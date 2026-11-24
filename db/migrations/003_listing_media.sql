-- Owner-uploaded photos and documents.
--
-- `nele.listings.image_asset` stays the NOT NULL stock illustration so sample
-- listings and photo-less posts keep rendering. When photos exist, the first
-- photo (position 0) is the cover and `image_asset` becomes the fallback shown
-- if the cover fails to load.

CREATE TABLE nele.listing_photos (
  listing_id text NOT NULL REFERENCES nele.listings(id) ON DELETE CASCADE,
  object_key text NOT NULL CHECK (char_length(object_key) BETWEEN 8 AND 200),
  ordinal smallint NOT NULL CHECK (ordinal BETWEEN 0 AND 7),
  width integer CHECK (width > 0 AND width <= 20000),
  height integer CHECK (height > 0 AND height <= 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (listing_id, ordinal),
  UNIQUE (listing_id, object_key)
);

-- Documents are optional. No column here is required at post time and the
-- client never blocks submission on them.
CREATE TABLE nele.listing_documents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  listing_id text NOT NULL REFERENCES nele.listings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ownership', 'tax', 'id', 'other')),
  file_name varchar(120) NOT NULL CHECK (char_length(btrim(file_name)) >= 1),
  object_key text NOT NULL CHECK (char_length(object_key) BETWEEN 8 AND 200),
  mime_type varchar(100) NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listing_documents_listing_idx ON nele.listing_documents (listing_id, created_at DESC);
