# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## XMail Application

XMail is a Gmail inbox analytics dashboard for freelancers, consultants, and small agencies.

### Artifacts

- `artifacts/xmail` — React + Vite frontend (previewPath: `/`)
- `artifacts/api-server` — Express API backend (previewPath: `/api`)

### Features

- Landing page with Terms of Service / Privacy Policy agreement gate
- Google OAuth 2.0 authentication (gmail.readonly scope)
- Dashboard: Response Time Tracker, Top Senders, Inbox Health Score, Weekly Report
- Hidden admin panel (tap XMAIL 10x → PIN: 2006) for multi-account management
- Zero-storage privacy: only metadata processed in memory

### Required Environment Variables

- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GOOGLE_REDIRECT_URI` — OAuth redirect URI (must be set in Google Cloud Console)
  - Development: `https://<replit-domain>/api/auth/google/callback`
  - Production: `https://<your-domain>/api/auth/google/callback`
- `SESSION_SECRET` — Already configured

### Database Schema

- `users` — authenticated users (googleId, email, name, picture, sessionToken)
- `connected_accounts` — OAuth tokens per user (userId, googleId, accessToken, refreshToken)

### Architecture

- Session management via HTTP-only cookie (`xmail_session`)
- Gmail API: read-only access, metadata only (From, Date, Thread-ID headers)
- All analytics computed in real time from Gmail API, nothing stored except tokens
