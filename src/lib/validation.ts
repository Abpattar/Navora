import { z } from 'zod';
import { isCarrierId, normalizeCarrierNameOrId } from '@/lib/carriers';

export const trackRequestSchema = z.object({
  carrier: z.string().refine(isCarrierId, 'Choose a supported carrier.'),
  trackingNumber: z.string()
    .trim()
    .min(3, 'Enter a tracking reference with at least 3 characters.')
    .max(80, 'Tracking references must be 80 characters or fewer.')
    .regex(/^[A-Za-z0-9][A-Za-z0-9 .\/_-]*$/, 'Use letters, numbers, spaces, dots, slashes, or hyphens only.'),
}).transform((value) => ({ ...value, trackingNumber: value.trackingNumber.trim() }));

export const batchRequestSchema = z.object({
  items: z.array(trackRequestSchema).min(1, 'Add at least one shipment.').max(100, 'Batch size limit is 100 shipments per job.'),
});

export const manifestRowSchema = z.object({
  shipmentId: z.string().trim().min(1, 'Shipment ID is required.'),
  trackingNumber: z.string().trim().min(3, 'Tracking number must be at least 3 characters.').max(80),
  carrier: z.string().transform((val, ctx) => {
    const normalized = normalizeCarrierNameOrId(val);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unrecognized carrier "${val}". Please specify a known carrier or alias.`,
      });
      return z.NEVER;
    }
    return normalized;
  }),
  promisedEta: z.string().nullable().optional(),
  assignedDock: z.enum(['Dock A', 'Dock B', 'Dock C', 'Dock D']).nullable().optional(),
  origin: z.string().nullable().optional(),
  destination: z.string().nullable().optional(),
});

export const rescheduleActionSchema = z.object({
  shipmentId: z.string().min(1, 'Shipment ID is required.'),
  originalBookingId: z.string().optional(),
  recommendedDockId: z.enum(['Dock A', 'Dock B', 'Dock C', 'Dock D']),
  recommendedSlotTime: z.string().min(1, 'Slot time is required.'),
  approved: z.boolean().default(false),
  reason: z.string().default('Shipment delay adjustment'),
  idempotencyKey: z.string().optional(),
});

export const dockBookingCreateSchema = z.object({
  shipmentId: z.string().min(1, 'Shipment ID is required.'),
  trackingNumber: z.string().min(3),
  carrierName: z.string().min(1),
  dockId: z.enum(['Dock A', 'Dock B', 'Dock C', 'Dock D']),
  slotTime: z.string().min(1, 'Slot time is required.'),
  originalBookingId: z.string().optional(),
  notes: z.string().optional(),
});
