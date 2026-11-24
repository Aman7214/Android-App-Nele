import type { Pool, QueryResultRow } from 'pg';

import type {
  ChatMessage, ChatMessagePage, ConversationSummary, ConversationThread,
} from '../../shared/chat.ts';
import { MESSAGE_PAGE_SIZE } from '../../shared/chat.ts';
import type { AvatarId, Profile, UpdateProfileInput } from '../../shared/profile.ts';
import type { AgentRequestInput } from '../../shared/support.ts';
import type {
  AccountCounts, CreateListingInput, DocumentKind, ListingPage, ListingQuery, ListingRecord, ListingScope,
  ListingStatus,
} from '../../shared/listings.ts';

import { ApiError } from './errors.ts';
import { traceDatabaseQuery } from './telemetry.ts';

export type StoredDocument = {
  id: string;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  size: number;
  objectKey: string;
  createdAt: string;
};

export type ListingDetailRow = { listing: ListingRecord; documents: StoredDocument[]; isOwner: boolean };

export interface ListingRepository {
  list(query: ListingQuery, scope: ListingScope, userId: string | null): Promise<ListingPage>;
  get(listingId: string, userId: string | null): Promise<ListingDetailRow | null>;
  create(input: CreateListingInput, userId: string): Promise<ListingRecord>;
  setStatus(listingId: string, userId: string, status: ListingStatus): Promise<ListingRecord>;
  /** Returns the existing thread when the buyer already started one. */
  startConversation(listingId: string, buyerId: string): Promise<string>;
  listConversations(userId: string): Promise<ConversationSummary[]>;
  getConversation(conversationId: string, userId: string): Promise<ConversationThread | null>;
  listMessages(conversationId: string, userId: string, before?: string): Promise<ChatMessagePage>;
  sendMessage(conversationId: string, userId: string, body: string): Promise<ChatMessage>;
  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(input: UpdateProfileInput, userId: string): Promise<Profile>;
  createAgentRequest(input: AgentRequestInput, userId: string): Promise<{ id: string; createdAt: string }>;
  /** Removes the account row; listings, photos, documents, chats and leads cascade. */
  deleteAccount(userId: string): Promise<boolean>;
  setSaved(listingId: string, userId: string, saved: boolean): Promise<void>;
  counts(userId: string): Promise<AccountCounts>;
  admitWrite(userId: string): Promise<boolean>;
}

type RowPhoto = { objectKey: string; width: number | null; height: number | null };

type DatabaseListing = QueryResultRow & Omit<ListingRecord, 'audience' | 'beds' | 'baths' | 'badge' | 'createdAt' | 'photos'> & {
  audience: ListingRecord['audience'] | null;
  beds: number | null;
  baths: number | null;
  badge: string | null;
  createdAt: Date;
  sortAt: string;
  photos: RowPhoto[] | null;
  status: ListingStatus;
  soldAt: Date | null;
};

type ConversationRow = QueryResultRow & {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImageAsset: ConversationSummary['listingImageAsset'];
  listingStatus: ListingStatus;
  town: ConversationSummary['town'];
  coverKey: string | null;
  role: ConversationSummary['partner']['role'];
  partnerName: string;
  lastMessage: string | null;
  lastMessageAt: string;
  createdAt: string;
};

const conversationSelection = `c.id, c.listing_id AS "listingId", l.title AS "listingTitle",
  l.image_asset AS "listingImageAsset", l.status AS "listingStatus", l.town,
  (SELECT p.object_key FROM nele.listing_photos p WHERE p.listing_id = l.id ORDER BY p.ordinal LIMIT 1) AS "coverKey",
  CASE WHEN c.buyer_id = $1 THEN 'owner' ELSE 'buyer' END AS role,
  CASE WHEN c.buyer_id = $1
    THEN COALESCE((SELECT p.display_name FROM nele.profiles p WHERE p.user_id = c.owner_id), owner.name)
    ELSE COALESCE((SELECT p.display_name FROM nele.profiles p WHERE p.user_id = c.buyer_id), buyer.name)
  END AS "partnerName",
  (SELECT m.body FROM nele.messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS "lastMessage",
  to_char(c.last_message_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "lastMessageAt",
  to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
  FROM nele.conversations c
  JOIN nele.listings l ON l.id = c.listing_id
  JOIN neon_auth."user" owner ON owner.id = c.owner_id
  JOIN neon_auth."user" buyer ON buyer.id = c.buyer_id`;

