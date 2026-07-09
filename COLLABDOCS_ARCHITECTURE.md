# CollabDocs: System Architecture, Microservices, and Deployment Guide

Welcome to the architectural specification and deployment log for **CollabDocs**—a real-time, collaborative document editing platform modeled after industry-grade systems like Google Docs. This document details the system design, tech stack selection, microservices patterns, API Gateway setup, and the solutions to the complex deployment hurdles resolved during the containerization process on Render.

---

## 1. System Topology & Architecture

```mermaid
graph TD
    Client["🌐 React Frontend (Vite)"]
    Gateway["🛡️ Nginx API Gateway (Port 8080)"]
    Auth["🔑 Auth Service (Port 5001)"]
    Doc["📄 Document Service (Port 5000)"]
    Notif["🔔 Notification Service (Port 3000)"]
    Firebase["🔥 Firebase Authentication & Firestore"]
    Redis["⚡ Upstash Redis (Pub/Sub & Cache)"]

    Client -->|HTTPS / WSS| Gateway
    Gateway -->|Proxy Pass| Auth
    Gateway -->|Proxy Pass| Doc
    
    Auth -->|Admin SDK| Firebase
    Auth -->|Token Blacklist| Redis
    
    Doc -->|Verify JWT| Firebase
    Doc -->|Save/Load YJS State| Firebase
    Doc -->|Scale WebSockets| Redis
    Doc -->|Publish Events| Redis
    
    Redis -->|Subscribe Events| Notif
```

---

## 2. Microservices Architecture: Why & How?

Unlike a monolithic application where the entire codebase is packaged into a single server, CollabDocs is split into specialized, self-contained **microservices**.

### Why Microservices?
1.  **Horizontal Scalability:** Collaborative editing is highly resource-intensive due to persistent WebSocket connections. In a monolith, scaling WebSockets would mean scaling the database connection pool, authentication logic, and background jobs unnecessarily. With microservices, we can scale the **Document Service** independently while keeping the **Auth Service** on minimal resources.
2.  **Fault Isolation:** If the background **Notification Service** crashes due to an email provider failure, users can still log in and edit documents. The rest of the system remains fully operational.
3.  **Technological Flexibility:** Different services can use optimized environments. For instance, the Gateway runs high-speed C-based Nginx, while the microservices run Node.js.

### Role of Each Service

#### 🛡️ API Gateway (Port 8080)
The single entry point for all frontend traffic. It intercepts requests, performs CORS preflights, and routes the traffic to the appropriate service. It handles SSL termination and upgrades HTTP requests to WebSockets (TCP).

#### 🔑 Auth Service (Port 5001)
Handles user onboarding, authentication, and session generation. It interacts with the Firebase Admin SDK to verify Google ID tokens, issues custom session JWTs, and manages token revocation (blacklist) during logout.

#### 📄 Document Service (Port 5000)
The core collaborative engine. It hosts the WebSocket server using `socket.io` and coordinates real-time text sync using Yjs (CRDTs). It loads document states from Firestore, merges concurrent edits, and periodically auto-saves back to Firestore.

#### 🔔 Notification Service (Port 3000)
An event-driven worker. It doesn't receive HTTP requests from the outside world. Instead, it runs in the background, listens to event brokers (Redis), and handles processing tasks like alerts or notifications out-of-band.

---

## 3. Tech Stack Deep Dive

### 🔑 Collaborative Engine: Yjs (CRDTs)
Traditional collaborative editing used **Operational Transformation (OT)** (used by Google Docs), which requires a centralized server to sequence every edit. CollabDocs uses **Conflict-free Replicated Data Types (CRDTs)** via the **Yjs** library. 
*   **How it works:** Edits are modeled as associative, commutative operations. This allows clients to apply edits locally in real-time, sync with other clients, and resolve conflicts mathematically without requiring a centralized, heavy sequencing server.

### 🛡️ Reverse Proxy & Routing: Nginx
Using Nginx as an API Gateway solves the **Single Ingress Port** requirement. 
*   **Why it's essential:** Browsers restrict cross-site requests. By putting Nginx at port `8080`, the frontend views the backend as a single domain. Nginx routes `/api/auth` to the Auth service and `/socket.io/` to the Document service seamlessly.
*   **Handshake Optimization:** Enables HTTP keep-alive connection reuse, eliminating the overhead of repeating TCP and SSL handshakes for every HTTP request.

