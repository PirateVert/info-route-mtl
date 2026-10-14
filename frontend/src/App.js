import { useEffect, useMemo, useState } from "react";
import WorkMap from "./WorkMap";
import Subscribe from "./Subscribe";
import { Footer, Header, useRoute } from "./chrome";
import {
  COPY,
  MHM,
  dateRangeText,
  formatDistance,
  formatImport,
  geoErrorKey,
  readLang,
  reasonLabel,
  scheduleText,
  storeLang,
  whoText,
} from "./i18n";

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
  if (copy[error]) return copy[error];
  return copy.loadError;
}

export default function App() {
  const [lang, setLang] = useState(readLang);
  const copy = COPY[lang];
  const route = useRoute();
  const path = route.split("?")[0];
  const [borough, setBorough] = useState(MHM);
  const [boroughs, setBoroughs] = useState([]);
  const [importedAt, setImportedAt] = useState("");
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState(null);
  const [selectedId, setSelectedId] = useState("");

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
    const path = borough ? `/api/works?borough=${encodeURIComponent(borough)}` : "/api/works";
    getJson(path)
      .then((data) => {
        if (cancel) return;
        setWorks(data.works || []);
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
    const data = await getJson(`/api/search?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
    setSearch(data);
    setSelectedId("");
  }

  async function onSearch(event) {
    event.preventDefault();
    const text = query.trim();
    if (!text) return;
    setSearching(true);
    setError("");
    try {
      const data = await getJson(`/api/search?q=${encodeURIComponent(text)}`);
      setSearch(data);
      setSelectedId("");
    } catch (err) {
      setError("loadError");
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
    setSelectedId("");
  }

  const shown = search ? search.results || [] : works;
  const selected = useMemo(
    () => shown.find((work) => work.id === selectedId) || null,
    [shown, selectedId]
  );
  const here = useMemo(() => {
    if (search?.place?.source !== "coords") return null;
    return { lat: search.place.lat, lng: search.place.lng, label: copy.youAreHere };
  }, [search, copy.youAreHere]);
  const fitToken = search
    ? `search:${search.query}:${search.place?.lat || ""}:${search.place?.lng || ""}:${search.place?.source || ""}`
    : `borough:${borough}`;

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

      <form className="search" onSubmit={onSearch}>
        <label htmlFor="street-search">{copy.searchLabel}</label>
        <div className="search-row">
          <input
            id="street-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            autoComplete="off"
          />
          <button type="submit" className="search-go" disabled={searching}>
            {searching && !locating ? copy.searching : copy.searchButton}
          </button>
          <button
            type="button"
            className="locate-button"
            disabled={searching}
            onClick={useMyLocation}
          >
            {locating ? copy.locating : copy.useMyLocation}
          </button>
        </div>
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
        <p className="count">{loading ? copy.loading : copy.count(shown.length)}</p>
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
          />
        </div>

        <section className="side">
          {here && <p className="place here-hint">{copy.youAreHere}</p>}
          {search?.place && !here && (
            <p className="place">
              {copy.placeFound} : {search.place.label}
            </p>
          )}

          {selected ? (
            <article className="detail" id="site-detail">
              <h2>{selected.street || copy.unknown}</h2>
              <p className="borough-name">{selected.borough}</p>
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
            </article>
          ) : (
            <p className="hint" id="site-detail">
              {copy.clickHint}
            </p>
          )}

          <h3>{search ? copy.resultsTitle : copy.listTitle}</h3>
          {search && shown.length === 0 && (
            <p className="hint">{here ? copy.noResultsHere : copy.noResults}</p>
          )}
          <ul className="site-list">
            {shown.map((work) => (
              <li key={work.id}>
                <button
                  type="button"
                  className={work.id === selectedId ? "active" : ""}
                  onClick={() => selectWork(work)}
                >
                  <span className="street">{work.street || copy.unknown}</span>
                  <span className="meta">
                    {work.borough}
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
        </section>
      </div>

      </>
      )}
    </main>
    <Footer lang={lang} importedAt={importedAt} formatImport={formatImport} />
    </>
  );
}
