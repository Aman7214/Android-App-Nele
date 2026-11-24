import { messagePageQuerySchema, sendMessageSchema, startConversationSchema } from '../../shared/chat.ts';
import { updateProfileSchema } from '../../shared/profile.ts';
import { agentRequestSchema } from '../../shared/support.ts';
import {
  createListingSchema, documentKinds, listingDetailSchema, listingFiltersSchema, updateListingStatusSchema,
  uploadPurposeSchema, type ListingScope,
} from '../../shared/listings.ts';

import { ApiError } from './errors.ts';
import type { ListingRepository } from './repository.ts';
import { jsonResponse } from './compression.ts';
import { createPublicListingCache } from './public-cache.ts';
import {
  documentExtension, MAX_DOCUMENT_BYTES, MAX_PHOTO_BYTES, photoExtension, photoUrl,
  type MediaStorage,
} from './storage.ts';

type Options = {
  repository: ListingRepository;
  identify: (request: Request) => Promise<string | null>;
  allowedOrigins: string[];
  /** Null when object storage is not configured on this branch. */
  storage?: MediaStorage | null;
};

type UploadedBody = {
  arrayBuffer(): Promise<ArrayBuffer>;
  size: number;
  type: string;
  name?: string;
};

/** Accepts the platform `File` from multipart without depending on its constructor. */
function asFile(value: unknown): UploadedBody | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Partial<UploadedBody>;
  return typeof candidate.arrayBuffer === 'function' && typeof candidate.size === 'number'
    && typeof candidate.type === 'string' ? candidate as UploadedBody : null;
}

async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'Send property details as JSON.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Property details are required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_192) {
        await reader.cancel();
        throw new ApiError(413, 'Property details are too large.');
      }
      chunks.push(value);
    }
    const body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(body));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Property details could not be read.');
  } finally {
    reader.releaseLock();
  }
}

