# The Cloud Experience — guide opérateur

## Lancer
1. Mettre les 3 fichiers (`index.html`, `style.css`, `script.js`) dans le même dossier.
2. Ouvrir `index.html` dans Chrome, puis **F11** pour le plein écran.
3. Les polices viennent de Google Fonts : ouvrir la page une fois avec internet avant l'expo.

## Les touches
| Touche | Action |
|---|---|
| **ESPACE** | écran suivant |
| **T** | mauvaise carte → "Try again" (revient seul au Round 1 après 2,5 s) |
| **S** | bonne carte → "Well done" + score dans le leaderboard |
| **F** | échec direct → "No more attempts" |
| **ÉCHAP** | retour à l'accueil (reset) |
| **H** | afficher / cacher l'aide à l'écran |
| **CTRL + SHIFT + X** (2 fois en 3 s) | vider le leaderboard |

La 3e pression sur **T** affiche automatiquement "No more attempts".
Sur l'écran d'accueil, le clavier sert au visiteur (il tape son nom puis Entrée).

## Les sons (joués automatiquement par le site)
Les fichiers MP3 doivent être dans un dossier `sounds/` à côté de `index.html` (noms exacts ci-dessous).
Une seule voix joue à la fois : un nouveau son coupe le précédent. ÉCHAP (ou la fin du jeu) coupe tout.

| Fichier (`sounds/…`) | Déclencheur |
|---|---|
| `Welcome to the Cloud.mp3` | 1,5 s après l'ouverture de la page (et à chaque retour à l'accueil) |
| `Thank you final.mp3` | 1 s après le clic sur START (ou Entrée) ; coupe "Welcome" s'il joue encore |
| `Not quit try again V final.mp3` | Round 1 : 1re mauvaise carte (**T**) |
| `Disppointing V final.mp3` | Round 1 : 2e mauvaise carte (**T**) |
| `No more attemps V final.mp3` | Round 1 : 3e mauvaise carte (**T**) ou échec direct (**F**) |
| `Well done - Round 2 final .mp3` | Round 1 : bonne carte (**S**), écran "Well done" |
| `Final Part.mp3` | Round 2 : ESPACE quand le visiteur choisit une carte (écran noir puis "Wrong.") |

**Musiques de fond** (en boucle, en pause pendant qu'une voix joue, reprennent à la fin de la voix) :

| Fichier (`sounds/…`) | Démarre | S'arrête |
|---|---|---|
| `round 1.mp3` | début du Round 1, seulement une fois "Thank you" terminé | bonne carte (S) ou "No more attempts" (3e T / F) |
| `Round 2.mp3` | ESPACE après l'annonce du Round 2 (début du Round 2) | ESPACE au Round 2, quand "Final Part" démarre |

**Lecture automatique :** Chrome bloque le son tant que personne n'a touché la page.
Si "Welcome" ne part pas à l'ouverture, il démarre au premier clic ou à la première touche
(l'opérateur peut cliquer une fois dans la page après le F11). Pour éviter ça complètement,
lancer Chrome avec `--autoplay-policy=no-user-gesture-required`.

## Déroulé (opérateur)
| Écran | Voix-off (contenu) | Touche pour passer |
|---|---|---|
| Accueil | boucle "Welcome…" | le visiteur tape son nom + Entrée |
| Instructions | "Hidden among these images…" | ESPACE à la fin de l'audio → le timer démarre |
| Round 1 | — | T / S / F selon la carte pressée |
| Try again | "Not quite. Try again." | revient seul |
| No more attempts | "No more attempts. Let's move on…" | ESPACE |
| Well done | "Well done! You found…" | ESPACE |
| Annonce Round 2 (clignote) | "Round 2 is about to start…" (retrait des cartes, 10 s) | ESPACE |
| Round 2 | — | ESPACE quand le visiteur appuie sur une carte (écran noir 1,5 s puis "Wrong.") |
| Wrong. | voix-off finale | ESPACE |
| "Actually, there was no right answer." | (suite voix-off) | ESPACE |
| "Every single creation… artificial intelligence." | | ESPACE |
| "And as more content floods the internet…" | | ESPACE |
| "Human creativity is being replaced." | | ESPACE |
| "How much of this is worth your attention?" | | ESPACE |
| "Thank you for your participation." + "Please leave the room →" | | ESPACE → accueil |

## Réglages faciles (en haut de `script.js`)
- `TRY_AGAIN_DURATION` : durée de l'écran "Try again"
- `BLACKOUT_DURATION` : durée du noir avant "Wrong."
- `FLASH_A_DURATION` / `FLASH_B_DURATION` : durée de "Round 2 is about to start" (1 s) et de "even harder" (2,5 s)
- `LEADERBOARD_SIZE` : nombre de scores affichés (5)
- Les couleurs sont en haut de `style.css` (`:root`).
