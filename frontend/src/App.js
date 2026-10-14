import { useEffect, useMemo, useState } from "react";
import WorkMap from "./WorkMap";
import Subscribe from "./Subscribe";
import { Footer, Header, useRoute } from "./chrome";
import {
  COPY,
  MHM,
  avisTypeLabel,
  dateRangeText,
  formatDistance,
  formatImport,
  geoErrorKey,
  mtqDescription,
  readLang,
  reasonLabel,
  scheduleText,
  storeLang,
  whoText,
} from "./i18n";

const PLACE_TYPES = ["route", "street", "address", "intersection", "near_me"];

async function getJson(path) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const response = await fetch(`${base}${path}`);
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
  if (copy[error]) return copy[error];
  return copy.loadError;
}

function SiteList({ items, selectedId, onSelect, copy, lang, search = false }) {
  return (
    <ul className="site-list">
      {items.map((work) => {
        const avis = work.kind === "avis";
        const mtq = work.kind === "mtq";
        return (
          <li key={work.id}>
            <button
              type="button"
              className={`${work.id === selectedId ? "active" : ""} ${avis ? "avis-item" : ""} ${mtq ? "mtq-item" : ""}`.trim()}
              onClick={() => onSelect(work)}
            >
              <span className="street">{work.title || work.street || copy.unknown}</span>
              <span className="meta">
                {avis ? `${copy.kindAvis} · ` : mtq ? `${copy.kindMtq} · ` : ""}
                {work.borough || (mtq ? copy.kindMtq : "")}
                {search && work.match
                  ? ` · ${work.match === "street" ? copy.streetMatch : copy.nearbyMatch}`
                  : ""}
                {search && formatDistance(work.distance_m, lang)
                  ? ` · ${formatDistance(work.distance_m, lang)}`
                  : ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function App() {
  const [lang, setLang] = useState(readLang);
  const copy = COPY[lang];
  const route = useRoute();
  const path = route.split("?")[0];
  const [borough, setBorough] = useState(MHM);
  const [boroughs, setBoroughs] = useState([]);
  const [importedAt, setImportedAt] = useState("");
  const [avisImportedAt, setAvisImportedAt] = useState("");
  const [mtqImportedAt, setMtqImportedAt] = useState("");
  const [works, setWorks] = useState([]);
  const [avis, setAvis] = useState([]);
  const [mtq, setMtq] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("street");
  const [query, setQuery] = useState("");
  const [via, setVia] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const needsVia = kind === "route" || kind === "intersection";
  const isNearMe = kind === "near_me";
  const placeCopy = copy.subscribe;

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "fr";
    document.title = "Info-Route MTL";
  }, [lang]);

  useEffect(() => {
    let cancel = false;
    getJson("/api/meta")
      .then((data) => {
        if (cancel) return;
        setBoroughs((data.boroughs || []).map((item) => item.name));
        setImportedAt(data.imported_at || "");
        setAvisImportedAt(data.avis?.imported_at || "");
        setMtqImportedAt(data.mtq?.imported_at || "");
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
    ])
      .then(([workData, avisData, mtqData]) => {
        if (cancel) return;
        setWorks(workData.works || []);
        setAvis(avisData.avis || []);
        setMtq(mtqData.mtq || []);
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

  async function runCoordSearch(lat, lng) {
    const data = await getJson(`/api/search?type=near_me&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    setSearch(data);
    setSelectedId("");
  }

  async function onSearch(event) {
    event.preventDefault();
    const text = query.trim();
    const viaText = via.trim();
    if (isNearMe || !text) return;
    if (needsVia && !viaText) return;
    setSearching(true);
    setError("");
    try {
      const params = new URLSearchParams({ q: text, type: kind });
      if (viaText) params.set("via", viaText);
      const data = await getJson(`/api/search?${params.toString()}`);
      setSearch(data);
      setSelectedId("");
    } catch (err) {
      setError(err.detail === "place_not_found" ? "placeNotFound" : err.detail === "outside_montreal" || err.detail === "bad_coords" ? "geoOutside" : "loadError");
    } finally {
      setSearching(false);
    }
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
          await runCoordSearch(position.coords.latitude, position.coords.longitude);
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
    setVia("");
    setSelectedId("");
  }

  function changeKind(next) {
    setKind(next);
    if (next !== "route" && next !== "intersection") setVia("");
  }

  const layered = useMemo(
    () => [
      ...works.map((work) => ({ ...work, kind: work.kind || "work" })),
      ...avis.map((item) => ({ ...item, kind: "avis" })),
      ...mtq.map((item) => ({ ...item, kind: "mtq" })),
    ],
    [works, avis, mtq]
  );
  const shown = search ? search.results || [] : layered;
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
    if (!search?.place) return [];
    const points = [];
    if (Number.isFinite(search.place.lat) && Number.isFinite(search.place.lng)) {
      points.push({ lat: search.place.lat, lng: search.place.lng });
    }
    if (Number.isFinite(search.place.end_lat) && Number.isFinite(search.place.end_lng)) {
      points.push({ lat: search.place.end_lat, lng: search.place.end_lng });
    }
    return points;
  }, [search]);
  const fitToken = search
    ? `search:${search.type || ""}:${search.query}:${search.via || ""}:${search.place?.lat || ""}:${search.place?.lng || ""}:${search.place?.end_lat || ""}:${search.place?.source || ""}`
    : `borough:${borough}:w${works.length}:a${avis.length}:m${mtq.length}`;

  const boroughOptions = useMemo(() => {
    const names = new Set(boroughs);
    names.add(MHM);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "fr"));
  }, [boroughs]);

  return (
    <>
    <Header lang={lang} setLang={changeLang} />
    <main className="page">
      {path.startsWith("/subscribe") ? (
        <Subscribe lang={lang} />
      ) : (
      <>
      <h1 className="page-title">{copy.title}</h1>
      <p className="tagline">{copy.tagline}</p>
      <p className="disclaimer">{copy.disclaimer}</p>

      <form className="search" onSubmit={onSearch}>
        <p className="search-lead">{copy.searchLabel}</p>
        <label htmlFor="map-search-type">{copy.searchKind}</label>
        <select
          id="map-search-type"
          value={kind}
          onChange={(event) => changeKind(event.target.value)}
        >
          {PLACE_TYPES.map((item) => (
            <option key={item} value={item}>{placeCopy.placeType[item]}</option>
          ))}
        </select>
        <p className="hint">{copy.searchHelp}</p>
        {isNearMe ? (
          <button
            type="button"
            className="locate-button"
            disabled={searching}
            onClick={useMyLocation}
          >
            {locating ? copy.locating : copy.useMyLocation}
          </button>
        ) : (
          <div className="search-fields">
            <label htmlFor="map-search-query">{placeCopy.placeQuery[kind]}</label>
            <input
              id="map-search-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeCopy.placePlaceholder[kind]}
              autoComplete="off"
            />
            {needsVia && (
              <>
                <label htmlFor="map-search-via">{placeCopy.placeVia[kind]}</label>
                <input
                  id="map-search-via"
                  value={via}
                  onChange={(event) => setVia(event.target.value)}
                  placeholder={placeCopy.placeViaPlaceholder[kind]}
                  autoComplete="off"
                />
              </>
            )}
            <div className="search-row">
              <button
                type="submit"
                className="search-go"
                disabled={searching || !query.trim() || (needsVia && !via.trim())}
              >
                {searching && !locating ? copy.searching : copy.searchButton}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="filters">
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
        <p className="count">{loading ? copy.loading : copy.layerCount({ works: workCount, avis: avisCount, mtq: mtqCount })}</p>
        {search && (
          <button type="button" className="text-button" onClick={clearSearch}>
            {copy.clearSearch}
          </button>
        )}
      </div>

      {error && <p className="banner">{errorMessage(copy, error)}</p>}

      <div className="layout">
        <div className="map-wrap">
          <WorkMap
            works={shown}
            selectedId={selectedId}
            onSelect={selectWork}
            fitToken={fitToken}
            here={here}
            focusPoints={focusPoints}
          />
          <p className="legend">
            <span><i className="swatch work" /> {copy.legendWork}</span>
            <span><i className="swatch avis" /> {copy.legendAvis}</span>
            <span><i className="swatch mtq" /> {copy.legendMtq}</span>
          </p>
        </div>

        <section className="side">
          {here && <p className="place here-hint">{copy.youAreHere}</p>}
          {search?.place && !here && (
            <p className="place">
              {copy.placeFound}{lang === "fr" ? " : " : ": "}{search.place.label}
            </p>
          )}

          {selected ? (
            <article className="detail" id="site-detail">
              <p className={`kind-pill ${selected.kind === "avis" ? "avis" : selected.kind === "mtq" ? "mtq" : "work"}`}>
                {selected.kind === "avis" ? copy.kindAvis : selected.kind === "mtq" ? copy.kindMtq : copy.kindWork}
              </p>
              <h2>{selected.title || selected.street || copy.unknown}</h2>
              <p className="borough-name">{selected.borough}</p>
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
              <SiteList items={works} selectedId={selectedId} onSelect={selectWork} copy={copy} lang={lang} />
              <h3>{copy.avisTitle}</h3>
              <p className="hint">{copy.avisHint}</p>
              {avis.length === 0 ? (
                <p className="hint">{copy.avisEmpty}</p>
              ) : (
                <SiteList items={avis} selectedId={selectedId} onSelect={selectWork} copy={copy} lang={lang} />
              )}
              <h3>{copy.mtqTitle}</h3>
              <p className="hint">{copy.mtqHint}</p>
              {mtq.length === 0 ? (
                <p className="hint">{copy.mtqEmpty}</p>
              ) : (
                <SiteList items={mtq} selectedId={selectedId} onSelect={selectWork} copy={copy} lang={lang} />
              )}
            </>
          )}
        </section>
      </div>

      </>
      )}
    </main>
    <Footer lang={lang} importedAt={importedAt} avisImportedAt={avisImportedAt} mtqImportedAt={mtqImportedAt} formatImport={formatImport} />
    </>
  );
}
