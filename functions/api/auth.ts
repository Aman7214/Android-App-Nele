import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { ApiError } from './errors.ts';

export function createIdentityVerifier(authUrl: string, jwksUrl: string, keySet?: JWTVerifyGetKey) {
  const jwks = keySet ?? createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 5_000 });
  const issuer = new URL(authUrl).origin;

  return async (request: Request): Promise<string | null> => {
    const header = request.headers.get('authorization');
    if (!header) return null;
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!match) throw new ApiError(401, 'Please sign in again.');
    try {
      const { payload } = await jwtVerify(match[1], jwks, {
        issuer,
        audience: issuer,
        algorithms: ['EdDSA'],
        requiredClaims: ['sub', 'exp', 'aud'],
      });
      if (!payload.sub || payload.role === 'anonymous') throw new Error('Missing user identity');
      return payload.sub;
    } catch {
      throw new ApiError(401, 'Please sign in again.');
    }
  };
}
