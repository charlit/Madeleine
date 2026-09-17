# Arène ⚔️ — jeu multijoueur temps réel

Petit jeu d'arène pensé pour mobile : 4 personnages, chacun avec son
projectile, jusqu'à 10 joueurs en simultané, cœurs de vie et armes
améliorées qui pop sur la carte. Auto-hébergé sur le Mac mini, comme
Madeleine et PalmStreet (voir le README à la racine du dépôt pour le
principe général Docker + Tailscale Funnel).

## Lancer en local (dev)

```
cd arena
npm install
npm start
```

Puis ouvre `http://localhost:8084` sur ton téléphone (même réseau Wi-Fi)
ou dans le navigateur de ton ordi (les manettes tactiles fonctionnent
aussi à la souris).

## Avec Docker (depuis la racine du dépôt)

```
docker compose up -d --build arena
```

Le service `arena` écoute sur le port **8084** (Madeleine reste sur 8083,
PalmStreet sur 8082).

## Exposer publiquement (Tailscale Funnel)

Pour faire cohabiter les trois services derrière un seul funnel 443 :

```
sudo tailscale serve --bg --set-path=/arena http://localhost:8084
sudo tailscale funnel --bg 443
```

Le jeu sera accessible sur :
```
https://games-carlitos.tail736807.ts.net/arena
```

## Personnages

| Personnage | Style de projectile |
|---|---|
| 🔥 Braise | Boule de feu, dégâts moyens, cadence moyenne |
| 🎯 Vise | Tir précis rapide, gros dégâts, cadence lente |
| ✨ Rafale | 3 projectiles en éventail, courte portée |
| 🔮 Spectre | Projectile lent qui suit légèrement la cible la plus proche |

## Règles

- Déplacement au joystick gauche, visée + tir au joystick droit (tenir
  le joystick droit incliné tire automatiquement dans cette direction).
- Un cœur ❤️ soigne 35 PV. Une arme améliorée 🔫 augmente dégâts et
  cadence de tir pendant 15s, équipée automatiquement en marchant dessus.
- 100 PV, mort = réapparition 3s plus tard ailleurs sur la carte.
- Jusqu'à 10 joueurs en simultané ; au-delà, l'arène affiche "pleine"
  jusqu'à ce qu'une place se libère.
