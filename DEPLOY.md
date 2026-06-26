# Deploy to Render.com

## One-time setup

1. **Push the repo to GitHub** (must be a separate repo, e.g. `nexus-backend`).
   - Confirm `.env` and all `*firebase*.json` are **NOT** committed (they are in `.gitignore`).
   - Confirm `dist/`, `node_modules/`, `tmp.js`, `seed.js` are not committed.

2. **Create a new Render service**:
   - Go to https://dashboard.render.com/select-repo
   - Select your `nexus-backend` repo
   - Click **"Apply"** next to `render.yaml` (Blueprint) **OR** pick **"Web Service"** if you'd rather configure manually.
   - Region: `Oregon` (or your nearest). Plan: `Free` is fine to start.

3. **Add the environment variables** (in Render dashboard -> Environment):
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
   - `FIREBASE_MEASUREMENT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`  (must match the `private_key` field from your Firebase service account JSON; paste as a single line with literal `\n` between lines)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `HUGGINGFACE_API_TOKEN`
   - `HUGGINGFACE_EMBEDDING_MODEL`
   - `VITE_GOOGLE_AI_KEY`  (Gemini key, used by product embeddings / recommendations)
   - `VITE_SUPABASE_URL2`
   - `VITE_SUPABASE_PUBLISHABLE_KEY2`

   All values come from your local `.env` (which you keep on your machine and never commit).

4. **Deploy**. Render will run:
   ```
   npm install --include=dev && npm run build
   ```
   then start with `node dist/server.js`.

5. **Verify**: visit `https://<your-service>.onrender.com/health` -> `{ "status": "ok" }`.

## Notes

- **Port**: Render sets `PORT` automatically; the app already reads `process.env.PORT` (defaults to `3000`, falls back to Render's `10000`).
- **Host**: binds to `0.0.0.0` (works on Render).
- **Firebase private key**: this MUST be the `private_key` value from your Firebase service account JSON. The key in your `.env` may look valid but still be wrong — verify it matches the JSON. In the Render dashboard, paste it as a single line with `\n` characters; the app converts them to real newlines and ensures a trailing newline before passing to firebase-admin.
- **Free plan** services sleep after 15 min of inactivity; first request after sleep takes ~30s. Upgrade to `Starter` ($7/mo) for always-on.
- **CORS** is currently `origin: true` (reflects all origins). For production you may want to restrict this to your frontend URL — edit `src/app.ts`.
- **Health check**: Render pings `/health` automatically; keep this route in `src/app.ts`.

## Updating env vars

Render dashboard -> your service -> Environment -> "Add Environment Variable" or edit existing. Service redeploys automatically.

## Logs

Render dashboard -> your service -> Logs. Real-time.
