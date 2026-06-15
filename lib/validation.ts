import { z } from "zod";

export const generateTripSchema = z
  .object({
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
    excludedPlaceIds: z.array(z.string()).max(500).optional(),
    departureAt: z.string().datetime().optional(),
    arrivalBy: z.string().datetime().optional()
  })
  .refine(
    (data) => !(data.departureAt && data.arrivalBy),
    { message: "departureAt and arrivalBy are mutually exclusive", path: ["departureAt"] }
  )
  .refine(
    (data) => {
      const departure = data.departureAt
        ? new Date(data.departureAt)
        : data.arrivalBy
          ? new Date(new Date(data.arrivalBy).getTime() - data.durationMinutes * 60_000)
          : null;
      if (!departure) return true;
      return departure.getTime() > Date.now() - 5 * 60_000;
    },
    { message: "L'heure de départ calculée est dans le passé.", path: ["departureAt"] }
  )
  .refine(
    (data) => {
      const ts = data.departureAt ?? data.arrivalBy;
      if (!ts) return true;
      return new Date(ts).getTime() < Date.now() + 100 * 24 * 60 * 60 * 1000;
    },
    { message: "L'heure planifiée dépasse l'horizon de 100 jours des transports en commun.", path: ["departureAt"] }
  );
