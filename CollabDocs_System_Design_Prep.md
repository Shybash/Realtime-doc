# CollabDocs: Principal System Design & Elite Interview Prep Guide

> **Author Perspective:** 15-Year Veteran Technical Recruiter & Principal Systems Architect
> **Target Audience:** Associate to Mid/Senior Software Engineering Candidates
> **Objective:** Translate your project into high-impact systems architectural terminology to survive rigorous technical screens at companies like Netflix, Stripe, Google, and Slack.

---

## 1. Architectural Blueprint (High-Level Overview)

```
                                    ┌────────────────────────┐
                                    │   React Vite Client    │
                                    │ (Port 5173 / Nginx SPA)│
                                    └───────────┬────────────┘
                                                │
                                                ▼ (HTTP/1.1 & WebSockets)
  ┌───────────────────────────────────────────────────────────────────────────────────────────┐
  │                           NGINX API GATEWAY (Host Port 8080)                              │
  ├───────────────────────────────────────────────────────────────────────────────────────────┤
  │   - Acts as single entrypoint for client traffic                                          │
  │   - Handles WebSocket Upgrades (Upgrade/Connection headers)                               │
  │   - Routes requests path-wise: /api/auth -> Auth, /api/docs & /socket.io -> Document      │
  └─────────────┬───────────────────────────────┬─────────────────────────────────────────────┘
                │ (/api/auth)                   │ (/api/docs, /graphql, /socket.io)
                ▼                               ▼
  ┌───────────────────────────┐   ┌───────────────────────────┐
  │       AUTH SERVICE        │   │     DOCUMENT SERVICE      │
  │        (Port 5001)        │   │        (Port 5000)        │
  ├───────────────────────────┤   ├───────────────────────────┤
  │ - Firebase JWT validation │   │ - GraphQL API (Apollo)    │
  │ - Cookie-session manager  │   │ - Document CRUD & History │
  │ - Redis Token Blacklisting│   │ - Yjs Real-Time Room Mgr  │
  └─────────────┬─────────────┘   └─────────────┬─────────────┘
                │                               │
                │ (Revoke JWT)                  │ (Publish Events)
                ▼                               ▼
  ┌───────────────────────────────────────────────────────────────────────────────────────────┐
  │                            REDIS MESSAGE BROKER & MEMORY ADAPTER                          │
  ├───────────────────────────────────────────────────────────────────────────────────────────┤
  │   1. Pub/Sub Broker: Decoupled messaging for microservice events (collabdocs-events)      │
  │   2. Socket.IO Adapter: Syncs WebSocket state across document service cluster nodes       │
  │   3. Security Store: Fast key-value memory mapping for blacklisted JWTs (TTL expiration)   │
  └─────────────────────────────────────────────▲─────────────────────────────────────────────┘
                                                │
                                                │ (Consume Events)
                                                ▼
                                  ┌───────────────────────────┐
                                  │   NOTIFICATION SERVICE    │
                                  │    (Background Daemon)    │
                                  ├───────────────────────────┤
                                  │ - Decoupled Email Alert   │
                                  │   (SMTP via Nodemailer)   │
                                  │ - Event Audit Logger      │
                                  └───────────────────────────┘
```

---

## 2. End-to-End System Workflows

### A. The Real-Time Character Stroke Workflow
How a single letter typed by "User A" reaches "User B" and is persisted:
1.  **Client Stroke:** User A types a character in the Tiptap text editor.
2.  **Yjs Delta Generation:** The local Yjs document engine (`useYjsProvider.js`) captures the insert operation and generates a binary delta update package.
3.  **WebSocket Dispatch:** The delta update is wrapped in a Yjs protocol packet and sent over the WebSocket connection.
4.  **Gateway Routing:** The packet hits the **Nginx API Gateway (Port 8080)** on path `/socket.io/`. Nginx inspects the HTTP Upgrade headers, maintains the TCP connection, and forwards it to the **Document Service (Port 5000)**.
5.  **Room Synchronization:** The Document Service applies the binary update to its in-memory Yjs Document (`getYDoc`). It then:
    *   Broadcasts the binary update to all other WebSocket connections in that document room.
    *   If scaled horizontally, the **Socket.IO Redis Adapter** publishes the update to the Redis broker, ensuring instances on other servers broadcast it to their local users.
