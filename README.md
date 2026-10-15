# MatchED

MatchED helps Brazilian students — especially from public schools — find scholarships, summer programs, competitions and exchanges they can **actually apply to**, understand the requirements in Portuguese, and follow a step-by-step plan to the deadline. It is free for students.

## Run it on your computer (2 minutes)

You need [Node.js 18 or newer](https://nodejs.org).

```bash
cd MatchED-Backend
npm install
npm run setup     # creates .env, the local database, and imports your spreadsheet if it is in data-import/
npm start         # → open http://localhost:3000
```

On Windows you can double-click `start.bat` instead.

**Load the real opportunities:** put `MatchED Apply - database.xlsx` in the `data-import/` folder and run `npm run setup` again. This folder is ignored by git, so the spreadsheet never goes to GitHub. Or upload it later in **Admin → Importar**.

**Become admin locally:**

```bash
npm run create-admin -- you@email.com "a-long-password-here"
```

Your e-mail must also be listed in `ADMIN_EMAILS` in `MatchED-Backend/.env`.

**Demo accounts (local only):** `estudante@matched.demo` and `universitario@matched.demo`, password `demo-matched-2026`. They are never created in production.

**Tests:** `cd MatchED-Backend && npm test`

## With Claude Code

Open this folder in Claude Code and paste:

> Set up and run MatchED locally: in MatchED-Backend run `npm install`, `npm run setup` and `npm test`, then start the server with `npm start` and tell me the URL. Read CLAUDE.md first.

`CLAUDE.md` explains the project to Claude Code: structure, rules, and how to test.

## What is in this repository

| Folder | What it is |
|---|---|
| `MatchED-Backend/` | The API (Node + Express, JSON-file database). It also serves the website at `http://localhost:3000`. |
| `MatchED-Web/` | **The website** (single-page app: `index.html` + `tools.js` + `tools.css`). This is the one in use. |
| `data-import/` | Put the private spreadsheet here. Ignored by git. |
| `MatchED-Frontend/` | Old copy of the website. **Not used** — kept only for history. |
| `MatchED-Pipeline/` | Earlier Next.js/Prisma experiment for the opportunity pipeline. Not used by the website. |

## Website pages

Public (no account needed):

- `#/home` — landing page with live numbers
- `#/check` — "Isso vale pra mim?": 7 questions → only the opportunities the student can apply to, with reasons and warnings
- `#/explore` — search and filter every verified opportunity (US-only ones hidden by default)
- `#/o/<id>` — shareable page for one opportunity
- `#/impact` — public impact numbers and how they are measured
- `#/glossary` — 22 application terms explained in Portuguese (fee waiver, essay, recommendation letter…)

For students with an account:

- **Descobrir** (swipe matches)
- **Salvos**
- **Quests** (step-by-step plan with dates counted back from the deadline)
- **Prazos** (calendar export and Google Calendar)
- **Resultados**
- **Perfil**

For admins:

- Review captured opportunities.
- Edit live ones.
- Handle reports from students.
- Run partner schools: invite link, QR code and printable poster.
- See the impact funnel.
- Import the spreadsheet.

## Deploy

See [DEPLOY.md](DEPLOY.md).

## Security notes

- Never commit `.env`, `data/` or spreadsheets (the `.gitignore` files already block them).
- In production you **must** set:
  - `JWT_SECRET` (long and random)
  - `ADMIN_EMAILS`
  - `FRONTEND_URL`
- An old admin password was once written in `index.html` and is still in the git history. Treat it as public: change that password everywhere it was used.