/**
 * Photos are aggregated per row so a page of listings still costs one query.
 * Keys are stored in Postgres; the public URL is built here so the database
 * never hard-codes a branch-specific storage host.
 */
const columns = `l.id, l.title, l.kind, l.locality, l.town, l.price::float8 AS price,
  l.mode, l.audience, l.beds, l.baths, l.area_sqft AS "areaSqft",
  l.image_asset AS "imageAsset", l.rating, l.reviews, l.badge,
  l.is_sample AS "isSample", l.created_at AS "createdAt", l.status, l.sold_at AS "soldAt",
  coalesce((
    SELECT json_agg(json_build_object('objectKey', p.object_key, 'width', p.width, 'height', p.height) ORDER BY p.ordinal)
    FROM nele.listing_photos p WHERE p.listing_id = l.id
  ), '[]'::json) AS photos`;

function toRecord(row: DatabaseListing, photoUrl: (key: string) => string): ListingRecord {
  return {
    id: row.id, title: row.title, kind: row.kind, locality: row.locality, town: row.town,
    price: row.price, mode: row.mode, audience: row.audience ?? undefined,
    beds: row.beds ?? undefined, baths: row.baths ?? undefined, areaSqft: row.areaSqft,
    imageAsset: row.imageAsset, rating: row.rating, reviews: row.reviews,
    badge: row.badge ?? undefined, isSample: row.isSample,
    status: row.status ?? 'active',
    soldAt: row.soldAt ? row.soldAt.toISOString() : undefined,
    createdAt: row.createdAt.toISOString(), saved: row.saved,
    photos: (row.photos ?? []).map((photo) => ({
      key: photo.objectKey,
      url: photoUrl(photo.objectKey),
      width: photo.width ?? undefined,
      height: photo.height ?? undefined,
    })),
  };
}

function decodeCursor(value: string): [string, string] {
  try {
    const result: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!Array.isArray(result) || result.length !== 2 || typeof result[0] !== 'string' ||
        typeof result[1] !== 'string' || result[1].length > 80 ||
        !/^\d{4}-\d{2}-\d{2}T/.test(result[0]) || !Number.isFinite(Date.parse(result[0]))) {
      throw new Error('Invalid cursor');
    }
    return [result[0], result[1]];
  } catch {
    throw new ApiError(400, 'Invalid page cursor.');
  }
}

function toConversation(row: ConversationRow, photoUrl: (key: string) => string): ConversationSummary {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listingTitle,
    listingImageAsset: row.listingImageAsset,
    listingCoverUrl: row.coverKey ? photoUrl(row.coverKey) : null,
    listingStatus: row.listingStatus,
    town: row.town,
    partner: { role: row.role, name: row.partnerName },
    lastMessage: row.lastMessage ?? null,
    lastMessageAt: row.lastMessageAt,
    createdAt: row.createdAt,
  };
}

type Database = Pick<Pool, 'query'>;
type RepositoryDatabase = Database & Partial<Pick<Pool, 'connect'>>;
type Transaction = <T>(work: (connection: Database) => Promise<T>) => Promise<T>;
type Options = { photoUrl?: (key: string) => string; transaction?: Transaction };

