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
    tagline:
      "Avant de partir : fermetures et stationnement interdit à vos endroits — maison, auto, travail, trajet.",
    disclaimer:
      "La signalisation dans la rue a toujours préséance. Ce n'est pas une garantie contre le remorquage. Les avis de la Ville ne couvrent pas toutes les manifestations ou fêtes. Les points MTQ sont des autoroutes, tunnels et ponts — pas les rues locales.",
    searchLabel: "Enregistrer un endroit",
    searchKind: "Type d'endroit",
    searchHelp: "Choisissez le type, cherchez, puis enregistrez. Gratuit : un seul à la fois — un nouvel enregistrement remplace le précédent.",
    searchHelpPaid: "Choisissez le type, cherchez, puis ajoutez jusqu'à 5 favoris.",
    searchPlaceholder: "Ex. rue Ontario, Hochelaga, 4200 rue Notre-Dame",
    searchButton: "Chercher",
    placeNotFound: "Ce lieu n'a pas été trouvé à Montréal.",
    searching: "Recherche…",
    useMyLocation: "Utiliser ma position",
    locating: "Localisation…",
    youAreHere: "Vous êtes ici",
    noResultsHere: "Aucun chantier, avis ni chantier MTQ à proximité de votre position.",
    geoDenied: "La localisation a été refusée. Autorisez-la dans le navigateur, ou tapez une adresse.",
    geoUnavailable: "Impossible d'obtenir votre position. Réessayez, ou tapez une adresse.",
    geoTimeout: "La localisation a pris trop de temps. Réessayez, ou tapez une adresse.",
    geoUnsupported: "Ce navigateur ne permet pas la localisation. Tapez une adresse.",
    geoOutside: "Ce lieu n'est pas sur l'île de Montréal.",
    clearSearch: "Revenir à la carte de l'arrondissement",
    showAll: "Afficher toute l'activité",
    mapOptions: "Options de la carte",
    mapOptionsHint: "Activez une ou plusieurs options. La carte montre tout ce qui correspond.",
    layersAllOn: "Tout activer",
    layersAllOff: "Tout masquer",
    layersNoneOn: "Aucune option n'est activée. Allumez rue fermée, voie, ou une autre option.",
    showClosures: "Fermetures seulement",
    impactStreet: "Rue fermée",
    impactLane: "Voie(s) fermée(s)",
    impactSidewalk: "Trottoir fermé",
    impactParking: "Stationnement interdit",
    impactNone: "Travaux sans fermeture annoncée",
    impactLabel: "Impact",
    placesTitle: "Mes endroits",
    placesEmpty: "Enregistrez votre maison, l'auto stationnée, le travail, un trajet, une rue, une intersection ou une adresse.",
    addPlace: "Enregistrer cet endroit",
    placeKind: "Type d'endroit",
    placeKinds: {
      home: "Maison",
      car: "Auto stationnée",
      work: "Travail",
      route: "Trajet enregistré",
      street: "Rue",
      intersection: "Intersection",
      address: "Adresse",
    },
    placeLimitFree: "Gratuit : 1 endroit enregistré (vous le voyez et le gardez). Un nouvel enregistrement remplace le précédent. 2 $/mois : jusqu'à 5 favoris et alertes courriel.",
    placeLimitPaid: "Plan payant : jusqu'à 5 favoris et alertes courriel (nouvelle fermeture ou stationnement interdit, plus un résumé le dimanche).",
    placeLimitPaidFull: "Vous avez déjà 5 favoris. Retirez-en un pour en ajouter un autre.",
    placeUpgrade: "Pour garder un 2e endroit et recevoir des alertes : 2 $/mois.",
    replaceAsk: (label) => `Vous avez déjà « ${label} ». Remplacez-le, ou passez à 5 favoris avec alertes.`,
    replacePlace: "Remplacer cet endroit",
    keepAndUpgrade: "Garder et passer à 5 + alertes",
    savePlaceHint: "Cherchez avec les boutons ci-dessous, puis enregistrez. Gratuit : un seul endroit à la fois.",
    routeStart: "Départ",
    routeEnd: "Arrivée",
    placeOk: "OK",
    snowSoon: "Statut de chargement de la neige : bientôt (Planif-Neige).",
    snowLotsTitle: "Stationnements gratuits de déneigement",
    snowLotsEmpty: "Aucun stationnement gratuit de déneigement à proximité pour le moment.",
    snowLotHours: "Heures",
    paidCta: "Alertes courriel — 2 $/mois",
    navPlaces: "Mes endroits",
    signsNote: "La signalisation dans la rue a toujours préséance.",
    boroughLabel: "Arrondissement",
    allBoroughs: "Tous les arrondissements",
    loading: "Chargement des chantiers, des avis et des autoroutes…",
    loadError: "Impossible de joindre le serveur pour le moment.",
    count: (n) => (n === 1 ? "1 chantier affiché" : `${n} chantiers affichés`),
    layerCount: ({ works, avis, mtq = 0 }) => {
      const parts = [];
      if (works) parts.push(works === 1 ? "1 chantier" : `${works} chantiers`);
      if (avis) parts.push(avis === 1 ? "1 avis" : `${avis} avis`);
      if (mtq) parts.push(mtq === 1 ? "1 chantier MTQ" : `${mtq} chantiers MTQ`);
      if (!parts.length) return "Aucun chantier, avis ni chantier MTQ affiché";
      if (parts.length === 1) {
        const n = works || avis || mtq;
        return `${parts[0]} affiché${n > 1 ? "s" : ""}`;
      }
      return `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]} affichés`;
    },
    clickHint: "Touchez un point sur la carte : rouge (rue fermée), ambre (voie), bleu (trottoir), jaune (stationnement interdit).",
    listTitle: "Chantiers de la Ville",
    avisTitle: "Avis officiels",
    avisHint: "Avis de circulation ou de stationnement publiés par la Ville. Pas une liste complète des manifestations ou fêtes.",
    avisEmpty: "Aucun avis de circulation ou de stationnement pour cet arrondissement.",
    mtqTitle: "Autoroutes Québec 511",
    mtqHint: "Fermetures de voies sur les autoroutes, tunnels et ponts du ministère des Transports. Ce n'est pas le réseau de rues de la Ville.",
    mtqEmpty: "Aucun chantier MTQ pour cet arrondissement. Les autoroutes sans arrondissement apparaissent dans Tous les arrondissements.",
    mtqLink: "Voir sur Québec 511",
    mtqLanes: "Voies",
    mtqDetour: "Détour",
    mtqDirection: "Direction",
    mtqWhere: "Localisation",
    noticeLink: "Lire l'avis sur montreal.ca",
    noticeType: "Type",
    legendTitle: "Légende",
    legendWork: "Travaux de la Ville",
    legendAvis: "Avis officiels",
    legendMtq: "MTQ / 511",
    legendStreet: "Rue fermée",
    legendLane: "Voie(s) fermée(s)",
    legendSidewalk: "Trottoir fermé",
    legendParking: "Stationnement interdit",
    legendNone: "Sans fermeture annoncée",
    legendSnow: "Stationnement déneigement",
    datasetImpacts: "Impacts des entraves",
    datasetSnow: "Stationnements déneigement",
    importedSnow: "Stationnements neige importés",
    kindWork: "Chantier",
    kindAvis: "Avis",
    kindMtq: "MTQ / 511",
    avisType: {
      "Circulation et transport": "Circulation et transport",
      Stationnement: "Stationnement",
    },
    resultsTitle: "Résultats",
    noResults: "Aucun chantier, avis ni chantier MTQ trouvé pour ce lieu.",
    placeFound: "Lieu repéré",
    streetMatch: "sur cette rue",
    nearbyMatch: "à proximité",
    reason: "Raison",
    who: "Qui fait les travaux",
    dates: "Dates",
    daysActive: "Jours actifs",
    unknown: "Non précisé",
    close: "Fermer le détail",
    footer:
      "Application citoyenne indépendante — données adaptées de la Ville de Montréal (travaux et avis) et de Transports Québec / Québec 511 (autoroutes), CC-BY 4.0",
    imported: "Dernière importation",
    importedWorks: "Travaux importés",
    importedAvis: "Avis importés",
    importedMtq: "MTQ importé",
    importUnknown: "Dernière importation : pas encore disponible",
    langGroup: "Langue",
    dataset: "Jeu de données",
    datasetWorks: "Travaux de la Ville",
    datasetAvis: "Avis et alertes",
    datasetMtq: "Travaux routiers MTQ",
    avisHuman: "Avis de la Ville",
    mtqHuman: "Québec 511",
    navMap: "Carte",
    backToMap: "← Accueil",
    navSubscribe: "Alertes 2 $",
    navParks: "Parcs MHM",
    menu: "Menu",
    menuClose: "Fermer",
    themeToggle: "Changer le thème",
    themeDark: "Sombre",
    themeLight: "Clair",
    subscribe: {
      title: "Alertes pour mes endroits",
      intro: "Gratuit : 1 endroit enregistré. 2 $ par mois : jusqu'à 5 favoris, alerte dès qu'une fermeture ou un stationnement interdit touche un endroit (environ 100 m, ou le long d'un trajet), plus un résumé le dimanche.",
      included: "Inclus : alertes courriel pour vos favoris (nouvelle fermeture ou stationnement interdit) et un résumé le dimanche.",
      month: "mois",
      email: "Courriel",
      frequency: "Fréquence du résumé",
      digestLanguage: "Langue du résumé",
      bothLanguages: "Français et anglais",
      choose: "Ce que vous voulez recevoir",
      alerts: "Informations",
      alert: {
        closure: "Nouvelle fermeture près d'un endroit",
        parking: "Nouveau stationnement interdit",
        new: "Nouveaux chantiers",
        ending: "Chantiers qui se terminent",
        dates: "Changements de dates",
        status: "Changements de statut",
        who: "Qui fait les travaux",
        reason: "La raison des travaux",
      },
      freq: {
        daily: "Chaque jour",
        weekly: "Chaque semaine",
        biweekly: "Aux deux semaines",
        monthly: "Chaque mois",
      },
      borough: "Arrondissement",
      allBoroughs: "Tous les arrondissements",
      placesTitle: "Lieux suivis",
      placesHelp: (n) => `${n} / 5 — maison, auto, travail, trajet, rue, intersection ou adresse.`,
      placeKind: "Type de lieu",
      placeType: {
        home: "Maison",
        car: "Auto stationnée",
        work: "Travail",
        route: "Trajet enregistré",
        street: "Rue",
        address: "Adresse",
        intersection: "Intersection",
        near_me: "Ma position",
      },
      placeHereLabel: "Ma position",
      useMyLocation: "Utiliser ma position",
      placeQuery: {
        route: "Départ",
        home: "Adresse",
        car: "Où est l'auto",
        work: "Adresse du travail",
        street: "Rue",
        address: "Adresse",
        intersection: "Première rue",
        near_me: "Position",
      },
      placeVia: {
        route: "Arrivée",
        intersection: "Deuxième rue",
      },
      placePlaceholder: {
        route: "Ex. 4200 rue Notre-Dame Est",
        home: "Ex. 4200 rue Darling, Hochelaga",
        car: "Ex. 900 rue Ontario Est",
        work: "Ex. 1550 rue Metcalfe",
        street: "Ex. rue Ontario",
        address: "Ex. 4200 rue Notre-Dame Est",
        intersection: "Ex. Ontario",
      },
      placeViaPlaceholder: {
        route: "Ex. station Honoré-Beaugrand",
        intersection: "Ex. Hochelaga",
      },
      addPlace: "Enregistrer ce lieu",
      addingPlace: "Vérification…",
      removePlace: "Retirer",
      cta: "S'abonner — 2 $ / mois",
      sending: "Ouverture du paiement…",
      secure: "Paiement par Stripe. Vous pourrez changer ces choix plus tard.",
      previewCount: (n) => (n === 1 ? "1 chantier correspond à ce choix en ce moment." : `${n} chantiers correspondent à ce choix en ce moment.`),
      previewChanges: (n) => (n === 1 ? "1 changement est prêt pour le prochain résumé." : `${n} changements sont prêts pour le prochain résumé.`),
      unknown: "Non précisé",
      successTitle: "Abonnement",
      successPaid: "C'est fait. Vos choix sont enregistrés. Le lien ci-dessous ouvre le résumé et permet de les changer.",
      successPending: "Le paiement n'est pas encore confirmé. Rechargez cette page dans un moment.",
      manageLink: "Changer mes choix",
      cancelTitle: "Paiement annulé",
      cancelBody: "Aucun montant n'a été pris.",
      back: "Revenir à l'abonnement",
      manageTitle: "Vos choix",
      save: "Enregistrer",
      saved: "Choix enregistrés.",
      changesTitle: "Dans le prochain résumé",
      noChanges: "Aucun changement depuis la dernière importation. Le résumé partira selon la fréquence choisie.",
      errors: {
        load: "Impossible de joindre le serveur pour le moment.",
        payments_off: "Le paiement n'est pas configuré sur ce serveur.",
        pick_alert: "Choisissez au moins une information.",
        bad_frequency: "Choisissez une fréquence.",
        bad_borough: "Cet arrondissement n'est pas dans les données.",
        street_not_found: "Cette rue ou adresse n'a pas été trouvée à Montréal.",
        place_not_found: "Ce lieu n'a pas été trouvé à Montréal.",
        too_many_places: "Vous pouvez enregistrer jusqu'à 5 lieux.",
        bad_place: "Ce type de lieu n'est pas reconnu.",
        geo_denied: "La localisation a été refusée. Autorisez-la dans le navigateur.",
        geo_unavailable: "Impossible d'obtenir votre position. Réessayez.",
        geo_timeout: "La localisation a pris trop de temps. Réessayez.",
        geo_unsupported: "Ce navigateur ne permet pas la localisation.",
        geo_outside: "Votre position n'est pas à Montréal.",
        outside_montreal: "Votre position n'est pas à Montréal.",
        bad_email: "Entrez un courriel valide.",
        checkout_failed: "Le paiement n'a pas pu démarrer. Réessayez.",
        bad_token: "Ce lien de gestion n'est pas valide.",
        subscription_not_found: "Abonnement introuvable.",
        bad_session: "Cette session de paiement n'est pas valide.",
      },
    },
  },
  en: {
    title: "Info-Route MTL",
    tagline:
      "Before you leave: closures and no-parking at your places — home, parked car, work, or a saved route.",
    disclaimer:
      "Street signs always take precedence. This is not a guarantee against towing. City notices do not cover every demonstration or party. MTQ marks are highways, tunnels, and bridges — not local streets.",
    searchLabel: "Save a place",
    searchKind: "Place type",
    searchHelp: "Pick a type, search, then save. Free: one at a time — saving another replaces the current one.",
    searchHelpPaid: "Pick a type, search, then add up to 5 favourites.",
    searchPlaceholder: "e.g. Ontario Street, Hochelaga, 4200 Notre-Dame",
    searchButton: "Search",
    placeNotFound: "That place was not found in Montreal.",
    searching: "Searching…",
    useMyLocation: "Use my location",
    locating: "Locating…",
    youAreHere: "You are here",
    noResultsHere: "No City work, notices, or MTQ highway sites near your location.",
    geoDenied: "Location was denied. Allow it in the browser, or type an address.",
    geoUnavailable: "Your location could not be found. Try again, or type an address.",
    geoTimeout: "Finding your location took too long. Try again, or type an address.",
    geoUnsupported: "This browser cannot share your location. Type an address.",
    geoOutside: "That place is not on the Island of Montreal.",
    clearSearch: "Back to the borough map",
    showAll: "Show all activity",
    mapOptions: "Map options",
    mapOptionsHint: "Turn on one or more options. The map shows everything that matches.",
    layersAllOn: "All on",
    layersAllOff: "All off",
    layersNoneOn: "Every option is off. Turn on closed street, lane, or another option.",
    showClosures: "Closures only",
    impactStreet: "Street closed",
    impactLane: "Lane(s) closed",
    impactSidewalk: "Sidewalk closed",
    impactParking: "No parking",
    impactNone: "Work with no announced closure",
    impactLabel: "Impact",
    placesTitle: "My places",
    placesEmpty: "Save your home, parked car, work, a route, a street, an intersection, or an address.",
    addPlace: "Save this place",
    placeKind: "Place type",
    placeKinds: {
      home: "Home",
      car: "Parked car",
      work: "Work",
      route: "Saved route",
      street: "Street",
      intersection: "Intersection",
      address: "Address",
    },
    placeLimitFree: "Free: 1 saved place (you can see it and keep it). Saving another replaces the current one. $2/month: up to 5 favourites and email alerts.",
    placeLimitPaid: "Paid plan: up to 5 favourites and email alerts (new closure or no-parking, plus a Sunday summary).",
    placeLimitPaidFull: "You already have 5 favourites. Remove one to add another.",
    placeUpgrade: "To keep a second place and get alerts: $2/month.",
    replaceAsk: (label) => `You already have “${label}”. Replace it, or upgrade to 5 favourites with alerts.`,
    replacePlace: "Replace this place",
    keepAndUpgrade: "Keep it and upgrade to 5 + alerts",
    savePlaceHint: "Search with the buttons below, then save. Free: one place at a time.",
    routeStart: "Start",
    routeEnd: "End",
    placeOk: "OK",
    snowSoon: "Snow-loading status: coming (Planif-Neige).",
    snowLotsTitle: "Free snow-removal parking lots",
    snowLotsEmpty: "No free snow-removal parking nearby right now.",
    snowLotHours: "Hours",
    paidCta: "Email alerts — $2/month",
    navPlaces: "My places",
    signsNote: "Street signs always take precedence.",
    boroughLabel: "Borough",
    allBoroughs: "All boroughs",
    loading: "Loading work sites, notices, and highways…",
    loadError: "The server can't be reached right now.",
    count: (n) => (n === 1 ? "1 work site shown" : `${n} work sites shown`),
    layerCount: ({ works, avis, mtq = 0 }) => {
      const parts = [];
      if (works) parts.push(works === 1 ? "1 City work site" : `${works} City work sites`);
      if (avis) parts.push(avis === 1 ? "1 notice" : `${avis} notices`);
      if (mtq) parts.push(mtq === 1 ? "1 MTQ highway site" : `${mtq} MTQ highway sites`);
      if (!parts.length) return "No City work, notices, or MTQ highway sites shown";
      if (parts.length === 1) return `${parts[0]} shown`;
      return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} shown`;
    },
    clickHint: "Tap a point on the map: red (street closed), amber (lane), blue (sidewalk), yellow (no parking).",
    listTitle: "City work sites",
    avisTitle: "Official notices",
    avisHint: "City notices about traffic or parking. This is not a complete list of demonstrations or parties.",
    avisEmpty: "No traffic or parking notices for this borough.",
    mtqTitle: "Québec 511 highways",
    mtqHint: "Lane closures on ministry highways, tunnels, and bridges. This is not the City street network.",
    mtqEmpty: "No MTQ highway sites for this borough. Highways without a borough appear under All boroughs.",
    mtqLink: "See on Québec 511",
    mtqLanes: "Lanes",
    mtqDetour: "Detour",
    mtqDirection: "Direction",
    mtqWhere: "Location",
    noticeLink: "Read the notice on montreal.ca",
    noticeType: "Type",
    legendTitle: "Legend",
    legendWork: "City roadwork",
    legendAvis: "Official notices",
    legendMtq: "MTQ / 511",
    legendStreet: "Street closed",
    legendLane: "Lane(s) closed",
    legendSidewalk: "Sidewalk closed",
    legendParking: "No parking",
    legendNone: "No announced closure",
    legendSnow: "Snow-removal parking",
    datasetImpacts: "Occupancy impacts",
    datasetSnow: "Snow-removal parking",
    importedSnow: "Snow lots imported",
    kindWork: "Work site",
    kindAvis: "Notice",
    kindMtq: "MTQ / 511",
    avisType: {
      "Circulation et transport": "Traffic and transport",
      Stationnement: "Parking",
    },
    resultsTitle: "Results",
    noResults: "No City work, notices, or MTQ highway sites found for that place.",
    placeFound: "Place located",
    streetMatch: "on this street",
    nearbyMatch: "nearby",
    reason: "Reason",
    who: "Who is doing the work",
    dates: "Dates",
    daysActive: "Days active",
    unknown: "Not specified",
    close: "Close details",
    footer:
      "Independent citizen application — data adapted from the City of Montreal (roadwork and notices) and Transports Québec / Québec 511 (highways), CC-BY 4.0",
    imported: "Last import",
    importedWorks: "Roadwork imported",
    importedAvis: "Notices imported",
    importedMtq: "MTQ imported",
    importUnknown: "Last import: not available yet",
    langGroup: "Language",
    dataset: "Dataset",
    datasetWorks: "City roadwork",
    datasetAvis: "Notices and alerts",
    datasetMtq: "MTQ roadwork",
    avisHuman: "City notices",
    mtqHuman: "Québec 511",
    navMap: "Map",
    backToMap: "← Home",
    navSubscribe: "Alerts $2",
    navParks: "MHM parks",
    menu: "Menu",
    menuClose: "Close",
    themeToggle: "Toggle theme",
    themeDark: "Dark",
    themeLight: "Light",
    subscribe: {
      title: "Alerts for my places",
      intro: "Free: 1 saved place. $2 a month: up to 5 favourites, an alert when a new closure or no-parking hits a saved place (about 100 m, or along a route), plus a Sunday summary.",
      included: "Included: email alerts for your favourites (new closure or no-parking) and a Sunday summary.",
      month: "month",
      email: "Email",
      frequency: "Digest frequency",
      digestLanguage: "Digest language",
      bothLanguages: "French and English",
      choose: "What you want to receive",
      alerts: "Updates",
      alert: {
        closure: "New closure near a place",
        parking: "New no-parking rule",
        new: "New work sites",
        ending: "Work that is ending",
        dates: "Date changes",
        status: "Status changes",
        who: "Who is doing the work",
        reason: "The reason for the work",
      },
      freq: {
        daily: "Every day",
        weekly: "Every week",
        biweekly: "Every two weeks",
        monthly: "Every month",
      },
      borough: "Borough",
      allBoroughs: "All boroughs",
      placesTitle: "Watched places",
      placesHelp: (n) => `${n} / 5 — home, parked car, work, or a route.`,
      placeKind: "Place type",
      placeType: {
        home: "Home",
        car: "Parked car",
        work: "Work",
        route: "Saved route",
        street: "Street",
        address: "Address",
        intersection: "Intersection",
        near_me: "My location",
      },
      placeHereLabel: "My location",
      useMyLocation: "Use my location",
      placeQuery: {
        route: "Start",
        home: "Address",
        car: "Where the car is",
        work: "Work address",
        street: "Street",
        address: "Address",
        intersection: "First street",
        near_me: "Location",
      },
      placeVia: {
        route: "End",
        intersection: "Second street",
      },
      placePlaceholder: {
        route: "e.g. 4200 Notre-Dame Street East",
        home: "e.g. 4200 Darling Street, Hochelaga",
        car: "e.g. 900 Ontario Street East",
        work: "e.g. 1550 Metcalfe Street",
        street: "e.g. Ontario Street",
        address: "e.g. 4200 Notre-Dame Street East",
        intersection: "e.g. Ontario",
      },
      placeViaPlaceholder: {
        route: "e.g. Honoré-Beaugrand station",
        intersection: "e.g. Hochelaga",
      },
      addPlace: "Save this place",
      addingPlace: "Checking…",
      removePlace: "Remove",
      cta: "Subscribe — $2 / month",
      sending: "Opening checkout…",
      secure: "Paid with Stripe. You can change these choices later.",
      previewCount: (n) => (n === 1 ? "1 work site matches this choice right now." : `${n} work sites match this choice right now.`),
      previewChanges: (n) => (n === 1 ? "1 change is ready for the next digest." : `${n} changes are ready for the next digest.`),
      unknown: "Not specified",
      successTitle: "Subscription",
      successPaid: "You're in. Your choices are saved. The link below opens the digest and lets you change them.",
      successPending: "The payment is not confirmed yet. Reload this page in a moment.",
      manageLink: "Change my choices",
      cancelTitle: "Payment cancelled",
      cancelBody: "You were not charged.",
      back: "Back to subscribe",
      manageTitle: "Your choices",
      save: "Save",
      saved: "Choices saved.",
      changesTitle: "In the next digest",
      noChanges: "Nothing has changed since the last import. The digest still goes out on the schedule you chose.",
      errors: {
        load: "The server can't be reached right now.",
        payments_off: "Payments are not configured on this server.",
        pick_alert: "Choose at least one update.",
        bad_frequency: "Choose a frequency.",
        bad_borough: "That borough is not in the data.",
        street_not_found: "That street or address was not found in Montreal.",
        place_not_found: "That place was not found in Montreal.",
        too_many_places: "You can save up to 5 places.",
        bad_place: "That place type is not recognized.",
        geo_denied: "Location was denied. Allow it in the browser.",
        geo_unavailable: "Your location could not be found. Try again.",
        geo_timeout: "Finding your location took too long. Try again.",
        geo_unsupported: "This browser cannot share your location.",
        geo_outside: "Your location is not in Montreal.",
        outside_montreal: "Your location is not in Montreal.",
        bad_email: "Enter a valid email.",
        checkout_failed: "Checkout could not start. Try again.",
        bad_token: "This manage link is not valid.",
        subscription_not_found: "Subscription not found.",
        bad_session: "This payment session is not valid.",
      },
    },
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

export function formatImport(iso, lang, label) {
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
  return `${label || copy.imported}${sep}${formatted}`;
}

export function avisTypeLabel(type, lang) {
  const copy = COPY[lang];
  return (copy.avisType && copy.avisType[type]) || type || copy.unknown;
}

export function mtqDescription(work, lang) {
  if (lang === "en" && work.description_en) return work.description_en;
  return work.description_fr || work.description_en || "";
}

export function geoErrorKey(error) {
  if (!error) return "geoUnavailable";
  if (error.code === 1) return "geoDenied";
  if (error.code === 2) return "geoUnavailable";
  if (error.code === 3) return "geoTimeout";
  return "geoUnavailable";
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

export function impactLabel(kind, lang) {
  const copy = COPY[lang];
  const labels = {
    street: copy.impactStreet,
    lane: copy.impactLane,
    sidewalk: copy.impactSidewalk,
    parking: copy.impactParking,
    none: copy.impactNone,
  };
  return labels[kind] || copy.impactNone;
}

export function impactKinds(work) {
  if (Array.isArray(work?.kinds) && work.kinds.length) return work.kinds;
  const kinds = [];
  if (work?.street_closed) kinds.push("street");
  if (work?.lane_closed) kinds.push("lane");
  if (work?.sidewalk_closed) kinds.push("sidewalk");
  if (work?.no_parking) kinds.push("parking");
  return kinds;
}
