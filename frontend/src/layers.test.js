import { anyLayerOn, defaultLayers, layerKey, matchesLayers } from "./layers";

function site(kinds) {
  return { kinds };
}

test("defaults keep the four closures on and no-closure off", () => {
  expect(defaultLayers()).toEqual({
    street: true,
    lane: true,
    sidewalk: true,
    parking: true,
    none: false,
  });
  expect(matchesLayers(site(["street"]), defaultLayers())).toBe(true);
  expect(matchesLayers(site(["lane", "parking"]), defaultLayers())).toBe(true);
  expect(matchesLayers(site([]), defaultLayers())).toBe(false);
  expect(matchesLayers({}, defaultLayers())).toBe(false);
});

test("a site stays visible when any of its impacts is switched on", () => {
  const layers = {
    street: false,
    lane: true,
    sidewalk: false,
    parking: false,
    none: false,
  };
  expect(matchesLayers(site(["street", "lane"]), layers)).toBe(true);
  expect(matchesLayers(site(["street"]), layers)).toBe(false);
  expect(matchesLayers(site(["sidewalk", "parking"]), layers)).toBe(false);
  expect(matchesLayers({ sidewalk_closed: true, lane_closed: true }, layers)).toBe(true);
});

test("sites with no announced closure follow the none switch", () => {
  const hidden = { ...defaultLayers(), none: false };
  const shown = { ...defaultLayers(), none: true, street: false, lane: false, sidewalk: false, parking: false };
  expect(matchesLayers(site([]), hidden)).toBe(false);
  expect(matchesLayers({}, shown)).toBe(true);
  expect(matchesLayers(site(["none"]), shown)).toBe(true);
  expect(matchesLayers(site(["none"]), hidden)).toBe(false);
});

test("turning every option off hides every site", () => {
  const layers = {
    street: false,
    lane: false,
    sidewalk: false,
    parking: false,
    none: false,
  };
  expect(anyLayerOn(layers)).toBe(false);
  expect(layerKey(layers)).toBe("off");
  expect(matchesLayers(site(["street", "lane", "sidewalk", "parking"]), layers)).toBe(false);
  expect(matchesLayers({ no_parking: true, street_closed: true }, layers)).toBe(false);
});

test("layer key lists only the switches that are on", () => {
  expect(layerKey({ street: true, lane: false, sidewalk: true, parking: false, none: true })).toBe(
    "street,sidewalk,none"
  );
  expect(anyLayerOn(defaultLayers())).toBe(true);
});
