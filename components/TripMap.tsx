"use client";

import { hasMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import type { Coordinate, TripPlan } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Props = { trip: TripPlan };

type MarkerIcon = {
  path: number | string;
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWeight: number;
  scale: number;
};

type MarkerLabel = {
  text: string;
  color: string;
  fontWeight: string;
  fontSize: string;
};

type PolylineIcon = {
  icon: { path: string; strokeOpacity: number; scale: number; strokeColor: string };
  offset: string;
  repeat: string;
};

declare global {
  interface Window {
    // Google Maps is loaded lazily only when a browser API key exists.
    google?: {
      maps: {
        Map: new (
          element: HTMLElement,
          options: Record<string, unknown>
        ) => {
          fitBounds(bounds: { extend(point: Coordinate): void }): void;
          addListener(event: string, handler: (e: { latLng?: { lat(): number; lng(): number } }) => void): void;
        };
        Marker: new (options: {
          position: Coordinate;
          map: unknown;
          icon?: MarkerIcon;
          label?: MarkerLabel;
        }) => {
          setPosition(pos: { lat: number; lng: number }): void;
          addListener(event: string, handler: (e?: { latLng?: { lat(): number; lng(): number } }) => void): void;
        };
        Polyline: new (options: {
          path: Coordinate[];
          map: unknown;
          strokeColor: string;
          strokeOpacity: number;
          strokeWeight: number;
          icons?: PolylineIcon[];
        }) => unknown;
        LatLngBounds: new () => {
          extend(point: Coordinate): void;
        };
        geometry?: {
          encoding: {
            decodePath(encodedPath: string): Coordinate[];
          };
        };
      };
    };
  }
}

function makeMarkerIcon(color: string): MarkerIcon {
  return {
    path: 0, // google.maps.SymbolPath.CIRCLE
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: 10,
  };
}

function makeMarkerLabel(text: string): MarkerLabel {
  return { text, color: "#ffffff", fontWeight: "bold", fontSize: "12px" };
}

export function TripMap({ trip }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(!hasMapsKey);

  useEffect(() => {
    let active = true;
    loadGoogleMaps()
      .then(() => {
        if (!active || !ref.current || !window.google?.maps) return;

        const map = new window.google.maps.Map(ref.current, {
          center: trip.stops[0]?.place.coordinate ?? trip.request.origin,
          zoom: 13,
          disableDefaultUI: true,
          mapId: "DEMO_MAP_ID"
        });
        const bounds = new window.google.maps.LatLngBounds();

        // Marqueur de départ/arrivée (boucle) — rouge
        bounds.extend(trip.request.origin);
        new window.google!.maps.Marker({
          position: trip.request.origin,
          map,
          icon: makeMarkerIcon("#ef4444"),
          label: makeMarkerLabel("D"),
        });

        // Marqueurs des stops — indigo
        trip.stops.forEach((stop, index) => {
          bounds.extend(stop.place.coordinate);
          new window.google!.maps.Marker({
            position: stop.place.coordinate,
            map,
            icon: makeMarkerIcon("#6366f1"),
            label: makeMarkerLabel(String(index + 1)),
          });
        });

        const geometry = window.google.maps.geometry;
        const points = [
          trip.request.origin,
          ...trip.stops.map((s) => s.place.coordinate),
          trip.request.origin,
        ];

        // Seuls les segments à pied sont tracés — les segments TRANSIT n'ont pas
        // de données de géométrie disponibles (restriction Google Maps pour le Japon).
        trip.legs.forEach((leg, i) => {
          if (leg.mode !== "WALK") return;

          const path = leg.polyline && geometry
            ? geometry.encoding.decodePath(leg.polyline)
            : [points[i]!, points[i + 1]!].filter(Boolean);
          if (!path.length) return;
          path.forEach((pt) => bounds.extend(pt));
          new window.google!.maps.Polyline({
            path,
            map,
            strokeColor: "#22c55e",
            strokeOpacity: leg.polyline ? 1 : 0.6,
            strokeWeight: 5,
          });
        });

        map.fitBounds(bounds);
      })
      .catch(() => setFallback(true));
    return () => {
      active = false;
    };
  }, [trip]);

  if (fallback) {
    return (
      <div className="map-fallback" aria-label="Aperçu du parcours">
        <div className="map-orbit orbit-one" />
        <div className="map-orbit orbit-two" />
        <div className="map-route" />
        <span className="map-pin start">D</span>
        {trip.stops.slice(0, 4).map((stop, index) => (
          <span className={`map-pin pin-${index + 1}`} key={stop.place.id}>
            {index + 1}
          </span>
        ))}
        <div className="map-caption">Ajoute une clé Google Maps navigateur pour la carte réelle.</div>
      </div>
    );
  }
  return <div className="trip-map" ref={ref} />;
}
