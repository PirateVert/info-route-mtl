# Info-Route MTL

Carte citoyenne des travaux routiers en cours à Montréal : chantiers de la Ville (orange), avis officiels de circulation et de stationnement (vert), et fermetures d'autoroutes, tunnels et ponts du Québec 511 / Transports Québec (violet). Les avis de la Ville ne sont pas un inventaire complet des manifestations, fêtes ou fermetures ponctuelles. La couche MTQ n'est pas le réseau de rues locales : seulement les routes provinciales sur l'île et ses approches. L'application est indépendante : pas de comptes, pas de paiement.

Citizen map of current Montreal roadwork: City work sites (orange), official traffic and parking notices (green), and Québec 511 / Transports Québec highway, tunnel, and bridge closures (purple). City notices are not a complete list of demonstrations, parties, or one-off closures. The MTQ layer is not local streets — only provincial highways on the island and its approaches. No accounts and no payments.

## Lancer en local / Start locally

Deux processus, comme pour une app React + FastAPI. Les ports **3000** et **8000** sont souvent déjà pris ; ce projet utilise **3001** (interface) et **8001** (API).

From the project folder `Info-Route MTL`:

```powershell
# 1. API
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe import_roadwork.py
.\.venv\Scripts\python.exe import_avis.py
.\.venv\Scripts\python.exe import_mtq.py
.\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001
```

```powershell
# 2. Interface (autre terminal)
cd frontend
npm install
npm start
```

- Interface : http://localhost:3001
- API : http://127.0.0.1:8001/api/

`npm start` parle à l'API grâce au proxy CRA (`frontend/package.json` → `http://127.0.0.1:8001`).

## Import quotidien

Trois scripts, à relancer une fois par jour (Planificateur de tâches Windows, ou plus tard une tâche planifiée). Le serveur de données refuse parfois le téléchargement sans un User-Agent de navigateur. Chaque script en envoie un. L'API relit les fichiers dès qu'ils changent.

### Travaux routiers

Télécharge le CSV des entraves et travaux en cours et enregistre **tous les arrondissements** dans `backend/data/roadwork.json`.

```powershell
cd backend
.\.venv\Scripts\python.exe import_roadwork.py
```

Le filtre Mercier–Hochelaga–Maisonneuve utilise le champ CSV **`boroughid`**, valeur **`Mercier-Hochelaga-Maisonneuve`**.

### Avis et alertes

Télécharge le GeoJSON [Avis et alertes](https://donnees.montreal.ca/dataset/avis-alertes) (le CSV n'a pas de coordonnées) et enregistre les avis de type **Circulation et transport** et **Stationnement** dans `backend/data/avis.json`. Ce sont des avis officiels qui peuvent fermer une rue ou un stationnement — pas une liste complète d'événements. Le site humain est [montreal.ca/avis-et-alertes](https://montreal.ca/avis-et-alertes).

```powershell
cd backend
.\.venv\Scripts\python.exe import_avis.py
```

### Travaux routiers MTQ / Québec 511

Télécharge le GeoJSON [Travaux routiers](https://www.donneesquebec.ca/recherche/dataset/travaux-routiers) du ministère des Transports (WFS temps réel, CC-BY 4.0) et enregistre les chantiers **sur l'île de Montréal et ses approches** dans `backend/data/mtq.json`. Jeu provincial : le script jette le reste du Québec. Ce sont des fermetures de voies sur autoroutes, tunnels et ponts (Ville-Marie/Viger, A-15, A-25 La Fontaine, approches Honoré-Mercier, Saint-Urbain) — pas les rues de la Ville. Le site humain est [quebec511.info](https://www.quebec511.info).

```powershell
cd backend
.\.venv\Scripts\python.exe import_mtq.py
```

## Render

Un seul `Dockerfile` construit l'app React et la sert avec FastAPI (`/` pour l'interface, `/api` pour les données). `render.yaml` décrit le service web Docker `info-route-mtl`, avec le contrôle de santé `/api/`. Lancer `import_roadwork.py`, `import_avis.py` et `import_mtq.py` avant de construire l'image, pour que `backend/data/roadwork.json`, `backend/data/avis.json` et `backend/data/mtq.json` soient inclus.

## Données et licences / Data and licenses

L'application réutilise des données ouvertes, filtrées et présentées en langage clair. Elle est indépendante : ni la Ville de Montréal ni le ministère des Transports n'endossent ce site. Le pied de page du site porte le crédit ; pas de note par point sur la carte.

The app reuses open data, filtered and shown in plain language. It is independent: neither the City of Montreal nor the ministry of transport endorses this site. Credit is in the site footer, not on each map pin.

- **Ville de Montréal — [Entraves et travaux en cours](https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d)** et **[Avis et alertes](https://donnees.montreal.ca/dataset/avis-alertes)** : [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([licence de la Ville](https://donnees.montreal.ca/fr/pages/licence-d-utilisation)). Crédit : Ville de Montréal. Pas de copyleft. Indiquer que les données sont adaptées. Ne pas suggérer un appui de la Ville.
- **Transports Québec / Québec 511 — [Travaux routiers](https://www.donneesquebec.ca/recherche/dataset/travaux-routiers)** : [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/) ([licence Données Québec](https://donneesquebec.ca/fr/licence/)). Crédit : ministère des Transports et de la Mobilité durable (Transports Québec). Le [site Québec 511](https://www.quebec511.info) et ses [conditions d'utilisation](https://www.quebec511.info/fr/basdepage/Utilisation.aspx) portent sur leurs plateformes ; ce projet utilise le jeu ouvert Données Québec, pas les fils RSS 511 (conditions plus strictes).
- **OpenStreetMap** (fond de carte `tile.openstreetmap.org` et géocodage [Nominatim](https://nominatim.openstreetmap.org)) : [ODbL](https://www.openstreetmap.org/copyright) (attribution + share-alike si on redistribue une base dérivée). [Politique Nominatim](https://operations.osmfoundation.org/policies/nominatim/) : User-Agent identifiable, pas de charge lourde, crédit OSM. [Tuiles](https://operations.osmfoundation.org/policies/tiles/) : crédit visible sur la carte.
- **[Leaflet](https://leafletjs.com)** : crédit sur la carte (contrôle d'attribution). Licence BSD 2-clause.
