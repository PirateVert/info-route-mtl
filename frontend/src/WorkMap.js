import { Fragment, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

const MHM_CENTER = [45.571, -73.5352];

function linePositions(geometry) {
  if (!geometry || !geometry.coordinates) return [];
  const { type, coordinates } = geometry;
  if (type === "LineString") {
    return [coordinates.filter((pair) => pair && pair.length >= 2).map(([lng, lat]) => [lat, lng])];
  }
  if (type === "MultiLineString") {
    return coordinates
      .map((line) => (line || []).filter((pair) => pair && pair.length >= 2).map(([lng, lat]) => [lat, lng]))
      .filter((line) => line.length >= 2);
  }
  return [];
}

function markerColors(work, selected) {
  if (selected) {
    return { color: "#1f2a37", fillColor: "#1d4ed8", weight: 3 };
  }
  if (work.kind === "avis") {
    return { color: "#065f46", fillColor: "#047857", weight: 3 };
  }
  if (work.kind === "mtq") {
    return { color: "#5b21b6", fillColor: "#7c3aed", weight: 3 };
  }
  return { color: "#9a3412", fillColor: "#ea580c", weight: 2 };
}

function MapFocus({ works, selectedId, fitToken, here, focusPoints }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    const points = works.filter((work) => Number.isFinite(work.lat) && Number.isFinite(work.lng));
    if (here && Number.isFinite(here.lat) && Number.isFinite(here.lng)) {
      points.push(here);
    }
    (focusPoints || []).forEach((point) => {
      if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
        points.push(point);
      }
    });
    if (!points.length) return;
    map.invalidateSize();
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((work) => [work.lat, work.lng]));
    map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
  }, [fitToken, works, map, here, focusPoints]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = works.find((work) => work.id === selectedId);
    if (!selected || !Number.isFinite(selected.lat) || !Number.isFinite(selected.lng)) return;
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
  }, [selectedId, works, map]);

  return null;
}

export default function WorkMap({ works, selectedId, onSelect, fitToken, here, focusPoints }) {
  const markers = useMemo(
    () => works.filter((work) => Number.isFinite(work.lat) && Number.isFinite(work.lng)),
    [works]
  );

  return (
    <MapContainer
      center={MHM_CENTER}
      zoom={13}
      scrollWheelZoom={false}
      className="map"
      aria-label="Carte des travaux, des avis et des autoroutes"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus works={markers} selectedId={selectedId} fitToken={fitToken} here={here} focusPoints={focusPoints} />
      {here && Number.isFinite(here.lat) && Number.isFinite(here.lng) && (
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
      {markers.map((work) => {
        const selected = work.id === selectedId;
        const colors = markerColors(work, selected);
        const lines = work.kind === "mtq" ? linePositions(work.geometry) : [];
        return (
          <Fragment key={work.id}>
            {lines.map((positions, index) => (
              <Polyline
                key={`${work.id}-line-${index}`}
                positions={positions}
                pathOptions={{
                  color: selected ? "#1d4ed8" : "#7c3aed",
                  weight: selected ? 6 : 4,
                  opacity: 0.88,
                }}
                eventHandlers={{ click: () => onSelect(work) }}
              />
            ))}
            <CircleMarker
              center={[work.lat, work.lng]}
              radius={selected ? 14 : work.kind === "mtq" ? 8 : work.kind === "avis" ? 9 : 10}
              pathOptions={{
                ...colors,
                fillOpacity: 0.92,
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
