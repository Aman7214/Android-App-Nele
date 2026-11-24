-- Sold status for a listing, and in-app buyer/seller chat.

-- Owners mark a property sold once the deal closes. Sold listings drop out of
-- the public feeds but stay readable (and badged) by id, so shared links and
-- the owner's own list still work.
ALTER TABLE nele.listings
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold')),
  ADD COLUMN sold_at timestamptz;

CREATE INDEX listings_status_created_idx ON nele.listings (status, created_at DESC, id DESC);

-- One thread per (listing, buyer); the owner is denormalised so the seller's
-- inbox is a single indexed scan.
CREATE TABLE nele.conversations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  listing_id text NOT NULL REFERENCES nele.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id),
  CHECK (buyer_id <> owner_id)
);

CREATE INDEX conversations_buyer_idx ON nele.conversations (buyer_id, last_message_at DESC);
CREATE INDEX conversations_owner_idx ON nele.conversations (owner_id, last_message_at DESC);

CREATE TABLE nele.messages (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id text NOT NULL REFERENCES nele.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conversation_idx ON nele.messages (conversation_id, created_at DESC, id DESC);
