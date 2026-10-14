# Info-Route MTL

Avertit **avant de partir** sur **vos endroits** : maison, auto stationnée, travail, trajet. Fermeture de rue, de voie, de trottoir, ou stationnement interdit — en langage clair. La carte des chantiers Ville, des avis et du Québec 511 reste disponible.

Warns you **before you leave** about **your places**: home, parked car, work, saved route. Street closed, lane closed, sidewalk closed, or no parking — in plain language. The City / notices / Québec 511 map is still there.

**La signalisation dans la rue a toujours préséance. / Street signs always take precedence.** Ce n'est pas une garantie contre le remorquage. This is not a guarantee against towing.

Gratuit : 1 endroit **enregistré** (vous le voyez et le gardez). Enregistrer un autre endroit remplace le précédent. 2 $/mois (Stripe) : jusqu'à 5 favoris, alertes courriel (nouvelle fermeture ou stationnement interdit à ~100 m ou le long d'un trajet), plus un résumé le dimanche. Les comptes gratuits ne reçoivent pas de courriels.

Free: 1 **saved** place (see and keep it). Saving another replaces the current one. $2/month (Stripe): up to 5 favourites, email alerts (new closure or no-parking within ~100 m or along a saved route), plus a Sunday summary. Free users do not get email alerts.

## Lancer en local / Start locally

Deux processus. Ports **3001** (interface) et **8001** (API).

From the project folder `Info-Route MTL`:

```powershell
# 1. API
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe import_roadwork.py
.\.venv\Scripts\python.exe import_avis.py
.\.venv\Scripts\python.exe import_mtq.py
.\.venv\Scripts\python.exe import_snow.py
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

Quatre scripts, à relancer une fois par jour. Le serveur de données refuse parfois le téléchargement sans un User-Agent de navigateur. Chaque script en envoie un. L'API relit les fichiers dès qu'ils changent.

### Travaux routiers + impacts

Télécharge le CSV des entraves **et** le CSV [Impacts des entraves](https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d/resource/a2bc8014-488c-495d-941b-e7ae1999d1bd). Jointure par identifiant de demande (`id` = `id_request`). Chaque chantier affiche :

- Rue fermée / Street closed (rouge)
- Voie(s) fermée(s) / Lane(s) closed (orange)
- Trottoir fermé / Sidewalk closed (bleu)
- Stationnement interdit / No parking (jaune)
- sinon Travaux sans fermeture annoncée (gris)

La carte propose des interrupteurs pour rue fermée, voie fermée, trottoir fermé, stationnement interdit, et les chantiers sans fermeture annoncée. Plusieurs peuvent être allumés en même temps. Par défaut, les quatre fermetures sont allumées et « sans fermeture » est éteint.

```powershell
cd backend
.\.venv\Scripts\python.exe import_roadwork.py
```

### Avis et alertes

```powershell
cd backend
.\.venv\Scripts\python.exe import_avis.py
```

### Travaux routiers MTQ / Québec 511

```powershell
cd backend
.\.venv\Scripts\python.exe import_mtq.py
```

### Stationnements gratuits de déneigement

```powershell
cd backend
.\.venv\Scripts\python.exe import_snow.py
```

Le statut de chargement Planif-Neige est prévu (`SNOW_ENABLED=1`) mais reste éteint tant que le jeton n'est pas fourni. Les stationnements gratuits s'affichent dès que le CSV est importé.

### Alertes courriel (plan payant)

```powershell
cd backend
.\.venv\Scripts\python.exe send_alerts.py
.\.venv\Scripts\python.exe send_alerts.py --weekly
```

Nécessite `STRIPE_SECRET_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `ALERT_FROM`. À lancer souvent pour les nouvelles fermetures, et le dimanche (ou avec `--weekly`) pour le résumé.

## Render

Un seul `Dockerfile` construit l'app React et la sert avec FastAPI. Lancer les imports avant de construire l'image, pour que `backend/data/*.json` soient inclus.

## Données et licences / Data and licenses

- **Ville de Montréal — [Entraves et travaux en cours](https://donnees.montreal.ca/dataset/667342f7-f667-4c3c-9837-65e81312cd8d)** (permis + impacts) et **[Avis et alertes](https://donnees.montreal.ca/dataset/avis-alertes)** : [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/). Crédit : Ville de Montréal.
- **[Stationnements gratuits et payants (déneigement)](https://donnees.montreal.ca/dataset/stationnements-deneigement)** : CC-BY 4.0. Crédit : Ville de Montréal.
- **Transports Québec / Québec 511 — [Travaux routiers](https://www.donneesquebec.ca/recherche/dataset/travaux-routiers)** : CC-BY 4.0.
- **OpenStreetMap** (tuiles et [Nominatim](https://nominatim.openstreetmap.org), suggestions d'adresses limitées à l'île de Montréal) : [ODbL](https://www.openstreetmap.org/copyright).
