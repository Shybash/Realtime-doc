# CollabDocs

CollabDocs is a production-grade, real-time collaborative document editing platform modeled after Google Docs. Built on a containerized microservices architecture, it leverages Conflict-free Replicated Data Types (CRDTs) to enable seamless, conflict-free collaborative editing with low latency.

---

## 🚀 Key Features

*   **Real-time Collaboration:** Multiple users can edit documents simultaneously with real-time character sync, remote selection tracking, and cursor presence.
*   **Conflict-free Text Sync:** Utilizes **Yjs** (CRDTs) for offline-first, mathematical text resolution, preventing edit conflicts.
*   **Secure Session Management:** Custom JSON Web Token (JWT) session generation, stored securely inside HTTP-only, secure, cross-site cookies.
*   **Scalable Architecture:** Built with independent microservices coordinated by a central API Gateway and scaled horizontally using a Redis Pub/Sub adapter.
*   **Asynchronous Processing:** Event-driven communication publishes document lifecycle events to a Redis Event Bus for background task processing.

---

## 🛠️ Tech Stack & Architecture

*   **Frontend:** React, Vite, Yjs (CRDTs), Socket.IO Client.
*   **API Gateway:** Nginx (routing, SSL termination, keep-alive connections).
*   **Microservices:** Express.js (Node.js runtime), Firebase Admin SDK.
*   **Databases:** Google Cloud Firestore (document persistence), Upstash Redis (WebSockets adapter, event broker, session blacklist cache).
*   **Containerization:** Docker (unified development & production environments).

---

## 💻 Local Development Setup

### Prerequisites
*   Node.js (v20+)
*   Docker Desktop
*   A Google Firebase account with Authentication and Firestore enabled.

### 1. Configuration Setup
Create a `.env` file in `/backend` (root level):
```env
PORT=5000
JWT_SECRET=your_local_jwt_secret_key
REDIS_URL=redis://localhost:6379

FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBA...-----END PRIVATE KEY-----\n"
```

Create a `.env` file in `/frontend`:
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

### 2. Start Gateway and Broker Services
Use Docker Compose to run the API Gateway (Nginx) and the Redis instance:
```bash
docker-compose up --build
```

### 3. Start Backend Microservices
Open separate terminal instances for each service:
```bash
# Start Auth Service
cd backend/services/auth-service
npm install && npm run dev

# Start Document Service
cd backend/services/document-service
npm install && npm run dev

# Start Notification Service
cd backend/services/notification-service
npm install && npm run dev
```

### 4. Start Frontend Client
In a separate terminal instance:
```bash
cd frontend
npm install && npm run dev
```
Open `http://localhost:5173` to access the local application.

---

## 📦 Deployment

The application is fully configured for deployment in containerized environments. It includes:
*   Standardized multi-stage **Dockerfiles** for Node.js runtime compatibility.
*   A **Render Blueprint** (`render.yaml`) mapping the gateway, static assets, and Node services with environment parameters.
