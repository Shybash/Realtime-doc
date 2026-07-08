# CollabDocs — Complete Project Interview Guide

> **Project Name:** CollabDocs (Real-Time Collaborative Document Editor)
> **Type:** Full-Stack Web Application
> **Inspired by:** Notion / Google Docs

---

## 1. Project Overview — The 60-Second Pitch

CollabDocs is a **real-time collaborative document editor** built as a full-stack web application. Multiple users can open the same document simultaneously and see each other's changes instantly — just like Google Docs or Notion.

**Core capabilities:**
- ✅ Real-time multi-user editing with live cursors showing who is typing where
- ✅ Rich text formatting — bold, italic, headings, bullet lists, numbered lists, tables, code blocks, task lists
- ✅ Slash `/` command menu (like Notion) to insert blocks quickly
- ✅ Document covers with emojis and cover images
- ✅ Role-based access control — Admin, Editor, Commenter, Viewer
- ✅ Shareable links with configurable permission levels
- ✅ Inline comments anchored to selected text
- ✅ Version history with named snapshots and one-click restore
- ✅ Dark mode with full theme support
- ✅ Command palette (Ctrl+K) for quick navigation
- ✅ Firebase Authentication (Email/Password)
- ✅ Deployed on Render (backend) + Vite static hosting (frontend)

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                  │
│                                                                 │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────────────┐   │
│  │  Auth    │  │  Document   │  │  Tiptap Editor           │   │
│  │  (Firebase│  │  List / UI  │  │  (ProseMirror based)     │   │
│  │   SDK)   │  │             │  │  + Yjs CRDT              │   │
│  └──────────┘  └─────────────┘  └──────────────────────────┘   │
│                                          │                       │
│                          Socket.IO Client (WebSocket)           │
└─────────────────────────────────────────────────────────────────┘
                                  │
                    WebSocket (Socket.IO)  +  REST API (Axios)
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Node.js + Express)                 │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │
│  │  Auth Routes│  │  Doc Routes │  │  Comment Routes        │  │
│  │  /api/auth  │  │  /api/docs  │  │  /api/docs/:id/comments│  │
│  └─────────────┘  └─────────────┘  └────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Socket.IO Server — manages Yjs document rooms          │    │
│  │  Stores Yjs binary state in Firestore on disconnect     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─────────────────────┐   ┌──────────────────────────────┐    │
│  │  Firebase Admin SDK │   │  JWT middleware (httpOnly     │    │
│  │  (Firestore + Auth) │   │  cookie-based sessions)      │    │
│  └─────────────────────┘   └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────┐
│                      FIREBASE (Google Cloud)                    │
│                                                                 │
│   Firestore Database           Firebase Authentication          │
│   ├── /documents/{id}          Email/Password provider          │
│   │   ├── yjsState (base64)                                     │
│   │   ├── title, content                                        │
│   │   ├── permissions[]                                         │
│   │   ├── allowedUsers[]                                        │
│   │   ├── /comments/{id}                                        │
│   │   └── /versions/{id}                                        │
│   └── (no other top-level collections)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack — With Full Justification

### 3.1 Frontend

#### ⚛️ React 19 + Vite
**What:** UI library + build tool
**Why React:**
- Component-based architecture makes it easy to split document editor, sidebar, toolbar, modals into isolated, reusable units
- Huge ecosystem — Tiptap, Framer Motion, react-hot-toast all have first-class React support
- Virtual DOM efficiently handles the high-frequency re-renders caused by real-time Yjs state changes

**Why Vite over Create React App / Webpack:**
- Vite uses native ES modules (no bundling in dev), giving **instant HMR** — critical when iterating on complex editor UI
- Build times are 10-20x faster than Webpack
- Zero config for TypeScript, JSX, CSS modules

**Why NOT Next.js:**
- This is a **client-heavy SPA** — server-side rendering is not needed and would complicate the real-time WebSocket setup
- Vite gives all the speed benefits without SSR overhead

---

#### 📝 Tiptap (on top of ProseMirror)
**What:** Rich-text editor framework
**Why Tiptap:**
- Built on **ProseMirror** — the same engine used by Notion, Atlassian, and the New York Times
- Has first-class Yjs integration via `@tiptap/extension-collaboration` — this is the key reason
- Extremely extensible — we added custom extensions like `CommentMark` (inline comment highlights) and `SlashCommands` (Notion-style `/` menu)
- Supports all required formatting: bold, italic, headings, bullet lists, numbered lists, task lists, tables, code blocks

**Why NOT Quill or Draft.js:**
- Quill has no Yjs integration — would require complete custom CRDT wiring
- Draft.js is Facebook-internal, less maintained, no built-in collaboration support
- Slate.js — no official Yjs binding either, and complex state management

