# Username Uniqueness Fix

## Problem

Multiple users were able to have the same Sozu tag (username), which violates the core principle that 1 tag = 1 user = 1 passkey = 1 wallet address.

## Root Causes

### 1. Trigger ON CONFLICT Clause (Primary Issue)
The `handle_new_user()` trigger function had a critical flaw in its `ON CONFLICT (id) DO UPDATE` clause:

```sql
on conflict (id) do update set
  username = coalesce(intended_username, profiles.username)
```

**Problem**: When a profile already existed (conflict on `id`), the trigger would try to UPDATE the username to `intended_username` without checking if that username was already taken by another user. The username uniqueness check only happened BEFORE the INSERT, not before the UPDATE in the conflict clause.

### 2. Register/Verify Route (Secondary Issue)
The `/api/auth/register/verify` route was attempting to UPDATE the username on existing profiles:

```typescript
const { error: profileUpdateError } = await supabase
  .from("profiles")
  .update({ username, display_name: username })
  .eq("id", authData.user.id)
```

**Problem**: This could bypass the unique constraint if the profile was created with a different username initially (e.g., from email prefix), and then the route tried to update it to the intended username, which might already be taken.

## Solution

### 1. Fixed Trigger Function (`scripts/021_fix_username_uniqueness.sql`)

**Key Changes**:
- Check if profile already exists before attempting insert
- If profile exists, **DO NOT** update the username (it's immutable once set)
- Only check username uniqueness when creating a NEW profile
- Removed username update from `ON CONFLICT` clause

**New Logic**:
```sql
-- If profile exists, don't change the username
if existing_username is not null then
  intended_username := existing_username;
else
  -- Check if username is taken by another user
  -- Raise error if taken
end if;

-- ON CONFLICT clause now only updates display_name, NOT username
on conflict (id) do update set
  display_name = ...
  -- username is NOT updated
```

### 2. Fixed Register/Verify Route (`app/api/auth/register/verify/route.ts`)

**Key Changes**:
- Removed automatic username updates
- Only update `display_name` if profile exists
- If username doesn't match expected value, log warning but don't change it
- Return proper error if username conflict is detected

**New Logic**:
- If profile exists with correct username → only update display_name
- If profile exists with different username → log warning, don't change username
- If profile exists with no username → try to set it, but fail if conflict
- If profile doesn't exist → create it (trigger should have done this)

### 3. Diagnostic Scripts

Created `scripts/022_find_duplicate_usernames.sql` to:
- Find all duplicate usernames in the database
- Show detailed information about each duplicate
- Help identify existing issues

## Database Constraints

The database should have a unique constraint on `profiles.username`:
```sql
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
```

The fix script (`021_fix_username_uniqueness.sql`) verifies this constraint exists and creates it if missing.

## Testing

1. **Run diagnostic script** to find existing duplicates:
   ```sql
   \i scripts/022_find_duplicate_usernames.sql
   ```

2. **Apply the fix**:
   ```sql
   \i scripts/021_fix_username_uniqueness.sql
   ```

3. **Test registration**:
   - Try to register with an existing username → should fail
   - Register with a new username → should succeed
   - Try to register again with same username → should fail

## Prevention

Going forward:
- ✅ Username is immutable once set (cannot be changed)
- ✅ Trigger checks uniqueness before creating profile
- ✅ Trigger does NOT update username in ON CONFLICT clause
- ✅ Register/verify route does NOT attempt to update username
- ✅ Unique constraint enforced at database level

## Migration Notes

If duplicate usernames are found:
1. Identify all duplicates using the diagnostic script
2. For each duplicate, decide which account should keep the username
3. Update other accounts to have unique usernames (e.g., add suffix)
4. Ensure all affected users can still log in with their passkeys

## Related Files

- `scripts/021_fix_username_uniqueness.sql` - Main fix script
- `scripts/022_find_duplicate_usernames.sql` - Diagnostic script
- `app/api/auth/register/verify/route.ts` - Fixed registration route
- `scripts/020_fix_trigger_username_conflict.sql` - Previous attempt (had the bug)
- `docs/USERNAME_PRIVACY_MODEL.md` - Username privacy documentation
