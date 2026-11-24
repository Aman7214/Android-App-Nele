import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

const compressBrotli = promisify(brotliCompress);
const compressGzip = promisify(gzip);

function encoding(header: string): 'br' | 'gzip' | undefined {
  const weights = new Map<string, number>();
  for (const part of header.toLowerCase().split(',')) {
    const [name, ...parameters] = part.trim().split(';');
    const quality = parameters.find((value) => value.trim().startsWith('q='));
    const weight = quality ? Number(quality.trim().slice(2)) : 1;
    weights.set(name.trim(), Number.isFinite(weight) && weight >= 0 && weight <= 1 ? weight : 0);
  }
  const quality = (name: string) => weights.get(name) ?? weights.get('*') ?? 0;
  const br = quality('br');
  const gz = quality('gzip');
  return br > 0 && br >= gz ? 'br' : gz > 0 ? 'gzip' : undefined;
}

export async function jsonResponse(request: Request, value: unknown, status: number, baseHeaders: Headers) {
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Vary', 'Origin, Authorization, Accept-Encoding');
  const original = Buffer.from(JSON.stringify(value));
  let body = new Uint8Array(original);
  const selected = encoding(request.headers.get('accept-encoding') ?? '');
  if (selected && original.byteLength >= 1024) {
    const compressed = selected === 'br'
      ? await compressBrotli(original, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } })
      : await compressGzip(original, { level: 6 });
    if (compressed.byteLength < original.byteLength) {
      body = new Uint8Array(compressed);
      headers.set('Content-Encoding', selected);
    }
  }
  if (status === 200 && headers.get('Cache-Control')?.startsWith('public')) {
    const tag = `"${createHash('sha256').update(body).digest('hex').slice(0, 24)}"`;
    headers.set('ETag', tag);
    const matches = request.headers.get('if-none-match')?.split(',').map((value) => value.trim().replace(/^W\//, ''));
    if (matches?.includes(tag) || matches?.includes('*')) {
      headers.delete('Content-Type');
      headers.delete('Content-Encoding');
      return new Response(null, { status: 304, headers });
    }
  }
  headers.set('Content-Length', String(body.byteLength));
  return new Response(body, { status, headers });
}
