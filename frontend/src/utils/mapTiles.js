import L from "leaflet";

export const HD_BASEMAPS = {
  calles: {
    label: "Calles",
    shortLabel: "Calles",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    fallbackUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; colaboradores de OpenStreetMap",
    maxZoom: 19,
    maxNativeZoom: 19,
  },
  vial: {
    label: "Mapa vial",
    shortLabel: "Vial",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
    maxNativeZoom: 18,
  },
  satelite: {
    label: "Satélite",
    shortLabel: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri",
    maxZoom: 19,
    maxNativeZoom: 18,
  },
  vectorial: {
    label: "Solo vectorial",
    shortLabel: "Offline",
    title: "Solo vectorial (sin internet)",
  },
};

/**
 * Crea la capa base Leaflet en resolución nativa exacta (zoom entero 1:1 sin estiramiento)
 * y respaldo automático entre servidores públicos antes de degradar a modo vectorial offline.
 */
export function attachHdBaseLayer(map, basemapKey, { onFallbackOffline, onTileLoaded } = {}) {
  const cfg = HD_BASEMAPS[basemapKey] || HD_BASEMAPS.calles;
  if (!cfg?.url) return null;

  let errorCount = 0;
  let switchedToFallback = false;

  const layer = L.tileLayer(cfg.url, {
    attribution: cfg.attribution,
    tileSize: 256,
    zoomOffset: 0,
    maxZoom: cfg.maxZoom || 19,
    maxNativeZoom: cfg.maxNativeZoom || 19,
    updateWhenZooming: false,
    keepBuffer: 4,
  });

  layer.on("tileerror", () => {
    errorCount += 1;
    if (errorCount >= 4 && cfg.fallbackUrl && !switchedToFallback) {
      switchedToFallback = true;
      errorCount = 0;
      layer.setUrl(cfg.fallbackUrl);
      layer.options.maxNativeZoom = 18;
      return;
    }
    if (errorCount >= 6) {
      onFallbackOffline?.();
    }
  });

  layer.on("tileload", () => {
    errorCount = 0;
    onTileLoaded?.();
  });

  layer.addTo(map);
  layer.bringToBack();
  return layer;
}
