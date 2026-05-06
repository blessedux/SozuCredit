# Community trust, vouches, and credit

Product primitives that tie reputation to limits and eventual credit flows.

## Trust points and vouches

- Users earn and allocate **trust points** through invites, daily activity, and **vouches** between accounts.
- Database tables (`trust_points`, `vouches`, extensions such as **trustworthy vouches**) implement the rules; migrations in `supabase/migrations/` are authoritative.

Operational checks:

- Verify triggers/cron jobs that award points remain idempotent (avoid double awards on retries).
- When changing point economics, backfill carefully and communicate UX impacts.

## Credit requests

Credit surfaces combine trust scores, education progress (when enabled), and risk policy. Feature-specific UI/API docs should live next to the routes under `app/`; update this section when stable contracts exist.

## Partner integrations (Maxflow / external)

External reputation or payout integrations should:

- Use explicit API keys and webhook signing.
- Map external identities to internal `user_id` consistently.
- Log audit trails for limit changes.
