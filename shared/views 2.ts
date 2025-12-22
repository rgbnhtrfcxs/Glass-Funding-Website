import { z } from "zod";

export const insertLabViewSchema = z.object({
  labId: z.number().int().positive(),
  sessionId: z.string().min(8),
  referrer: z.string().optional().nullable(),
});

export type InsertLabView = z.infer<typeof insertLabViewSchema>;

export const labViewAggregateSchema = z.object({
  views7d: z.number(),
  views30d: z.number(),
  favorites: z.number(),
  recentFavorites: z.array(
    z.object({
      labId: z.number().int().positive(),
      userId: z.string().uuid(),
      createdAt: z.string(),
    }),
  ),
});

export type LabViewAggregate = z.infer<typeof labViewAggregateSchema>;
