# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
pnpm dev              # Start dev server (Next.js with Turbopack)
pnpm build            # Production build (standalone output for Docker)
pnpm start            # Start production server
pnpm lint             # ESLint (flat config, next/core-web-vitals + prettier)
pnpm format           # Prettier format all files (no semis, single quotes)
pnpm format:check     # Check formatting only
pnpm clean:logs       # Preview console.log removal; add --write to apply
pnpm db:generate      # Regenerate Prisma Client (needs .env)
pnpm db:migrate       # Run Prisma migrations (needs .env)
pnpm db:studio        # Open Prisma Studio GUI (needs .env)
pnpm db:push          # Push schema to DB without migrations
```

Node version: v22.20.0 (see `.nvmrc`). Package manager: pnpm.

## Architecture

### Directory Layout

```
app/                    # Next.js App Router — pages, API routes, Server Actions
  ├── api/chat/         # POST → SSE stream; delegates to server/services/chat
  ├── api/auth/         # NextAuth handler + custom login/register/me endpoints
  ├── api/message/      # Message CRUD + partial-save during streaming
  ├── api/share/        # Shared conversation lookup by token
  ├── api/geo|speech|tts|upload|image/  # Utility endpoints
  ├── actions/          # 'use server' Server Actions (conversation CRUD)
  ├── chat/             # /chat page (redirect) + /chat/[conversationId]
  └── auth/             # Sign-in, error, popup, link-account pages

server/                 # Server-only code (never imported in client components)
  ├── auth/             # NextAuth v4 config (auth.ts), JWT utils, password hashing, getCurrentUserId
  ├── db/client.ts      # Prisma singleton
  ├── repositories/     # Data access layer (User, Conversation, Message, AuditLog)
  ├── services/
  │   ├── ai/           # SiliconFlow API client (streaming, retry with backoff, 120s timeout)
  │   ├── chat/         # Core chat orchestrator (chat.service.ts), SSE streaming, prompt builder, message persister
  │   ├── tools/        # ToolRegistry + tool implementations (web_search, get_weather, generate_image)
  │   ├── image/        # Image generation, caching, storage, network probing
  │   ├── export/       # Markdown conversation exporter
  │   └── geo/          # IP-based geo lookup
  └── middleware/        # Audit log middleware

features/               # Client-side feature modules (colocated components + store + services)
  ├── chat/             # Chat store (Zustand), chat service (SSE parsing), SSE parser, message state machine
  ├── conversation/     # Conversation list store with CRUD
  ├── auth/             # LoginDialog, AuthGuard, use-auth hook, OAuth popup handling
  ├── share/            # Share button + shared conversation components
  └── voice/            # Audio recorder/player hooks, TTS/STT services

components/             # Shared UI — shadcn/ui primitives (components/ui/) + custom (Header, Sidebar, MainLayout)
lib/                    # Shared utilities — UI store (Zustand, persisted), hooks, SSE utils, storage helpers
prisma/schema.prisma    # Database schema — 7 models, PostgreSQL
middleware.ts           # Next.js middleware — auth redirects (/ → /chat for logged-in, /chat → / for anon)
```

### Request Flow: Chat Message

1. `features/chat/services/chat.service.ts` (client) calls `POST /api/chat` with message content + model config
2. `app/api/chat/route.ts` authenticates via `getCurrentUserId()`, resolves API key, hands off to `handleChatRequest()`
3. `server/services/chat/chat.service.ts` creates/gets conversation, saves user+assistant messages, builds context, calls SiliconFlow API
4. If tools enabled: `createSSEStreamWithTools()` runs multi-round AI↔tool loop (up to 5 rounds). Otherwise: simple SSE stream.
5. Client-side `SSEParser` receives typed events: `thinking`, `answer`, `tool_call`, `tool_progress`, `tool_result`, `error`, `complete`
6. `useChatStore` (Zustand) updates message state through a finite state machine (idle→waiting→thinking→answering→tool_calling→idle)

### Authentication

**Dual auth mechanism** in `server/auth/utils.ts`:
- **Primary**: NextAuth.js v4 with JWT strategy (7-day expiry), Prisma adapter. Providers: Google OAuth, GitHub OAuth, Credentials (email+password with bcrypt).
- **Fallback**: Legacy JWT token from `auth-token` cookie — backwards compatibility.

The `signIn` callback in `server/auth/auth.ts` auto-links OAuth accounts to existing email-matched users.

### Tool System

`server/services/tools/registry.ts` — `ToolRegistry` class manages tool lifecycle. Tools implement the `Tool` interface (`name`, `description`, `parameters` as JSON Schema, `execute()`). Three built-in tools: `web_search` (Tavily API), `get_weather` (Amap API for Chinese cities), `generate_image` (SiliconFlow API). Tools are registered on first use via `ensureToolsReady()`.

### State Management

Two main Zustand stores:
- `features/chat/store/chat.store.ts` — messages, streaming state, model selection, thinking mode, web search toggle, message state machine
- `features/conversation/store/conversation-store.ts` — conversation list, search, CRUD
- `lib/stores/` — UI preferences (sidebar, theme, model defaults), persisted to localStorage

### Database

PostgreSQL via Prisma. Key models: `User`, `Conversation` (with share tokens, pin support), `Message` (with thinking, toolCalls, toolResults JSON fields), `Account`/`Session` (NextAuth), `PendingAccountLink` (OAuth merge flow), `AuditLog`. Schema uses cascading deletes — deleting a user removes all their conversations and messages.

### Environment Variables

Required: `DATABASE_URL`, `AUTH_SECRET`, `SILICONFLOW_API_KEY`. OAuth: `GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`. Tools: `TAVILY_API_KEY`, `AMAP_API_KEY`. Optional: `ANALYZE=true` enables bundle analyzer on build.

### Commit Conventions

Husky + commitlint enforce conventional commits (type-enum, lowercase, header ≤100 chars). Pre-commit hook runs Prettier.

### No Tests

This project has no test framework configured. There is no Jest, Vitest, or Playwright setup.
