import { Fragment, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

const MHM_CENTER = [45.571, -73.5352];
// Island plus Québec 511 approaches. 0,0 is Null Island (Gulf of Guinea).
const MAP_LAT_MIN = 45.38;
const MAP_LAT_MAX = 45.73;
const MAP_LNG_MIN = -74.05;
const MAP_LNG_MAX = -73.45;

export function isMapPoint(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= MAP_LAT_MIN && lat <= MAP_LAT_MAX && lng >= MAP_LNG_MIN && lng <= MAP_LNG_MAX;
}

const pinIcon = L.divIcon({
  className: "search-pin",
  html: '<span class="search-pin-mark"></span>',
  iconSize: [28, 40],
  iconAnchor: [14, 38],
});

function linePositions(geometry) {
  if (!geometry || !geometry.coordinates) return [];
  const { type, coordinates } = geometry;
  const keep = (pair) => pair && pair.length >= 2 && isMapPoint(pair[1], pair[0]);
  if (type === "LineString") {
    const line = coordinates.filter(keep).map(([lng, lat]) => [lat, lng]);
    return line.length >= 2 ? [line] : [];
  }
  if (type === "MultiLineString") {
    return coordinates
      .map((line) => (line || []).filter(keep).map(([lng, lat]) => [lat, lng]))
      .filter((line) => line.length >= 2);
  }
  return [];
}

export function impactColor(work, selected) {
  if (selected) {
    return { color: "#1f2a37", fillColor: "#1d4ed8", weight: 3 };
  }
  const primary = work.map_primary || (work.kind === "avis" ? "lane" : work.kind === "mtq" ? "lane" : "none");
  if (primary === "street") return { color: "#7f1d1d", fillColor: "#dc2626", weight: 3 };
  if (primary === "lane") return { color: "#b45309", fillColor: "#f59e0b", weight: 2 };
  if (primary === "sidewalk") return { color: "#075985", fillColor: "#0284c7", weight: 2 };
  if (primary === "parking") return { color: "#854d0e", fillColor: "#ca8a04", weight: 3 };
  if (work.kind === "avis") return { color: "#065f46", fillColor: "#047857", weight: 3 };
  if (work.kind === "mtq") return { color: "#5b21b6", fillColor: "#7c3aed", weight: 3 };
  return { color: "#64748b", fillColor: "#94a3b8", weight: 2 };
}

function MapFocus({ works, selectedId, fitToken, here, focusPoints, pin }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    const points = works.filter((work) => isMapPoint(work.lat, work.lng));
    if (here && isMapPoint(here.lat, here.lng)) {
      points.push(here);
    }
    if (pin && isMapPoint(pin.lat, pin.lng)) {
      points.push(pin);
    }
    (focusPoints || []).forEach((point) => {
      if (point && isMapPoint(point.lat, point.lng)) {
        points.push(point);
      }
    });
    if (!points.length) return;
    map.invalidateSize();
    if (pin && isMapPoint(pin.lat, pin.lng) && (focusPoints || []).length <= 1) {
      map.setView([pin.lat, pin.lng], 16, { animate: false });
      return;
    }
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((work) => [work.lat, work.lng]));
    map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
  }, [fitToken, works, map, here, focusPoints, pin]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = works.find((work) => work.id === selectedId);
    if (!selected || !isMapPoint(selected.lat, selected.lng)) return;
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
  }, [selectedId, works, map]);

  return null;
}

export default function WorkMap({ works, selectedId, onSelect, fitToken, here, focusPoints, pin, snowLots = [] }) {
  const markers = useMemo(
    () => works.filter((work) => isMapPoint(work.lat, work.lng)),
    [works]
  );

  return (
    <MapContainer
      center={MHM_CENTER}
      zoom={13}
      scrollWheelZoom={false}
      className="map"
      aria-label="Carte des fermetures et des endroits"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus works={markers} selectedId={selectedId} fitToken={fitToken} here={here} focusPoints={focusPoints} pin={pin} />
      {pin && isMapPoint(pin.lat, pin.lng) && (
        <Marker position={[pin.lat, pin.lng]} icon={pinIcon}>
          <Tooltip permanent>{pin.label}</Tooltip>
        </Marker>
      )}
      {here && isMapPoint(here.lat, here.lng) && (
        <CircleMarker
          center={[here.lat, here.lng]}
          radius={9}
          pathOptions={{
            color: "#1d4ed8",
            fillColor: "#3b82f6",
            fillOpacity: 0.95,
            weight: 3,
          }}
        >
          <Tooltip permanent>{here.label}</Tooltip>
        </CircleMarker>
      )}
      {snowLots.map((lot) => (
        isMapPoint(lot.lat, lot.lng) ? (
          <CircleMarker
            key={lot.id}
            center={[lot.lat, lot.lng]}
            radius={7}
            pathOptions={{ color: "#0f766e", fillColor: "#14b8a6", fillOpacity: 0.85, weight: 2 }}
          >
            <Tooltip>{lot.name_fr || lot.name_en || lot.id}</Tooltip>
          </CircleMarker>
        ) : null
      ))}
      {markers.map((work) => {
        const selected = work.id === selectedId;
        const colors = impactColor(work, selected);
        const lines = work.kind === "mtq" ? linePositions(work.geometry) : [];
        return (
          <Fragment key={work.id}>
            {lines.map((positions, index) => (
              <Polyline
                key={`${work.id}-line-${index}`}
                positions={positions}
                pathOptions={{
                  color: selected ? "#1d4ed8" : colors.fillColor,
                  weight: selected ? 6 : 4,
                  opacity: 0.88,
                }}
                eventHandlers={{ click: () => onSelect(work) }}
              />
            ))}
            <CircleMarker
              center={[work.lat, work.lng]}
              radius={selected ? 14 : work.closes ? 11 : 8}
              pathOptions={{
                ...colors,
                fillOpacity: work.closes || selected ? 0.92 : 0.7,
              }}
              eventHandlers={{ click: () => onSelect(work) }}
            >
              <Tooltip>{work.title || work.street || work.borough}</Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
