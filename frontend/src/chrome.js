import { useEffect, useState } from "react";
import { COPY, storeLang } from "./i18n";

const THEME_KEY = "inforoute-theme";
const PARKS_URL = "https://parcs.lespiratesverts.org";

export function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch (err) {
    /* private mode */
  }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (err) {
    /* ignore */
  }
}

export function navigate(to) {
  if (window.location.pathname + window.location.search !== to) {
    window.history.pushState({}, "", to);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

export function useRoute() {
  const [route, setRoute] = useState(() => window.location.pathname + window.location.search);
  useEffect(() => {
    const sync = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return route;
}

function Cone() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.2 19.6h15.6v2.6H4.2z" fill="#c2410c" />
      <path d="M12 2.6 19.4 19.8H4.6Z" fill="#ff8a3c" />
      <path d="M9.7 8.4h4.6l.9 2.4H8.8Z" fill="#fff" />
      <path d="M7.5 13.8h9l1.1 2.6H6.4Z" fill="#fff" />
    </svg>
  );
}

function Sun() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function Moon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function BackToMap({ lang }) {
  const copy = COPY[lang];
  return (
    <a
      className="back-to-map"
      href="/"
      data-testid="back-to-map"
      onClick={(event) => {
        event.preventDefault();
        navigate("/");
      }}
    >
      {copy.backToMap}
    </a>
  );
}

export function Header({ lang, setLang }) {
  const copy = COPY[lang];
  const [theme, setTheme] = useState(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const route = useRoute();
  const path = route.split("?")[0];

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const items = [
    { to: "/", key: "places", label: copy.navPlaces },
    { to: "/#map-panel", key: "map", label: copy.navMap, hash: true },
    { to: "/subscribe", key: "subscribe", label: copy.navSubscribe },
    { to: PARKS_URL, key: "parks", label: copy.navParks, external: true },
  ];

  function active(to) {
    if (to === "/") return path === "/";
    return path === to || path.startsWith(`${to}/`);
  }

  function go(event, to, hash) {
    event.preventDefault();
    if (hash || to.includes("#")) {
      const [pathname, anchor] = to.split("#");
      if (window.location.pathname !== (pathname || "/")) {
        navigate(pathname || "/");
      }
      if (anchor) {
        requestAnimationFrame(() => {
          const node = document.getElementById(anchor);
          if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }
    navigate(to);
  }

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function changeLang(next) {
    setLang(next);
    storeLang(next);
  }

  return (
    <header className="site-header" data-testid="app-header">
      <div className="site-header-bar">
        <a className="brand" href="/" onClick={(event) => go(event, "/")}>
          <span className="brand-mark"><Cone /></span>
          <span className="brand-text">
            <span className="brand-title">Info-Route MTL</span>
            <span className="brand-sub">Montréal</span>
          </span>
        </a>
        <nav className="desktop-nav" data-testid="main-nav">
          {items.map((item) => (
            item.external ? (
              <a key={item.key} href={item.to} data-testid={`nav-${item.key}`}>{item.label}</a>
            ) : (
              <a
                key={item.key}
                href={item.to}
                data-testid={`nav-${item.key}`}
                className={active(item.to.split("#")[0]) ? "active" : ""}
                onClick={(event) => go(event, item.to, item.hash)}
              >
                {item.label}
              </a>
            )
          ))}
        </nav>
        <div className="header-tools">
          <button type="button" className="icon-button" data-testid="theme-toggle" aria-label={copy.themeToggle} onClick={toggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
          </button>
          <div className="lang-pill header-lang" role="group" aria-label={copy.langGroup} data-testid="header-lang">
            <button type="button" aria-pressed={lang === "fr"} onClick={() => changeLang("fr")}>FR</button>
            <button type="button" aria-pressed={lang === "en"} onClick={() => changeLang("en")}>EN</button>
          </div>
          <button
            type="button"
            className="menu-button"
            data-testid="mobile-menu-toggle"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? copy.menuClose : copy.menu}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="mobile-nav" data-testid="mobile-nav">
          {items.map((item) => (
            item.external ? (
              <a key={item.key} href={item.to}>{item.label}</a>
            ) : (
              <a
                key={item.key}
                href={item.to}
                className={active(item.to.split("#")[0]) ? "active" : ""}
                onClick={(event) => go(event, item.to, item.hash)}
              >
                {item.label}
              </a>
            )
          ))}
          <div className="mobile-tools">
            <button type="button" className="text-button" onClick={toggleTheme}>
              {theme === "dark" ? copy.themeLight : copy.themeDark}
            </button>
            <div className="lang-pill" role="group" aria-label={copy.langGroup}>
              <button type="button" aria-pressed={lang === "fr"} onClick={() => changeLang("fr")}>FR</button>
              <button type="button" aria-pressed={lang === "en"} onClick={() => changeLang("en")}>EN</button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

export function Footer({ lang, importedAt, avisImportedAt, mtqImportedAt, snowImportedAt, formatImport }) {
  const copy = COPY[lang];
  return (
    <footer className="site-footer">
      <div className="site-footer-bar">
        <span>
          {copy.footer}
          {" · "}
          <span className="footer-by">par </span>
          <a href="https://lespiratesverts.org" target="_blank" rel="noreferrer" data-testid="footer-pirates-link">
            Le Pirate Vert
          </a>
        </span>
        <span className="footer-badge">Montréal · 2026</span>
      </div>
      <p className="footer-data">
        {copy.signsNote}
        {" · "}
        {formatImport(importedAt, lang, copy.importedWorks)}
        {avisImportedAt ? ` · ${formatImport(avisImportedAt, lang, copy.importedAvis)}` : ""}
        {mtqImportedAt ? ` · ${formatImport(mtqImportedAt, lang, copy.importedMtq)}` : ""}
        {snowImportedAt ? ` · ${formatImport(snowImportedAt, lang, copy.importedSnow)}` : ""}
        {" · "}
        <a href="https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d">{copy.datasetWorks}</a>
        {" · "}
        <a href="https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d">{copy.datasetImpacts}</a>
        {" · "}
        <a href="https://donnees.montreal.ca/dataset/avis-alertes">{copy.datasetAvis}</a>
        {" · "}
        <a href="https://montreal.ca/avis-et-alertes">{copy.avisHuman}</a>
        {" · "}
        <a href="https://www.donneesquebec.ca/recherche/dataset/travaux-routiers">{copy.datasetMtq}</a>
        {" · "}
        <a href="https://www.quebec511.info">{copy.mtqHuman}</a>
        {" · "}
        <a href="https://donnees.montreal.ca/dataset/stationnements-deneigement">{copy.datasetSnow}</a>
        {" · "}
        <a href="https://creativecommons.org/licenses/by/4.0/">CC-BY 4.0</a>
        {" · "}
        <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>
      </p>
    </footer>
  );
}
