import type { Coordinate } from "@/lib/types";

const EARTH_RADIUS_METERS = 6_371_000;

const radians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMeters(a: Coordinate, b: Coordinate): number {
  const latDelta = radians(b.lat - a.lat);
  const lngDelta = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);

  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;

  return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(value)));
}

export function walkingMinutes(a: Coordinate, b: Coordinate): number {
  return Math.max(1, Math.ceil(distanceMeters(a, b) / 75));
}

// Pénalité de demi-tour : angle proche de 180° entre (from→via) et (via→to).
// Retourne 0 si l'angle est < 90°, monte jusqu'à 20 à 180°.
export function backtrackPenalty(from: Coordinate, via: Coordinate, to: Coordinate): number {
  const v1 = { lat: via.lat - from.lat, lng: via.lng - from.lng };
  const v2 = { lat: to.lat - via.lat, lng: to.lng - via.lng };

  const mag1 = Math.sqrt(v1.lat ** 2 + v1.lng ** 2);
  const mag2 = Math.sqrt(v2.lat ** 2 + v2.lng ** 2);
  if (mag1 < 1e-9 || mag2 < 1e-9) return 0;

  const cosAngle = (v1.lat * v2.lat + v1.lng * v2.lng) / (mag1 * mag2);
  // cosAngle : 1 = même direction, -1 = demi-tour complet
  return Math.max(0, -cosAngle) * 20;
}
