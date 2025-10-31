# Debug Redirect Issues

## Why redirects might not work

1. **JavaScript Errors** - Check browser console for errors that might prevent redirect
2. **SessionStorage not set** - Verify `dev_authenticated` is set to "true"
3. **Verify function returning wrong format** - Check if `authResult.success` is actually true
4. **Middleware blocking** - Check if middleware is redirecting away from /wallet

## Check These in Browser Console

After clicking fingerprint button, check console for:

### Expected Log Sequence:

```
[Auth] ====== Starting authentication ======
[Auth] Step 1: Attempting login...
[Auth] Step 2: Challenge generated, calling getPasskey...
[Auth] Step 3: getPasskey result: Got credential
[Auth] Step 4: Verifying authentication...
[Auth] Step 5: Verification result: {success: true, userId: "..."}
[Auth] Step 6: Setting up authentication...
[Auth] SessionStorage verified: true
[Auth] Step 7: Redirecting to wallet...
[Auth] About to redirect - final check: {pathname: "/auth", sessionAuth: "true", redirectingRef: true}
```

### If redirect doesn't happen:

1. **Check if Step 7 is reached** - If not, verification is failing
2. **Check sessionStorage** - Open console and run:
   ```javascript
   sessionStorage.getItem("dev_authenticated");
   // Should return "true"
   ```
3. **Check if still on /auth page** - Look at URL bar
4. **Check for errors** - Look for red error messages in console

## Manual Redirect Test

If redirect isn't working, manually test in console:

```javascript
sessionStorage.setItem("dev_authenticated", "true");
sessionStorage.setItem("dev_username", "user");
window.location.replace("/wallet");
```

## Common Issues

1. **API route returning error** - Check Network tab for `/api/auth/login/verify` response
2. **verifyAuthentication returning false** - Check the response from API
3. **Middleware redirect loop** - Check if middleware is redirecting back to /auth

## Fix: Add More Logging

Added aggressive logging and backup redirects that:

- Try immediate redirect with `window.location.replace()`
- Fallback to `window.location.href` if replace fails
- Backup redirect after 200ms if still on /auth page
- Log final state before redirect

If still not working, check:

1. Browser console for errors
2. Network tab for API failures
3. Application tab > Storage > Session Storage for auth data
