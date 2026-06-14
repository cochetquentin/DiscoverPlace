const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY;

export const hasMapsKey = Boolean(key);

export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps || !key) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("#google-maps-script");
    if (existing) {
      // Script previously failed: remove it so we can retry below
      if (existing.dataset.failed === "true") {
        existing.remove();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google Maps indisponible")), { once: true });
        return;
      }
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.dataset.failed = "true";
      reject(new Error("Google Maps indisponible"));
    };
    document.head.appendChild(script);
  });
}
