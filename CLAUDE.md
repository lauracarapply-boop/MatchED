# CLAUDE.md — working on MatchED

MatchED is a free web app that matches Brazilian students (mainly public-school, low-income) with scholarships, summer programs, competitions and exchanges they are eligible for. The interface is in Brazilian Portuguese first (en/es/fr also exist). The current focus is the **website**; the mobile app comes later.

## Run and test

```bash
cd MatchED-Backend
npm install
npm run setup          # .env + local DB (data/db.json) + imports data-import/*.xlsx
npm test               # node:test suite, uses a throwaway DB — must stay green
npm start              # http://localhost:3000 (API under /api, website served from ../MatchED-Web)
```

- `npm run setup -- --reset` wipes the local DB and rebuilds it.
- `npm run create-admin -- email "password"` creates or updates an admin account. The e-mail must also be in `ADMIN_EMAILS`.
- Demo logins (development only): `estudante@matched.demo` / `demo-matched-2026`.

## Layout

- `MatchED-Backend/src/server.js` — Express app.
  - Security headers, CORS from `FRONTEND_URL` + `CORS_ORIGINS`.
  - Admin-only mounts for `/api/sources`, `/api/import`, `/api/capture`, `/api/captured-opportunities`.
  - Exports `app`; it only listens when run directly.
- `src/config.js` — environment settings. `JWT_SECRET` is required in production.
- `src/middleware/auth.js` — `optionalAuth`, `requireAuth`, `requireSelf` (user can only touch their own `:userId`), `requireAdmin`, `ownsRecord`.
- `src/middleware/rateLimit.js` — in-memory rate limiting.
- `src/database/db.js` — JSON-file DB: cached read, atomic write. `COLLECTIONS` lists every table.
- `src/lib/eligibility.js` — the matching engine.
  - `detectFlags` checks US citizenship or work authorization, nationality, funding, fees, Brazil focus, public-school focus, English, age.
  - `computeMatch` returns `score`, `reasons`, `warnings` and `eligible`.
- `src/lib/opportunities.js` — `publicOpp()` builds the only shape the site receives.
  - Safe URLs, all-caps text tidied, flags attached.
- `src/lib/profile.js` — profile field whitelist and options (grade `ef8…concluido`, school type, state, English level, goals).
- `src/routes/*` — one file per area.
  - Public: `/api/opportunities` (explorer, `/check`, `/:id`, `/:id/report`), `/api/public/stats`, `/api/public/partners/:code`.
  - `/api/admin/*` is admin only.
- `src/jobs/reminders.js` — deadline e-mails 7 and 2 days before a deadline. Runs only when SMTP is configured.
- `src/import/xlsxImporter.js` — spreadsheet import, with dedupe; rows without an official link go to `capturedOpportunities`.
- `src/seed-data/brazil-opportunities.json` + `src/import/curated.js` — hand-checked opportunities for Brazilian students (olympiads, Jovens Embaixadores, Prep Program, UWC…). Loaded on every server start and by `npm run import:br`; fixed ids, safe to repeat, archives spreadsheet duplicates. Each entry keeps `verification_source`; re-check dates every year.
- `GET /api/users/:id/export` and `DELETE /api/users/:id` (body `{"confirm":"EXCLUIR"}`) — LGPD data download and account deletion; the privacy page is `#/privacidade` (`pagePrivacy` in `tools.js`, a draft pending legal review).
- Admin **Qualidade** tab (`GET /api/admin/quality`, `renderAdminQuality` in `tools.js`) — work queue of live opportunities with no description, no deadline, or unclear nationality; admins fill them in and can set checked `flags` (whitelisted keys) that override text detection.
- Partner school dashboard: each partner has a secret `viewToken`; `#/escola/CODE/TOKEN` (`pagePartnerDashboard`) calls `GET /api/public/partners/:code/dashboard?t=` — totals only, groups under 5 shown as "<5". `POST /api/admin/partners/:id/rotate` replaces the link.
- `test/api.test.js` — API tests. Add a test for every bug fix.
- `MatchED-Web/index.html` — the main SPA: hash router, student pages, admin panel.
- `MatchED-Web/tools.js` — the newer public pages and shared tools:
  - pages: home, check, explore, opportunity page, impact, glossary, Brazilian profile form;
  - shared: detail sheet, `.ics` and Google Calendar, WhatsApp share, admin Reports/Partners/Impact;
  - all Portuguese and English strings live in `NS`.
- `MatchED-Web/tools.css` — styles for the above.
- `MatchED-Web/sw.js`, `manifest.webmanifest` — installable PWA. API calls are never cached.
- `MatchED-Web/vendor/qrcode-generator.js` — QR codes (MIT), local so they work offline.
- `MatchED-Frontend/` and `MatchED-Pipeline/` — legacy. Do not edit.

## Rules

1. **Escape everything.** Any text that came from the database or a user goes through `esc()`; any link goes through `safeUrl()`. Scraped data is untrusted.
2. **Never trust ids from the client.** Use `req.user` / `req.targetUserId` and `ownsRecord`. Admin is decided only by `ADMIN_EMAILS` plus a verified e-mail.
3. **Never commit secrets or data.** That covers `.env`, `MatchED-Backend/data/` and `data-import/*.xlsx`; the repo is public.
4. **Eligibility honesty.** Opportunities flagged as needing US citizenship or work authorization are hidden from Brazilian students by default. They are never shown as a match.
5. **Portuguese first.** New UI text goes in `NS.pt` and `NS.en` in `tools.js`. Use plain words a 15-year-old understands; explain jargon through the glossary.
6. **Mobile first.** Most students use Android phones with limited data. Keep pages light, avoid new libraries, and test at 390px width.
7. After changes, run `npm test`. Then open the site and click through:
   - `#/check`
   - `#/explore`
   - an opportunity
   - sign up
   - Quests
   - Prazos
   - Admin
