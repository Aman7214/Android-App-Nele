import { z } from 'zod';

import { towns } from './listings.ts';

/** What the caller wants an agent to help with. */
export const agentIntents = ['buy', 'rent', 'sell'] as const;
/** When it is convenient to call. */
export const contactTimes = ['morning', 'afternoon', 'evening', 'anytime'] as const;

export const agentIntentLabels: Record<(typeof agentIntents)[number], string> = {
  buy: 'Buying a property',
  rent: 'Looking for a rental',
  sell: 'Selling or renting out my property',
};

export const contactTimeLabels: Record<(typeof contactTimes)[number], string> = {
  morning: 'Morning (9am–12pm)',
  afternoon: 'Afternoon (12pm–4pm)',
  evening: 'Evening (4pm–8pm)',
  anytime: 'Any time',
};

export const agentRequestSchema = z.strictObject({
  name: z.string().trim().min(2, 'Tell us your name.').max(80),
  // Deliberately loose: Indian mobile numbers are written with spaces, +91 and dashes.
  phone: z.string().trim().min(7).max(20).regex(/^[0-9+][0-9 ()-]{6,19}$/, 'Enter a phone number we can call.'),
  town: z.enum(towns),
  intent: z.enum(agentIntents),
  budget: z.string().trim().max(40).optional(),
  contactTime: z.enum(contactTimes),
  notes: z.string().trim().max(500).optional(),
});

export const agentRequestResultSchema = z.strictObject({
  id: z.string(),
  createdAt: z.string(),
});

export type AgentRequestInput = z.infer<typeof agentRequestSchema>;
export type AgentRequestResult = z.infer<typeof agentRequestResultSchema>;
export type AgentIntent = (typeof agentIntents)[number];
export type ContactTime = (typeof contactTimes)[number];
