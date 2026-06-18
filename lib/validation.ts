import { z } from "zod";

export const generateTripSchema = z
  .object({
    origin: z.object({
      lat: z.number().min(34).max(37),
      lng: z.number().min(138).max(141)
    }),
    destination: z.object({
      lat: z.number().min(34).max(37),
      lng: z.number().min(138).max(141)
    }).optional(),
    durationMinutes: z.union([
      z.literal(120),
      z.literal(240),
      z.literal(360)
    ]),
    walking: z.enum(["low", "medium", "high"]),
    excludeTripId: z.string().optional(),
    excludedPlaceIds: z.array(z.string()).max(500).optional(),
    departureAt: z.string().datetime({ offset: true }).optional(),
    arrivalBy: z.string().datetime({ offset: true }).optional()
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
      return departure.getTime() > Date.now() - 60_000;
    },
    { message: "L'heure de départ calculée est dans le passé.", path: ["departureAt"] }
  )
  .refine(
    (data) => {
      const HORIZON_MS = 100 * 24 * 60 * 60 * 1000;
      // Pour departureAt : valider departureAt + durationMinutes (la dernière requête routing)
      if (data.departureAt) {
        return new Date(data.departureAt).getTime() + data.durationMinutes * 60_000 < Date.now() + HORIZON_MS;
      }
      // Pour arrivalBy : le retour arrive à arrivalBy, c'est le timestamp le plus tardif
      if (data.arrivalBy) {
        return new Date(data.arrivalBy).getTime() < Date.now() + HORIZON_MS;
      }
      return true;
    },
    { message: "L'heure planifiée dépasse l'horizon de 100 jours des transports en commun.", path: ["departureAt"] }
  );
