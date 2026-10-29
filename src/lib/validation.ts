import { z } from 'zod';
import { isCarrierId } from '@/lib/carriers';

export const trackRequestSchema = z.object({
  carrier: z.string().refine(isCarrierId, 'Choose a supported carrier.'),
  trackingNumber: z.string()
    .trim()
    .min(3, 'Enter a tracking reference with at least 3 characters.')
    .max(80, 'Tracking references must be 80 characters or fewer.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9 .\/_-]*$/, 'Use letters, numbers, spaces, dots, slashes, or hyphens only.'),
}).transform((value) => ({ ...value, trackingNumber: value.trackingNumber.trim() }));

export const batchRequestSchema = z.object({
  items: z.array(trackRequestSchema).min(1, 'Add at least one shipment.').max(5, 'A batch can contain at most five shipments.'),
});
