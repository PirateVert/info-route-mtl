import { useEffect, useRef, useState } from "react";

async function suggest(query, lang) {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const response = await fetch(`${base}/api/suggest?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(lang)}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.suggestions || [];
}

export default function AddressSuggest({
  id,
  label,
  value,
  onChange,
  onPick,
  placeholder,
  lang,
  disabled = false,
}) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const text = (value || "").trim();
    if (text.length < 3) {
      setItems([]);
      setOpen(false);
      return undefined;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      suggest(text, lang)
        .then((next) => {
          setItems(next);
          setOpen(next.length > 0);
          setActive(0);
        })
        .catch(() => {
          setItems([]);
          setOpen(false);
        });
    }, 280);
    return () => clearTimeout(timerRef.current);
  }, [value, lang]);

  useEffect(() => {
    function onDoc(event) {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(item) {
    onPick(item);
    setOpen(false);
  }

  function onKey(event) {
    if (!open || items.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      pick(items[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="suggest" ref={wrapRef}>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKey}
      />
      {open && items.length > 0 && (
        <ul id={`${id}-list`} className="suggest-list" role="listbox">
          {items.map((item, index) => (
            <li key={`${item.lat}-${item.lng}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                className={index === active ? "active" : ""}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(item);
                }}
              >
                <span className="suggest-label">{item.label}</span>
                {item.detail && item.detail !== item.label && (
                  <span className="suggest-detail">{item.detail}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
