-- Substring search keeps the current multi-word and BHK matching behavior.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE nele.listings ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(title || ' ' || kind || ' ' || kind || 's ' || locality || ' ' || town || ' '
    || mode || ' ' || coalesce(audience, '') || ' '
    || CASE mode WHEN 'sale' THEN 'buy sell for sale' ELSE 'rent rental for rent' END || ' '
    || CASE audience WHEN 'family' THEN 'family families'
      WHEN 'students' THEN 'student students rooms' ELSE 'anyone' END || ' '
    || CASE WHEN beds IS NOT NULL THEN beds::text || 'bhk ' || beds::text || ' bedrooms' ELSE '' END)
) STORED;

CREATE INDEX listings_search_idx ON nele.listings USING gin (search_text gin_trgm_ops);
CREATE INDEX listings_town_created_idx ON nele.listings (town, created_at DESC, id DESC);
CREATE INDEX listings_kind_created_idx ON nele.listings (kind, created_at DESC, id DESC);
CREATE INDEX listings_mode_audience_created_idx ON nele.listings (mode, audience, created_at DESC, id DESC);
CREATE INDEX saved_listings_listing_idx ON nele.saved_listings (listing_id);
