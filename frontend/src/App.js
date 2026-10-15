import { useEffect, useMemo, useState } from "react";
import AddressSuggest from "./AddressSuggest";
import WorkMap, { isMapPoint } from "./WorkMap";
import Subscribe from "./Subscribe";
import { Footer, Header, navigate, useRoute } from "./chrome";
import {
  COPY,
  avisTypeLabel,
  dateRangeText,
  formatDistance,
  formatImport,
  geoErrorKey,
  impactKinds,
  impactLabel,
  mtqDescription,
  readLang,
  reasonLabel,
  scheduleText,
  storeLang,
  whoText,
} from "./i18n";
import { anyLayerOn, defaultLayers, layerKey, LAYER_IDS, matchesLayers } from "./layers";
import PlaceKindBar from "./PlaceKindBar";
import {
  FREE_MAX,
  PAID_MAX,
  capPlaces,
  formatPlaceLabel,
  kindNeedsVia,
  newPlaceId,
  readManageToken,
  readPlaces,
  storeManageToken,
  storePlaces,
} from "./places";

async function getJson(path, options) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const response = await fetch(`${base}${path}`, options);
  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload.detail || "";
    } catch (err) {
      /* ignore */
    }
    const error = new Error(detail || `HTTP ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response.json();
}

function errorMessage(copy, error) {
  if (!error) return copy.loadError;
  if (error.detail === "outside_montreal" || error.detail === "bad_coords") return copy.geoOutside;
  if (error.detail === "place_not_found") return copy.placeNotFound;
  if (error.detail === "too_many_places") return copy.placeUpgrade;
  if (copy[error]) return copy[error];
  return copy.loadError;
}

function SiteList({ items, selectedId, onSelect, copy, lang, search = false }) {
  return (
    <ul className="site-list">
      {items.map((work) => (
        <li key={work.id}>
          <button
            type="button"
            className={`${work.id === selectedId ? "active" : ""} impact-${work.map_primary || "none"}`.trim()}
            onClick={() => onSelect(work)}
          >
            <span className="street">{work.title || work.street || copy.unknown}</span>
            <span className="meta">
              {impactLabel(work.resident_primary || work.map_primary || "none", lang)}
              {work.borough ? ` · ${work.borough}` : ""}
              {search && work.match
                ? ` · ${work.match === "street" ? copy.streetMatch : copy.nearbyMatch}`
                : ""}
              {search && formatDistance(work.distance_m, lang)
                ? ` · ${formatDistance(work.distance_m, lang)}`
                : ""}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PlaceCards({ statuses, copy, lang, onOpen }) {
  if (!statuses.length) {
    return <p className="hint">{copy.placesEmpty}</p>;
  }
  return (
    <ul className="place-cards">
      {statuses.map((place) => (
        <li key={place.id || place.label}>
          <button
            type="button"
            className={`place-card ${place.status || "none"}`}
            onClick={() => onOpen(place)}
          >
            <span className="place-card-kind">{copy.placeKinds[place.kind] || place.kind}</span>
            <strong>{lang === "en" ? place.headline_en || place.headline : place.headline_fr || place.headline}</strong>
            {place.snow?.enabled && <span className="place-card-snow">{copy.snowSoon}</span>}
            {place.snow_lots?.[0] && (
              <span className="place-card-snow">
                {copy.snowLotsTitle}
                {": "}
                {lang === "en" ? place.snow_lots[0].name_en : place.snow_lots[0].name_fr}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function App() {
  const [lang, setLang] = useState(readLang);
  const copy = COPY[lang];
  const route = useRoute();
  const path = route.split("?")[0];
  const [borough, setBorough] = useState("");
  const [boroughs, setBoroughs] = useState([]);
  const [importedAt, setImportedAt] = useState("");
  const [avisImportedAt, setAvisImportedAt] = useState("");
  const [mtqImportedAt, setMtqImportedAt] = useState("");
  const [snowImportedAt, setSnowImportedAt] = useState("");
  const [snowAvailable, setSnowAvailable] = useState(false);
  const [snowEnabled, setSnowEnabled] = useState(false);
  const [works, setWorks] = useState([]);
  const [avis, setAvis] = useState([]);
  const [mtq, setMtq] = useState([]);
  const [snowLots, setSnowLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [pin, setPin] = useState(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [layers, setLayers] = useState(defaultLayers);
  const [places, setPlaces] = useState(readPlaces);
  const [placeStatuses, setPlaceStatuses] = useState([]);
  const [placeKind, setPlaceKind] = useState("home");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeVia, setPlaceVia] = useState("");
  const [draft, setDraft] = useState(null);
  const [draftEnd, setDraftEnd] = useState(null);
  const [pendingReplace, setPendingReplace] = useState(null);
  const paid = Boolean(readManageToken());
  const needsVia = kindNeedsVia(placeKind);

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "fr";
    document.title = "Info-Route MTL";
  }, [lang]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    if (path.startsWith("/subscribe/success") || path.startsWith("/subscribe/manage")) {
      const stored = params.get("session_id");
      if (token) storeManageToken(token);
      if (stored) {
        getJson(`/api/subscribe/session?session_id=${encodeURIComponent(stored)}`)
          .then((data) => {
            if (data.manage_token) storeManageToken(data.manage_token);
          })
          .catch(() => {});
      }
    }
  }, [path]);

  useEffect(() => {
    let cancel = false;
    getJson("/api/meta")
      .then((data) => {
        if (cancel) return;
        setBoroughs((data.boroughs || []).map((item) => item.name));
        setImportedAt(data.imported_at || "");
        setAvisImportedAt(data.avis?.imported_at || "");
        setMtqImportedAt(data.mtq?.imported_at || "");
        setSnowImportedAt(data.snow?.imported_at || "");
        setSnowAvailable(Boolean(data.snow?.lots_available));
        setSnowEnabled(Boolean(data.snow?.status_enabled));
      })
      .catch(() => {
        if (!cancel) setError("loadError");
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");
    const worksPath = borough ? `/api/works?borough=${encodeURIComponent(borough)}` : "/api/works";
    const avisPath = borough ? `/api/avis?borough=${encodeURIComponent(borough)}` : "/api/avis";
    const mtqPath = borough ? `/api/mtq?borough=${encodeURIComponent(borough)}` : "/api/mtq";
    Promise.all([
      getJson(worksPath),
      getJson(avisPath).catch(() => ({ avis: [] })),
      getJson(mtqPath).catch(() => ({ mtq: [] })),
      getJson("/api/snow-lots").catch(() => ({ lots: [], available: false })),
    ])
      .then(([workData, avisData, mtqData, snowData]) => {
        if (cancel) return;
        setWorks(workData.works || []);
        setAvis(avisData.avis || []);
        setMtq(mtqData.mtq || []);
        setSnowLots(snowData.available ? snowData.lots || [] : []);
        setSnowAvailable(Boolean(snowData.available));
        setLoading(false);
      })
      .catch(() => {
        if (cancel) return;
        setError("loadError");
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [borough]);

  useEffect(() => {
    setPlaces((current) => {
      const next = capPlaces(current, paid);
      return next.length === current.length ? current : next;
    });
  }, [paid]);

  useEffect(() => {
    storePlaces(places);
    if (!places.length) {
      setPlaceStatuses([]);
      return undefined;
    }
    let cancel = false;
    getJson("/api/places/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ places: capPlaces(places, paid), lang, paid }),
    })
      .then((data) => {
        if (!cancel) setPlaceStatuses(data.places || []);
      })
      .catch(() => {
        if (!cancel) setPlaceStatuses([]);
      });
    return () => {
      cancel = true;
    };
  }, [places, lang, paid]);

  function changeLang(next) {
    setLang(next);
    storeLang(next);
  }

  function selectWork(work) {
    setSelectedId(work.id);
    const card = document.getElementById("site-detail");
    if (card && window.matchMedia("(max-width: 899px)").matches) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function runTypedSearch(kind, start, end) {
    const label = end
      ? (kind === "intersection" ? `${start.label} × ${end.label}` : `${start.label} → ${end.label}`)
      : (start.label || placeQuery);
    if (start?.lat != null) setPin({ ...start, label });
    setQuery(label);
    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({ type: kind, q: start.label || placeQuery || label });
      if (end?.label || placeVia) params.set("via", end?.label || placeVia);
      if (start?.lat != null && start?.lng != null) {
        params.set("lat", String(start.lat));
        params.set("lng", String(start.lng));
      }
      const data = await getJson(`/api/search?${params.toString()}`);
      setSearch(data);
      setSelectedId("");
    } catch (err) {
      if (err.detail === "outside_montreal" || err.detail === "bad_coords") setError("geoOutside");
      else if (err.detail === "place_not_found") setError("placeNotFound");
      else setError("loadError");
      setSearch({
        place: { label, lat: start?.lat, lng: start?.lng, source: kind },
        results: [],
      });
    } finally {
      setSearching(false);
    }
    const map = document.getElementById("map-panel");
    if (map) map.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function zoomTo(place, kind = "near_me") {
    if (kind !== "near_me" && kind !== "car") {
      await runTypedSearch(kind, place, null);
      return;
    }
    setPin(place);
    setQuery(place.label || "");
    setSearching(true);
    setError("");
    try {
      const data = await getJson(
        `/api/search?type=near_me&lat=${encodeURIComponent(place.lat)}&lng=${encodeURIComponent(place.lng)}&q=${encodeURIComponent(place.label || "")}`
      );
      setSearch(data);
      setSelectedId("");
    } catch (err) {
      setSearch({
        place: { label: place.label, lat: place.lat, lng: place.lng, source: "address" },
        results: [],
      });
    } finally {
      setSearching(false);
    }
    const map = document.getElementById("map-panel");
    if (map) map.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("geoUnsupported");
      return;
    }
    setLocating(true);
    setSearching(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const here = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            label: copy.youAreHere,
          };
          setPlaceKind("car");
          setPlaceQuery(copy.youAreHere);
          setDraft(here);
          setDraftEnd(null);
          setPlaceVia("");
          await zoomTo(here, "car");
        } catch (err) {
          setError(err.detail === "outside_montreal" || err.detail === "bad_coords" ? "geoOutside" : "loadError");
        } finally {
          setLocating(false);
          setSearching(false);
        }
      },
      (err) => {
        setLocating(false);
        setSearching(false);
        setError(geoErrorKey(err));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  function clearSearch() {
    setSearch(null);
    setQuery("");
    setPin(null);
    setSelectedId("");
  }

  function buildPlace(from = draft, until = draftEnd, kind = placeKind) {
    if (!from) return null;
    if (kindNeedsVia(kind) && !until) return null;
    const via = kindNeedsVia(kind) ? (until?.label || "") : "";
    let label = from.label;
    if (kind === "route" && until) label = `${from.label} → ${until.label}`;
    if (kind === "intersection" && until) label = `${from.label} × ${until.label}`;
    return {
      id: newPlaceId(),
      kind,
      type: kind,
      query: from.label,
      via,
      label,
      lat: from.lat,
      lng: from.lng,
      end_lat: until?.lat,
      end_lng: until?.lng,
    };
  }

  function resetDraft() {
    setPlaceQuery("");
    setPlaceVia("");
    setDraft(null);
    setDraftEnd(null);
    setPendingReplace(null);
  }

  async function commitPlaces(nextList, { replace = false } = {}) {
    try {
      await getJson("/api/places/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ places: nextList, paid, replace }),
      });
    } catch (err) {
      if (err.detail === "too_many_places") {
        setError(paid ? "placeLimitPaidFull" : "placeUpgrade");
        return false;
      }
    }
    setPlaces(nextList);
    resetDraft();
    return true;
  }

  async function savePlace({ replace = false } = {}) {
    const next = pendingReplace || buildPlace();
    if (!next) return;
    if (paid) {
      if (places.length >= PAID_MAX) {
        setError("placeLimitPaidFull");
        return;
      }
      await commitPlaces([...places, next]);
      return;
    }
    if (places.length >= FREE_MAX && !replace) {
      setPendingReplace(next);
      setError("placeUpgrade");
      return;
    }
    await commitPlaces([next], { replace: true });
  }

  function removePlace(id) {
    setPlaces((current) => current.filter((place) => place.id !== id));
  }

  const layered = useMemo(
    () => [
      ...works.map((work) => ({ ...work, kind: work.kind || "work" })),
      ...avis.map((item) => ({ ...item, kind: "avis" })),
      ...mtq.map((item) => ({ ...item, kind: "mtq" })),
    ],
    [works, avis, mtq]
  );
  const shown = useMemo(() => {
    const rows = search ? search.results || [] : layered;
    return rows.filter((item) => matchesLayers(item, layers));
  }, [search, layered, layers]);
  const workCount = shown.filter((item) => item.kind !== "avis" && item.kind !== "mtq").length;
  const avisCount = shown.filter((item) => item.kind === "avis").length;
  const mtqCount = shown.filter((item) => item.kind === "mtq").length;
  const selected = useMemo(
    () => shown.find((work) => work.id === selectedId) || null,
    [shown, selectedId]
  );
  const here = useMemo(() => {
    if (search?.place?.source !== "coords") return null;
    return { lat: search.place.lat, lng: search.place.lng, label: copy.youAreHere };
  }, [search, copy.youAreHere]);
  const focusPoints = useMemo(() => {
    const points = [];
    if (pin) points.push(pin);
    if (search?.place && isMapPoint(search.place.lat, search.place.lng)) {
      points.push({ lat: search.place.lat, lng: search.place.lng });
    }
    return points;
  }, [search, pin]);
  const fitToken = pin
    ? `pin:${pin.lat}:${pin.lng}`
    : search
      ? `search:${search.type || ""}:${search.query}:${search.place?.lat || ""}:${search.place?.lng || ""}`
      : `borough:${borough}:w${works.length}:a${avis.length}:m${mtq.length}:layers${layerKey(layers)}`;

  const boroughOptions = useMemo(() => {
    const names = new Set(boroughs);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "fr"));
  }, [boroughs]);

  const nearbySnow = useMemo(() => {
    if (!snowAvailable || !pin) return snowLots.slice(0, 40);
    return snowLots;
  }, [snowAvailable, snowLots, pin]);

  return (
    <>
    <Header lang={lang} setLang={changeLang} />
    <main className="page">
      {path.startsWith("/subscribe") ? (
        <Subscribe lang={lang} savedPlaces={places} />
      ) : (
      <>
      <div className="hero">
      <h1 className="page-title">{copy.title}</h1>
      <p className="tagline">{copy.tagline}</p>
      <p className="disclaimer">{copy.disclaimer}</p>
      </div>

      <section className="home-places" id="places">
        <div className="places-head">
          <h2>{copy.placesTitle}</h2>
          <p className="hint">{paid ? copy.placeLimitPaid : copy.placeLimitFree}</p>
        </div>
        <PlaceCards
          statuses={placeStatuses}
          copy={copy}
          lang={lang}
          onOpen={(place) => {
            if (isMapPoint(place.sites?.[0]?.lat, place.sites?.[0]?.lng)) {
              selectWork(place.sites[0]);
            }
            const match = places.find((item) => item.id === place.id);
            if (match?.lat) zoomTo({ lat: match.lat, lng: match.lng, label: match.label });
          }}
        />
        {placeStatuses.some((item) => item.snow_lots?.length) && (
          <div className="snow-lots">
            <h3>{copy.snowLotsTitle}</h3>
            <ul>
              {placeStatuses.flatMap((item) => item.snow_lots || []).slice(0, 6).map((lot) => (
                <li key={lot.id}>{lang === "en" ? lot.name_en : lot.name_fr} · {lang === "en" ? lot.hours_en : lot.hours_fr}</li>
              ))}
            </ul>
          </div>
        )}
        {snowEnabled && <p className="hint">{copy.snowSoon}</p>}
        {places.map((place) => (
          <p key={`rm-${place.id}`} className="place-remove-row">
            <span>{formatPlaceLabel(place)}</span>
            <button type="button" className="text-button" onClick={() => removePlace(place.id)}>{copy.subscribe.removePlace}</button>
          </p>
        ))}
        {!paid && (
          <p className="hint">
            {copy.placeUpgrade}{" "}
            <a href="/subscribe" onClick={(event) => { event.preventDefault(); navigate("/subscribe"); }}>{copy.paidCta}</a>
          </p>
        )}
      </section>

      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft && (!needsVia || draftEnd)) {
            runTypedSearch(placeKind, draft, draftEnd);
          } else if (placeQuery.trim()) {
            runTypedSearch(placeKind, { label: placeQuery.trim(), lat: draft?.lat, lng: draft?.lng }, draftEnd || (placeVia ? { label: placeVia } : null));
          }
        }}
      >
        <PlaceKindBar
          value={placeKind}
          onChange={(kind) => {
            setPlaceKind(kind);
            setDraftEnd(null);
            setPlaceVia("");
            setPendingReplace(null);
          }}
          labels={copy.placeKinds}
          groupLabel={copy.searchLabel}
          idPrefix="search-kind"
        />
        <p className="hint">{paid ? copy.searchHelpPaid : copy.searchHelp}</p>
        <AddressSuggest
          id="map-search-query"
          lang={lang}
          label={copy.subscribe.placeQuery[placeKind] || copy.placeKind}
          value={placeQuery}
          placeholder={copy.subscribe.placePlaceholder[placeKind] || copy.searchPlaceholder}
          onChange={(value) => {
            setPlaceQuery(value);
            setDraft(null);
          }}
          onPick={(item) => {
            setPlaceQuery(item.label);
            setDraft(item);
            if (!needsVia) runTypedSearch(placeKind, item, null);
          }}
        />
        {needsVia && (
          <AddressSuggest
            id="map-search-via"
            lang={lang}
            label={copy.subscribe.placeVia[placeKind] || copy.routeEnd}
            value={placeVia}
            placeholder={copy.subscribe.placeViaPlaceholder[placeKind] || copy.subscribe.placeViaPlaceholder.route}
            onChange={(value) => {
              setPlaceVia(value);
              setDraftEnd(null);
            }}
            onPick={(item) => {
              setPlaceVia(item.label);
              setDraftEnd(item);
              if (draft) runTypedSearch(placeKind, draft, item);
            }}
          />
        )}
        <div className="search-row">
          <button type="submit" className="search-go" disabled={searching || (!placeQuery.trim() && !draft)}>
            {searching ? copy.searching : copy.searchButton}
          </button>
          <button
            type="button"
            className="search-go"
            disabled={!draft || (needsVia && !draftEnd)}
            onClick={() => savePlace()}
          >
            {copy.addPlace}
          </button>
          <button type="button" className="locate-button" disabled={searching} onClick={useMyLocation}>
            {locating ? copy.locating : copy.useMyLocation}
          </button>
        </div>
        {pendingReplace && !paid && (
          <div className="replace-place">
            <p className="hint">{copy.replaceAsk(formatPlaceLabel(places[0]) || pendingReplace.label)}</p>
            <div className="search-row">
              <button type="button" className="search-go" onClick={() => savePlace({ replace: true })}>
                {copy.replacePlace}
              </button>
              <a
                className="text-button inline-link"
                href="/subscribe"
                onClick={(event) => { event.preventDefault(); navigate("/subscribe"); }}
              >
                {copy.keepAndUpgrade}
              </a>
            </div>
          </div>
        )}
      </form>

      <div className="filters" id="map-panel">
        <label htmlFor="borough">{copy.boroughLabel}</label>
        <select
          id="borough"
          value={borough}
          onChange={(event) => {
            setBorough(event.target.value);
            setSearch(null);
            setSelectedId("");
          }}
        >
          <option value="">{copy.allBoroughs}</option>
          {boroughOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <div className="layer-controls">
          <div className="layer-controls-head">
            <p className="legend-title" id="map-options-label">{copy.mapOptions}</p>
            <div className="layer-bulk">
              <button type="button" className="text-button" onClick={() => setLayers(Object.fromEntries(LAYER_IDS.map((id) => [id, true])))}>
                {copy.layersAllOn}
              </button>
              <button type="button" className="text-button" onClick={() => setLayers(Object.fromEntries(LAYER_IDS.map((id) => [id, false])))}>
                {copy.layersAllOff}
              </button>
            </div>
          </div>
          <p className="hint">{copy.mapOptionsHint}</p>
          <div className="layer-toggles" role="group" aria-labelledby="map-options-label">
            {LAYER_IDS.map((id) => {
              const on = Boolean(layers[id]);
              const label = {
                street: copy.legendStreet,
                lane: copy.legendLane,
                sidewalk: copy.legendSidewalk,
                parking: copy.legendParking,
                none: copy.legendNone,
              }[id];
              return (
                <button
                  key={id}
                  type="button"
                  className="layer-toggle"
                  aria-pressed={on}
                  onClick={() => setLayers((current) => ({ ...current, [id]: !current[id] }))}
                >
                  <i className={`swatch ${id}`} aria-hidden="true" />
                  <span>{label}</span>
                  <span className="switch" aria-hidden="true"><i /></span>
                </button>
              );
            })}
          </div>
        </div>
        <p className="count">
          {loading
            ? copy.loading
            : anyLayerOn(layers)
              ? copy.layerCount({ works: workCount, avis: avisCount, mtq: mtqCount })
              : copy.layersNoneOn}
        </p>
        {search && (
          <button type="button" className="text-button" onClick={clearSearch}>
            {copy.clearSearch}
          </button>
        )}
      </div>

      {error && (
        <p className="banner">
          {error === "placeUpgrade" ? copy.placeUpgrade : error === "placeLimitPaidFull" ? copy.placeLimitPaidFull : errorMessage(copy, error)}
          {error === "placeUpgrade" && (
            <>
              {" "}
              <a href="/subscribe" onClick={(event) => { event.preventDefault(); navigate("/subscribe"); }}>{copy.paidCta}</a>
            </>
          )}
        </p>
      )}

      <div className="layout">
        <div className="map-panel">
          <div className="map-wrap">
            <WorkMap
              works={shown}
              selectedId={selectedId}
              onSelect={selectWork}
              fitToken={fitToken}
              here={here}
              focusPoints={focusPoints}
              pin={pin}
              snowLots={snowAvailable ? nearbySnow : []}
            />
          </div>
          {snowAvailable && (
            <div className="legend">
              <p className="legend-items">
                <span><i className="swatch snow" aria-hidden="true" /> {copy.legendSnow}</span>
              </p>
            </div>
          )}
        </div>

        <section className="side">
          {here && <p className="place here-hint">{copy.youAreHere}</p>}
          {pin && !here && (
            <p className="place">
              {copy.placeFound}{lang === "fr" ? " : " : ": "}{pin.label}
            </p>
          )}

          {selected ? (
            <article className="detail" id="site-detail">
              <p className={`kind-pill ${selected.map_primary || "none"}`}>
                {impactLabel(selected.resident_primary || selected.map_primary || "none", lang)}
              </p>
              <h2>{selected.title || selected.street || copy.unknown}</h2>
              <p className="borough-name">{selected.borough}</p>
              <p className="signs-note">{copy.signsNote}</p>
              {impactKinds(selected).length > 1 && (
                <p className="hint">{impactKinds(selected).map((kind) => impactLabel(kind, lang)).join(" · ")}</p>
              )}
              {selected.kind === "mtq" ? (
                <>
                  <dl>
                    {selected.localisation && (
                      <div>
                        <dt>{copy.mtqWhere}</dt>
                        <dd>{selected.localisation}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{copy.dates}</dt>
                      <dd>{dateRangeText(selected, lang)}</dd>
                    </div>
                    {selected.lanes && (
                      <div>
                        <dt>{copy.mtqLanes}</dt>
                        <dd>{selected.lanes}</dd>
                      </div>
                    )}
                    {selected.detour && (
                      <div>
                        <dt>{copy.mtqDetour}</dt>
                        <dd>{selected.detour}</dd>
                      </div>
                    )}
                    {selected.direction && (
                      <div>
                        <dt>{copy.mtqDirection}</dt>
                        <dd>{selected.direction}</dd>
                      </div>
                    )}
                  </dl>
                  {mtqDescription(selected, lang) && (
                    <p className="mtq-description">{mtqDescription(selected, lang)}</p>
                  )}
                  {selected.url && (
                    <a className="notice-link mtq-link" href={selected.url} target="_blank" rel="noreferrer">
                      {copy.mtqLink}
                    </a>
                  )}
                </>
              ) : selected.kind === "avis" ? (
                <>
                  <dl>
                    <div>
                      <dt>{copy.noticeType}</dt>
                      <dd>{avisTypeLabel(selected.type, lang)}</dd>
                    </div>
                    <div>
                      <dt>{copy.dates}</dt>
                      <dd>{dateRangeText(selected, lang)}</dd>
                    </div>
                  </dl>
                  {selected.url && (
                    <a className="notice-link" href={selected.url} target="_blank" rel="noreferrer">
                      {copy.noticeLink}
                    </a>
                  )}
                </>
              ) : (
                <dl>
                  <div>
                    <dt>{copy.impactLabel}</dt>
                    <dd>{impactKinds(selected).map((kind) => impactLabel(kind, lang)).join(" · ") || copy.impactNone}</dd>
                  </div>
                  <div>
                    <dt>{copy.reason}</dt>
                    <dd>{reasonLabel(selected, lang)}</dd>
                  </div>
                  <div>
                    <dt>{copy.who}</dt>
                    <dd>{whoText(selected, lang)}</dd>
                  </div>
                  <div>
                    <dt>{copy.dates}</dt>
                    <dd>{dateRangeText(selected, lang)}</dd>
                  </div>
                  <div>
                    <dt>{copy.daysActive}</dt>
                    <dd>{scheduleText(selected, lang)}</dd>
                  </div>
                </dl>
              )}
            </article>
          ) : (
            <p className="hint" id="site-detail">
              {copy.clickHint}
            </p>
          )}

          {search ? (
            <>
              <h3>{copy.resultsTitle}</h3>
              {shown.length === 0 && (
                <p className="hint">{here ? copy.noResultsHere : copy.noResults}</p>
              )}
              <SiteList items={shown} selectedId={selectedId} onSelect={selectWork} copy={copy} lang={lang} search />
            </>
          ) : (
            <>
              <h3>{copy.listTitle}</h3>
              <SiteList items={shown.filter((item) => item.kind !== "avis" && item.kind !== "mtq")} selectedId={selectedId} onSelect={selectWork} copy={copy} lang={lang} />
              <h3>{copy.avisTitle}</h3>
              <p className="hint">{copy.avisHint}</p>
              {shown.filter((item) => item.kind === "avis").length === 0 ? (
                <p className="hint">{copy.avisEmpty}</p>
              ) : (
                <SiteList items={shown.filter((item) => item.kind === "avis")} selectedId={selectedId} onSelect={selectWork} copy={copy} lang={lang} />
              )}
              <h3>{copy.mtqTitle}</h3>
              <p className="hint">{copy.mtqHint}</p>
              {shown.filter((item) => item.kind === "mtq").length === 0 ? (
                <p className="hint">{copy.mtqEmpty}</p>
              ) : (
                <SiteList items={shown.filter((item) => item.kind === "mtq")} selectedId={selectedId} onSelect={selectWork} copy={copy} lang={lang} />
              )}
            </>
          )}
        </section>
      </div>

      </>
      )}
    </main>
    <Footer
      lang={lang}
      importedAt={importedAt}
      avisImportedAt={avisImportedAt}
      mtqImportedAt={mtqImportedAt}
      snowImportedAt={snowAvailable ? snowImportedAt : ""}
      formatImport={formatImport}
    />
    </>
  );
}