6.  **UI Render:** User B's client receives the update, Yjs merges the delta using CRDT rules (Conflict-Free Replicated Data Types), and the cursor reflects the change in real-time with no merge conflicts.
7.  **Debounced Persistence:** Every 60 seconds (or upon room closure), the Document Service's auto-save loop flushes the document's state as a base64 encoded binary RDB snapshot to **Cloud Firestore**.

### B. The Real-Time Comment & Notification Workflow
How a comment triggers background actions:
1.  **Comment Submission:** A user submits a comment. The React frontend posts a payload to `http://localhost:8080/api/docs/:id/comments`.
2.  **Authentication & Security Gate:** 
    *   The API Gateway forwards the request to the Document Service.
    *   The verification middleware (`auth.js`) checks if the session token cookie is valid and queries Redis to ensure it isn't blacklisted.
    *   The role middleware (`documentRole.js`) queries Firestore to verify the user has a `commenter`, `editor`, or `admin` role.
3.  **Database Commit:** The Document Service writes the comment to the document's sub-collection in Firestore and returns a 201 response.
4.  **Socket Broadcast:** The Document Service instantly emits `comment-added` via WebSockets to all clients in the document room. The sidebar on other users' screens appends the comment instantly, eliminating HTTP polling.
5.  **Asynchronous Event Broadcast:** The Document Service publishes an event payload `{ event: 'comment.created', data: { ... } }` to the Redis broker channel.
6.  **Background Notification:** The **Notification Service** (listening to Redis) receives the event, creates a secure SMTP connection to **Ethereal Mail**, sends a styled HTML notification, and prints a clickable test mail sandbox link to the console.

---

## 3. Technology Stack & Trade-offs (The "Why" vs. "Why Not")

### A. Real-Time Sync: Yjs (CRDT) vs. ShareDB (OT)
*   **What we used:** **Yjs** (Conflict-Free Replicated Data Types - CRDT)
*   **Why we used it:** Yjs is a high-performance, decentralized CRDT library. It resolves conflicts mathematically without requiring a centralized coordinator. This enables instant offline editing (backed by browser IndexedDB) because conflicts can be merged automatically when the user reconnects.
*   **Why NOT Operational Transformation (OT) (e.g., ShareDB, Google Docs):** OT requires a single, central server to sequence and transform every operation. It is extremely complex to implement, does not support true offline peer-to-peer editing, and introduces a single point of failure. If the central server is slow, the entire typing experience lags.

### B. Messaging & Sockets Cluster: Redis vs. RabbitMQ
*   **What we used:** **Redis**
*   **Why we used it:** We chose Redis because of **Architectural Lean-ness**. Socket.IO requires Redis to scale horizontally (via the `@socket.io/redis-adapter` pub/sub broker). Since Redis is already running in our stack, we reused its Pub/Sub engine to act as our microservices EventBus and its memory store to handle blacklist lookups.
*   **Why NOT RabbitMQ:** While RabbitMQ has advanced routing features, we do not need complex exchanges or dead-letter queues. Running RabbitMQ would require spinning up a separate, resource-heavy Erlang-based container, doubling our cloud hosting bills and configuration complexity for zero extra benefit.

### C. Database: Firestore Admin SDK vs. Client SDK
*   **What we used:** **Firebase Admin SDK (Node.js)**
*   **Why we used it:** By routing database requests through our Document Service using the Admin SDK, we run database operations on secure, backend server threads. This allows us to perform custom validation, business logic, role-based access control, and EventBus dispatches *before* writing to the database.
*   **Why NOT Firebase Client SDK directly:** If the frontend writes directly to Firestore, you must write complex Firestore Security Rules in their proprietary language. It makes role-based access difficult to maintain, exposes database schemas, and prevents you from triggering backend events (like audit logging and email notifications) when changes occur.

### D. Session Security: Stateless JWT with Redis Blacklist vs. Stateful Sessions
*   **What we used:** **Stateless JWTs in HttpOnly Cookies + Redis Blacklist**
*   **Why we used it:** JWTs in HttpOnly cookies protect against Cross-Site Scripting (XSS) and require no database reads to verify a user on each request, making our microservices highly performant. The Redis blacklist solves the major drawback of stateless JWTs (inability to revoke a token immediately on logout) by storing revoked tokens with a Time-To-Live (TTL) expiration matching the JWT's lifespan.
*   **Why NOT Stateful Sessions (Database-backed):** Stateful sessions require the server to query a database (like MySQL or MongoDB) on every single API request to verify the session. This creates a massive database bottleneck and limits horizontal scaling.

