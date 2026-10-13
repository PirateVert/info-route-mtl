import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

const MHM_CENTER = [45.571, -73.5352];

function MapFocus({ works, selectedId, fitToken }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    const points = works.filter((work) => Number.isFinite(work.lat) && Number.isFinite(work.lng));
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((work) => [work.lat, work.lng]));
    map.invalidateSize();
    map.fitBounds(bounds.pad(0.12), { maxZoom: 15, animate: false });
  }, [fitToken, works, map]);

  useEffect(() => {
    if (!selectedId) return;
    const selected = works.find((work) => work.id === selectedId);
    if (!selected || !Number.isFinite(selected.lat) || !Number.isFinite(selected.lng)) return;
    map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 16), { duration: 0.5 });
  }, [selectedId, works, map]);

  return null;
}

export default function WorkMap({ works, selectedId, onSelect, fitToken }) {
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
      <MapFocus works={markers} selectedId={selectedId} fitToken={fitToken} />
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
