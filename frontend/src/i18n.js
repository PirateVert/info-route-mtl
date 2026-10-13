export const LANG_KEY = "inforoute-lang";
export const MHM = "Mercier-Hochelaga-Maisonneuve";

const REASON_EN = {
  "A-1 Réseau aérien existant": "A-1 existing overhead network",
  "AS-2 Réseau aérosouterrain existant": "AS-2 existing overhead-underground network",
  Autre: "Other",
  "Construction/rénovation avec excavation": "Construction or renovation with excavation",
  "Construction/rénovation sans excavation": "Construction or renovation without excavation",
  Déménagement: "Moving",
  Entretien: "Maintenance",
  "Feux de signalisation - Ajout/réparation": "Traffic lights — addition or repair",
  "Forage/excavation exploratoire": "Exploratory drilling or excavation",
  Inspection: "Inspection",
  "Puits d'accès - Construction/réparation": "Access shaft — construction or repair",
  "Puits d'accès - Inspection": "Access shaft — inspection",
  "Réseaux routier - Réfection et travaux corrélatifs": "Road network — resurfacing and related work",
  "S-1 Infrastructure souterraine existante": "S-1 existing underground infrastructure",
  "S-10 Fuite ou bris de gaz, situation post-urgence": "S-10 gas leak or break, post-emergency",
  "S-2 Infrastructure souterraine mineure ou équipement hors-sol - Réseaux de gaz":
    "S-2 minor underground work or above-ground equipment — gas network",
  "S-2 Infrastructure souterraine mineure ou équipement hors-sol - Réseaux électriques, télécommunications ou câbles des distributions":
    "S-2 minor underground work or above-ground equipment — electricity, telecom, or distribution cables",
  "S-3 Infrastructure souterraine majeure - Massifs et conduits":
    "S-3 major underground infrastructure — duct banks and conduits",
  "S-3 Infrastructure souterraine majeure - Puits d'accès":
    "S-3 major underground infrastructure — access shafts",
  "S-3 Infrastructure souterraine majeure - Réseaux de gaz":
    "S-3 major underground infrastructure — gas network",
  "Toiture - Rénovation": "Roof renovation",
  "Trottoirs - Construction": "Sidewalk construction",
  "Égouts et aqueducs - Excavation": "Sewers and water mains — excavation",
  "Égouts et aqueducs - Inspection et nettoyage": "Sewers and water mains — inspection and cleaning",
  "Égouts et aqueducs - Réhabilitation": "Sewers and water mains — rehabilitation",
};

const SUBMITTER_EN = {
  "Entrepreneur sous contrat avec la Ville de Montréal": "a contractor working for the City of Montreal",
  Entreprise: "a private company",
  "Organisation publique ou son sous-traitant": "a public organization or its subcontractor",
  "RTU (Réseau technique urbain) ou son sous-traitant":
    "the urban technical network (RTU) or its subcontractor",
  "Ville de Montréal": "the City of Montreal",
  "CSEM (Commission des services électriques de Montréal) ou son sous-traitant":
    "the Montreal electrical services commission (CSEM) or its subcontractor",
};

const WEEKDAYS = {
  mon: { fr: "lundi", en: "Monday" },
  tue: { fr: "mardi", en: "Tuesday" },
  wed: { fr: "mercredi", en: "Wednesday" },
  thu: { fr: "jeudi", en: "Thursday" },
  fri: { fr: "vendredi", en: "Friday" },
  sat: { fr: "samedi", en: "Saturday" },
  sun: { fr: "dimanche", en: "Sunday" },
};

