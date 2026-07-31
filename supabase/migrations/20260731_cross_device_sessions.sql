-- Cross-Device Registration Sessions
-- QR flow: desktop without biometrics registers via phone.
-- Apply in Supabase SQL editor (or `supabase db push`) before merging SOZU-22 (#7).

CREATE TABLE IF NOT EXISTS public.cross_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id),
  credential_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cross_device_session_id
  ON public.cross_device_sessions (session_id);

CREATE INDEX IF NOT EXISTS idx_cross_device_expires
  ON public.cross_device_sessions (expires_at);

-- Ephemeral pairing table: routes use the anon server client before login.
-- Anyone with the session_id (from the QR) can read/update that row.
ALTER TABLE public.cross_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon insert cross_device_sessions"
  ON public.cross_device_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anon select cross_device_sessions"
  ON public.cross_device_sessions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "anon update cross_device_sessions"
  ON public.cross_device_sessions
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.cleanup_expired_cross_device_sessions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.cross_device_sessions
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

COMMENT ON TABLE public.cross_device_sessions IS
  'Temporary sessions for QR code cross-device passkey registration. Desktop creates session; phone completes it.';
