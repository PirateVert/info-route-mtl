import { useEffect, useState } from "react";
import AddressSuggest from "./AddressSuggest";
import PlaceKindBar from "./PlaceKindBar";
import { COPY, reasonLabel } from "./i18n";
import { BackToMap, navigate } from "./chrome";
import { PAID_MAX, PLACE_KINDS, formatPlaceLabel, kindNeedsVia, storeManageToken } from "./places";

const MAX_PLACES = PAID_MAX;

function placeLabel(place) {
  return formatPlaceLabel(place) || place.query || "";
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

export default function Subscribe({ lang, savedPlaces = [] }) {
  const copy = COPY[lang].subscribe;
  const path = window.location.pathname;
  let screen;
  if (path.startsWith("/subscribe/success")) screen = <Success lang={lang} />;
  else if (path.startsWith("/subscribe/cancel")) screen = <Cancel lang={lang} />;
  else if (path.startsWith("/subscribe/manage")) screen = <Manage lang={lang} />;
  else screen = <Signup lang={lang} copy={copy} savedPlaces={savedPlaces} />;
  return (
    <>
      <BackToMap lang={lang} />
      {screen}
    </>
  );
}

function PlacesEditor({ copy, places, setPlaces, setError, lang }) {
  const [kind, setKind] = useState("home");
  const [query, setQuery] = useState("");
  const [via, setVia] = useState("");
  const [draft, setDraft] = useState(null);
  const [draftEnd, setDraftEnd] = useState(null);
  const [adding, setAdding] = useState(false);
  const needsVia = kindNeedsVia(kind);
  const labels = PLACE_KINDS.reduce((acc, item) => {
    acc[item] = copy.placeType[item];
    return acc;
  }, {});

  async function savePlace(next) {
    if (places.length >= MAX_PLACES) {
      setError(copy.errors.too_many_places);
      setAdding(false);
      return;
    }
    setAdding(true);
    setError("");
    try {
      await sendJson("/api/subscribe/preview", {
        method: "POST",
        body: JSON.stringify({ places: [...places, next] }),
      });
      setPlaces((current) => [...current, next]);
      setQuery("");
      setVia("");
      setDraft(null);
      setDraftEnd(null);
    } catch (err) {
      setError(errorText(copy, err));
    } finally {
      setAdding(false);
    }
  }

  async function addPlace(event) {
    event.preventDefault();
    if (!draft) return;
    if (needsVia && !draftEnd) return;
    await savePlace({
      type: kind,
      kind,
      query: draft.label,
      via: needsVia ? draftEnd.label : "",
      label: kind === "route"
        ? `${draft.label} → ${draftEnd.label}`
        : kind === "intersection"
          ? `${draft.label} × ${draftEnd.label}`
          : draft.label,
      lat: draft.lat,
      lng: draft.lng,
      end_lat: draftEnd?.lat,
      end_lng: draftEnd?.lng,
    });
  }

  return (
    <div className="places">
      <h3>{copy.placesTitle}</h3>
      <p className="hint">{copy.placesHelp(places.length)}</p>
      <ul className="place-list">
        {places.map((place, index) => (
          <li key={`${place.type}-${place.query}-${place.via}-${index}`}>
            <span className="place-kind">{copy.placeType[place.type] || copy.placeType[place.kind]}</span>
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
          <PlaceKindBar
            value={kind}
            onChange={(next) => {
              setKind(next);
              setVia("");
              setDraftEnd(null);
            }}
            labels={labels}
            groupLabel={copy.placeKind}
            idPrefix="sub-kind"
          />
          <AddressSuggest
            id="place-query"
            lang={lang}
            label={copy.placeQuery[kind]}
            value={query}
            placeholder={copy.placePlaceholder[kind]}
            onChange={setQuery}
            onPick={(item) => {
              setQuery(item.label);
              setDraft(item);
            }}
          />
          {needsVia && (
            <AddressSuggest
              id="place-via"
              lang={lang}
              label={copy.placeVia[kind]}
              value={via}
              placeholder={copy.placeViaPlaceholder[kind]}
              onChange={setVia}
              onPick={(item) => {
                setVia(item.label);
                setDraftEnd(item);
              }}
            />
          )}
          <button type="button" className="text-button" disabled={adding || !draft || (needsVia && !draftEnd)} onClick={addPlace}>
            {adding ? copy.addingPlace : copy.addPlace}
          </button>
        </div>
      )}
    </div>
  );
}

function Signup({ lang, copy, savedPlaces = [] }) {
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState(lang);
  const [places, setPlaces] = useState(savedPlaces.slice(0, MAX_PLACES));
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      sendJson("/api/subscribe/preview", {
        method: "POST",
        body: JSON.stringify({ borough: "", alerts: ["closure", "parking"], places }),
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [places]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await sendJson("/api/subscribe/checkout", {
        method: "POST",
        body: JSON.stringify({
          email,
          alerts: ["closure", "parking"],
          frequency: "weekly",
          language,
          borough: "",
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

  return (
    <section className="subscribe">
      <h1>{copy.title}</h1>
      <p className="tagline">{copy.intro}</p>
      <div className="subscribe-grid">
        <form className="detail subscribe-card" onSubmit={onSubmit}>
          <p className="price"><strong>$2</strong> <span>CAD / {copy.month}</span></p>
          <p className="hint">{copy.included}</p>
          <label htmlFor="sub-email">{copy.email}</label>
          <input id="sub-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@example.com" />

          <label htmlFor="sub-language">{copy.digestLanguage}</label>
          <select id="sub-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="both">{copy.bothLanguages}</option>
          </select>

          <button type="submit" disabled={busy}>{busy ? copy.sending : copy.cta}</button>
          {error && <p className="banner">{error}</p>}
          <p className="hint">{copy.secure}</p>
        </form>

        <div className="detail">
          <PlacesEditor copy={copy} places={places} setPlaces={setPlaces} setError={setError} lang={lang} />

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
      .then((data) => {
        if (data.manage_token) storeManageToken(data.manage_token);
        setInfo(data);
      })
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
          alerts: ["closure", "parking"],
          frequency: "weekly",
          language: data.language,
          borough: data.borough || "",
          places: data.places || (data.street ? [{ type: "street", query: data.street, via: "" }] : []),
          email: data.email || "",
        });
      })
      .catch((err) => setError(errorText(copy, err)));
  }, [token, copy]);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      const data = await sendJson("/api/subscribe", {
        method: "PATCH",
        body: JSON.stringify({ token, ...form, alerts: ["closure", "parking"], frequency: "weekly" }),
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
      <p className="hint">{copy.included}</p>
      <form className="detail" onSubmit={onSubmit}>
        <label htmlFor="manage-language">{copy.digestLanguage}</label>
        <select id="manage-language" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="both">{copy.bothLanguages}</option>
        </select>
        <PlacesEditor
          copy={copy}
          lang={lang}
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
              {item.street} · {item.kinds.map((kind) => copy.alert[kind] || kind).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