---

## 4. Systems Design & DevOps Patterns

### A. Session Affinity (Sticky Sessions)
*   **The Concept:** WebSockets are stateful, persistent TCP connections. Once a client connects to a server pod, they must stay connected to that specific pod. If a load balancer randomly routes WebSocket traffic to different pods, the connection will constantly break.
*   **How we solved it:** In our Kubernetes configs (`/k8s`), we configured the Nginx Ingress Controller with cookie-based session stickiness annotations:
    ```yaml
    nginx.ingress.kubernetes.io/affinity: "cookie"
    ```
    This ensures that once a client establishes a WebSocket connection, they are pinned to the same Document Service container instance.

### B. API Gateway pattern
*   **The Concept:** A client should not have to manage multiple connection ports or know the internal structure of your backend network.
*   **How we solved it:** We created an **Nginx API Gateway** running on port `8080`. The client makes all calls to `localhost:8080`. The Gateway forwards traffic based on path rules and upgrades WebSocket protocols, hiding ports `5000` and `5001` from the public.

---

## 5. Elite Interview Preparation: "Grill Sessions"

Here are 5 tough questions a senior interviewer or architect will throw at you, along with the strategic answers you should give:

#### Q1: "Your document auto-saves every 60 seconds. What happens if a server container crashes while 10 users are actively typing? Is their work lost?"
> **Candidate Answer:** *"No work is lost. We designed the collaboration stack to be offline-first and resilient. We use **y-indexeddb** in the browser. When a user types, their changes are saved instantly to the local browser IndexedDB database. If the server crashes, the clients will attempt to reconnect. When a new Document Service instance spins up, the client sends its local Yjs state delta, which is merged seamlessly on the server using CRDT mathematical rules. The data is then saved back to Firestore during the next auto-save loop."*

#### Q2: "Why did you split the Auth and Document services into microservices, but keep them connecting to the same Firestore database instance?"
> **Candidate Answer:** *"For our development sandbox and MVP stage, sharing the Firestore instance keeps infrastructure costs low. However, in a strict production microservices pattern, we enforce **Database-per-Service**. The Auth Service would only manage authentication credentials (using Firebase Auth), and the Document Service would have its own Firestore instance. Communication between them is kept decoupled: the Document Service queries user metadata asynchronously using the Auth Service's REST API (`/api/auth/user-info`), and never queries the user database directly."*

#### Q3: "You are using Redis Pub/Sub for your EventBus. What happens if your Notification Service goes offline for 10 minutes? Do users lose their email notifications?"
> **Candidate Answer:** *"With Redis Pub/Sub, yes, because it is a fire-and-forget broadcaster with no message persistence. If a service is offline, it misses the events. For notifications, this is acceptable for an MVP. However, to make this enterprise-ready, we would replace raw Redis Pub/Sub with **BullMQ** (which uses Redis Lists under the hood) or **RabbitMQ**. This would give us message persistence, acknowledged delivery, and automatic retries, ensuring that if the notification worker crashes, it will process the accumulated queue once it restarts."*

#### Q4: "WebSockets are stateful, but HTTP is stateless. How do your microservices validate JWT cookies on Socket.IO connection requests?"
> **Candidate Answer:** *"In our Document Service `server.js`, we hook into Socket.IO's connection handshake. Since the browser automatically attaches cookies to WebSocket HTTP upgrade requests, we extract the `token` cookie during the handshake, query the Redis blacklist to ensure the user hasn't logged out, and verify the Firebase JWT. If validation fails, we reject the connection request immediately at the gate, preventing unauthorized WebSocket traffic."*

#### Q5: "Nginx is acting as your API Gateway. What happens if your Nginx container crashes? How do you prevent it from being a single point of failure?"
> **Candidate Answer:** *"In a local Docker Compose setup, Nginx is a single point of failure. However, when we deploy to production using our Kubernetes manifests (`/k8s`), the API Gateway is deployed as an **Nginx Ingress Controller** managed by Kubernetes. Kubernetes automatically runs multiple replicas of the Ingress Controller behind a Cloud Load Balancer (like AWS ALB), automatically replacing any crashed Ingress pods with no downtime."*
