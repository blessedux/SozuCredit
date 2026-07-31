-- Cross-Device Registration Sessions
-- For QR code flow: desktop without biometrics registers via phone

CREATE TABLE IF NOT EXISTS cross_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id),
  credential_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Index for quick session lookups
  INDEX idx_cross_device_session_id ON cross_device_sessions(session_id),
  INDEX idx_cross_device_expires ON cross_device_sessions(expires_at)
);

-- Auto-cleanup expired sessions (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_cross_device_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM cross_device_sessions
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE cross_device_sessions IS 'Temporary sessions for QR code cross-device passkey registration. Desktop creates session, phone completes it.';