async function runTransaction<T>(pool: RepositoryDatabase, work: (connection: Database) => Promise<T>): Promise<T> {
  if (!pool.connect) throw new Error('Publishing requires a database transaction.');
  const connection = await pool.connect();
  let releaseError: Error | undefined;
  try {
    await connection.query('BEGIN');
    const result = await work(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    try { await connection.query('ROLLBACK'); }
    catch (rollbackError) {
      // A connection with an uncertain transaction state must leave the pool.
      releaseError = rollbackError instanceof Error ? rollbackError : new Error('Rollback failed.');
    }
    throw error;
  } finally { connection.release(releaseError); }
}

export function createListingRepository(pool: RepositoryDatabase, {
  photoUrl = (key) => key, transaction = (work) => runTransaction(pool, work),
}: Options = {}): ListingRepository {
  const queryDatabase = <T extends QueryResultRow>(sql: string, values: unknown[], connection: Database = pool) =>
    traceDatabaseQuery(sql.trim().split(/\s+/, 1)[0], () => connection.query<T>(sql, values));

  const readMessages = async (conversationId: string, userId: string, before?: string): Promise<ChatMessagePage> => {
    const values: unknown[] = [conversationId, userId];
    let cursorPredicate = '';
    if (before) {
      const [at, id] = decodeCursor(before);
      values.push(at, id);
      cursorPredicate = 'AND (m.created_at, m.id) < ($3::timestamptz, $4::text)';
    }
    values.push(MESSAGE_PAGE_SIZE + 1);
    const { rows } = await queryDatabase<ChatMessage & QueryResultRow>(`SELECT m.id,
      m.conversation_id AS "conversationId", m.sender_id AS "senderId", m.body,
      to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
      (m.sender_id = $2) AS mine
      FROM nele.messages m
      WHERE m.conversation_id = $1 AND EXISTS (
        SELECT 1 FROM nele.conversations c
        WHERE c.id = m.conversation_id AND (c.buyer_id = $2 OR c.owner_id = $2)
      ) ${cursorPredicate}
      ORDER BY m.created_at DESC, m.id DESC LIMIT $${values.length}`, values);
    const page = rows.slice(0, MESSAGE_PAGE_SIZE);
    const oldest = page.at(-1);
    return {
      messages: page.reverse(),
      nextCursor: rows.length > MESSAGE_PAGE_SIZE && oldest
        ? Buffer.from(JSON.stringify([oldest.createdAt, oldest.id])).toString('base64url')
        : null,
    };
  };
  return {
    async list(query, scope, userId) {
      const values: unknown[] = [userId];
      const predicates: string[] = [];
      const add = (expression: string, value: unknown) => {
        values.push(value);
        predicates.push(expression.replace('?', `$${values.length}`));
      };
      const sort = scope === 'saved' ? 's.created_at' : 'l.created_at';
      const join = scope === 'saved'
        ? 'JOIN nele.saved_listings s ON s.listing_id = l.id AND s.user_id = $1'
        : '';
      if (scope === 'mine') predicates.push('l.owner_id = $1');
      // Sold properties leave the public feeds; the owner still sees them in `mine`.
      else predicates.push("l.status = 'active'");
      if (query.town) add('l.town = ?', query.town);
      if (query.kind) add('l.kind = ?', query.kind);
      if (query.mode) add('l.mode = ?', query.mode);
      if (query.audience) add('l.audience = ?', query.audience);
      for (const word of query.q?.toLowerCase().split(/\s+/).filter(Boolean) ?? []) {
        add(`l.search_text LIKE ? ESCAPE '\\'`, `%${word.replace(/[\\%_]/g, '\\$&')}%`);
      }
      if (query.cursor) {
        const [at, id] = decodeCursor(query.cursor);
        values.push(at, id);
        predicates.push(`(${sort}, l.id) < ($${values.length - 1}::timestamptz, $${values.length}::text)`);
      }
      values.push(query.limit + 1);
      const { rows } = await queryDatabase<DatabaseListing>(`SELECT ${columns},
        to_char(${sort} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "sortAt",
        CASE WHEN $1::uuid IS NULL THEN false ELSE
          EXISTS (SELECT 1 FROM nele.saved_listings saved WHERE saved.user_id = $1 AND saved.listing_id = l.id)
        END AS saved
        FROM nele.listings l ${join}
        ${predicates.length ? 'WHERE ' + predicates.join(' AND ') : ''}
        ORDER BY ${sort} DESC, l.id DESC LIMIT $${values.length}`, values);
      const hasMore = rows.length > query.limit;
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return {
        listings: page.map((row) => toRecord(row, photoUrl)),
        nextCursor: hasMore && last
          ? Buffer.from(JSON.stringify([last.sortAt, last.id])).toString('base64url')
          : null,
      };
    },
    async get(listingId, userId) {
      const { rows } = await queryDatabase<DatabaseListing & { ownerId: string | null }>(`SELECT ${columns},
        l.owner_id AS "ownerId",
        CASE WHEN $1::uuid IS NULL THEN false ELSE
          EXISTS (SELECT 1 FROM nele.saved_listings saved WHERE saved.user_id = $1 AND saved.listing_id = l.id)
        END AS saved
        FROM nele.listings l WHERE l.id = $2`, [userId, listingId]);
      if (!rows.length) return null;
      const listing = toRecord(rows[0], photoUrl);
      // Documents never travel with a public read; the owner check lives in SQL.
      const documents = await queryDatabase<StoredDocument & QueryResultRow>(`SELECT d.id, d.kind,
        d.file_name AS "fileName", d.mime_type AS "mimeType", d.size_bytes AS "size",
        d.object_key AS "objectKey",
        to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
        FROM nele.listing_documents d JOIN nele.listings l ON l.id = d.listing_id
        WHERE d.listing_id = $2 AND l.owner_id = $1
        ORDER BY d.created_at DESC`, [userId, listingId]);
      return { listing, documents: documents.rows, isOwner: Boolean(userId) && rows[0].ownerId === userId };
    },
    async create(input, userId) {
      return transaction(async (connection) => {
        const query = <T extends QueryResultRow>(sql: string, values: unknown[]) => queryDatabase<T>(sql, values, connection);
        const { rows } = await query<DatabaseListing>(`INSERT INTO nele.listings AS l (
          owner_id, client_request_id, title, kind, locality, town, price, mode, audience,
          beds, baths, area_sqft, image_asset
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (owner_id, client_request_id) DO UPDATE SET client_request_id = EXCLUDED.client_request_id
        RETURNING ${columns}, false AS saved`, [
          userId, input.requestId, input.title, input.kind, input.locality, input.town, input.price,
          input.mode, input.audience ?? null, input.beds ?? null, input.baths ?? null,
          input.areaSqft, input.imageAsset,
        ]);
        const listing = rows[0];
        // The upsert holds this row's lock until commit, serializing retried publishes.
        await query('DELETE FROM nele.listing_photos WHERE listing_id = $1', [listing.id]);
        const photos = input.photos ?? [];
        if (photos.length) {
          await query(`INSERT INTO nele.listing_photos (listing_id, object_key, ordinal, width, height)
            SELECT $1, key, ordinal, width, height
            FROM unnest($2::text[], $3::smallint[], $4::int[], $5::int[]) AS selection (key, ordinal, width, height)`, [
            listing.id,
            photos.map((photo) => photo.key),
            photos.map((_, index) => index),
            photos.map((photo) => photo.width ?? null),
            photos.map((photo) => photo.height ?? null),
          ]);
        }
        await query('DELETE FROM nele.listing_documents WHERE listing_id = $1', [listing.id]);
        const documents = input.documents ?? [];
        if (documents.length) {
          await query(`INSERT INTO nele.listing_documents (listing_id, kind, file_name, object_key, mime_type, size_bytes)
            SELECT $1, kind, file_name, object_key, mime_type, size_bytes
            FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::int[])
              AS selection (kind, file_name, object_key, mime_type, size_bytes)`, [
            listing.id,
            documents.map((document) => document.kind),
            documents.map((document) => document.name),
            documents.map((document) => document.key),
            documents.map((document) => document.mimeType),
            documents.map((document) => document.size),
          ]);
        }
        // Re-read so the response carries the photos that were just stored.
        const stored = await query<DatabaseListing>(`SELECT ${columns}, false AS saved
          FROM nele.listings l WHERE l.id = $1`, [listing.id]);
        return toRecord(stored.rows[0] ?? listing, photoUrl);
      });
    },
    async setStatus(listingId, userId, status) {
      const { rows } = await queryDatabase<DatabaseListing>(`UPDATE nele.listings AS l
        SET status = $3::text,
            sold_at = CASE WHEN $3::text = 'sold' THEN now() ELSE NULL END
        WHERE l.id = $2 AND l.owner_id = $1
        RETURNING ${columns}, false AS saved`, [userId, listingId, status]);
      if (!rows.length) throw new ApiError(404, 'This property is no longer available.');
      return toRecord(rows[0], photoUrl);
    },
    async startConversation(listingId, buyerId) {
      const { rows } = await queryDatabase<{ ownerId: string | null } & QueryResultRow>(
        'SELECT owner_id AS "ownerId" FROM nele.listings WHERE id = $1', [listingId]);
      if (!rows.length) throw new ApiError(404, 'This property is no longer available.');
      const ownerId = rows[0].ownerId;
      if (!ownerId) throw new ApiError(400, 'This listing has no owner to message.');
      if (ownerId === buyerId) throw new ApiError(400, 'This is your own listing.');
      // A second tap on "message" reopens the same thread instead of starting a new one.
      const thread = await queryDatabase<{ id: string }>(`INSERT INTO nele.conversations (listing_id, buyer_id, owner_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (listing_id, buyer_id) DO UPDATE SET listing_id = EXCLUDED.listing_id
        RETURNING id`, [listingId, buyerId, ownerId]);
      return thread.rows[0].id;
    },
    async listConversations(userId) {
      const { rows } = await queryDatabase<ConversationRow>(`SELECT ${conversationSelection}
        WHERE c.buyer_id = $1 OR c.owner_id = $1
        ORDER BY c.last_message_at DESC, c.id DESC LIMIT 100`, [userId]);
      return rows.map((row) => toConversation(row, photoUrl));
    },
    async getConversation(conversationId, userId) {
      const { rows } = await queryDatabase<ConversationRow>(`SELECT ${conversationSelection}
        WHERE c.id = $2 AND (c.buyer_id = $1 OR c.owner_id = $1)`, [userId, conversationId]);
      if (!rows.length) return null;
      return { ...toConversation(rows[0], photoUrl), ...await readMessages(conversationId, userId) };
    },
    async listMessages(conversationId, userId, before) {
      const { rows } = await queryDatabase(`SELECT id FROM nele.conversations
        WHERE id = $1 AND (buyer_id = $2 OR owner_id = $2)`, [conversationId, userId]);
      if (!rows.length) throw new ApiError(404, 'This conversation is no longer available.');
      return readMessages(conversationId, userId, before);
    },
    async sendMessage(conversationId, userId, body) {
      // The sender must be part of the thread; the membership check lives in SQL.
      const { rows } = await queryDatabase<ChatMessage & QueryResultRow>(`WITH inserted AS (
        INSERT INTO nele.messages (conversation_id, sender_id, body)
        SELECT c.id, $2, $3 FROM nele.conversations c
        WHERE c.id = $1 AND (c.buyer_id = $2 OR c.owner_id = $2)
        RETURNING id, conversation_id, sender_id, body, created_at
      ), touched AS (
        UPDATE nele.conversations c SET last_message_at = inserted.created_at
        FROM inserted WHERE c.id = inserted.conversation_id
        RETURNING c.id
      )
      SELECT inserted.id, inserted.conversation_id AS "conversationId",
        inserted.sender_id AS "senderId", inserted.body,
        to_char(inserted.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt",
        true AS mine
      FROM inserted`, [conversationId, userId, body]);
      if (!rows.length) throw new ApiError(404, 'This conversation is no longer available.');
      return rows[0];
    },
    async getProfile(userId) {
      const { rows } = await queryDatabase<{ displayName: string; avatarId: string | null } & QueryResultRow>(`SELECT
        COALESCE(profile.display_name, account.name) AS "displayName",
        profile.avatar_id AS "avatarId"
        FROM neon_auth."user" account
        LEFT JOIN nele.profiles profile ON profile.user_id = account.id
        WHERE account.id = $1`, [userId]);
      if (!rows.length) return null;
      return { displayName: rows[0].displayName, avatarId: rows[0].avatarId as AvatarId | null };
    },
    async updateProfile(input, userId) {
      const { rows } = await queryDatabase<{ displayName: string; avatarId: string | null } & QueryResultRow>(`INSERT INTO nele.profiles AS profile
        (user_id, display_name, avatar_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          avatar_id = EXCLUDED.avatar_id,
          updated_at = now()
        RETURNING profile.display_name AS "displayName", profile.avatar_id AS "avatarId"`,
      [userId, input.displayName, input.avatarId]);
      return { displayName: rows[0].displayName, avatarId: rows[0].avatarId as AvatarId | null };
    },
    async createAgentRequest(input, userId) {
      const { rows } = await queryDatabase<{ id: string; createdAt: string } & QueryResultRow>(`INSERT INTO nele.agent_requests AS r
        (user_id, name, phone, town, intent, budget, contact_time, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING r.id,
          to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"`, [
        userId, input.name, input.phone, input.town, input.intent,
        input.budget ?? null, input.contactTime, input.notes ?? null,
      ]);
      return rows[0];
    },
    async deleteAccount(userId) {
      // Deleting the auth identity cascades every table that references it.
      const result = await queryDatabase('DELETE FROM neon_auth."user" WHERE id = $1', [userId]);
      return Boolean(result.rowCount);
    },
    async setSaved(listingId, userId, saved) {
      if (saved) {
        const { rows } = await queryDatabase(`WITH property AS (
          SELECT id FROM nele.listings WHERE id = $2
        ), added AS (
          INSERT INTO nele.saved_listings (user_id, listing_id)
          SELECT $1, id FROM property ON CONFLICT (user_id, listing_id) DO NOTHING
        ) SELECT id FROM property`, [userId, listingId]);
        if (!rows.length) throw new ApiError(404, 'This property is no longer available.');
      } else {
        await queryDatabase('DELETE FROM nele.saved_listings WHERE user_id = $1 AND listing_id = $2', [userId, listingId]);
      }
    },
    async counts(userId) {
      const { rows } = await queryDatabase<AccountCounts & QueryResultRow>(`SELECT
        (SELECT count(*)::int FROM nele.listings WHERE owner_id = $1) AS listed,
        (SELECT count(*)::int FROM nele.saved_listings WHERE user_id = $1) AS saved`, [userId]);
      return rows[0];
    },
    async admitWrite(userId) {
      const result = await queryDatabase(`INSERT INTO nele.write_limits AS quota (user_id) VALUES ($1)
        ON CONFLICT (user_id) DO UPDATE SET
          window_start = CASE WHEN quota.window_start < now() - interval '1 minute' THEN now() ELSE quota.window_start END,
          requests = CASE WHEN quota.window_start < now() - interval '1 minute' THEN 1 ELSE quota.requests + 1 END
        WHERE quota.window_start < now() - interval '1 minute' OR quota.requests < 60
        RETURNING requests`, [userId]);
      return Boolean(result.rowCount);
    },
  };
}