---

#### 🔄 Yjs (CRDT)
**What:** Conflict-free Replicated Data Type library
**Why Yjs:**
- CRDT (Conflict-free Replicated Data Type) = when two users edit the same spot at the same time, **both edits are preserved without conflicts**, and the final state is the same on all clients
- This is mathematically guaranteed convergence — no "last write wins" that loses data
- Yjs specifically uses the **YATA algorithm** which is optimised for text editing
- Binary encoded — very compact, efficient over WebSocket

**Why CRDTs over Operational Transforms (OT):**
- Google Docs uses OT — but OT requires a **central server** to transform operations in the correct order. If the server is down, editing stops
- CRDTs are **peer-to-peer capable** — clients can sync directly and merge later
- Yjs is the most mature JavaScript CRDT library with Tiptap integration built in

---

#### 🔌 Socket.IO (WebSocket)
**What:** Real-time bidirectional communication
**Why Socket.IO over raw WebSocket:**
- **Automatic reconnection** — if a user's network drops, Socket.IO reconnects and re-syncs the Yjs document state
- **Room management** — built-in `socket.join('document-abc123')` broadcasts only to users in that document
- **Fallback to HTTP long-polling** if WebSocket is blocked (corporate firewalls)
- Built-in event acknowledgements, namespaces, and middleware

**Why NOT Firebase Realtime Database for sync:**
- Firebase Realtime Database stores JSON, not binary CRDT state
- Cannot store Yjs binary diffs natively
- We'd lose the CRDT conflict-resolution properties — back to "last write wins"

---

#### 🎨 Tailwind CSS v4
**What:** Utility-first CSS framework
**Why Tailwind:**
- Consistent design system without naming CSS classes manually
- Dark mode with `dark:` variants — single source of truth for theming
- Zero unused CSS in production (purges unused utility classes at build time)
- `@tailwindcss/vite` plugin gives fast builds

---

#### 🎞️ Framer Motion
**What:** Animation library
**Why:** Smooth micro-animations on modals (scale-in, fade-in), page transitions, and interactive elements give the app a premium feel. Declarative animation API fits React's component model.

---

### 3.2 Backend

#### 🟢 Node.js + Express
**What:** JavaScript runtime + web framework
**Why Node.js:**
- **Same language as frontend** — team doesn't need to context-switch between Python/Java
- **Event-driven, non-blocking I/O** — ideal for WebSocket connections where thousands of clients can be held open with low memory overhead (no thread-per-connection like Java)
- Socket.IO is a Node.js library — native integration

**Why Express over Fastify / NestJS:**
- Express is minimal and widely understood — fast to build with
- Middleware ecosystem (cors, helmet, cookie-parser, express-rate-limit) is battle-tested
- NestJS would add unnecessary boilerplate for a project of this scale

---

#### 🔐 Firebase Admin SDK
**What:** Server-side Firebase library
**Why:** 
- Verifies Firebase ID tokens (`admin.auth().verifyIdToken(idToken)`) — this is the bridge between Firebase's client-side auth and our custom backend
- Full Firestore access with **no security rules restrictions** — the Admin SDK uses a service account with full read/write, so our backend owns all data access
- This is the correct pattern — never expose database credentials in the frontend

---

#### 🔒 JWT via httpOnly Cookie
**What:** Session management
**Why httpOnly cookies over localStorage:**
- `localStorage` is accessible by JavaScript — vulnerable to **XSS attacks**. If a malicious script runs on the page, it can steal the token
- `httpOnly` cookies are **never readable by JavaScript** — the browser sends them automatically on every request
- `SameSite: lax` (dev) / `SameSite: none; Secure` (production) prevents **CSRF attacks**

---

#### 🛡️ Helmet + Rate Limiting
**Why Helmet:** Sets HTTP security headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.) — one-line security hardening
**Why Rate Limiting:** Prevents brute-force attacks on `/api/auth/login`. Auth endpoints are limited to 20 requests per 15 minutes per IP.

---

### 3.3 Database

#### 🔥 Firebase Firestore
**What:** NoSQL document database
**Why Firestore:**
- **Schemaless** — each document can have different fields. Adding version history, comments, emojis, cover images required zero migration
- **Subcollections** — natural fit for `documents/{id}/comments` and `documents/{id}/versions` hierarchies
- **Managed** — no infrastructure to provision, auto-scales
- Firebase Admin SDK gives server-side access we fully control

**Why NOT PostgreSQL / MySQL:**
- Relational schema would require ALTER TABLE migrations for every new feature
- Running a separate DB server adds infra complexity (Render PostgreSQL, connection pooling, etc.)
- For a document editor where each doc is a blob of content + metadata, document DB is natural

