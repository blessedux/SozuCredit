# Authentication and accounts

Runbooks for passkeys, profile/username issues, and cleaning up mismatched credentials.

## Passkey mismatch (“Passkey not found” / 401)

Typical causes:

1. Browser credential store out of sync with `passkeys` rows in Supabase.
2. Wrong environment (production vs staging) with stale credentials.
3. Credential id stored in DB does not match what WebAuthn selects.

### Reset passkeys safely

1. **Browser**: remove site passkeys for your host (`chrome://settings/passkeys`, Safari Passwords, Keychain entries for WebAuthn/localhost).
2. **Database** (Supabase SQL editor): inspect rows:

```sql
SELECT p.id, p.user_id, p.credential_id, pr.username, p.created_at
FROM passkeys p
JOIN profiles pr ON p.user_id = pr.id
ORDER BY p.created_at DESC;
```

3. Delete stale credentials for affected users only (avoid blanket deletes in shared environments):

```sql
DELETE FROM passkeys WHERE user_id = '<user_uuid>';
```

4. Re-register via the app’s normal passkey enrollment flow.

## Username visibility (privacy mode)

If profiles support a private username flag, apply schema-driven updates through migrations rather than hand-running legacy scripts. After migrations, verify:

- Public APIs or leaderboards do not leak private handles.
- Invite links and vouch flows still resolve internal user ids.

## Duplicate accounts / uniqueness issues

When triggers or signup paths create conflicting profiles:

1. List duplicates by natural key (email, username, turnkey id — whichever your migration defines).
2. Merge or delete rows in a transaction after backing up data.
3. Fix trigger functions so **insert** paths remain idempotent (e.g. `ON CONFLICT` or guarded inserts).

Always test fixes on a staging project before production.

## Persistence testing

When debugging cookie/session issues:

- Confirm `Secure`, `SameSite`, and domain attributes match deployment URL.
- Confirm API routes that set session cookies run on the same site as the auth UI (avoid cross-subdomain surprises unless configured).
