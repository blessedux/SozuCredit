# Vercel Environment Variables Setup Guide

## Quick Setup Steps

### 1. Get Your Vercel Project URL

Go to your Vercel dashboard → Your project → Settings → General
Note your project URL (e.g., `your-app.vercel.app`)

### 2. Add Environment Variables in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Click **Add New** and add these variables:

   **Variable 1:**

   - **Name:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** `https://hxzwqsywmahgngbgeinb.supabase.co`
   - **Environment:** Select all (Production, Preview, Development)

   **Variable 2:**

   - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4endxc3l3bWFoZ25nYmdlaW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NjY3NzcsImV4cCI6MjA3NzQ0Mjc3N30.4Hzd5WQ0TCCyfrMUw_Ha5O7RhclkkXQ9cF1F2HGon1c`
   - **Environment:** Select all (Production, Preview, Development)

   **Variable 3 (Optional but Recommended):**

   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** `[your-service-role-key]` (Get from Supabase Dashboard → Settings → API → service_role key)
   - **Environment:** Select all (Production, Preview, Development)

3. **Important:** After adding variables, you MUST redeploy:
   - Go to **Deployments** tab
   - Click the **three dots** (⋯) on the latest deployment
   - Click **Redeploy** → **Redeploy**
   - OR push a new commit to trigger a new deployment

### 3. Verify Environment Variables

After redeploying, check the health endpoint:

```
https://your-app.vercel.app/api/health
```

You should see:

```json
{
  "status": "ok",
  "config": {
    "supabaseUrl": "✓ Set",
    "supabaseAnonKey": "✓ Set",
    "supabaseServiceKey": "✓ Set"
  }
}
```

### 4. Configure Supabase CORS (If Needed)

If you still get CORS errors, add your Vercel domain to Supabase:

1. Go to **Supabase Dashboard** → Your Project → **Settings** → **API**
2. Under **CORS**, add your Vercel domain:
   - `https://your-app.vercel.app`
   - `https://*.vercel.app` (wildcard for preview deployments)

### 5. Check Vercel Function Logs

If you still see 500 errors:

1. Go to **Vercel Dashboard** → **Deployments** → Latest deployment
2. Click **Functions** tab
3. Check the logs for specific error messages

Common errors:

- `Missing Supabase environment variables` → Variables not set correctly
- `Failed to initialize database connection` → Check Supabase URL format
- `Network error` → Check Supabase project is active

## Troubleshooting

### Environment Variables Not Working

- ✅ Make sure you selected all environments (Production, Preview, Development)
- ✅ Redeploy after adding variables
- ✅ Check variable names for typos (case-sensitive)
- ✅ Make sure values don't have extra spaces

### Still Getting 500 Errors

1. Check `/api/health` endpoint first
2. Check Vercel function logs for specific error
3. Verify Supabase project is active (not paused)
4. Make sure database tables exist (run SQL scripts)

### CORS Errors

1. Add Vercel domain to Supabase CORS settings
2. Check browser console for specific CORS error
3. Verify API routes are returning CORS headers

## Quick Checklist

- [ ] Environment variables added to Vercel
- [ ] All 3 environments selected (Production, Preview, Development)
- [ ] Redeployed after adding variables
- [ ] Health endpoint shows all variables set
- [ ] Vercel domain added to Supabase CORS (if needed)
- [ ] Checked function logs for specific errors