### ⚡ Event Broker & Scaler: Redis
We use serverless **Upstash Redis** for two critical system design patterns:
1.  **WebSocket Horizontal Scaling (Pub/Sub Adapter):** WebSockets are stateful; a client connects to a specific server instance. If we run multiple instances of the Document Service, a user on Server 1 won't see edits from a user on Server 2. The Redis adapter links all Document Service instances via Pub/Sub. When Server 1 receives an edit, it broadcasts it to Redis, which relays it to Server 2 to update its connected clients.
2.  **Distributed Event Bus:** Acts as an asynchronous broker. The Document Service publishes events (e.g. `document.created`) to Redis, which the Notification Service subscribes to and processes in the background.

---

## 4. Complete End-to-End System Workflow

```
[ User Register ]  ──> Authenticates with Firebase via Frontend Client
                             │
[ User Login ]     ──> Frontend sends Firebase Token to Gateway (/api/auth/login)
                             │
                     Gateway proxies to Auth Service
                             │
                     Auth Service verifies token with Firebase Admin SDK,
                     generates a custom session JWT, and returns it as a
                     Secure, httpOnly, SameSite=None cookie
                             │
[ Open Document ]  ──> Frontend connects to WebSockets (/socket.io/)
                             │
                     Gateway upgrades connection to WebSocket (WSS) and
                     proxies to Document Service
                             │
                     Document Service reads JWT from Cookie, verifies session,
                     loads Yjs document state from Google Firestore, and
                     syncs the editor state with the client
                             │
[ Editing Doc ]    ──> Client types. Yjs updates are sent over WebSockets.
                     Document Service broadcasts changes to other users via Redis,
                     and schedules an asynchronous auto-save to Firestore
```

---

## 5. The Render Deployment & Troubleshooting Log

Deploying this multi-service stack to Render's Free tier required solving several real-world infrastructure and networking bugs:

### Challenge 1: The Firebase Private Key Decoder Error
*   **Issue:** The Firebase private key contains newline characters (`\n`). When pasted as an environment variable in a cloud service dashboard, these newlines get escaped as literal text characters (`\\n`). This breaks the PEM formatting, causing Node's OpenSSL engine to throw:
    `FirebaseAppError: Failed to parse private key: Error: error:1E08010C:DECODER routines::unsupported`
*   **Solution:** We added a custom formatter in the Firebase initialization script:
    ```javascript
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || "";
    const formattedPrivateKey = rawPrivateKey
      .replace(/^["']|["']$/g, "") // Strip surrounding quotes
      .replace(/\\n/g, "\n");     // Convert literal \n back to actual newlines
    ```
    We also switched the Docker base images from `node:20-alpine` to standard `node:20` to guarantee the availability of the complete Debian OpenSSL cryptography libraries.

### Challenge 2: Render Blueprint Environment Wiping
*   **Issue:** When services are managed using a Render Blueprint (`render.yaml`), pushing a new Git commit triggers a synchronization. During this sync, Render automatically resets the service configurations to match the YAML file. Any environment variables added manually via the Render web dashboard were instantly deleted, crashing the containers.
*   **Solution:** We declared the required secrets in `render.yaml` using the `sync: false` key. This instructs Render to prompt the user to input the values once during initial setup and then protect and persist those values across all future Git pushes.

### Challenge 3: Redis `rediss://` TLS Handshake Crashes
*   **Issue:** Upstash Redis requires secure connections via TLS (`rediss://`). The backend configuration originally verified connection strings using:
    `redisUrl.startsWith("redis://")`
    Because it didn't account for the extra `s` in `rediss://`, the parser failed, treated the entire connection string as a hostname, and threw a DNS `getaddrinfo ENOTFOUND` crash.
*   **Solution:** We updated all Redis parser statements to support both protocols:
    ```javascript
    redisUrl.startsWith("redis://") || redisUrl.startsWith("rediss://")
    ```

### Challenge 4: Nginx Gateway 502 Bad Gateway (SNI Mismatch)
*   **Issue:** To optimize performance, we grouped the backend proxies inside Nginx `upstream` blocks to enable keep-alive connection reuse. However, when proxying to an `upstream` block over HTTPS, Nginx defaults to using the name of the upstream block (`auth_backend` / `doc_backend`) as the Server Name Indication (SNI) host during the TLS handshake. Render's load balancer rejected these invalid hostnames, failing the SSL handshake and returning a `502 Bad Gateway`.
*   **Solution:** We added `proxy_ssl_name` directives to force Nginx to send the correct public host domain during the ClientHello handshake:
    ```nginx
    proxy_ssl_server_name on;
    proxy_ssl_name collabdocs-auth-service.onrender.com;
    ```

