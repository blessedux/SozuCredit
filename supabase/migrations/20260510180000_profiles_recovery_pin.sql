-- Optional backup PIN (scrypt hash) for passkey accounts; set from Settings after first passkey login.
alter table public.profiles
  add column if not exists recovery_pin_hash text;

comment on column public.profiles.recovery_pin_hash is 'Format saltB64:hashB64 from Node scrypt; null if user has not set a backup PIN.';
