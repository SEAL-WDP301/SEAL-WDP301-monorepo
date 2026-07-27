export type EventLocationMapData = {
  name?: string | null;
  venueName?: string | null;
  address?: string | null;
  mapUrl?: string | null;
};

const INVALID_PLACEHOLDER_MAP_URLS = new Set([
  "https://maps.app.goo.gl/fpthcm",
]);

export function buildGoogleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function getEventMapUrl(location?: EventLocationMapData | null) {
  if (!location) return null;

  const configuredUrl = location.mapUrl?.trim();
  if (
    configuredUrl &&
    !INVALID_PLACEHOLDER_MAP_URLS.has(configuredUrl.toLowerCase())
  ) {
    return configuredUrl;
  }

  const query = [location.venueName || location.name, location.address]
    .filter(Boolean)
    .join(", ");

  return query ? buildGoogleMapsSearchUrl(query) : null;
}