export const COPY = {
  fr: {
    title: "Info-Route MTL",
    tagline: "Les travaux routiers en cours, en langage clair.",
    searchLabel: "Qu'est-ce qui se passe sur ma rue?",
    searchPlaceholder: "Ex. rue Ontario, Hochelaga, 4200 rue Notre-Dame",
    searchButton: "Chercher",
    searching: "Recherche…",
    clearSearch: "Revenir à la carte de l'arrondissement",
    boroughLabel: "Arrondissement",
    allBoroughs: "Tous les arrondissements",
    loading: "Chargement des chantiers…",
    loadError: "Impossible de joindre le serveur pour le moment.",
    count: (n) => (n === 1 ? "1 chantier affiché" : `${n} chantiers affichés`),
    clickHint: "Touchez un point orange sur la carte, ou un nom de rue dans la liste.",
    listTitle: "Chantiers",
    resultsTitle: "Résultats",
    noResults: "Aucun chantier trouvé pour cette adresse.",
    placeFound: "Adresse repérée",
    streetMatch: "sur cette rue",
    nearbyMatch: "à proximité",
    reason: "Raison",
    who: "Qui fait les travaux",
    dates: "Dates",
    daysActive: "Jours actifs",
    unknown: "Non précisé",
    close: "Fermer le détail",
    footer:
      "Application citoyenne indépendante — données : Ville de Montréal (CC-BY 4.0)",
    imported: "Dernière importation",
    importUnknown: "Dernière importation : pas encore disponible",
    langGroup: "Langue",
    dataset: "Jeu de données",
  },
  en: {
    title: "Info-Route MTL",
    tagline: "Current roadwork, in plain language.",
    searchLabel: "What's happening on my street?",
    searchPlaceholder: "e.g. Ontario Street, Hochelaga, 4200 Notre-Dame",
    searchButton: "Search",
    searching: "Searching…",
    clearSearch: "Back to the borough map",
    boroughLabel: "Borough",
    allBoroughs: "All boroughs",
    loading: "Loading work sites…",
    loadError: "The server can't be reached right now.",
    count: (n) => (n === 1 ? "1 work site shown" : `${n} work sites shown`),
    clickHint: "Tap an orange dot on the map, or a street name in the list.",
    listTitle: "Work sites",
    resultsTitle: "Results",
    noResults: "No work sites found for that address.",
    placeFound: "Address located",
    streetMatch: "on this street",
    nearbyMatch: "nearby",
    reason: "Reason",
    who: "Who is doing the work",
    dates: "Dates",
    daysActive: "Days active",
    unknown: "Not specified",
    close: "Close details",
    footer: "Independent citizen application — data: City of Montreal (CC-BY 4.0)",
    imported: "Last import",
    importUnknown: "Last import: not available yet",
    langGroup: "Language",
    dataset: "Dataset",
  },
};

export function readLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "fr") return saved;
  } catch (err) {
    /* private mode */
  }
  return "fr";
}

export function storeLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (err) {
    /* ignore */
  }
}

