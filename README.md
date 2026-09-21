# planner-web

The browser client for [Planner](../PRODUCT-PLAN.md): capture-first, cloud-first,
talking to [`planner-api`](../planner-api) with a Firebase ID token.

Next.js 16 · React 19 · TypeScript · Tailwind 4 · TanStack Query · Firebase Auth.

The mobile app is local-first and syncs; this app is not — every page is a live
query against the API. That is deliberate (see the product plan §3): at a desk
on a wired connection, local-first buys nothing and costs a replica.

## What it does

| Page | |
|---|---|
| **Capture** (`/`) | A text box and a paste target. Lines become tasks (Inbox, or *Next* when filed), a note, activity entries, or raw meeting lines. A screenshot pasted **anywhere on the page** is uploaded to R2 and filed under the same scope — and pinned to the selected meeting. |
| Inbox | Captured, not yet filed. |
| Tasks | Today / Next / In progress / Waiting / Someday / Done, search, scope filter. Complete, reopen, drop, carry forward, checklist, subtasks, recurrence on create. |
| Organizations, Projects | CRUD, summaries, everything filed under them. |
| Meetings | Raw notes that autosave and are never rewritten. *Split* derives one item per line; each line is processed into a task, requirement, decision or note with the same rules as the mobile app (`MeetingProcessingService`). Screenshots pasted on the page attach to the meeting. |
| Requirements, Decisions, Notes, Activity | Lists, editing, scope filters. Notes autosave. |
| Weekly review | Planned vs unplanned, per-organization split, overdue, waiting, carried forward. |
| Settings | Profile, sign-out, account erasure (Firebase + Postgres). |
| Guests | "Continue without an account" on the sign-in page gives a Firebase anonymous session — full app, data on the server, reachable only from this browser. Signing in later keeps everything: a new credential links in place, an existing account adopts the guest's rows (`src/auth/guest.ts`). Guests are capped at `GUEST_MAX_ATTACHMENTS` uploads. |

Keyboard: `c` capture, `i` inbox, `t` tasks, `o` organizations, `p` projects,
`m` meetings, `n` notes, `r` review. `⌘↵` saves in any capture box.

## Running it

```bash
npm install
cp .env.example .env.local
npm run dev                    # http://localhost:3000
```

Fill the Firebase values from the `web` entry of
`planner-mobile/lib/firebase_options.dart` (the app `flutterfire configure`
registered — same Firebase project as mobile, so accounts are shared) or from
the Firebase console. The deployed API already allows `http://localhost:3000`,
so that is enough to sign in and work against production data. Point
`NEXT_PUBLIC_API_URL` at `http://localhost:3100/api/v1` to work against a
local `planner-api` instead.

### Checks

```bash
npm run typecheck
npm run lint
npm test            # vitest: HTTP layer, upload flow, meeting processing, formatting
npm run build
```

## Deploying — Vercel

The web client lives at **`https://memory.dave.com.et`** (the API is
`memory-api.dave.com.et`; both are already in the API's `CORS_ORIGIN`).

Already done on the API side (2026-09-13): `CORS_ORIGIN` on the server allows
`https://memory.dave.com.et`, `https://planner-web-*.vercel.app` (preview
deployments, any branch) and `http://localhost:3000`; the API matches `*`
patterns (`planner-api/src/config/cors.ts`). Firebase already authorises
`localhost`.

Still to do, in order:

1. **Vercel project.** Push the repo to GitHub, import it in Vercel with
   **root directory** `planner-web`, and name the project `planner-web` (the
   API's preview-origin pattern depends on that name). Environment variables
   (Production and Preview): the five in `.env.example`, with the Firebase
   values from the `web` entry of `planner-mobile/lib/firebase_options.dart`
   (or the Firebase console).
   Then Settings → Domains → add `memory.dave.com.et` and create the CNAME it
   asks for in the `dave.com.et` DNS zone (Cloudflare). If the record is
   proxied (orange cloud) set it to DNS-only, or Vercel cannot issue the
   certificate.
2. **Firebase** → Authentication → Settings → *Authorised domains*: add
   `memory.dave.com.et`. Google/Apple popups fail with
   `auth/unauthorized-domain` until then. Preview deployments (`*.vercel.app`)
   cannot be wildcarded here — add a specific preview host if you need
   sign-in on one; email/password sign-in works everywhere regardless.
3. **Cloudflare R2** → R2 → bucket `planner-media` → Settings → *CORS policy*
   → Edit, paste:
   ```json
   [
     {
       "AllowedOrigins": [
         "https://memory.dave.com.et",
         "https://*.vercel.app",
         "http://localhost:3000"
       ],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
   Uploads are browser → R2 `PUT`s with a presigned URL, so the bucket must
   allow the origin; without this the attachment row is created and the tile
   shows "not uploaded". The API's R2 token is object-scoped and cannot set
   this itself (tried; `AccessDenied`) — it has to be the dashboard, or an
   *Admin Read & Write* token.

`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` is set by Vercel and shown in Settings as
the build id.

## The Android app

The phone app is offered from three places: a dismissible banner in the app
shell and a link under the sign-in form — both only on Android browsers,
where the file can actually be installed — and a "Phone app" card in
Settings, on every device, for sending the link to a phone.

Nothing about the APK lives in this repo. `src/lib/android-app.ts` asks
GitHub for the latest release of `NEXT_PUBLIC_ANDROID_RELEASES_REPO` (default
`ETdvlpr/planner-mobile`) and links to its `planner-android.apk` asset via the
stable `releases/latest/download/…` URL, so publishing a new build
(`planner-mobile/scripts/release-android.sh`) needs no web deploy. One
unauthenticated GitHub API call per session, cached for an hour. No release,
a rate-limited response, or an empty variable all just hide the offer.

## Layout

```
src/
  app/                     routes — thin page.tsx files; (app)/ is behind RequireAuth
  auth/                    AuthProvider, RequireAuth, sign-in page
  lib/api/                 types.ts (mirrors schema.prisma), client.ts (envelope +
                           token + errors), index.ts (one function per route)
  lib/hooks.ts             useMe, useLookup (orgs + projects), useApiMutation, useAutosave
  lib/upload.ts            create row → PUT to R2 → confirm
  lib/format.ts            enum labels, dates
  components/ui/           button, fields, dialog (native <dialog>), badges, states
  components/layout/       app shell, scope pickers
  features/<area>/         pages and dialogs per resource
```

Conventions worth knowing:

- **Nothing is filtered client-side that the API can filter.** Every list is a
  server query; mutations invalidate by resource key and the screen refetches.
- **Dialogs mount a fresh form.** `<Dialog>` renders children only while open,
  so form state initialises from props with plain `useState` — no effects to
  reset state.
- **Autosave never clobbers typing.** `useAutosave` adopts a new server value
  only while the field is clean.
- **Enum values are a wire contract** with the mobile app (`Enum.name` strings).
  Labels live in `lib/format.ts`; never rename a value.

## Known gaps

- "Tasks from this meeting" on the meeting page filters client-side because
  `GET /tasks` has no `sourceMeetingId` filter. Adding that query param to
  `TaskQueryDto` is a one-line API change.
- Voice notes are listed nowhere yet — they are a phone thing, and playback
  needs a presigned URL per note. The API supports it; the page does not.
- No offline behaviour, by design.