**Why NOT MongoDB:**
- Firestore is already in the Firebase ecosystem alongside Firebase Auth — one platform, one billing account, one console
- Firestore has strong consistency and ACID transactions at the document level
- No self-hosting required

---

#### 🔑 Firebase Authentication
**What:** Identity management
**Why Firebase Auth:**
- Handles email verification, password hashing, secure token generation — we don't reinvent security
- ID tokens are short-lived (1 hour) JWTs signed by Google — our backend verifies them without storing any passwords
- Easy to extend with Google OAuth, phone auth in the future

---

### 3.4 Deployment

#### ☁️ Render (Backend)
**Why Render over Heroku:**
- Heroku removed its free tier in 2022 — Render has a free tier for web services
- Zero-config deployments from Git — push to main, Render auto-deploys
- WebSocket support is native (Heroku required special configuration)
- Environment variables managed in Render dashboard → maps to `render.yaml`

#### ⚡ Vite Static Build (Frontend)
- `npm run build` produces a static `dist/` folder
- Can be hosted on Render Static Sites, Vercel, Netlify, or any CDN
- No server needed — pure HTML/CSS/JS

---

## 4. Key Feature Deep Dives

### 4.1 Real-Time Collaboration Flow

```
User A types → Tiptap onChange → Yjs encodes binary diff
    → Socket.IO emits "yjs-update" to server
    → Server applies update to in-memory Y.Doc
    → Server broadcasts to all other clients in the room
    → User B's Yjs applies the diff → Tiptap re-renders
```

**On disconnect:**
```
Socket disconnect → Server calls saveYDocToFirestore()
    → encodeStateAsUpdate() → base64 → Firestore { yjsState }
    → Next user connects → loadYDocFromFirestore() → applyUpdate() → in sync
```

### 4.2 Authentication Flow

```
User submits email/password
    → Firebase Client SDK: signInWithEmailAndPassword()
    → Firebase returns: ID Token (JWT, 1hr expiry)
    → Frontend POST /api/auth/login { idToken }
    → Backend: admin.auth().verifyIdToken(idToken) ✓
    → Backend sets httpOnly cookie { token: idToken }
    → All subsequent requests send cookie automatically
    → Backend middleware verifies cookie on every protected route
```

### 4.3 Role-Based Access Control

| Role | Read | Edit | Comment | Manage Permissions | Delete |
|---|---|---|---|---|---|
| Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ | ❌ | ❌ |
| Commenter | ✅ | ❌ | ✅ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ✅ | ❌ | ❌ |

Each document stores:
```json
{
  "permissions": [{ "userId": "abc", "role": "admin" }],
  "allowedUsers": ["abc", "def"]
}
```
`allowedUsers` enables efficient Firestore queries (`array-contains`).

### 4.4 Version History

- Admin/Editor can create named snapshots at any point
- Snapshot stores: `yjsState` (binary), `content` (HTML), `createdAt`, `createdBy`
- Restore: replaces main document's `yjsState` + evicts in-memory room → broadcasts `document-restored` via Socket.IO → all clients reload

### 4.5 Shareable Links

- Admin generates a token (`nanoid(16)`) stored in the document
- Anyone with the link visits `/documents/:id?token=TOKEN`
- Backend validates token → returns document with permission level (viewer/commenter/editor)
- No Firebase account required for shared access

---

## 5. Interview Q&A

### 🔄 Real-Time & WebSocket Questions

**Q1: How does real-time collaboration work in your project?**

> We use **Yjs** — a CRDT (Conflict-free Replicated Data Type) library — combined with **Socket.IO** WebSockets. When a user types, Tiptap editor triggers an `onUpdate` event. Yjs encodes the change as a compact binary diff. Socket.IO emits this diff to the backend server, which applies it to the in-memory `Y.Doc` and broadcasts it to all other connected clients in the same document room. Each client applies the diff to their local Yjs document, which triggers Tiptap to re-render the editor. This all happens in milliseconds.

---

**Q2: What is a CRDT and why did you use it instead of Operational Transforms?**

> A CRDT (Conflict-free Replicated Data Type) is a data structure where **concurrent edits from multiple sources always converge to the same final state automatically**, with no conflict resolution needed. It's mathematically guaranteed. 
>
> Operational Transforms (OT) — used by Google Docs — also solve concurrent edits, but require a **central server** that transforms operations before applying them. If the server is unavailable, editing stops. CRDTs work without a central coordinator — clients can even sync peer-to-peer. Yjs uses the YATA algorithm optimized for text, and it integrates directly with Tiptap's ProseMirror data model.

---

**Q3: How do you persist the document state? What happens when no users are in a document?**

