"use client";

import { hasMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Coord = { lat: number; lng: number };

type Props = {
  initialPosition: Coord;
  onConfirm: (pos: Coord) => void;
  onCancel: () => void;
};

const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 };
const TOKYO_BOUNDS = { latMin: 34, latMax: 37, lngMin: 138, lngMax: 141 };

function isInTokyo(pos: Coord) {
  return (
    pos.lat >= TOKYO_BOUNDS.latMin &&
    pos.lat <= TOKYO_BOUNDS.latMax &&
    pos.lng >= TOKYO_BOUNDS.lngMin &&
    pos.lng <= TOKYO_BOUNDS.lngMax
  );
}

export function LocationPicker({ initialPosition, onConfirm, onCancel }: Props) {
  // Use Tokyo Station as fallback center when the initial position is outside bounds
  const center = isInTokyo(initialPosition) ? initialPosition : TOKYO_STATION;
  const mapRef = useRef<HTMLDivElement>(null);
  // Initialize picked to the rendered marker position so confirm is usable immediately
  const [picked, setPicked] = useState<Coord>(center);
  const [outOfBounds, setOutOfBounds] = useState(!isInTokyo(center));
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    let active = true;

    if (!hasMapsKey) return;

    loadGoogleMaps()
      .then(() => {
        if (!active || !mapRef.current || !window.google?.maps) return;

        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          mapId: "DEMO_MAP_ID"
        });

        const marker = new window.google.maps.Marker({
          position: center,
          map,
          draggable: true
        });

        const updatePicked = (pos: Coord) => {
          setPicked(pos);
          setOutOfBounds(!isInTokyo(pos));
        };

        map.addListener("click", (e: { latLng: { lat(): number; lng(): number } }) => {
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.setPosition(pos);
          updatePicked(pos);
        });

        marker.addListener("dragend", (e?: { latLng: { lat(): number; lng(): number } }) => {
          if (!e) return;
          updatePicked({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      })
      // Fix 2: surface a visible error instead of silently failing
      .catch(() => {
        if (active) setMapError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const noMapContent = mapError ? (
    <div className="picker-no-key">
      <p>Impossible de charger la carte. Vérifie ta connexion ou recharge la page.</p>
    </div>
  ) : (
    <div className="picker-no-key">
      <p>
        Carte indisponible : configure{" "}
        <code>NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY</code> pour choisir
        un point sur la carte.
      </p>
    </div>
  );

  const content = (
    <div className="picker-overlay" role="dialog" aria-modal="true">
      <div className="picker-modal">
        <div className="picker-header">
          <span>Choisir un point de départ</span>
          <button className="mini-button" type="button" onClick={onCancel}>✕</button>
        </div>

        {hasMapsKey && !mapError ? (
          <div className="picker-map" ref={mapRef} />
        ) : (
          noMapContent
        )}

        {outOfBounds && (
          <div className="picker-warning">
            Ce point est hors de Tokyo. Choisis un endroit dans la région de Tokyo.
          </div>
        )}

        <div className="picker-actions">
          <button className="button ghost" type="button" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="button primary"
            type="button"
            disabled={outOfBounds || mapError}
            onClick={() => onConfirm(picked)}
          >
            Utiliser cette position
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
