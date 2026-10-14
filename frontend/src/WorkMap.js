import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

const MHM_CENTER = [45.571, -73.5352];

function MapFocus({ works, selectedId, fitToken, here }) {
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
    if (!points.length) return;
    map.invalidateSize();
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(points.map((work) => [work.lat, work.lng]));
    map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
  }, [fitToken, works, map, here]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = works.find((work) => work.id === selectedId);
    if (!selected || !Number.isFinite(selected.lat) || !Number.isFinite(selected.lng)) return;
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
  }, [selectedId, works, map]);

  return null;
}

export default function WorkMap({ works, selectedId, onSelect, fitToken, here }) {
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
      aria-label="Carte des travaux"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus works={markers} selectedId={selectedId} fitToken={fitToken} here={here} />
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
        return (
          <CircleMarker
            key={work.id}
            center={[work.lat, work.lng]}
            radius={selected ? 14 : 10}
            pathOptions={{
              color: selected ? "#1f2a37" : "#9a3412",
              fillColor: selected ? "#1d4ed8" : "#ea580c",
              fillOpacity: 0.92,
              weight: 2,
            }}
            eventHandlers={{ click: () => onSelect(work) }}
          >
            <Tooltip>{work.street || work.borough}</Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