export function createApiHandler({ repository, identify, allowedOrigins, storage = null }: Options) {
  const publicCache = createPublicListingCache();
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin, Authorization' });
    const json = (value: unknown, status = 200) => jsonResponse(request, value, status, headers);
    if (origin && !allowedOrigins.includes(origin)) return json({ error: 'This app origin is not allowed.' }, 403);
    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Timing-Allow-Origin', origin);
    }
    headers.set('Access-Control-Expose-Headers', 'Server-Timing, ETag');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/$/, '') || '/';
      const userId = await identify(request);
      const requireUser = () => {
        if (!userId) throw new ApiError(401, 'Sign in to post and save properties.');
        return userId;
      };

      if (request.method === 'GET' && ['/listings', '/saved', '/mine'].includes(path)) {
        const scope = path.slice(1) as ListingScope;
        if (scope !== 'listings') requireUser();
        const query = listingFiltersSchema.safeParse(Object.fromEntries(url.searchParams));
        if (!query.success) throw new ApiError(400, 'Check the property filters.');
        if (scope === 'listings' && !userId) {
          headers.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
          const normalized = { ...query.data, q: query.data.q?.toLowerCase().replace(/\s+/g, ' ') };
          return json(await publicCache.read(JSON.stringify(normalized), () => repository.list(normalized, scope, null)));
        }
        return json(await repository.list(query.data, scope, userId));
      }
      if (request.method === 'GET' && path === '/me') {
        return json(await repository.counts(requireUser()));
      }
      if (request.method === 'POST' && path === '/uploads') {
        const owner = requireUser();
        if (!storage) throw new ApiError(503, 'Photo uploads are not configured for this environment.');
        if (!await repository.admitWrite(owner)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        const declared = Number(request.headers.get('content-length') ?? '0');
        if (Number.isFinite(declared) && declared > MAX_DOCUMENT_BYTES + 1_048_576) {
          throw new ApiError(413, 'That file is too large.');
        }
        // React Native's FormData type shadows the DOM one; this runs on Node.
        const form = await request.formData().catch(() => {
          throw new ApiError(400, 'Choose a photo or document to upload.');
        }) as unknown as { get(name: string): unknown };
        const purpose = uploadPurposeSchema.safeParse(form.get('purpose'));
        if (!purpose.success) throw new ApiError(400, 'Say whether this upload is a photo or a document.');
        const file = asFile(form.get('file'));
        if (!file) throw new ApiError(400, 'Choose a photo or document to upload.');
        if (file.size <= 0) throw new ApiError(400, 'That file is empty.');
        const kindField = form.get('kind');
        const kind = typeof kindField === 'string'
          ? documentKinds.find((value) => value === kindField)
          : undefined;
        if (purpose.data === 'photo') {
          if (!photoExtension(file.type)) throw new ApiError(415, 'Use a JPG, PNG or WebP photo.');
          if (file.size > MAX_PHOTO_BYTES) throw new ApiError(413, 'Keep each photo under 8 MB.');
        } else {
          if (!documentExtension(file.type)) throw new ApiError(415, 'Use a PDF, JPG, PNG or WebP document.');
          if (file.size > MAX_DOCUMENT_BYTES) throw new ApiError(413, 'Keep each document under 15 MB.');
          if (!kind) throw new ApiError(400, 'Choose what kind of document this is.');
        }
        const declaredName = form.get('name');
        const media = {
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type,
          name: typeof declaredName === 'string' && declaredName.trim() ? declaredName : file.name ?? purpose.data,
          size: file.size,
        };
        const stored = purpose.data === 'photo'
          ? await storage.putPhoto(owner, media)
          : await storage.putDocument(owner, media, kind!);
        return json({
          key: stored.key,
          purpose: purpose.data,
          // Documents are private: the client only ever receives a signed link on read.
          url: purpose.data === 'photo' ? photoUrl(stored.key) : null,
          name: stored.name, mimeType: stored.mimeType, size: stored.size,
        }, 201);
      }
      if (request.method === 'POST' && path === '/listings') {
        const owner = requireUser();
        if (!await repository.admitWrite(owner)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        const input = createListingSchema.safeParse(await readJson(request));
        if (!input.success) throw new ApiError(400, 'Check the title, locality, price, area and rental audience.');
        // Uploads are keyed by owner, so a listing can only claim its own files.
        const foreign = [...(input.data.photos ?? []), ...(input.data.documents ?? [])].some((upload) =>
          !upload.key.startsWith(`listings/${owner}/`) && !upload.key.startsWith(`documents/${owner}/`));
        if (foreign) throw new ApiError(403, 'Those uploads belong to another account.');
        const record = await repository.create(input.data, owner);
        publicCache.invalidate();
        return json(record, 201);
      }
      if (request.method === 'GET' && path === '/profile') {
        const profile = await repository.getProfile(requireUser());
        if (!profile) throw new ApiError(404, 'That account no longer exists.');
        return json(profile);
      }
      if (request.method === 'PUT' && path === '/profile') {
        const userId = requireUser();
        if (!await repository.admitWrite(userId)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        const input = updateProfileSchema.safeParse(await readJson(request));
        if (!input.success) throw new ApiError(400, 'Check the display name and avatar.');
        return json(await repository.updateProfile(input.data, userId));
      }
      if (request.method === 'POST' && path === '/agent-requests') {
        const userId = requireUser();
        if (!await repository.admitWrite(userId)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        const input = agentRequestSchema.safeParse(await readJson(request));
        if (!input.success) throw new ApiError(400, 'Check your name, phone number and town.');
        return json(await repository.createAgentRequest(input.data, userId), 201);
      }
      if (request.method === 'DELETE' && path === '/account') {
        const userId = requireUser();
        // Files first: if storage fails we stop before the rows disappear, so the
        // user can retry and nothing is left orphaned in a bucket.
        if (storage) {
          try {
            await storage.deleteOwned(userId);
          } catch {
            throw new ApiError(503, 'Your files could not be removed. Please try again.');
          }
        }
        const deleted = await repository.deleteAccount(userId);
        if (!deleted) throw new ApiError(404, 'That account no longer exists.');
        publicCache.invalidate();
        return json({ deleted: true });
      }
      const statusMatch = /^\/listings\/([a-zA-Z0-9_-]{1,80})\/status$/.exec(path);
      if (request.method === 'PUT' && statusMatch) {
        const owner = requireUser();
        if (!await repository.admitWrite(owner)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        const input = updateListingStatusSchema.safeParse(await readJson(request));
        if (!input.success) throw new ApiError(400, 'Choose whether the property is live or sold.');
        const record = await repository.setStatus(statusMatch[1], owner, input.data.status);
        // A sold property must leave the public feeds immediately.
        publicCache.invalidate();
        return json(record);
      }
      if (request.method === 'GET' && path === '/conversations') {
        return json({ conversations: await repository.listConversations(requireUser()) });
      }
      if (request.method === 'POST' && path === '/conversations') {
        const buyer = requireUser();
        if (!await repository.admitWrite(buyer)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        const input = startConversationSchema.safeParse(await readJson(request));
        if (!input.success) throw new ApiError(400, 'Choose a property to message about.');
        const conversationId = await repository.startConversation(input.data.listingId, buyer);
        const thread = await repository.getConversation(conversationId, buyer);
        if (!thread) throw new ApiError(404, 'This conversation is no longer available.');
        return json(thread, 201);
      }
      const messageMatch = /^\/conversations\/([a-zA-Z0-9_-]{1,80})\/messages$/.exec(path);
      if (request.method === 'GET' && messageMatch) {
        const userId = requireUser();
        const input = messagePageQuerySchema.safeParse(Object.fromEntries(url.searchParams));
        if (!input.success) throw new ApiError(400, 'Check the message page cursor.');
        return json(await repository.listMessages(messageMatch[1], userId, input.data.before));
      }
      if (request.method === 'POST' && messageMatch) {
        const sender = requireUser();
        if (!await repository.admitWrite(sender)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        const input = sendMessageSchema.safeParse(await readJson(request));
        if (!input.success) throw new ApiError(400, 'Write a message before sending.');
        return json(await repository.sendMessage(messageMatch[1], sender, input.data.body), 201);
      }
      const threadMatch = /^\/conversations\/([a-zA-Z0-9_-]{1,80})$/.exec(path);
      if (request.method === 'GET' && threadMatch) {
        const thread = await repository.getConversation(threadMatch[1], requireUser());
        if (!thread) throw new ApiError(404, 'This conversation is no longer available.');
        return json(thread);
      }
      const detailMatch = /^\/listings\/([a-zA-Z0-9_-]{1,80})$/.exec(path);
      if (request.method === 'GET' && detailMatch) {
        const detail = await repository.get(detailMatch[1], userId);
        if (!detail) throw new ApiError(404, 'This property is no longer available.');
        const documents = storage && detail.documents.length
          ? await Promise.all(detail.documents.map(async (document) => ({
            id: document.id, kind: document.kind, name: document.fileName,
            mimeType: document.mimeType, size: document.size,
            url: await storage.signDocument(document.objectKey),
          })))
          : [];
        return json({ ...detail.listing, documents, isOwner: detail.isOwner });
      }
      const savedMatch = /^\/saved\/([a-zA-Z0-9_-]{1,80})$/.exec(path);
      if (savedMatch && ['PUT', 'DELETE'].includes(request.method)) {
        const owner = requireUser();
        if (!await repository.admitWrite(owner)) {
          headers.set('Retry-After', '60');
          throw new ApiError(429, 'Please wait a moment before trying again.');
        }
        await repository.setSaved(savedMatch[1], owner, request.method === 'PUT');
        return json({ saved: request.method === 'PUT' });
      }
      return json({ error: 'This endpoint does not exist.' }, 404);
    } catch (error) {
      headers.set('Cache-Control', 'no-store');
      if (error instanceof ApiError) {
        if (error.status === 401) headers.set('WWW-Authenticate', 'Bearer');
        return json({ error: error.message }, error.status);
      }
      console.error('Nele database request failed', { type: error instanceof Error ? error.name : 'unknown' });
      return json({ error: 'Properties could not be loaded. Please try again.' }, 503);
    }
  };
}
