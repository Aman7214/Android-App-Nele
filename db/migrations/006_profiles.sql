-- Display name and illustrated avatar chosen on the profile screen.
-- Kept beside the auth identity rather than inside it: Neon Auth owns
-- neon_auth."user", Nele owns this row and falls back to the account name.

CREATE TABLE nele.profiles (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  display_name varchar(40) CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 40),
  avatar_id text CHECK (avatar_id IN ('a1','a2','a3','a4','a5','a6','a7','a8','a9','a10')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