function clean(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function reasonText(work, lang) {
  const raw = clean(work.reason);
  if (!raw) return COPY[lang].unknown;
  if (lang === "fr") return raw;
  return REASON_EN[raw] || raw;
}

function rolePhrase(submitter, lang) {
  const raw = clean(submitter);
  if (!raw) return "";
  if (lang === "en") return SUBMITTER_EN[raw] || raw;
  if (raw === "Ville de Montréal") return "la Ville de Montréal";
  if (/^[A-Z]{2,}/.test(raw)) return raw;
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

export function whoText(work, lang) {
  const org = clean(work.organization);
  const role = rolePhrase(work.submitter, lang);
  if (org && role) return `${org} (${role})`;
  if (org) return org;
  if (role) return role.charAt(0).toUpperCase() + role.slice(1);
  return COPY[lang].unknown;
}

function formatDay(iso, lang) {
  if (!iso) return COPY[lang].unknown;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function torontoDayNumber(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const [year, month, day] = stamp.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function joinList(items, lang) {
  if (items.length <= 1) return items[0] || "";
  const conjunction = lang === "fr" ? " et " : " and ";
  return `${items.slice(0, -1).join(", ")}${conjunction}${items[items.length - 1]}`;
}

function weekdaySentence(work, lang) {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const active = order.filter((day) => (work.active_days || []).includes(day));
  if (active.length === 0) {
    return lang === "fr"
      ? "Les jours de travail ne sont pas précisés."
      : "The work days are not specified.";
  }
  if (active.length === 7) {
    return lang === "fr" ? "Les travaux ont lieu tous les jours." : "Work takes place every day.";
  }
  if (active.join(",") === "mon,tue,wed,thu,fri") {
    return lang === "fr"
      ? "Les travaux ont lieu en semaine, du lundi au vendredi."
      : "Work takes place on weekdays, Monday to Friday.";
  }
  const names = active.map((day) => WEEKDAYS[day][lang]);
  return lang === "fr"
    ? `Les travaux ont lieu le ${joinList(names, lang)}.`
    : `Work takes place on ${joinList(names, lang)}.`;
}

export function scheduleText(work, lang) {
  const startLabel = formatDay(work.start, lang);
  const endLabel = formatDay(work.end, lang);
  const startDay = work.start ? torontoDayNumber(work.start) : null;
  const endDay = work.end ? torontoDayNumber(work.end) : null;
  const today = torontoDayNumber(new Date());
  const weekdays = weekdaySentence(work, lang);

  let lead;
  if (startDay == null) {
    lead = lang === "fr"
      ? `Dates : du ${startLabel} au ${endLabel}.`
      : `Dates: from ${startLabel} to ${endLabel}.`;
  } else if (endDay != null && today > endDay) {
    lead = lang === "fr"
      ? `Ces travaux sont terminés (du ${startLabel} au ${endLabel}).`
      : `This work has ended (from ${startLabel} to ${endLabel}).`;
  } else if (today < startDay) {
    const ahead = Math.round((startDay - today) / 86400000);
    lead = lang === "fr"
      ? `Pas encore commencé : début le ${startLabel}, fin prévue le ${endLabel} (dans ${ahead} jour${ahead > 1 ? "s" : ""}).`
      : `Not started yet: begins ${startLabel}, planned end ${endLabel} (in ${ahead} day${ahead === 1 ? "" : "s"}).`;
  } else if (today === startDay) {
    lead = lang === "fr"
      ? `Commencé aujourd'hui, jusqu'au ${endLabel}.`
      : `Started today, until ${endLabel}.`;
  } else {
    const days = Math.round((today - startDay) / 86400000);
    lead = lang === "fr"
      ? `Actif depuis ${days} jour${days > 1 ? "s" : ""}, du ${startLabel} au ${endLabel}.`
      : `Active for ${days} day${days === 1 ? "" : "s"}, from ${startLabel} to ${endLabel}.`;
  }
  return `${lead} ${weekdays}`;
}

export function dateRangeText(work, lang) {
  const startLabel = formatDay(work.start, lang);
  const endLabel = formatDay(work.end, lang);
  return lang === "fr"
    ? `Du ${startLabel} au ${endLabel}.`
    : `From ${startLabel} to ${endLabel}.`;
}

export function formatImport(iso, lang) {
  const copy = COPY[lang];
  if (!iso) return copy.importUnknown;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return copy.importUnknown;
  const formatted = new Intl.DateTimeFormat(lang === "fr" ? "fr-CA" : "en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
  const sep = lang === "fr" ? " : " : ": ";
  return `${copy.imported}${sep}${formatted}`;
}

export function formatDistance(meters, lang) {
  if (meters == null) return "";
  if (meters < 1000) {
    const rounded = Math.round(meters);
    return lang === "fr" ? `à ${rounded} m` : `${rounded} m away`;
  }
  const km = (meters / 1000).toFixed(1);
  return lang === "fr" ? `à ${km} km` : `${km} km away`;
}

export function reasonLabel(work, lang) {
  return reasonText(work, lang);
}