> Yjs documents are held in server memory in a `Map` called `docs`. Each entry has a `Y.Doc`, an `Awareness` object (for live cursor positions), and a `Set` of connected socket IDs. When the last user disconnects from a document room, we call `saveYDocToFirestore()` — this encodes the current Yjs state as a binary `Uint8Array`, converts it to base64, and stores it in Firestore under the `yjsState` field. When a new user opens the document later, we call `loadYDocFromFirestore()` which reads the base64, decodes it back to binary, and applies it to a fresh `Y.Doc` using `applyUpdate()`.

---

**Q4: Why did you choose Socket.IO over the native WebSocket API?**

> Socket.IO adds important features on top of raw WebSockets:
> 1. **Automatic reconnection** — if the network drops, Socket.IO re-establishes the connection and re-joins the document room, which re-syncs the Yjs state
> 2. **Room management** — `socket.join('document-abc')` and `socket.to('document-abc').emit()` broadcast only to users in that specific document
> 3. **HTTP long-polling fallback** for environments where WebSocket is blocked (e.g. corporate proxies)
> 4. **Event-based API** — cleaner `socket.on('yjs-update')` vs manual WebSocket message parsing

---

**Q5: What is the Awareness protocol and what do you use it for?**

> Awareness is a Yjs feature for **ephemeral (non-document) state** — information that doesn't need to be persisted. We use it for **live user cursors** — each user's name, color, and cursor position in the editor. When a user moves their cursor, Awareness broadcasts the update to all others in the room. They see colored cursor indicators with the user's name floating above. This state is lost when the user disconnects, which is correct — we don't want to save cursor positions to the database.

---

### 🔐 Authentication & Security Questions

**Q6: How does authentication work? Why use Firebase Auth with your own backend?**

> Firebase Auth handles the **identity verification** — it securely validates the email/password and returns a signed JWT ID token (valid 1 hour). Our Express backend then **verifies that token** using the Firebase Admin SDK (`admin.auth().verifyIdToken()`). On success, we store the token in an **httpOnly cookie** and use it for all subsequent requests. 
>
> This pattern gives us the best of both worlds — Firebase handles password hashing, account management, and token signing (hard security problems) while our backend owns **authorization** (which user can do what) through our custom role-based permissions system.

---

**Q7: Why httpOnly cookies instead of storing the JWT in localStorage?**

> `localStorage` is accessible to any JavaScript running on the page. If there's an **XSS (Cross-Site Scripting)** vulnerability — even from a third-party library — an attacker can run `localStorage.getItem('token')` and steal the session. 
>
> `httpOnly` cookies are **never accessible to JavaScript** — the browser sends them automatically on every request but no script can read them. We also set `SameSite: lax` in development and `SameSite: none; Secure` in production to mitigate **CSRF (Cross-Site Request Forgery)** attacks.

---

**Q8: What is the `auth/invalid-credential` error from Firebase and how did you handle it?**

> This is Firebase's **unified error code** for both "wrong password" and "email doesn't exist". Firebase deliberately uses one code for both cases to prevent **account enumeration** — if we told attackers "this email doesn't exist", they could probe our database to discover which emails are registered. 
>
> We handled it by building a `firebaseErrors.js` utility that maps raw Firebase error codes to friendly, actionable messages. For `auth/invalid-credential`, we show: *"Incorrect email or password. If you don't have an account, please click Create one now."*

---

**Q9: How did you secure the comments feature against unauthorized access?**

> There were two security issues we identified and fixed:
>
> 1. **Frontend direct Firestore access** — the CommentSidebar was originally using the Firebase client SDK's `onSnapshot()` to read comments directly from Firestore. This fails if Firestore Security Rules don't explicitly allow it, and also bypasses our role-based permission system. We replaced it with polling via our backend API (`GET /docs/:docId/comments`), which uses the Admin SDK (no security rules restrictions) and runs our role checks first.
>
> 2. **Missing role authorization on comment routes** — the comment API routes only checked if the user was logged in, but not if they had access to that specific document. We added a `requireCommentRole` middleware that reads the document's `permissions` array and verifies the user's role before allowing read/write.

---

### 🏗️ Architecture & Design Questions

**Q10: How does the role-based access control system work?**

> Each document has a `permissions` array in Firestore: `[{ userId: "uid1", role: "admin" }, { userId: "uid2", role: "editor" }]`. There's also an `allowedUsers` array (just the UIDs) that enables efficient Firestore queries using `array-contains`. 
>
> On the backend, a `requireDocumentRole(allowedRoles)` middleware reads the document from Firestore, finds the current user's role in the permissions array, and checks if it's in the allowed roles list. If not, it returns 403. This middleware is applied to every document route.

---

**Q11: How does the version history feature work?**