### Challenge 5: Cookie Blocking (CORS 401 Unauthorized)
*   **Issue:** Modern browsers treat `*.onrender.com` subdomains as separate top-level domains (because `onrender.com` is on the Public Suffix List). Therefore, cookie sharing between your frontend and gateway is treated as cross-site. Since the containers were running without `NODE_ENV` set to `"production"`, the auth cookie was created as `sameSite: "lax"` and `secure: false`, causing the browser to block the cookie from being sent on API requests.
*   **Solution:** We set `NODE_ENV: "production"` inside `render.yaml` for all Node services. This forces Express to write the cookie with `secure: true` and `sameSite: "none"`, allowing cross-subdomain authentication.

---

## 6. Performance Optimization Reference

1.  **Keep-Alive Pools:** Nginx maintains a persistent pool of 32 idle connections to the upstream microservices. This eliminates the 200ms–300ms TCP and TLS handshake overhead on subsequent API calls.
2.  **Native WebSockets Bypass:** The Socket.IO React client is forced to use `transports: ['websocket']`. This prevents Socket.IO from performing HTTP long-polling negotiation, saving multiple network round-trips during connection.
3.  **Preventing Cold Starts:** To keep the free tier containers warm and prevent Render's 50-second idle shutdown, set up a free uptime monitor (e.g., UptimeRobot) to ping the gateway and microservice URLs every 10 minutes.

---

## 7. API Reference & Network Contracts

Below is the interface specification for the HTTP endpoints exposed by the services.

### 🔑 Authentication Service (`collabdocs-auth-service`)

#### 1. Login User
Authenticates the user using a Firebase client token and sets a secure httpOnly cookie session.
*   **Endpoint:** `POST /api/auth/login`
*   **Headers:** `Content-Type: application/json`
*   **Request Body:**
    ```json
    {
      "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
    }
    ```
*   **Response (200 OK):**
    ```json
    {
      "uid": "user_firebase_uid_12345",
      "email": "user@example.com",
      "name": "Jane Doe"
    }
    ```
*   **Response Cookies Set:**
    `token=<jwt_id_token>; HttpOnly; Secure; SameSite=None; Max-Age=604800`

#### 2. Logout User
Revokes the session and blacklists the current JWT token in Redis.
*   **Endpoint:** `POST /api/auth/logout`
*   **Headers:** `Cookie: token=<jwt_id_token>`
*   **Response (200 OK):**
    ```json
    {
      "message": "Logged out"
    }
    ```

#### 3. Verify Protected Session
Checks if the current cookie session is still active and valid.
*   **Endpoint:** `GET /api/auth/protected`
*   **Headers:** `Cookie: token=<jwt_id_token>`
*   **Response (200 OK):**
    ```json
    {
      "message": "Access granted to protected route",
      "user": {
        "uid": "user_firebase_uid_12345",
        "email": "user@example.com",
        "name": "Jane Doe"
      }
    }
    ```
*   **Response (401 Unauthorized):**
    ```json
    {
      "error": "Unauthorized"
    }
    ```

### 📄 Document Service (`collabdocs-document-service`)

#### 1. Fetch All Documents
Lists all active documents the user has access to.
*   **Endpoint:** `GET /api/docs?all=true`
*   **Headers:** `Cookie: token=<jwt_id_token>`
*   **Response (200 OK):**
    ```json
    [
      {
        "id": "doc_id_9988",
        "title": "Project Architecture",
        "owner": "user_firebase_uid_12345",
        "createdAt": "2026-07-09T10:00:00Z"
      }
    ]
    ```

#### 2. Create Document
Creates a new blank document inside Firestore.
*   **Endpoint:** `POST /api/docs`
*   **Headers:** `Content-Type: application/json`, `Cookie: token=<jwt_id_token>`
*   **Request Body:**
    ```json
    {
      "title": "System Design Specs"
    }
    ```
*   **Response (201 Created):**
    ```json
    {
      "id": "new_doc_id_5544",
      "title": "System Design Specs",
      "owner": "user_firebase_uid_12345"
    }
    ```

---

## 8. WebSocket Protocol & Real-time Collaboration

Real-time collaboration is managed over WebSocket channels. The Document Service uses `socket.io` to transmit document updates and coordinate editor awareness (cursor positions/selections).

### WebSocket Lifecycle Events

#### 1. Join Document Room
Fired by the client immediately after establishing the WebSocket connection.
*   **Event:** `join-document`
*   **Payload:**
    ```json
    {
      "roomName": "document-new_doc_id_5544",
      "userInfo": {
        "name": "Jane Doe",
        "color": "#ff5733",
        "id": "unique_client_session_id"
      }
    }
    ```

