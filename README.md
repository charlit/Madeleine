# Madeleine auto-hébergé sur ton Mac mini — guide complet

Ce dossier remplace Netlify : le jeu et le classement TOP 10 tournent
directement sur ton Mac mini, via Docker (Colima), exactement comme
PalmStreet. On utilise **Tailscale Funnel** pour que n'importe qui puisse
y jouer depuis internet, sans toucher à ta box ni ouvrir de port.

## Contenu du dossier

```
Madeleine/
├── server.js           <- remplace netlify/functions/scores.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── index.html / script.js / style.css   <- le jeu (source, gardés synchro avec public/)
├── public/
│   ├── index.html       <- copie servie en prod par server.js
│   ├── script.js
│   └── style.css
└── data/                <- créé automatiquement, contient scores.json
```

## 1. Cloner le dépôt sur le Mac mini

```
ssh jussan@games-carlitos.tail736807.ts.net
git clone https://github.com/charlit/Madeleine.git
```

## 2. Lancer le serveur avec Docker

Toujours connecté en SSH sur le Mac mini :

```
colima start --vm-type=vz   # si Colima n'est pas déjà démarré
cd Madeleine
docker compose up -d --build
```

Vérifie que ça tourne :
```
docker compose logs -f
```
Tu dois voir `Madeleine auto-hébergé, écoute sur le port 8083`. Ctrl+C
pour quitter l'affichage des logs (le serveur continue de tourner).

Teste en local sur le Mac mini :
```
curl http://localhost:8083/api/scores
```
Tu dois voir `[]`.

## 3. Rendre le jeu accessible à tout le monde

**Important : PalmStreet tourne déjà sur ce Mac mini avec son propre Funnel
sur le port 8082.** Tailscale Funnel n'expose qu'un seul service à la fois
par port public (443/8443/10000), donc il y a deux façons de faire cohabiter
les deux jeux :

### Option A — les deux jeux en public en même temps (recommandé)

On utilise `tailscale serve` pour router par chemin d'URL vers chaque port
local, puis un seul `tailscale funnel` sur le port 443 :

```
sudo tailscale serve --bg --set-path=/madeleine http://localhost:8083
sudo tailscale funnel --bg 443
```

(si PalmStreet n'est pas déjà routé sur `/`, fais pareil pour lui :
`sudo tailscale serve --bg --set-path=/ http://localhost:8082`)

Le jeu sera alors accessible sur :
```
https://games-carlitos.tail736807.ts.net/madeleine
```

Vérifie le routage actif :
```
sudo tailscale serve status
```

### Option B — un seul jeu public à la fois (plus simple)

```
sudo tailscale funnel --bg off      # coupe le funnel actuel (PalmStreet)
sudo tailscale funnel --bg 8083     # expose Madeleine à la place
```

L'URL reste `https://games-carlitos.tail736807.ts.net/`, mais un seul des
deux jeux est joignable de l'extérieur à la fois.

## 4. Ce qui change par rapport à Netlify

- Le jeu n'est en ligne que si **le Mac mini est allumé et connecté**.
- `docker compose logs -f` remplace les logs de fonctions Netlify.
- Les scores sont dans `Madeleine/data/scores.json` — tu peux les ouvrir
  avec `cat data/scores.json` ou les éditer comme n'importe quel fichier.

## 5. Mettre à jour le jeu plus tard

```
cd Madeleine
git pull
docker compose up -d --build
```

## 6. Démarrage automatique au redémarrage du Mac mini

Le conteneur a `restart: unless-stopped`, donc si Docker/Colima redémarre,
le conteneur repart tout seul. Si le Mac mini lui-même redémarre, Colima
doit être relancé aussi (même limitation que pour PalmStreet) — dis-moi si
tu veux un agent `launchd` qui démarre `colima` puis les deux
`docker compose up -d` au boot.