> When a user creates a version snapshot, the backend checks if the document is currently active in server memory (someone is editing it). If yes, it reads the live Yjs state directly from `Y.Doc` in memory — this is more accurate than what's in Firestore because writes are only persisted on disconnect. If no one is editing, it reads from Firestore. The snapshot is stored as a subcollection `documents/{id}/versions/{versionId}` with the Yjs binary state, HTML content, timestamp, and creator's email.
>
> To restore, we overwrite the main document's `yjsState` with the version's, delete the in-memory room so it reloads from Firestore, and emit a `document-restored` Socket.IO event to all connected clients — which triggers a page reload for everyone in that document.

---

**Q12: Why did you use Firestore's subcollections for comments and versions?**

> Firestore subcollections (`documents/{id}/comments/{commentId}`) are a natural fit because:
> 1. **Data locality** — comments belong to a document, so nesting them makes queries simple: just read from the subcollection of a specific document
> 2. **Independent scaling** — a document with 1000 comments doesn't bloat the parent document record (Firestore has a 1MB document size limit)
> 3. **Independent security** — in the future, we could add Firestore Security Rules that check parent document permissions before allowing subcollection access

---

**Q13: What is the `allowedUsers` array and why maintain it alongside `permissions`?**

> Firestore doesn't support querying nested array-of-objects fields efficiently. You can't do: `WHERE permissions[].userId == 'abc'`. But you *can* do: `WHERE allowedUsers array-contains 'abc'`. So we maintain `allowedUsers` as a flat array of just the user IDs for **query efficiency** when listing all documents a user has access to. The `permissions` array holds the full role information for authorization checks.

---

### 💻 Frontend Architecture Questions

**Q14: How does the Tiptap editor integrate with Yjs?**

> Tiptap's `@tiptap/extension-collaboration` extension binds a `Y.Doc`'s shared text type directly to ProseMirror's document model. Every keystroke becomes a Yjs transaction that automatically produces a binary diff. The `@tiptap/extension-collaboration-cursor` extension uses the Yjs Awareness protocol to render other users' cursors as colored overlays in the editor. The Yjs document (`Y.Doc`) is created in the `useYjsProvider` custom hook and passed to Tiptap via the extension configuration.

---

**Q15: Explain the custom `useYjsProvider` hook. Why is it a custom hook?**

> `useYjsProvider` encapsulates all the complexity of setting up real-time collaboration: creating the `Y.Doc`, connecting Socket.IO, setting up the `SocketIOProvider`, and configuring the Tiptap editor with all its extensions. By making it a custom hook, the `Document` component stays clean — it just calls `useYjsProvider()` and gets back `{ editor, isYjsReady, onlineUsers }`. This follows the **Separation of Concerns** principle. The hook also handles cleanup — on unmount it destroys the provider, the Y.Doc, and disconnects the socket, preventing memory leaks.

---

**Q16: Why use `React.memo` on DocumentEditor and DocumentToolbar?**

> These components receive `editor` as a prop — an object that doesn't change reference on every render. Without `memo`, every parent re-render (e.g. save status changing, online users updating) would re-render the toolbar and editor unnecessarily. Since the editor has heavy ProseMirror internals, unnecessary re-renders waste CPU time. `React.memo` does a shallow prop comparison — if `editor` and `onAddComment` haven't changed, the component skips re-rendering.

---

**Q17: How does the slash command menu work?**

> We built a custom Tiptap extension called `SlashCommands` that uses Tiptap's `@tiptap/suggestion` API. When the user types `/`, the extension intercepts the input and shows a floating dropdown menu (rendered via Tippy.js for positioning). Each menu item maps to a Tiptap command — `/h1` triggers `editor.chain().focus().setHeading({ level: 1 }).run()`, `/table` inserts a table, etc. The suggestion API handles keyboard navigation (arrow keys, Enter, Escape) within the menu.

---

### 🚀 Performance & Scalability Questions

**Q18: What are the performance bottlenecks and how would you scale this?**

> **Current bottlenecks:**
> 1. In-memory `Y.Doc` storage — all document state is in server RAM. If the server restarts, in-progress changes not yet saved to Firestore are lost
> 2. Single server — all WebSocket connections go to one Node.js process
>
> **How to scale:**
> 1. Use **Redis** as a shared pub/sub layer so multiple backend instances can forward Yjs updates across servers (the `y-redis` package does exactly this)
> 2. Use **sticky sessions** on the load balancer so a user always connects to the same server (simpler, but less fault-tolerant)
> 3. Replace the polling for comments with **real-time push** — after adding a comment via backend, emit a Socket.IO event to all clients in the document room

---

**Q19: The frontend bundle is over 1MB. How would you fix that?**

