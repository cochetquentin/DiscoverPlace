import { z } from "zod";

export const generateTripSchema = z.object({
  origin: z.object({
    lat: z.number().min(34).max(37),
    lng: z.number().min(138).max(141)
  }),
  durationMinutes: z.union([
    z.literal(60),
    z.literal(120),
    z.literal(240),
    z.literal(360)
  ]),
  mood: z.enum(["surprise", "unusual", "nature", "culture", "food"]),
  walking: z.enum(["low", "medium", "high"]),
  excludeTripId: z.string().optional(),
  excludedPlaceIds: z.array(z.string()).max(500).optional()
});
