import { PLACE_KINDS } from "./places";

export default function PlaceKindBar({
  value,
  onChange,
  labels,
  groupLabel,
  idPrefix = "place-kind",
}) {
  return (
    <div className="place-kind-bar">
      {groupLabel ? <p className="search-lead">{groupLabel}</p> : null}
      <div className="place-kind-buttons" role="radiogroup" aria-label={groupLabel || ""}>
        {PLACE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            id={`${idPrefix}-${kind}`}
            role="radio"
            aria-checked={value === kind}
            aria-pressed={value === kind}
            className={value === kind ? "active" : ""}
            onClick={() => onChange(kind)}
          >
            {labels[kind] || kind}
          </button>
        ))}
      </div>
    </div>
  );
}
