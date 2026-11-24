CREATE SCHEMA IF NOT EXISTS nele;

CREATE TABLE nele.listings (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id uuid REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  client_request_id varchar(80),
  title varchar(60) NOT NULL CHECK (char_length(btrim(title)) >= 3),
  kind text NOT NULL CHECK (kind IN ('House', 'Apartment', 'Plot', 'Land', 'Shop', 'Warehouse', 'Hostel')),
  locality varchar(40) NOT NULL CHECK (char_length(btrim(locality)) >= 2),
  town text NOT NULL CHECK (town IN ('raichur', 'manvi', 'sindhanur', 'lingasgur', 'mudgal')),
  price bigint NOT NULL CHECK (price > 0 AND price <= 9999999999),
  mode text NOT NULL CHECK (mode IN ('rent', 'sale')),
  audience text CHECK (audience IN ('students', 'family', 'anyone')),
  beds smallint CHECK (beds BETWEEN 0 AND 99),
  baths smallint CHECK (baths BETWEEN 0 AND 99),
  area_sqft integer NOT NULL CHECK (area_sqft > 0 AND area_sqft <= 99999999),
  image_asset text NOT NULL CHECK (image_asset IN ('house', 'apartment', 'flat', 'plot', 'land', 'shop', 'warehouse', 'hostel')),
  rating double precision NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  reviews integer NOT NULL DEFAULT 0 CHECK (reviews >= 0),
  badge text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, client_request_id),
  CHECK ((mode = 'rent' AND audience IS NOT NULL) OR (mode = 'sale' AND audience IS NULL)),
  CHECK (
    (is_sample AND owner_id IS NULL AND client_request_id IS NULL)
    OR (NOT is_sample AND owner_id IS NOT NULL AND client_request_id IS NOT NULL)
  )
);

CREATE INDEX listings_created_idx ON nele.listings (created_at DESC, id DESC);
CREATE INDEX listings_town_mode_idx ON nele.listings (town, mode, created_at DESC, id DESC);
CREATE INDEX listings_owner_idx ON nele.listings (owner_id, created_at DESC, id DESC);

CREATE TABLE nele.saved_listings (
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  listing_id text NOT NULL REFERENCES nele.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX saved_listings_user_created_idx ON nele.saved_listings (user_id, created_at DESC, listing_id DESC);

CREATE TABLE nele.write_limits (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL DEFAULT now(),
  requests integer NOT NULL DEFAULT 1 CHECK (requests > 0)
);
