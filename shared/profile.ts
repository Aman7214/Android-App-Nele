import { z } from 'zod';

/**
 * The bundled illustrated avatars. Kept here (not in the app) so the server can
 * reject an id that would never render on a client.
 */
export const AVATAR_IDS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9', 'a10'] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 40;

export const profileSchema = z.strictObject({
  /** Falls back to the account name until the user changes it. */
  displayName: z.string(),
  /** Constrained by a CHECK constraint in the database and the bundled set here. */
  avatarId: z.enum(AVATAR_IDS).nullable(),
});

/** A full replace: the edit screen always sends both fields. */
export const updateProfileSchema = z.strictObject({
  displayName: z.string().trim().min(DISPLAY_NAME_MIN, 'Use at least 2 characters.').max(DISPLAY_NAME_MAX),
  avatarId: z.enum(AVATAR_IDS).nullable(),
});

export type Profile = z.infer<typeof profileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
