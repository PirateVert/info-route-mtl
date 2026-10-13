import { useEffect, useMemo, useState } from "react";
import WorkMap from "./WorkMap";
import {
  COPY,
  MHM,
  dateRangeText,
  formatDistance,
  formatImport,
  readLang,
  reasonLabel,
  scheduleText,
  storeLang,
  whoText,
} from "./i18n";

const DATASET_URL = "https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d";

async function getJson(path) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const response = await fetch(`${base}${path}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export default function App() {
  const [lang, setLang] = useState(readLang);
  const copy = COPY[lang];
  const [borough, setBorough] = useState(MHM);
  const [boroughs, setBoroughs] = useState([]);
  const [importedAt, setImportedAt] = useState("");
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
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
        if (!cancel) setError("load");
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
        setError("load");
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
      setError("load");
    } finally {
      setSearching(false);
    }
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
  const fitToken = search ? `search:${search.query}:${search.place?.lat || ""}` : `borough:${borough}`;

  const boroughOptions = useMemo(() => {
    const names = new Set(boroughs);
    names.add(MHM);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "fr"));
  }, [boroughs]);

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1>{copy.title}</h1>
          <p className="tagline">{copy.tagline}</p>
        </div>
        <div className="lang" role="group" aria-label={copy.langGroup}>
          <button type="button" aria-pressed={lang === "fr"} onClick={() => changeLang("fr")}>
            FR
          </button>
          <button type="button" aria-pressed={lang === "en"} onClick={() => changeLang("en")}>
            EN
          </button>
        </div>
      </header>

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
          <button type="submit" disabled={searching}>
            {searching ? copy.searching : copy.searchButton}
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

      {error && <p className="banner">{copy.loadError}</p>}

      <div className="layout">
        <div className="map-wrap">
          <WorkMap works={shown} selectedId={selectedId} onSelect={selectWork} fitToken={fitToken} />
        </div>

        <section className="side">
          {search?.place && (
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
          {search && shown.length === 0 && <p className="hint">{copy.noResults}</p>}
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

      <footer>
        <p>{copy.footer}</p>
        <p>{formatImport(importedAt, lang)}</p>
        <p>
          <a href={DATASET_URL}>{copy.dataset}</a>
          {" · "}
          <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
        </p>
      </footer>
    </div>
  );
}
