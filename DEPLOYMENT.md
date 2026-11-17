# Deploying TopRank AI (Vercel + Neon)

This project is a Next.js 16 app with Prisma 7 on PostgreSQL (Neon), AI calls to
Google Gemini, and Cloudinary image uploads. The database schema and migrations
are already applied to the Neon database in `.env`; deploying does **not** touch
the `main` branch.

## 1. What must exist before the first deploy

- A Neon PostgreSQL database and its pooled connection string
  (`postgresql://...-pooler.../neondb?sslmode=require`).
- A Cloudinary account with cloud name, API key and API secret (the
  `toprank/avatars` folder is created automatically).
- A Gemini API key.
- Migrations applied once from your machine:

```bash
npm run prisma:deploy
```

`npm run build` already runs `prisma generate` before `next build`, so the
generated client is rebuilt on every deploy.

## 2. Import the repository

1. Go to <https://vercel.com/new> and import the GitHub repository
   `maxpasegroup-debug/TopRankAI`.
2. Leave the framework preset as **Next.js**.
3. Leave the build command as the `package.json` default (`npm run build`) and
   the install command as `npm install`.
4. Open **Settings → Git → Production Branch** and choose
   **`feature/ai-exam-platform`**. This deploys your branch to the public
   project URL without merging it into `main`.

If you prefer to keep Vercel's production branch on `main`, skip that step and
share the branch **Preview** URL instead (see step 5).

## 3. Environment variables

Add these in **Settings → Environment Variables** (Production **and** Preview).
Copy the secret values from your local `.env`; never commit them.

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Your Neon pooled connection string |
| `APP_URL` | The public URL users open, e.g. `https://toprank-ai.vercel.app` |
| `AUTH_SECRET` | A long random string (16+ characters) |
| `ACCOUNT_POLICY_REVIEWED` | `true` |
| `GEMINI_API_KEY` | Your Gemini key |
| `GEMINI_MODEL` | `gemini-3.5-flash` (or the model you use locally) |
| `AI_FEATURES_ENABLED` | `true` |
| `CLOUDINARY_CLOUD_NAME` | From the Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | From the Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | From the Cloudinary dashboard (server-only) |
| `STORAGE_PROVIDER` | `cloudinary` |

Notes:

- `APP_URL` must be the exact `https://` origin. The auth API routes compare the
  request origin against it. If you deploy to a new domain, update this value.
- The R2 variables are optional and can stay unset while `STORAGE_PROVIDER` is
  `cloudinary`.
- `NODE_ENV` is set by Vercel automatically; do not add it.

## 4. Deploy

```bash
git push origin feature/ai-exam-platform
```

Vercel builds automatically on every push. The build runs:

1. `prisma generate --config prisma7.config.ts`
2. `next build`

If the first build ran before `APP_URL` was known, add or correct the variable
and redeploy (**Deployments → ⋯ → Redeploy**).

## 5. Share the link

- **Production URL** (`https://<project>.vercel.app`): public by default and
  stable. This is the easiest link to send someone.
- **Preview URL** (`https://<project>-git-feature-ai-exam-platform-<team>.vercel.app`):
  created for the branch. If opening it asks you to log in to Vercel, go to
  **Settings → Deployment Protection** and either disable Vercel Authentication
  for previews or use the deployment's **Share** action to create a temporary
  bypass link.

## 6. CLI alternative (optional)

```bash
npm i -g vercel
vercel login
vercel link          # create/link the project
vercel --prod        # deploy the current branch to production
```

`vercel` prints the deployment URL when it finishes. Environment variables still
need to be added in the dashboard (or with `vercel env add`).

## Troubleshooting

- **`Value 'CANDIDATE' not found in enum 'UserRole'` in local dev.** The
  `.next` build cache was copied from another checkout. Stop the dev server,
  delete `.next`, run `npm run prisma:generate`, and start again.
- **`PrismaClientInitializationError` on Vercel.** `DATABASE_URL` is missing or
  still points at `localhost`. Use the Neon pooled URL.
- **Sign-in/sign-up works locally but 403s in production.** `APP_URL` does not
  match the origin in the browser. Set it to the deployment origin and redeploy.
- **Uploads answer `503`.** The Cloudinary variables are missing or
  `STORAGE_PROVIDER` pins R2. Check `GET /api/uploads/avatar`; it reports the
  active provider and any missing variable names.
- **AI text is disabled.** `GEMINI_API_KEY` is missing or
  `AI_FEATURES_ENABLED=false`. Scores and marks never depend on the AI key.