> The large bundle comes mainly from Tiptap extensions + Yjs + Socket.IO + highlight.js all being in the same chunk. Solutions:
> 1. **Dynamic imports** — the Document component is already lazy-loaded with `React.lazy()`. We could also lazy-load Tiptap extensions
> 2. **Manual chunks** in `vite.config.js` using `build.rollupOptions.output.manualChunks` to split vendor libraries into separate cacheable chunks
> 3. **Tree shaking** — ensure we only import what we use from lodash (use `lodash.debounce` separately, which we already do)

---

### 🔧 General CS / System Design Questions

**Q20: How do you handle the case where two users delete the same text simultaneously?**

> This is exactly the problem CRDTs solve. In Yjs, each character is assigned a unique ID based on the client ID and a logical clock. When two users independently delete the same character, both deletions reference the same character ID. Yjs's YATA algorithm merges these operations: the character gets marked as deleted (tombstoned). The result is consistent on all clients — the text is gone, and no error occurs. Neither client's other edits are affected.

---

**Q21: What is the difference between `onSnapshot` (Firestore client SDK) and using your backend API?**

> `onSnapshot` connects the browser directly to Firestore using the Firebase client SDK and streams real-time updates. It requires **Firestore Security Rules** to authorize each request. If the security rules are too restrictive (e.g. no rule for `comments` subcollection), the client gets "Missing or insufficient permissions."
>
> Our backend API uses the **Firebase Admin SDK** which bypasses security rules entirely — it authenticates as a service account with root-level access. This means authorization is entirely in our hands (our Express middleware), and we can enforce complex role-based logic that would be difficult to express in Firestore's rule language. The tradeoff is we lose native real-time push for comments — we compensate with polling.

---

**Q22: Why did you use `sanitize-html` on both frontend and backend?**

> We use it on the **backend** to prevent **Stored XSS** — if a user submits malicious HTML like `<script>alert('xss')</script>` as document content and we store it in Firestore, when another user opens the document, that script could execute in their browser. `sanitize-html` strips all dangerous tags and attributes before saving.
>
> Defense in depth — even if the frontend sends clean HTML, we sanitize on the backend too, because an attacker could bypass the frontend entirely and call the API directly with a crafted request.

---

**Q23: Explain how the document title is kept separate from the document body.**

> The title is stored as a dedicated `title` field in Firestore, separate from the `content` field (which holds the ProseMirror/Yjs document body). In the UI, the title is a plain HTML `<input>` element, completely separate from the Tiptap `EditorContent`. We use a local state variable in the `DocumentCover` component for the title, with a **debounced save** (1-second delay) that only sends a `PUT /docs/:id` API call — it updates only the `title` field. Typing in the editor triggers Yjs/Tiptap updates which update only `content`. These are two completely independent data flows.

---

## 6. Common Follow-Up Questions

**Q: What would you do differently if you built this again?**
> Use TypeScript from the start for type safety across the Yjs + Tiptap + Socket.IO integration. Add Redis for multi-instance scaling from day one. Use a proper job queue (Bull/BullMQ) for auto-save instead of debounced timeouts.

**Q: How do you handle offline editing?**
> Currently, offline editing is not supported. The editor requires a WebSocket connection to the backend. To support offline editing, we could use a service worker to cache the app, store Yjs updates in IndexedDB when offline, and sync them when the connection returns — this is what the `y-indexeddb` provider does.

**Q: What happens if the server crashes mid-edit?**
> Any unsaved Yjs state in memory (since the last `saveYDocToFirestore()` on disconnect) could be lost. This is a known limitation. The mitigation would be periodic server-side auto-save (e.g. save every 30 seconds regardless of connection state) and using Redis persistence.

---

## 7. Project Structure Summary

