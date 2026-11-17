# Deploying HOLYDO MARKET (staging)

The plan: **API + database on Render**, **website on Vercel**, **photos on Cloudinary**, **emails through Resend**. Each has a free plan that's enough for a staging site. Allow about 30 minutes.

```
Phone / browser ──▶ Vercel (website, HTTPS) ──▶ Render (API) ──▶ Render PostgreSQL
                                                     ├──▶ Cloudinary (photos)
                                                     └──▶ Resend (emails)
```

You need the code on GitHub first (`main` branch, or merge the open pull request).

## 1. Cloudinary (photos)

1. Create a free account at cloudinary.com.
2. On the dashboard, copy the **API environment variable**. It looks like `cloudinary://123456:abcDEF@your-cloud`. This is `CLOUDINARY_URL`.

## 2. Resend (emails)

1. Create a free account at resend.com and create an **API key**.
2. Your `SMTP_URL` is `smtps://resend:YOUR_API_KEY@smtp.resend.com:465`.
3. Until you verify your own domain in Resend, set `MAIL_FROM` to `HOLYDO MARKET <onboarding@resend.dev>`. In that mode Resend only delivers to **your own** email address, which is fine for testing. Verify a domain (for example holydomarket.com) before inviting real users.

Any other SMTP provider (Brevo, SendGrid, Mailgun…) works the same way. Only `SMTP_URL` changes.

## 3. Render (API + database)

1. Create an account at render.com and connect your GitHub account.
2. Go to **New → Blueprint** and select the `HOLYDJOMARKET` repository. Render reads `render.yaml` and proposes a database (`holydo-db`) and a web service (`holydo-api`).
3. Fill in the values it asks for:
   - `FRONTEND_URL` and `APP_URL`: put `https://example.com` for now. You'll replace them in step 5.
   - `SMTP_URL`, `MAIL_FROM` and `CLOUDINARY_URL`: the values from steps 1–2.
4. Click **Apply**. The first deployment takes a few minutes. When it's live, open `https://holydo-api.onrender.com/health` (your exact URL is shown on the service page). It should show `{"ok":true}`.

`JWT_SECRET` is generated automatically. Database tables are created on each start by `prisma migrate deploy`.

## 4. Vercel (website)

1. Create an account at vercel.com, then **Add New → Project** and import `HOLYDJOMARKET`.
2. Set **Root Directory** to `frontend` (the framework is detected as Next.js).
3. Add one environment variable: `NEXT_PUBLIC_API_URL` = your Render API URL, for example `https://holydo-api.onrender.com`, with no trailing slash.
4. Click **Deploy**. You get a URL like `https://holydo-market.vercel.app`.

## 5. Connect the two

Back in Render, open `holydo-api` → **Environment** and set `FRONTEND_URL` and `APP_URL` to your Vercel URL. Then save; Render redeploys. In production the API only accepts requests from `FRONTEND_URL`.

## 6. Create your admin account (and optional demo data)

These commands run **from your computer** against the online database. In Render, open the `holydo-db` database and copy its **External Database URL**.

```bash
cd backend
# Your real admin account (never deletes anything):
DATABASE_URL="<external URL>" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="<12+ characters>" npm run db:create-admin

# Optional — fill staging with the 18 demo providers. ⚠️ This WIPES the database:
DATABASE_URL="<external URL>" NODE_ENV=production ALLOW_DEMO_SEED=true npm run db:seed
```

## 7. Test on your phone

Open the Vercel URL on your phone. It's HTTPS, so **"Autour de moi" (GPS) works** here. To install it like an app, use **Share → Add to Home Screen** (iPhone, Safari) or **⋮ → Add to Home screen** (Android, Chrome).

## Before inviting real users

- **Legal pages:** fill in `frontend/src/lib/legal.ts` (company, address, privacy officer), have `/conditions` and `/confidentialite` reviewed, then set `LEGAL_REVIEWED = true`.
- **Email sender:** verify your own domain in Resend and update `MAIL_FROM`.
- **Address search:** the free public Photon server is fine for testing and light traffic. For heavy use, self-host Photon (`GEOCODER_URL`) or switch to a paid geocoder.

## Things to know about the free plans

- **Render free web service:** it sleeps after about 15 minutes without traffic, so the first request after a pause can take up to a minute. Paid plans don't sleep.
- **Render free PostgreSQL:** it is **deleted after 30 days**. Upgrade it, or move to another database such as Neon or Supabase, before storing real data.
- **Every push to `main`:** Vercel and Render redeploy automatically.

## Changing the database later

1. Edit `backend/prisma/schema.prisma`.
2. Run `npm run db:migration -- --name what-changed` locally. This creates a migration file.
3. Commit it. Render applies it on the next deployment.
