# Test Endpoint Troubleshooting

## Issue: Can't Reach `/api/test/balance-tracking` in Browser

### Possible Causes

1. **Server Not Running**
   - Make sure dev server is running: `npm run dev`
   - Check console for errors

2. **Authentication Required**
   - The endpoint requires authentication
   - You must be logged in to access it
   - Browser will show 401 Unauthorized if not logged in

3. **Route Not Found**
   - Make sure file exists: `app/api/test/balance-tracking/route.ts`
   - Check Next.js build logs for errors

### Solutions

#### Solution 1: Check Server is Running

```bash
# Start dev server
npm run dev

# Should see:
# ✓ Ready in Xms
# ○ Local: http://localhost:3000
```

#### Solution 2: Make Sure You're Logged In

1. Open your app in browser: `http://localhost:3000`
2. Log in with your credentials
3. Then try: `http://localhost:3000/api/test/balance-tracking`

#### Solution 3: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try accessing the endpoint
4. Check for errors in console

#### Solution 4: Test with cURL

```bash
# First, get your auth cookie from browser
# Then test endpoint:
curl http://localhost:3000/api/test/balance-tracking \
  -H "Cookie: <your_auth_cookie>"
```

#### Solution 5: Check Route File

```bash
# Verify file exists
ls -la app/api/test/balance-tracking/route.ts

# Check for syntax errors
npm run build
```

### Quick Test

1. **Check if server is running:**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Check if you can access other endpoints:**
   ```bash
   curl http://localhost:3000/api/test/soroban
   ```

3. **Try test endpoint:**
   ```bash
   # In browser (while logged in):
   http://localhost:3000/api/test/balance-tracking
   ```

### Alternative: Use SQL Queries Instead

If the endpoint doesn't work, you can use SQL queries directly:

See: `scripts/simple-balance-queries.sql`

These queries work without authentication and show all data.

