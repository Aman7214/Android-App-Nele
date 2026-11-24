import './auth-runtime';

import { createAuthClient } from '@neon/auth';
import { BetterAuthVanillaAdapter } from '@neon/auth/vanilla/adapters';
import { z } from 'zod';

import { sessionStorage } from './session-storage';
import { singleFlight } from '../utils/shared-request.ts';

const authUrl = process.env.EXPO_PUBLIC_NEON_AUTH_URL;
const userSchema = z.object({
  id: z.string(), name: z.string(), email: z.string(), emailVerified: z.boolean(),
});
const storedSessionSchema = z.union([
  z.strictObject({ authUrl: z.string(), token: z.string() }),
  z.strictObject({ authUrl: z.string(), signedOut: z.literal(true) }),
]);
export type AccountUser = z.infer<typeof userSchema>;

let credential: string | null = null;
let currentUser: AccountUser | null = null;
let generation = 0;
let expiredHandler = () => {};
let client: ReturnType<typeof buildClient> | undefined;

export class VerificationRequiredError extends Error {
  constructor() { super('Verify your email to finish creating your account.'); }
}

function buildClient(baseUrl: string) {
    return createAuthClient(baseUrl, {
      adapter: BetterAuthVanillaAdapter({
        fetchOptions: {
          credentials: 'include',
          timeout: 15_000,
          onRequest: (context) => {
            if (credential) context.headers.set('Authorization', `Bearer ${credential}`);
          },
          onSuccess: async (context) => {
            const token = context.response.headers.get('set-auth-token');
            if (token) await saveCredential(token);
          },
        },
      }),
    });
}

function getClient() {
  if (!authUrl) throw new Error('The account connection is not configured yet.');
  client ??= buildClient(authUrl);
  return client;
}

const readSession = singleFlight((force: boolean) => getClient().getSession(force
  ? { fetchOptions: { headers: { 'X-Force-Fetch': 'true' } } }
  : undefined));

async function saveCredential(token: string) {
  credential = token;
  await sessionStorage.write(JSON.stringify({ authUrl, token }));
}

export function onSessionExpired(handler: () => void) { expiredHandler = handler; }
export function sessionGeneration() { return generation; }

export async function clearSession() {
  generation += 1;
  credential = null;
  currentUser = null;
  // Remember sign-out even if the server could not clear its cookie while offline.
  await sessionStorage.write(JSON.stringify({ authUrl, signedOut: true }));
}

export async function expireSession(expectedUserId?: string, expectedGeneration?: number) {
  if (expectedUserId && currentUser?.id !== expectedUserId) return;
  if (expectedGeneration !== undefined && generation !== expectedGeneration) return;
  await clearSession();
  expiredHandler();
}

export async function restoreSession(): Promise<AccountUser | null> {
  if (!authUrl) throw new Error('The account connection is not configured yet.');
  const stored = await sessionStorage.read();
  if (stored) {
    try {
      const parsed = storedSessionSchema.parse(JSON.parse(stored));
      if (parsed.authUrl !== authUrl) { await clearSession(); return null; }
      if ('signedOut' in parsed) return null;
      credential = parsed.token;
    } catch { await clearSession(); return null; }
  }
  if (!credential && !sessionStorage.cookieSessionFallback) return null;
  const started = generation;
  const result = await readSession(`session:${started}:force`, true);
  if (started !== generation) return currentUser;
  if (result.error) throw new Error(result.error.message ?? 'Your account could not be restored.');
  currentUser = result.data?.user ? userSchema.parse(result.data.user) : null;
  if (!currentUser && credential) await clearSession();
  return currentUser;
}

export async function authenticate(input: { email: string; password: string; name?: string }, signUp: boolean) {
  await clearSession();
  const auth = getClient();
  const result = signUp
    ? await auth.signUp.email({ email: input.email, password: input.password, name: input.name ?? input.email.split('@')[0] })
    : await auth.signIn.email({ email: input.email, password: input.password });
  if (result.error) {
    if (result.error.code === 'EMAIL_NOT_VERIFIED') throw new VerificationRequiredError();
    throw new Error(result.error.message ?? 'Sign in failed. Please try again.');
  }
  if (result.data?.token && !credential) await saveCredential(result.data.token);
  const user = await restoreSession();
  if (!user) {
    if (signUp) throw new VerificationRequiredError();
    throw new Error('Your session could not be started. Please try again.');
  }
  return user;
}

export async function verifyEmail(email: string, otp: string) {
  // $fetch retains Neon's managed hooks while avoiding widened plugin types in @neon/auth 0.8.2.
  const result = await getClient().$fetch<{ status: boolean }>('/email-otp/verify-email', {
    method: 'POST', body: { email, otp },
  });
  if (result.error) throw new Error(result.error.message ?? 'The verification code could not be checked.');
}

export async function sendVerificationCode(email: string) {
  const result = await getClient().$fetch<{ success: boolean }>('/email-otp/send-verification-otp', {
    method: 'POST', body: { email, type: 'email-verification' },
  });
  if (result.error) throw new Error(result.error.message ?? 'The verification code could not be sent.');
}

export async function signOut() {
  try {
    const result = await getClient().signOut();
    if (result.error) throw new Error(result.error.message ?? 'Sign out could not be confirmed.');
  } finally { await clearSession(); }
}

export async function accessToken(expectedUserId: string): Promise<string> {
  const started = generation;
  if (currentUser?.id !== expectedUserId) throw new Error('Please sign in again.');
  // Neon places the JWT on the session and refreshes it when its managed cache expires.
  const result = await readSession(`session:${started}`, false);
  if (started !== generation) throw new Error('Your account changed. Please try again.');
  if (result.error) {
    if (result.error.status === 401 || result.error.status === 403) {
      await expireSession(expectedUserId, started);
      throw new Error('Please sign in again.');
    }
    throw new Error('Your account connection is unavailable. Please try again.');
  }
  if (!result.data?.session?.token) {
    await expireSession(expectedUserId, started);
    throw new Error('Please sign in again.');
  }
  if (result.data.user.id !== expectedUserId) throw new Error('Your account changed. Please try again.');
  return result.data.session.token;
}
