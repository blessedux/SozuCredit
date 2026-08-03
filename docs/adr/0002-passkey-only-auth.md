# Passkey-only auth (Backup PIN retired)

Narrative UX v1 authenticates users with **Passkey** only. The former Backup PIN path (tag+PIN login, settings PIN-set, `/api/auth/pin/*`) is removed from UI and disabled at the API. `profiles.recovery_pin_hash` may remain unused until a later cleanup. We chose this over “keep PIN login until recovery ships” so setup never implies a safety net the product does not stand behind. True **Account Recovery** (e.g. second Passkey) is a later initiative after balance orb feedback — not PIN revived.

**Considered options:** (1) strip backup *copy* but keep PIN login for existing hashes — rejected: still advertises a half-recovery model; (2) Passkey-only + disable APIs, leave DB column — accepted; (3) full DB migration + user messaging now — deferred as unnecessary for this epic.

**Consequences:** Users who lose their only Passkey have no in-app recovery this version. Do not ship “contact support to recover” copy unless support can actually restore control.
