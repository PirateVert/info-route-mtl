import { impactKinds } from "./i18n";

export const LAYER_IDS = ["street", "lane", "sidewalk", "parking", "none"];

export function defaultLayers() {
  return {
    street: true,
    lane: true,
    sidewalk: true,
    parking: true,
    none: false,
  };
}

export function layerKey(layers) {
  return LAYER_IDS.filter((id) => layers[id]).join(",") || "off";
}

export function anyLayerOn(layers) {
  return LAYER_IDS.some((id) => layers[id]);
}

/** A site stays visible when any of its impacts is switched on. */
export function matchesLayers(work, layers) {
  const kinds = impactKinds(work);
  if (!kinds.length) return Boolean(layers.none);
  return kinds.some((kind) => layers[kind]);
}