#### 2. Synchronize Document State
Fired by the server to the client immediately after joining, containing the compiled base64-encoded Yjs state document.
*   **Event:** `document-state`
*   **Payload:**
    ```json
    {
      "content": "AQJncm91cAJ0aXRsZQ..."
    }
    ```

#### 3. Broadcast Document Update
Transmits incremental updates (characters typed, deletions, formatting changes) between clients.
*   **Event:** `update-document`
*   **Direction:** Bi-directional (Client $\rightarrow$ Server $\rightarrow$ Other Clients)
*   **Payload:** A raw Binary ArrayBuffer containing the Yjs incremental delta update.

#### 4. Awareness & Cursor Sync
Shares dynamic client states such as mouse selection ranges and cursor coordinates.
*   **Event:** `awareness-update`
*   **Direction:** Bi-directional (Client $\rightarrow$ Server $\rightarrow$ Other Clients)
*   **Payload:** Binary awareness state encoding.

---

## 9. Data Storage Models

### Google Firestore Schema

#### `documents` Collection
Stores the metadata and core binary editor states of all collaboration rooms.
*   **Document ID:** Unique alphanumeric string (`docId`).
*   **Fields:**
    *   `title` (string): Title of the document.
    *   `owner` (string): Firebase UID of the creator.
    *   `createdAt` (timestamp): Document creation time.
    *   `updatedAt` (timestamp): Last auto-save time.
    *   `yjsState` (string): Base64-encoded binary representation of the Yjs document state. This string is parsed and decoded back into a binary state whenever a new client joins the room.

### Upstash Redis Key Schema

Redis maintains two database states:
1.  **Blacklist Cache:** 
    *   **Key Format:** `blacklist:<jwt_token_string>`
    *   **Value:** `1`
    *   **Expiry (TTL):** Equal to the remaining lifetime of the JWT token (verified by verifying expiration times via `verifyIdToken`).
2.  **Socket.IO Adapter channels:**
    *   Managed natively by `@socket.io/redis-adapter` for broadcasting messages across scaled microservice instances.

---

## 10. Local Development & Setup Workflow

Follow these steps to run the entire microservices stack locally on your computer.

### Prerequisites
*   Node.js (v20+)
*   Docker Desktop
*   A Google Firebase Project (Authentication & Firestore enabled)

### Step 1: Clone the Environment Settings
Create a `.env` file in **`/backend`** (inside the root):
```env
PORT=5000
JWT_SECRET=local_development_jwt_secret_key_999
REDIS_URL=redis://localhost:6379

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBA...-----END PRIVATE KEY-----\n"
```

Create a `.env` file in **`/frontend`**:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_BACKEND_URL=http://localhost:8080
VITE_AUTH_URL=http://localhost:8080
```

### Step 2: Spin Up Local Services (Nginx & Redis)
Use Docker Compose to run Nginx (API Gateway) and a local Redis container:
```bash
# From the root directory
docker-compose up --build
```

### Step 3: Run Microservices Locally
Open separate terminal tabs to run each Node service:
```bash
# Tab 1: Auth Service
cd backend/services/auth-service
npm install
npm run dev

# Tab 2: Document Service
cd backend/services/document-service
npm install
npm run dev

# Tab 3: Notification Service
cd backend/services/notification-service
npm install
npm run dev
```

### Step 4: Run Frontend Client
In a final terminal tab:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to test the collaborative suite locally!

---

## 11. Core Code Logic Explanations

### Offline-First Collaboration (`useYjsProvider.js`)
CollabDocs uses an **offline-first** design by combining **IndexedDB** (local browser database) and **WebSockets** (Document Service).

1.  **IndexedDB Sync:** When the client opens a document, Yjs immediately loads the historical document state from IndexedDB. The editor is loaded instantly without waiting for network connections.
2.  **WebSocket Sync:** Once connected, the client compares its local state vector with the server's state vector, resolves changes using CRDT rules, saves the merged state to IndexedDB, and updates the editor.

### Custom EventBus Broker (`eventBus.js`)
To decouple services, the **Document Service** publishes events to a Redis channel, and the **Notification Service** subscribes to it.

*   **Publishing in Document Service:**
    ```javascript
    async publish(event, data) {
      if (this.isRedisConnected && this.redisClient) {
        const payload = JSON.stringify({ event, data });
        await this.redisClient.publish("collabdocs-events", payload);
      } else {
        this.emitter.emit(event, data); // Fallback to local memory emitter
      }
    }
    ```
*   **Subscribing in Notification Service:**
    ```javascript
    await this.redisSubscriber.subscribe("collabdocs-events", (message) => {
      const { event, data } = JSON.parse(message);
      this.emitter.emit(event, data); // Triggers corresponding notification handler
    });
    ```
