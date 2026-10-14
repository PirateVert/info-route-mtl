const PLACES_KEY = "inforoute-places";
const TOKEN_KEY = "inforoute-manage-token";
export const FREE_MAX = 1;
export const PAID_MAX = 5;
export const FREE_LIMIT = FREE_MAX;
export const PAID_LIMIT = PAID_MAX;
export const PLACE_KINDS = ["home", "car", "work", "route", "street", "intersection", "address"];

export function readPlaces() {
  try {
    const raw = localStorage.getItem(PLACES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export function storePlaces(places) {
  try {
    localStorage.setItem(PLACES_KEY, JSON.stringify(places));
  } catch (err) {
    /* private mode */
  }
}

export function readManageToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (err) {
    return "";
  }
}

export function storeManageToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    /* ignore */
  }
}

export function newPlaceId() {
  return `place-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function placeLimit(paid) {
  return paid ? PAID_MAX : FREE_MAX;
}

export function kindNeedsVia(kind) {
  return kind === "route" || kind === "intersection";
}

export function capPlaces(places, paid) {
  return (places || []).slice(0, placeLimit(paid));
}

export function formatPlaceLabel(place) {
  if (!place) return "";
  if (place.label) return place.label;
  const kind = place.kind || place.type;
  if (kind === "route") return `${place.query || ""} → ${place.via || ""}`.trim();
  if (kind === "intersection") return `${place.query || ""} × ${place.via || ""}`.trim();
  return place.query || place.via || "";
}
