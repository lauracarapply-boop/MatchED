# Guia de Deploy — MatchED

```
Site (Netlify ou Vercel)  ── chama a API ──▶  Backend (Railway)
  pasta MatchED-Web                             pasta MatchED-Backend + volume /app/data
```

O backend também serve o site sozinho (`http://localhost:3000`), então para testes basta o Railway. Para produção, o recomendado é site no Netlify/Vercel (rápido e grátis) e API no Railway.

---

## Passo 1 — Backend no Railway

1. Em [railway.app](https://railway.app): **New Project → Deploy from GitHub repo** → escolha o repositório MatchED.
2. **Settings → Root Directory:** `MatchED-Backend`.
3. **+ Add Volume**, mount path `/app/data`. Sem isso, o banco é apagado a cada deploy.
4. **Variables:**

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | **obrigatório**. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DB_PATH` | `/app/data/db.json` |
| `ADMIN_EMAILS` | `lauracar.apply@gmail.com` (separe vários com vírgula) |
| `FRONTEND_URL` | endereço final do site, ex.: `https://matched.com.br` |
| `CORS_ORIGINS` | outros endereços do site, se houver (ex.: `https://matched.netlify.app`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | e-mail (Gmail: use uma *Senha de app*). Liga confirmação de cadastro, recuperação de senha e lembretes de prazo |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | opcional, para "Entrar com Google" |
| `API_URL` | endereço público do Railway (usado no login com Google) |

5. **Settings → Networking → Generate Domain** e anote a URL (ex.: `https://matched-api.up.railway.app`).

### Criar sua conta de admin em produção

No Railway, abra o **Shell** do serviço e rode:

```bash
npm run create-admin -- lauracar.apply@gmail.com "uma-senha-nova-e-longa"
```

Use uma senha **nova**. A antiga ficou exposta no histórico do GitHub.

### Carregar as oportunidades

1. Entre no site com a conta de admin.
2. Vá em **Admin → Importar → Planilha .xlsx** e envie `MatchED Apply - database.xlsx`.

A planilha é processada e apagada do servidor. Ela nunca vai para o GitHub.

> ⚠️ Não rode `npm run seed` em produção: ele apaga o banco. O comando agora se recusa a rodar se já existir um banco, a menos que você passe `--force`.

---

## Passo 2 — Site no Netlify (ou Vercel)

**Netlify:** Add new site → Import from GitHub.

- **Base directory:** `MatchED-Web`
- **Build command:** `node build.js`
- **Publish directory:** `MatchED-Web` (ou `.` relativo à base)
- **Environment variable:** `MATCHED_API_URL` = URL do Railway do passo 1.5

**Vercel:** igual, com Root Directory `MatchED-Web`, framework "Other", e a mesma variável `MATCHED_API_URL`.

> A pasta antiga `MatchED-Frontend` **não** é mais usada. Se um deploy antigo aponta para ela, troque para `MatchED-Web`.

---

## Passo 3 — Domínio

1. Conecte o domínio no Netlify/Vercel (Settings → Domains).
2. Atualize `FRONTEND_URL` no Railway com o domínio final.

---

## Checklist final

- [ ] `JWT_SECRET`, `ADMIN_EMAILS`, `FRONTEND_URL` e `DB_PATH` definidos no Railway
- [ ] Volume `/app/data` criado
- [ ] Admin criado pelo Shell com senha nova
- [ ] Planilha importada pelo painel Admin
- [ ] `MATCHED_API_URL` definido no site
- [ ] Testar no celular:
  - [ ] "Isso vale pra mim?"
  - [ ] Explorar
  - [ ] cadastro
  - [ ] Quests
  - [ ] Prazos (exportar calendário)
  - [ ] link de escola parceira (`?ref=CODIGO`)
- [ ] SMTP configurado para lembretes de prazo e recuperação de senha
