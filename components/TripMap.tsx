"use client";

import type { Coordinate, TripPlan } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Props = { trip: TripPlan };

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
        };
        Marker: new (options: Record<string, unknown>) => unknown;
        Polyline: new (options: Record<string, unknown>) => unknown;
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

const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY;

function loadGoogleMaps() {
  if (window.google?.maps || !key) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("#google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps indisponible"));
    document.head.appendChild(script);
  });
}

export function TripMap({ trip }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(!key);

  useEffect(() => {
    let active = true;
    loadGoogleMaps()
      .then(() => {
        if (!active || !ref.current || !window.google?.maps) return;
        const points = [
          trip.request.origin,
          ...trip.stops.map((stop) => stop.place.coordinate),
          trip.request.origin
        ];
        const map = new window.google.maps.Map(ref.current, {
          center: trip.stops[0]?.place.coordinate ?? trip.request.origin,
          zoom: 13,
          disableDefaultUI: true,
          mapId: "DEMO_MAP_ID"
        });
        const bounds = new window.google.maps.LatLngBounds();
        points.forEach((point, index) => {
          bounds.extend(point);
          if (index < points.length - 1) {
            new window.google!.maps.Marker({
              position: point,
              map,
              label: index === 0 ? "D" : String(index)
            });
          }
        });
        const geometry = window.google.maps.geometry;
        const decodedSegments = trip.legs
          .map((leg) => leg.polyline && geometry?.encoding.decodePath(leg.polyline))
          .filter((path): path is Coordinate[] => Boolean(path?.length));

        if (decodedSegments.length > 0) {
          decodedSegments.forEach((path) => {
            path.forEach((point) => bounds.extend(point));
            new window.google!.maps.Polyline({
              path,
              map,
              strokeColor: "#f55b3e",
              strokeOpacity: 0.9,
              strokeWeight: 4
            });
          });
        } else {
          new window.google.maps.Polyline({
            path: points,
            map,
            strokeColor: "#f55b3e",
            strokeOpacity: 0.45,
            strokeWeight: 4
          });
        }
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
