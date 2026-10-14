import { useEffect, useState } from "react";
import { COPY, MHM, reasonLabel } from "./i18n";
import { navigate } from "./chrome";

const ALERT_KEYS = ["new", "ending", "dates", "status", "who", "reason"];
const FREQUENCIES = ["daily", "weekly", "biweekly", "monthly"];
const PLACE_TYPES = ["route", "street", "address", "intersection"];
const MAX_PLACES = 10;

function placeLabel(place) {
  if (place.type === "route") return `${place.query} → ${place.via}`;
  if (place.type === "intersection") return `${place.query} × ${place.via}`;
  return place.query;
}

async function sendJson(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || "load");
    error.code = data.detail || "load";
    throw error;
  }
  return data;
}

function errorText(copy, error) {
  return copy.errors[error.code] || copy.errors.load;
}

export default function Subscribe({ lang }) {
  const copy = COPY[lang].subscribe;
  const path = window.location.pathname;
  if (path.startsWith("/subscribe/success")) return <Success lang={lang} />;
  if (path.startsWith("/subscribe/cancel")) return <Cancel lang={lang} />;
  if (path.startsWith("/subscribe/manage")) return <Manage lang={lang} />;
  return <Signup lang={lang} copy={copy} />;
}

function PlacesEditor({ copy, places, setPlaces, setError }) {
  const [kind, setKind] = useState("route");
  const [query, setQuery] = useState("");
  const [via, setVia] = useState("");
  const [adding, setAdding] = useState(false);
  const needsVia = kind === "route" || kind === "intersection";

  async function addPlace(event) {
    event.preventDefault();
    if (places.length >= MAX_PLACES) {
      setError(copy.errors.too_many_places);
      return;
    }
    setAdding(true);
    setError("");
    try {
      const next = { type: kind, query: query.trim(), via: via.trim() };
      await sendJson("/api/subscribe/preview", {
        method: "POST",
        body: JSON.stringify({ places: [...places, next] }),
      });
      setPlaces((current) => [...current, next]);
      setQuery("");
      setVia("");
    } catch (err) {
      setError(errorText(copy, err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="places">
      <h3>{copy.placesTitle}</h3>
      <p className="hint">{copy.placesHelp(places.length)}</p>
      <ul className="place-list">
        {places.map((place, index) => (
          <li key={`${place.type}-${place.query}-${place.via}-${index}`}>
            <span className="place-kind">{copy.placeType[place.type]}</span>
            <span className="place-label">{placeLabel(place)}</span>
            <button
              type="button"
              className="text-button place-remove"
              onClick={() => setPlaces((current) => current.filter((_, i) => i !== index))}
            >
              {copy.removePlace}
            </button>
          </li>
        ))}
      </ul>
      {places.length < MAX_PLACES && (
        <div className="place-form">
          <label htmlFor="place-type">{copy.placeKind}</label>
          <select id="place-type" value={kind} onChange={(event) => setKind(event.target.value)}>
            {PLACE_TYPES.map((item) => (
              <option key={item} value={item}>{copy.placeType[item]}</option>
            ))}
          </select>
          <label htmlFor="place-query">{copy.placeQuery[kind]}</label>
          <input
            id="place-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.placePlaceholder[kind]}
          />
          {needsVia && (
            <>
              <label htmlFor="place-via">{copy.placeVia[kind]}</label>
              <input
                id="place-via"
                value={via}
                onChange={(event) => setVia(event.target.value)}
                placeholder={copy.placeViaPlaceholder[kind]}
              />
            </>
          )}
          <button type="button" className="text-button" disabled={adding || !query.trim() || (needsVia && !via.trim())} onClick={addPlace}>
            {adding ? copy.addingPlace : copy.addPlace}
          </button>
        </div>
      )}
    </div>
  );
}

function Signup({ lang, copy }) {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [language, setLanguage] = useState(lang);
  const [alerts, setAlerts] = useState(ALERT_KEYS);
  const [borough, setBorough] = useState(MHM);
  const [boroughs, setBoroughs] = useState([]);
  const [places, setPlaces] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/meta")
      .then((response) => response.json())
      .then((data) => setBoroughs((data.boroughs || []).map((item) => item.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      sendJson("/api/subscribe/preview", {
        method: "POST",
        body: JSON.stringify({ borough, alerts, places }),
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [borough, alerts, places]);

  function toggleAlert(key) {
    setAlerts((current) => (
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    ));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await sendJson("/api/subscribe/checkout", {
        method: "POST",
        body: JSON.stringify({
          email,
          alerts,
          frequency,
          language,
          borough,
          places,
          origin_url: window.location.origin,
        }),
      });
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(errorText(copy, err));
      setBusy(false);
    }
  }

  const names = Array.from(new Set([MHM, ...boroughs])).sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <section className="subscribe">
      <h1>{copy.title}</h1>
      <p className="tagline">{copy.intro}</p>
      <div className="subscribe-grid">
        <form className="detail subscribe-card" onSubmit={onSubmit}>
          <p className="price"><strong>$2</strong> <span>CAD / {copy.month}</span></p>
          <label htmlFor="sub-email">{copy.email}</label>
          <input id="sub-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@example.com" />

          <label htmlFor="sub-frequency">{copy.frequency}</label>
          <select id="sub-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value)}>
            {FREQUENCIES.map((key) => <option key={key} value={key}>{copy.freq[key]}</option>)}
          </select>

          <label htmlFor="sub-language">{copy.digestLanguage}</label>
          <select id="sub-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="both">{copy.bothLanguages}</option>
          </select>

          <button type="submit" disabled={busy || alerts.length === 0}>{busy ? copy.sending : copy.cta}</button>
          {error && <p className="banner">{error}</p>}
          <p className="hint">{copy.secure}</p>
        </form>

        <div className="detail">
          <h2>{copy.choose}</h2>
          <fieldset>
            <legend>{copy.alerts}</legend>
            {ALERT_KEYS.map((key) => (
              <label key={key} className="check">
                <input type="checkbox" checked={alerts.includes(key)} onChange={() => toggleAlert(key)} />
                <span>{copy.alert[key]}</span>
              </label>
            ))}
          </fieldset>

          <label htmlFor="sub-borough">{copy.borough}</label>
          <select id="sub-borough" value={borough} onChange={(event) => setBorough(event.target.value)}>
            <option value="">{copy.allBoroughs}</option>
            {names.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>

          <PlacesEditor copy={copy} places={places} setPlaces={setPlaces} setError={setError} />

          {preview && (
            <p className="hint">
              {copy.previewCount(preview.count)}
              {preview.changes?.length ? ` ${copy.previewChanges(preview.changes.length)}` : ""}
            </p>
          )}
          {preview?.samples?.length > 0 && (
            <ul className="preview-list">
              {preview.samples.map((work) => (
                <li key={work.id}>{work.street || copy.unknown} · {reasonLabel(work, lang)}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Success({ lang }) {
  const copy = COPY[lang].subscribe;
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";

  useEffect(() => {
    if (!sessionId) {
      setError(copy.errors.load);
      return;
    }
    sendJson(`/api/subscribe/session?session_id=${encodeURIComponent(sessionId)}`)
      .then(setInfo)
      .catch((err) => setError(errorText(copy, err)));
  }, [sessionId, copy]);

  return (
    <section className="subscribe">
      <h1>{copy.successTitle}</h1>
      {error && <p className="banner">{error}</p>}
      {info && (
        <article className="detail">
          <p>{info.paid ? copy.successPaid : copy.successPending}</p>
          <p>{info.email}</p>
          {info.places?.length > 0 && (
            <ul className="place-list">
              {info.places.map((place, index) => (
                <li key={`${place.type}-${index}`}>
                  <span className="place-kind">{copy.placeType[place.type]}</span>
                  <span className="place-label">{placeLabel(place)}</span>
                </li>
              ))}
            </ul>
          )}
          {info.manage_token && (
            <p>
              <a href={`/subscribe/manage?token=${encodeURIComponent(info.manage_token)}`} onClick={(event) => { event.preventDefault(); navigate(`/subscribe/manage?token=${encodeURIComponent(info.manage_token)}`); }}>
                {copy.manageLink}
              </a>
            </p>
          )}
        </article>
      )}
    </section>
  );
}

function Cancel({ lang }) {
  const copy = COPY[lang].subscribe;
  return (
    <section className="subscribe">
      <h1>{copy.cancelTitle}</h1>
      <p className="tagline">{copy.cancelBody}</p>
      <a className="text-button inline-link" href="/subscribe" onClick={(event) => { event.preventDefault(); navigate("/subscribe"); }}>{copy.back}</a>
    </section>
  );
}

function Manage({ lang }) {
  const copy = COPY[lang].subscribe;
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [form, setForm] = useState(null);
  const [changes, setChanges] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(copy.errors.bad_token);
      return;
    }
    sendJson(`/api/subscribe?token=${encodeURIComponent(token)}`)
      .then((data) => {
        setChanges(data.changes || []);
        setForm({
          alerts: data.alerts || [],
          frequency: data.frequency,
          language: data.language,
          borough: data.borough || "",
          places: data.places || (data.street ? [{ type: "street", query: data.street, via: "" }] : []),
          email: data.email || "",
        });
      })
      .catch((err) => setError(errorText(copy, err)));
  }, [token, copy]);

  function toggleAlert(key) {
    setForm((current) => ({
      ...current,
      alerts: current.alerts.includes(key)
        ? current.alerts.filter((item) => item !== key)
        : [...current.alerts, key],
    }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const data = await sendJson("/api/subscribe", {
        method: "PATCH",
        body: JSON.stringify({ token, ...form }),
      });
      setChanges(data.changes || []);
      setSaved(true);
    } catch (err) {
      setError(errorText(copy, err));
    } finally {
      setBusy(false);
    }
  }

  if (!form) {
    return (
      <section className="subscribe">
        <h1>{copy.manageTitle}</h1>
        {error && <p className="banner">{error}</p>}
      </section>
    );
  }

  return (
    <section className="subscribe">
      <h1>{copy.manageTitle}</h1>
      <p className="tagline">{form.email}</p>
      <form className="detail" onSubmit={onSubmit}>
        <fieldset>
          <legend>{copy.alerts}</legend>
          {ALERT_KEYS.map((key) => (
            <label key={key} className="check">
              <input type="checkbox" checked={form.alerts.includes(key)} onChange={() => toggleAlert(key)} />
              <span>{copy.alert[key]}</span>
            </label>
          ))}
        </fieldset>
        <label htmlFor="manage-frequency">{copy.frequency}</label>
        <select id="manage-frequency" value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>
          {FREQUENCIES.map((key) => <option key={key} value={key}>{copy.freq[key]}</option>)}
        </select>
        <label htmlFor="manage-language">{copy.digestLanguage}</label>
        <select id="manage-language" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="both">{copy.bothLanguages}</option>
        </select>
        <PlacesEditor
          copy={copy}
          places={form.places}
          setPlaces={(next) => setForm((current) => ({
            ...current,
            places: typeof next === "function" ? next(current.places) : next,
          }))}
          setError={setError}
        />
        <button type="submit" disabled={busy}>{busy ? copy.sending : copy.save}</button>
        {saved && <p className="hint">{copy.saved}</p>}
        {error && <p className="banner">{error}</p>}
      </form>
      <h2>{copy.changesTitle}</h2>
      {changes.length === 0 ? <p className="hint">{copy.noChanges}</p> : (
        <ul className="preview-list">
          {changes.map((item) => (
            <li key={item.id}>
              {item.street} · {item.kinds.map((kind) => copy.alert[kind]).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
