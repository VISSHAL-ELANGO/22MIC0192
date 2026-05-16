# Notification System Design

## Overview

A campus notification system built for the Affordmed evaluation. It consists of three parts:

- **logging_middleware** — shared logging package that POSTs structured logs to the Affordmed test server
- **notification_app_be** — backend scripts for authentication, registration, and priority inbox (Stage 1)
- **notification_app_fe** — Next.js frontend for browsing and prioritising notifications (Stage 2)

---

## Repository Structure

```
22mic0192/
├── logging_middleware/        # Shared logging package
│   ├── index.ts               # Log(), backendLogger, frontendLogger
│   └── package.json
│
├── notification_app_be/       # Backend (Node/TypeScript scripts)
│   ├── auth.ts                # POST /auth — obtains Bearer token
│   ├── register.ts            # POST /register — one-time registration
│   ├── priority_inbox.ts      # Fetches notifications, ranks via Max-Heap
│   └── package.json
│
├── notification_app_fe/       # Frontend (Next.js + MUI)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # All Notifications page
│   │   │   ├── priority/page.tsx      # Priority Inbox page
│   │   │   ├── layout.tsx
│   │   │   ├── globals.css
│   │   │   └── api/
│   │   │       ├── auth/route.ts      # Proxy: POST /auth
│   │   │       ├── logs/route.ts      # Proxy: POST /logs
│   │   │       └── notifications/route.ts  # Proxy: GET /notifications
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── NotificationCard.tsx
│   │   │   └── ThemeRegistry.tsx
│   │   └── lib/
│   │       ├── api.ts         # fetchNotifications(), getTopN()
│   │       ├── auth.ts        # Token cache + refresh
│   │       ├── logger.ts      # Frontend logger (proxied via /api/logs)
│   │       ├── types.ts       # Shared TypeScript types
│   │       ├── theme.ts       # MUI theme
│   │       └── useViewed.ts   # localStorage hook for read state
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
│
├── notification_system_design.md   # This file
└── .gitignore
```

---

## Architecture

### Logging Middleware

A standalone TypeScript module consumed by both the backend scripts and the frontend.

- `Log(stack, level, package, message)` — sends a structured log entry to `POST /evaluation-service/logs`
- Attaches a Bearer token via `Authorization` header once authenticated
- Never throws — logging failures are swallowed so they never break the main app
- Exports `backendLogger` and `frontendLogger` convenience wrappers

### Backend (notification_app_be)

**Stage 1 — Priority Inbox**

1. `register.ts` — called once to obtain `clientID` and `clientSecret`
2. `auth.ts` — calls `POST /auth` with credentials, returns a Bearer token
3. `priority_inbox.ts` — fetches all notifications, ranks them using a **Max-Heap**

**Priority Scoring**

```
score = TYPE_WEIGHT[type] + epoch_ms / 1e9
```

| Type      | Weight |
|-----------|--------|
| Placement | 300    |
| Result    | 200    |
| Event     | 100    |

Dividing epoch milliseconds by 1e9 keeps recency in the ~1700–1800 range, the same order of magnitude as the type weights, so both factors meaningfully influence the score.

**Max-Heap complexity**
- Insert: O(log n)
- Extract max: O(log n)
- Build heap from N items: O(N log N)
- Extract top K: O(K log N)

### Frontend (notification_app_fe)

**Stage 2 — Next.js Web App**

The frontend is a Next.js 16 app using MUI v9 for UI components.

**Pages**
- `/` — All Notifications with filter (All / Placement / Result / Event) and pagination
- `/priority` — Priority Inbox with adjustable top-N slider and per-notification score display

**API Proxy Routes**

All external API calls are proxied through Next.js API routes to avoid CORS issues in the browser:

| Route | Proxies to |
|-------|-----------|
| `GET /api/auth` | `POST /evaluation-service/auth` |
| `POST /api/logs` | `POST /evaluation-service/logs` |
| `GET /api/notifications` | `GET /evaluation-service/notifications` |

**Token Flow**
1. Browser calls `GET /api/auth` (Next.js server-side proxy)
2. Token is cached in `sessionStorage` and in module memory
3. On 401, token is cleared and re-fetched automatically (one retry)

**Read State**

Viewed notification IDs are persisted in `localStorage` via the `useViewed` hook. No server state is needed.

---

## Running the Project

### Backend (Stage 1)

```bash
cd notification_app_be
npm install
# Run priority inbox (top 10 by default)
npx ts-node priority_inbox.ts
# Run with custom top-N
npx ts-node priority_inbox.ts 15
```

### Frontend (Stage 2)

```bash
cd notification_app_fe
npm install
npm run dev
# Open http://localhost:3000
```

### Logging Middleware (standalone)

```bash
cd logging_middleware
npm install
npm run build
```