```
realtime-doc/
├── frontend/                    # React + Vite SPA
│   └── src/
│       ├── App.jsx              # Routing, ThemeProvider, Toaster
│       ├── api/docs.js          # Axios instance + comment API helpers
│       ├── utils/firebaseErrors.js  # Firebase error → user message mapping
│       └── components/
│           ├── AuthContext.jsx  # Firebase login/register/logout + auth state
│           ├── firebase.js      # Firebase client SDK init
│           ├── ThemeContext.jsx # Dark/light mode toggle
│           ├── DocumentList.jsx # Dashboard — list, create, search docs
│           ├── Document.jsx     # Main document page + roles + modals
│           └── document/
│               ├── useYjsProvider.js     # Yjs + Socket.IO + Tiptap setup
│               ├── DocumentEditor.jsx   # Tiptap EditorContent wrapper
│               ├── DocumentToolbar.jsx  # Bold/Italic/Lists/Tables/Comment
│               ├── DocumentCover.jsx    # Title, emoji, cover image
│               ├── DocumentHeader.jsx   # Top bar — role badge, save status
│               ├── CommentSidebar.jsx   # Comment list (polls backend API)
│               ├── CommentModal.jsx     # Add comment modal
│               ├── ShareModal.jsx       # Generate shareable link
│               ├── CollaboratorsList.jsx # Manage permissions
│               ├── VersionHistoryModal.jsx # View/restore versions
│               ├── SocketIOProvider.js  # Custom Yjs ↔ Socket.IO bridge
│               └── extensions/
│                   ├── CommentMark.js   # Custom ProseMirror mark for highlights
│                   ├── SlashCommands.js # / command menu extension
│                   └── suggestion.js   # Slash command items + renderItem
│
├── backend/                     # Node.js + Express API + Socket.IO server
│   ├── server.js                # Express app + Socket.IO + Yjs room management
│   ├── firebase/admin.js        # Firebase Admin SDK init
│   ├── routes/
│   │   ├── auth.routes.js       # /api/auth — login, logout, lookup-uid
│   │   ├── docs.routes.js       # /api/docs — CRUD + share + versions
│   │   └── comments.routes.js   # /api/docs/:docId/comments
│   ├── controllers/
│   │   ├── authController.js    # verifyIdToken → set httpOnly cookie
│   │   └── commentController.js # Firestore comment CRUD via Admin SDK
│   ├── middlewares/
│   │   ├── auth.js              # Verify httpOnly cookie JWT on every request
│   │   └── documentRole.js      # requireDocumentRole(['admin','editor',...])
│   └── utils/
│       ├── permissions.js       # hasDocumentRole() helper
│       └── documentStore.js     # In-memory Map of active Y.Doc rooms
│
└── render.yaml                  # Render.com deployment configuration
```

*Good luck with your interviews! This project demonstrates real-time systems design, secure authentication patterns, CRDT-based conflict resolution, and full-stack React/Node.js development — all strong differentiators.*

---

## 8. Version 2.0: Advanced Enterprise & Cloud-Native Features

### 8.1 🔄 Event-Driven Architecture (EDA)
*   **Why we implemented this:** 
    In standard request-response systems, post-processing operations (like generating audit trails or dispatching commenter notifications) block the primary API execution loop. By implementing a pub/sub EventBus, we decoupled backend business logic: Express controllers simply fire events, and subscribers process them asynchronously. This speeds up API response times, makes components highly modular, and allows us to scale handlers independently.
*   **Core Code:**
    *   Event Broker Utility: [eventBus.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/utils/eventBus.js) (handles Redis connections and falls back to Node `EventEmitter` locally).
    *   Subscribers / Listeners: [eventHandlers.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/subscribers/eventHandlers.js) (processes audit logs and notifications).
    *   Express Integration: Dispatched via `eventBus.publish()` inside [docs.routes.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/routes/docs.routes.js) and [commentController.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/controllers/commentController.js).
*   **How to verify:**
    1. Start the server (`npm run dev` in `backend/`).
    2. Check the console startup logs to confirm the subscribers are initialized:
       `[Subscribers] Initializing Event-Driven subscribers...`
       `[EventBus] Registered subscriber for: document.created`
    3. Create or delete a document or comment via the UI/API.
    4. Confirm that the terminal logs the decoupled background processing:
       `[Audit Trail] 🆕 Document "Sprint Plan" was created by user: ...`

---

### 8.2 🎛️ GraphQL API Design
*   **Why we implemented this:**
    Traditional REST endpoints can cause **over-fetching** (loading the entire document body when you only want the title list) or **under-fetching** (requiring multiple HTTP round-trips to get a document and then fetch its comments). Our GraphQL API endpoint (`/graphql`) allows clients to request exactly the fields they need, reducing mobile data consumption and network overhead.
*   **Core Code:**
    *   GraphQL TypeDefs: [schema.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/graphql/schema.js)
    *   Resolvers: [resolvers.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/graphql/resolvers.js) (integrates Firestore operations and checks Firebase JWT auth).
    *   Server mounting: Mounts Apollo Server 5 via `@as-integrations/express5` in [server.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/server.js).
    *   Frontend Client: [graphql.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/frontend/src/api/graphql.js) (lightweight Axios wrapper).
*   **How to verify:**
    1. Send a POST request to `http://localhost:5000/graphql` using Postman, Apollo Sandbox, or your frontend.
    2. Use the query:
       ```graphql
       query {
         documents(all: true) {
           id
           title
           createdAt
         }
       }
       ```
    3. Verify that only the specified fields are returned in the JSON payload.

---

### 8.3 🧩 Micro-Frontend (MFE) Pattern
*   **Why we implemented this:**
    In large enterprises, frontend monorepos are often split among different teams. By implementing **Vite Module Federation**, we exposed CollabDocs' collaborative `DocumentEditor` and `DocumentToolbar` components as self-contained remote modules. Other applications (like a company's main intranet portal or a dashboard app) can now load and mount our collaborative editor dynamically at runtime.
