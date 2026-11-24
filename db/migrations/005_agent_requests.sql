-- Callback requests from people who want a booking agent to contact them.
-- Signed-in only, so every lead is tied to an account and rate-limited by the
-- same write quota as listings.

CREATE TABLE nele.agent_requests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL CHECK (char_length(btrim(name)) >= 2),
  phone varchar(20) NOT NULL CHECK (phone ~ '^[0-9+][0-9 -]{6,19}$'),
  town text NOT NULL CHECK (town IN ('raichur', 'manvi', 'sindhanur', 'lingasgur', 'mudgal')),
  intent text NOT NULL CHECK (intent IN ('buy', 'rent', 'sell')),
  budget varchar(40),
  contact_time text NOT NULL CHECK (contact_time IN ('morning', 'afternoon', 'evening', 'anytime')),
  notes varchar(500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX agent_requests_created_idx ON nele.agent_requests (created_at DESC);
CREATE INDEX agent_requests_user_idx ON nele.agent_requests (user_id, created_at DESC);
