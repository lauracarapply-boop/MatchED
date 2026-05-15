# Guia de Deploy — MatchED

## Visão geral

```
Frontend (Vercel) ──── chama API ────▶ Backend (Railway)
     ↓                                        ↓
 domínio próprio                       JSON database persistido
```

---

## Passo 1 — Subir o Backend no Railway

### 1.1 Criar conta e projeto

1. Acesse [railway.app](https://railway.app) e crie uma conta (pode entrar com GitHub)
2. Clique em **New Project → Deploy from GitHub repo**
3. Conecte seu GitHub e selecione o repositório do MatchED
4. Railway vai detectar o projeto automaticamente

### 1.2 Configurar o serviço

1. No painel do Railway, clique no serviço criado
2. Vá em **Settings → Root Directory** e coloque: `MatchED-Backend`
3. Vá em **Variables** e adicione as seguintes variáveis:

| Variável | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | uma string aleatória longa (ex: gere em [randomkeygen.com](https://randomkeygen.com)) |
| `DB_PATH` | `/app/data/db.json` |
| `FRONTEND_URL` | *(preencher depois com a URL do Vercel)* |
| `PORT` | *(deixe em branco — Railway define automaticamente)* |

### 1.3 Adicionar volume persistente para o banco de dados

1. No painel do serviço, clique em **+ Add Volume**
2. Mount path: `/app/data`
3. Isso garante que o `db.json` não seja apagado nos redeploys

### 1.4 Popular o banco com dados iniciais

Após o primeiro deploy, abra o terminal do Railway (aba **Shell**) e rode:
```bash
node src/seed-data/seed.js
```

### 1.5 Copiar a URL do backend

No painel do Railway, vá em **Settings → Networking → Public Networking** e gere um domínio público.
Anote a URL — vai parecer com: `https://matched-backend-production.up.railway.app`

---

## Passo 2 — Subir o Frontend no Vercel

### 2.1 Criar projeto no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **Add New → Project**
3. Importe o repositório do GitHub
4. **Framework Preset:** Other (não é Next.js nem nenhum framework)
5. **Root Directory:** `MatchED-Frontend`
6. **Build Command:** `node build.js`
7. **Output Directory:** `.` (ponto — a pasta raiz)

### 2.2 Adicionar variável de ambiente

Na tela de configuração (ou em **Settings → Environment Variables** depois):

| Variável | Valor |
|---|---|
| `MATCHED_API_URL` | URL do Railway do passo 1.5 (ex: `https://matched-backend-production.up.railway.app`) |

### 2.3 Deploy

Clique em **Deploy**. O Vercel vai rodar `node build.js`, que escreve o `config.js` com a URL correta do backend.

---

## Passo 3 — Conectar o domínio próprio

1. No Vercel, vá em **Settings → Domains**
2. Clique em **Add Domain** e coloque o domínio que você comprou
3. O Vercel vai mostrar os registros DNS para configurar no seu registrar
4. Se você comprou o domínio no próprio Vercel, isso é automático

---

## Passo 4 — Atualizar CORS do backend

Depois de ter a URL final do Vercel (ex: `https://matched.com.br`), volte nas variáveis do Railway e atualize:

| Variável | Valor |
|---|---|
| `FRONTEND_URL` | `https://matched.com.br` |

---

## Checklist final

- [ ] Backend rodando no Railway com volume persistente
- [ ] Seed executado (`node src/seed-data/seed.js`)
- [ ] Frontend deployado no Vercel com `MATCHED_API_URL` configurado
- [ ] Domínio conectado no Vercel
- [ ] `FRONTEND_URL` no Railway atualizado com o domínio final
- [ ] Testar login, swipe, quests e resultados em produção

---

## Rodar localmente (sem mudanças)

Nada muda para desenvolvimento local. Continue usando o `start.bat` normalmente — o backend serve o frontend em `localhost:3000`.