*   **Core Code:**
    *   Federation Config: [vite.config.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/frontend/vite.config.js) (defines remote exposes and configures shared packages like React and Yjs to prevent duplicate loads).
*   **How to verify:**
    1. Run `npm run build` in the `frontend/` directory.
    2. Inspect the build directory (`dist/assets/`).
    3. Verify that the build output generates module federation entry points:
       *   `remoteEntry.js`
       *   `__federation_expose_DocumentEditor-*.js`
       *   `__federation_expose_DocumentToolbar-*.js`

---

### 8.4 📄 REST API Swagger Documentation
*   **Why we implemented this:**
    APIs need clear, interactive contracts. We added JSDoc Swagger specifications to automatically compile route metadata, giving developers a live interface to test and query endpoints.
*   **Core Code:**
    *   Swagger Setup: [swagger.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/utils/swagger.js)
    *   Annotations: Added above Express auth paths in [auth.routes.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/routes/auth.routes.js).
    *   Server mounting: Hosted on `/api-docs` inside [server.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/server.js).
*   **How to verify:**
    1. Run the backend server (`npm run dev`).
    2. Open your web browser and navigate to `http://localhost:5000/api-docs`.
    3. You will see the interactive Swagger UI interface detailing all authentication routes.

---

### 8.5 🔀 Socket.IO Redis Scaling Adapter
*   **Why we implemented this:**
    WebSocket connections are stateful and bound to server memory. If User A is connected to server instance #1, and User B is connected to instance #2, they cannot collaborate. We implemented the `@socket.io/redis-adapter` so that all socket updates are published to a Redis Pub/Sub channel. This links multiple backend instances, enabling global sync across clustered instances.
*   **Core Code:**
    *   Adapter integration: Configured in [server.js](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/server.js).
*   **How to verify:**
    1. On startup, Socket.IO checks for Redis environment variables (`REDIS_URL` or `REDIS_HOST`).
    2. If Redis is running, you will see:
       `[Socket.IO] Redis adapter successfully connected and configured for horizontal scaling.`
    3. If Redis is offline, it falls back to:
       `[Socket.IO] No Redis configuration found. Running with default in-memory socket adapter.`

---

### 8.6 🐳 Kubernetes Orchestration (under `/k8s`)
*   **Why we implemented this:**
    Manually deploying, scaling, and managing containerized applications is error-prone. Kubernetes handles container self-healing, rolling updates, and service discovery. 
    Our custom **Ingress configurations configure sticky sessions (session affinity)**. This is crucial because Socket.IO performs an HTTP handshake before upgrading to WebSockets; if subsequent handshakes hit different backend replicas, the connection drops.
*   **Core Code:**
    *   Dockerfiles: Multi-stage [Dockerfile](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/backend/Dockerfile) (backend) and [Dockerfile](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/frontend/Dockerfile) (frontend).
    *   Manifests: Grouped in `/k8s`. [ingress.yaml](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/k8s/ingress.yaml) specifies the Nginx Ingress annotations for stickiness:
        `nginx.ingress.kubernetes.io/affinity: "cookie"`
*   **How to verify:**
    1. Deploy to a local cluster (e.g. Minikube or Kind) using:
       `kubectl apply -k k8s/`
    2. Verify all pods are running successfully:
       `kubectl get pods -n collabdocs-prod`

---

### 8.7 🏗️ Terraform / IaC (under `/terraform`)
*   **Why we implemented this:**
    Infrastructure as Code (IaC) ensures that your entire network, compute resources, load balancers, and security firewall rules are fully defined, versioned, and reproducible.
*   **Core Code:**
    *   [vpc.tf](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/terraform/vpc.tf): Network setup with public and private subnets.
    *   [alb.tf](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/terraform/alb.tf): Application Load Balancer with target group stickiness configured.
    *   [ecs.tf](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/terraform/ecs.tf): Cluster and ECS Fargate definitions.
*   **How to verify:**
    1. Verify file schemas and compile states:
       `cd terraform`
       `terraform init`
       `terraform validate`

---

### 8.8 🚀 CI/CD Pipeline
*   **Why we implemented this:**
    Automating build, test, and release flows prevents human errors during deployment. The pipeline validates tests, compiles Docker builds, tags images, pushes to AWS ECR, and applies rolling updates to ECS.
*   **Core Code:**
    *   Workflow Config: [.github/workflows/ci-cd.yml](file:///c:/Users/shybash.shaik/Desktop/realtime-doc/.github/workflows/ci-cd.yml).
*   **How to verify:**
    1. Push code to the `main` branch.
    2. Check the "Actions" tab on your GitHub repository page to watch the automated checks and compilation stages execute.
