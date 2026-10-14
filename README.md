# Info-Route MTL

Carte citoyenne des travaux routiers en cours à Montréal, plus les avis officiels de circulation et de stationnement. Les deux jeux viennent de la Ville de Montréal (CC-BY 4.0). Les avis ne sont pas un inventaire complet des manifestations, fêtes ou fermetures ponctuelles. L'application est indépendante : pas de comptes, pas de paiement.

Citizen map of current Montreal roadwork, plus official traffic and parking notices, using City of Montreal open data (CC-BY 4.0). Notices are not a complete list of demonstrations, parties, or one-off closures. No accounts and no payments.

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

Deux scripts, à relancer une fois par jour (Planificateur de tâches Windows, ou plus tard une tâche planifiée). Le serveur de données refuse le téléchargement sans un User-Agent de navigateur. Chaque script en envoie un. L'API relit les fichiers dès qu'ils changent.

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

## Render

Un seul `Dockerfile` construit l'app React et la sert avec FastAPI (`/` pour l'interface, `/api` pour les données). `render.yaml` décrit le service web Docker `info-route-mtl`, avec le contrôle de santé `/api/`. Lancer `import_roadwork.py` et `import_avis.py` avant de construire l'image, pour que `backend/data/roadwork.json` et `backend/data/avis.json` soient inclus.
