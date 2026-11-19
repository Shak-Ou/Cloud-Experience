/* =========================================================
   THE CLOUD EXPERIENCE — script.js

   Comment ça marche, en résumé :
   - Chaque écran est une <section class="screen"> dans index.html.
   - Un seul écran est visible à la fois : celui qui a la classe "active".
   - La fonction showScreen("nom") cache tous les écrans et affiche le bon.
   - L'opérateur pilote tout au clavier (ESPACE, T, S, F, ÉCHAP, H).
   - Le leaderboard est un tableau (array) d'objets {id, name, time},
     trié du plus rapide au plus lent et sauvegardé dans le navigateur.
   ========================================================= */


/* =========================================================
   1. LES RÉGLAGES
   "const" = une valeur qui ne change jamais pendant le jeu.
   On les met tout en haut pour pouvoir les modifier facilement.
   Les durées sont en millisecondes (1000 ms = 1 seconde).
   ========================================================= */

const MAX_ATTEMPTS = 3;           // nombre de tentatives au Round 1
const TRY_AGAIN_DURATION = 2500;  // "Try again" reste affiché 2,5 s
const BLACKOUT_DURATION = 1500;   // écran noir avant "Wrong." (1,5 s)
const FLASH_A_DURATION = 1000;    // "Round 2 is about to start" reste 1 s
const FLASH_B_DURATION = 2500;    // "This time, it's going to be even harder" reste 2,5 s
const LEADERBOARD_SIZE = 5;       // on affiche les 5 meilleurs temps

// Les écrans de fin, dans l'ordre (une phrase par écran).
// Ce sont les "id" des sections dans index.html, sans le "screen-" devant.
const END_SCREENS = ["wrong", "end1", "end2", "end3", "end4", "end5", "end6"];


/* =========================================================
   2. LES VARIABLES DU JEU
   "let" = une valeur qui va changer pendant le jeu.
   ========================================================= */

let currentScreen = "welcome";  // l'écran affiché en ce moment
let playerName = "";            // le nom tapé par le visiteur
let wrongCount = 0;             // combien de mauvaises cartes il a pressées
let startTime = 0;              // l'heure exacte où le timer a démarré
let elapsed = 0;                // le temps écoulé depuis, en millisecondes
let lastEntryId = null;         // l'id du dernier score ajouté (pour le faire clignoter)

// On garde ici les "minuteurs" en cours, pour pouvoir les arrêter plus tard
// avec clearInterval() ou clearTimeout().
let timerInterval = null;       // le timer qui défile
let flashTimeout = null;        // l'alternance des 2 messages du Round 2
let tryAgainTimeout = null;     // le retour automatique après "Try again"
let blackoutTimeout = null;     // l'écran noir avant "Wrong."

// On récupère le leaderboard sauvegardé (s'il existe déjà)
let leaderboard = loadLeaderboard();


/* =========================================================
   3. LES ÉLÉMENTS DE LA PAGE
   document.getElementById("...") va chercher dans le HTML
   l'élément qui a cet id, pour pouvoir le modifier en JS.
   ========================================================= */

const nameForm = document.getElementById("name-form");
const nameInput = document.getElementById("name-input");
const finalTime = document.getElementById("final-time");
const help = document.getElementById("help");
const helpCurrent = document.getElementById("help-current");
const announceScreen = document.getElementById("screen-announce");


/* =========================================================
   3 bis. LES SONS (voix-off)
   Les fichiers sont dans le dossier "sounds/", à côté de index.html.
   Une seule voix joue à la fois : lancer un son arrête celui en cours.
   ========================================================= */

const WELCOME_DELAY = 1500;   // la voix d'accueil démarre 1,5 s après l'ouverture

const SOUND_FILES = {
  welcome:     "Welcome to the Cloud.mp3",           // accueil : invite à entrer son nom
  thankyou:    "Thank you final.mp3",                // nom validé : 1 s après le clic sur START
  tryagain:    "Not quit try again V final.mp3",     // Round 1 : 1re mauvaise carte (T)
  disappoint:  "Disppointing V final.mp3",           // Round 1 : 2e mauvaise carte (T)
  nomore:      "No more attemps V final.mp3",        // Round 1 : 3e mauvaise carte (T) ou échec direct (F)
  welldone:    "Well done - Round 2 final .mp3",     // Round 1 : bonne carte (S), écran "Well done"
  finalpart:   "Final Part.mp3"                      // Round 2 : choix fait → début de la séquence de fin
};

// On prépare un objet Audio par fichier (chargé à l'avance)
const sounds = {};
Object.keys(SOUND_FILES).forEach(function (key) {
  sounds[key] = new Audio("sounds/" + encodeURIComponent(SOUND_FILES[key]));
  sounds[key].preload = "auto";
});

let currentSound = null;        // le son qui joue en ce moment
let welcomeState = "waiting";   // "waiting" → "playing" → "done"
let welcomeTimeout = null;      // le délai de 1,5 s avant l'accueil
let thankYouTimeout = null;     // le délai de 1 s entre START et "thankyou"
const THANK_YOU_DELAY = 1000;   // "thankyou" démarre 1 s après la validation du nom
let thankYouDone = false;       // "thankyou" terminé ? (la musique du Round 1 l'attend)

// Lance un son (et coupe celui qui jouait avant)
function playSound(key) {
  if (key !== "thankyou") {
    clearTimeout(thankYouTimeout);   // un autre son prend la main
    thankYouDone = true;             // "thankyou" annulé ou coupé : la musique n'a plus à l'attendre
  }
  stopSound();
  const sound = sounds[key];
  sound.currentTime = 0;
  currentSound = sound;
  // play() peut être refusé par le navigateur tant que personne n'a cliqué/tapé
  return sound.play().catch(function () {
    if (currentSound === sound) currentSound = null;
    throw new Error("blocked");
  });
}

// Arrête le son en cours
function stopSound() {
  if (currentSound) {
    currentSound.pause();
    currentSound.currentTime = 0;
    currentSound = null;
  }
}

/* --- MUSIQUE DE FOND (en boucle, sur une piste à part) ---
   Elle se met en pause pendant qu'une voix joue, et reprend
   là où elle en était quand la voix se termine. */

const MUSIC_FILES = {
  round1: "round 1.mp3",   // Round 1 : de l'arrivée sur le Round 1 jusqu'à "Well done" / "No more attemps"
  round2: "Round 2.mp3"    // Round 2 : de l'arrivée sur le Round 2 jusqu'au lancement de "Final Part"
};

const music = {};
Object.keys(MUSIC_FILES).forEach(function (key) {
  music[key] = new Audio("sounds/" + encodeURIComponent(MUSIC_FILES[key]));
  music[key].preload = "auto";
  music[key].loop = true;
});

let currentMusic = null;   // la musique du round en cours

// Démarre la musique d'un round (depuis le début)
function startMusic(key) {
  stopMusic();
  currentMusic = music[key];
  currentMusic.currentTime = 0;
  updateMusic();
}

// Coupe la musique (fin du round)
function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}

// Musique en pause si une voix joue, sinon elle (re)part
function updateMusic() {
  if (!currentMusic) return;
  const voicePlaying = currentSound && !currentSound.paused && !currentSound.ended;
  // La musique du Round 1 attend la fin de "Thank you final"
  const waitingThankYou = currentMusic === music.round1 && !thankYouDone;
  if (voicePlaying || waitingThankYou) {
    currentMusic.pause();
  } else {
    currentMusic.play().catch(function () {});
  }
}

// Chaque voix prévient la musique quand elle démarre, s'arrête ou se termine
Object.keys(sounds).forEach(function (key) {
  const sound = sounds[key];
  sound.addEventListener("play", updateMusic);
  sound.addEventListener("pause", updateMusic);
  sound.addEventListener("ended", function () {
    if (currentSound === sound) currentSound = null;
    updateMusic();
  });
});

// Coupe tout et remet l'état audio à zéro (retour à l'accueil)
function resetAudio() {
  stopMusic();
  stopSound();
  clearTimeout(welcomeTimeout);
  welcomeState = "waiting";
  clearTimeout(thankYouTimeout);
  thankYouDone = false;
}

// ACCUEIL : "Welcome to the Cloud" 1,5 s après l'arrivée sur l'accueil
function scheduleWelcome() {
  clearTimeout(welcomeTimeout);
  welcomeTimeout = setTimeout(tryPlayWelcome, WELCOME_DELAY);
}

function tryPlayWelcome() {
  welcomeTimeout = null;
  if (welcomeState !== "waiting" || currentScreen !== "welcome") return;
  welcomeState = "playing";
  playSound("welcome").catch(function () {
    // Bloqué par le navigateur : on réessaiera au premier geste (touche ou clic)
    welcomeState = "waiting";
  });
}

// Quand "welcome" se termine
sounds.welcome.addEventListener("ended", function () {
  welcomeState = "done";
  currentSound = null;
});

// NOM VALIDÉ (START ou Entrée) : on coupe "welcome" s'il joue encore,
// puis "thankyou" démarre 1 s plus tard
function onNameSubmitted() {
  clearTimeout(welcomeTimeout);
  welcomeState = "done";
  stopSound();
  clearTimeout(thankYouTimeout);
  thankYouDone = false;
  thankYouTimeout = setTimeout(function () {
    playSound("thankyou").catch(function () {
      thankYouDone = true;   // lecture refusée : on ne bloque pas la musique
      updateMusic();
    });
  }, THANK_YOU_DELAY);
}

// Fin de "thankyou" : la musique du Round 1 peut démarrer
sounds.thankyou.addEventListener("ended", function () {
  thankYouDone = true;
  updateMusic();
});

// Déblocage : si le navigateur a refusé l'accueil, le 1er geste le relance
// (sauf Entrée : le nom est validé, on passe directement à "thankyou")
function unlockAudio(event) {
  if (event.key === "Enter") return;
  if (welcomeState === "waiting" && currentScreen === "welcome" && !welcomeTimeout) {
    tryPlayWelcome();
  }
}
document.addEventListener("keydown", unlockAudio, true);
document.addEventListener("pointerdown", unlockAudio, true);


/* =========================================================
   4. CHANGER D'ÉCRAN
   C'est LA fonction centrale du projet.
   Exemple : showScreen("round1") affiche <section id="screen-round1">
   ========================================================= */

function showScreen(name) {
  // a) on cache TOUS les écrans en leur enlevant la classe "active"
  //    (querySelectorAll renvoie une liste, forEach la parcourt)
  const screens = document.querySelectorAll(".screen");
  screens.forEach(function (screen) {
    screen.classList.remove("active");
  });

  // b) on affiche le bon écran en lui ajoutant la classe "active"
  //    (dans style.css : .screen.active { display: flex; })
  document.getElementById("screen-" + name).classList.add("active");

  // c) on retient quel écran est affiché
  currentScreen = name;
  helpCurrent.textContent = name;

  // d) l'annonce du Round 2 clignote seulement quand elle est affichée
  if (name === "announce") {
    startFlash();
  } else {
    stopFlash();
  }

  // e) sur l'accueil, on met directement le curseur dans le champ du nom
  if (name === "welcome") {
    nameInput.focus();
  }
}


/* =========================================================
   5. ÉCRAN 1 : LE VISITEUR ENTRE SON NOM
   "submit" se déclenche quand on appuie sur Entrée
   ou qu'on clique sur le bouton START.
   ========================================================= */

nameForm.addEventListener("submit", function (event) {
  // Par défaut un formulaire recharge la page : on l'en empêche
  event.preventDefault();

  // trim() enlève les espaces au début et à la fin
  // toUpperCase() met en MAJUSCULES
  const name = nameInput.value.trim().toUpperCase();

  // Pas de nom = on ne fait rien (return arrête la fonction ici)
  if (name === "") {
    return;
  }

  // On prépare une nouvelle partie
  playerName = name;
  wrongCount = 0;
  elapsed = 0;

  // On écrit le nom dans tous les éléments qui ont la classe "player-name"
  document.querySelectorAll(".player-name").forEach(function (el) {
    el.textContent = playerName;
  });

  updateTimers();     // le timer affiche 00:00.00
  updateAttempts();   // les 3 cases sont blanches
  nameInput.blur();   // on sort du champ : le clavier sert maintenant à l'opérateur
  showScreen("instructions");
  onNameSubmitted();  // SON : "Thank you final" 1 s après START
});


/* =========================================================
   6. LE TIMER
   setInterval(fonction, 50) = lance la fonction toutes les 50 ms.
   À chaque fois, on calcule le temps écoulé depuis le départ.
   ========================================================= */

function startTimer() {
  stopTimer();              // sécurité : on arrête un ancien timer s'il tourne
  startTime = Date.now();   // Date.now() = l'heure actuelle en millisecondes
  elapsed = 0;

  timerInterval = setInterval(function () {
    elapsed = Date.now() - startTime;   // maintenant - départ = temps écoulé
    updateTimers();
  }, 50);
}

function stopTimer() {
  clearInterval(timerInterval);   // arrête le setInterval
  timerInterval = null;
}

// Transforme des millisecondes en texte "00:12.47"
// Exemple : 12470 ms → 0 minute, 12 secondes, 47 centièmes
function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);          // 60000 ms dans une minute
  const seconds = Math.floor(ms / 1000) % 60;      // % 60 = le reste (0 à 59)
  const hundredths = Math.floor(ms / 10) % 100;    // les centièmes (0 à 99)
  return pad(minutes) + ":" + pad(seconds) + "." + pad(hundredths);
}

// Ajoute un 0 devant si le nombre n'a qu'un chiffre : 5 → "05"
function pad(number) {
  return String(number).padStart(2, "0");
}

// Écrit le temps dans tous les éléments qui ont la classe "timer"
function updateTimers() {
  const text = formatTime(elapsed);   // "00:12.47"
  const main = text.slice(0, 5);      // les 5 premiers caractères : "00:12"
  const small = text.slice(5);        // le reste : ".47"

  // Les centièmes sont dans un <span class="cs"> pour être plus petits (voir CSS)
  document.querySelectorAll(".timer").forEach(function (el) {
    el.innerHTML = main + '<span class="cs">' + small + "</span>";
  });
}


/* =========================================================
   7. LES TENTATIVES (3 cases)
   Case blanche = tentative encore disponible.
   Case rouge avec ✕ = tentative utilisée.
   ========================================================= */

function updateAttempts() {
  // Il y a des cases sur 2 écrans (Round 1 et Try again) : on met à jour les deux
  document.querySelectorAll(".attempts").forEach(function (group) {
    const boxes = group.querySelectorAll("span");

    // index = la position de la case : 0, 1 ou 2
    boxes.forEach(function (box, index) {
      if (index < wrongCount) {
        // case utilisée : on ajoute la classe "used" (fond rouge) et le ✕
        box.classList.add("used");
        box.textContent = "✕";
      } else {
        // case encore disponible : blanche et vide
        box.classList.remove("used");
        box.textContent = "";
      }
    });
  });
}


/* =========================================================
   8. ROUND 1 : LES RÉPONSES (touches T, S, F)
   ========================================================= */

// T : le visiteur a pressé une MAUVAISE carte
function wrongCard() {
  wrongCount = wrongCount + 1;
  updateAttempts();

  // 3e erreur = plus de tentatives, échec automatique
  // (fail() lance le son "No more attemps")
  if (wrongCount >= MAX_ATTEMPTS) {
    fail();
    return;
  }

  showScreen("tryagain");

  // SON : 1re erreur → "Not quit try again", 2e erreur → "Disppointing"
  // (playSound coupe le son précédent s'il joue encore)
  playSound(wrongCount === 1 ? "tryagain" : "disappoint").catch(function () {});

  // setTimeout(fonction, durée) = lance la fonction UNE fois après la durée.
  // Ici : retour automatique au Round 1 (le timer continue de tourner).
  clearTimeout(tryAgainTimeout);
  tryAgainTimeout = setTimeout(function () {
    if (currentScreen === "tryagain") {
      showScreen("round1");
    }
  }, TRY_AGAIN_DURATION);
}

// F : échec (No more attempts) — pas de score enregistré
function fail() {
  clearTimeout(tryAgainTimeout);
  stopTimer();
  wrongCount = MAX_ATTEMPTS;
  updateAttempts();
  showScreen("fail");
  stopMusic();                                  // SON : fin de la musique du Round 1
  playSound("nomore").catch(function () {});   // SON : "No more attemps" (3e erreur ou F)
}

// S : le visiteur a trouvé une carte HUMAINE
function success() {
  clearTimeout(tryAgainTimeout);
  stopTimer();

  // On crée un objet avec les infos du score.
  // id = Date.now() donne un nombre unique pour reconnaître ce score.
  const entry = {
    id: Date.now(),
    name: playerName,
    time: elapsed
  };
  leaderboard.push(entry);   // push = ajoute à la fin du tableau

  // sort() trie le tableau. (a.time - b.time) = du plus petit temps au plus grand
  leaderboard.sort(function (a, b) {
    return a.time - b.time;
  });

  lastEntryId = entry.id;    // pour faire clignoter ce score en vert
  saveLeaderboard();
  renderLeaderboard();

  finalTime.textContent = formatTime(elapsed);
  showScreen("success");
  stopMusic();                                  // SON : fin de la musique du Round 1
  playSound("welldone").catch(function () {});  // SON : "Well done - Round 2"
}


/* =========================================================
   9. LE LEADERBOARD
   ========================================================= */

// Affiche les meilleurs scores dans les <ol class="leaderboard">
// (il y en a 2 : sur l'accueil et sur l'écran Well done)
function renderLeaderboard() {
  // slice(0, 5) = on garde seulement les 5 premiers du tableau
  const top = leaderboard.slice(0, LEADERBOARD_SIZE);

  document.querySelectorAll(".leaderboard").forEach(function (list) {
    list.innerHTML = "";   // on vide la liste avant de la remplir

    // Aucun score pour l'instant
    if (top.length === 0) {
      list.innerHTML = '<li class="empty">No scores yet. Be the first.</li>';
      return;
    }

    // Pour chaque score, on crée une ligne <li> avec 3 <span> : rang, nom, temps
    top.forEach(function (entry, index) {
      const li = document.createElement("li");

      const rank = document.createElement("span");
      rank.textContent = pad(index + 1);   // index commence à 0, donc +1 → "01"

      const name = document.createElement("span");
      // textContent (et pas innerHTML) : le nom s'affiche tel quel,
      // même si quelqu'un tape du code HTML à la place de son nom
      name.textContent = entry.name;

      const time = document.createElement("span");
      time.textContent = formatTime(entry.time);

      // appendChild = on met les 3 <span> dans le <li>
      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(time);

      // Le 1er est en rouge, le nouveau score clignote en vert (voir CSS)
      if (index === 0) {
        li.classList.add("first");
      }
      if (entry.id === lastEntryId) {
        li.classList.add("new");
      }

      list.appendChild(li);   // on met le <li> dans la liste
    });
  });
}

// localStorage = une petite mémoire du navigateur, qui reste
// même si on ferme la page. Elle ne garde que du texte, donc :
// JSON.stringify transforme le tableau en texte pour le sauvegarder,
// JSON.parse retransforme le texte en tableau pour le relire.
//
// try { ... } catch { ... } = "essaie, et si ça plante, ne bloque pas le jeu".
// (certains navigateurs refusent localStorage)
function saveLeaderboard() {
  try {
    localStorage.setItem("cloudLeaderboard", JSON.stringify(leaderboard));
  } catch (error) {
    // si ça ne marche pas, le leaderboard reste juste en mémoire jusqu'au rechargement
  }
}

function loadLeaderboard() {
  try {
    const saved = localStorage.getItem("cloudLeaderboard");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {}
  return [];   // rien de sauvegardé : on commence avec un tableau vide
}

// Vider le leaderboard : par sécurité, il faut appuyer 2 fois
// sur CTRL + SHIFT + X en moins de 3 secondes.
let clearPressedAt = 0;   // l'heure du premier appui

function clearLeaderboard() {
  const now = Date.now();
  if (now - clearPressedAt < 3000) {
    // 2e appui en moins de 3 s : on vide
    leaderboard = [];
    lastEntryId = null;
    saveLeaderboard();
    renderLeaderboard();
    clearPressedAt = 0;
  } else {
    // 1er appui : on retient juste l'heure
    clearPressedAt = now;
  }
}


/* =========================================================
   10. ANNONCE ROUND 2 : les 2 messages alternent
   Message A ("Round 2 is about to start") sur fond noir,
   puis message B ("even harder") sur fond blanc, qui reste plus longtemps.
   La classe "flash-b" sur l'écran affiche le message B (voir CSS).
   Les deux fonctions s'appellent l'une l'autre avec setTimeout,
   ce qui crée une boucle A → B → A → B...
   ========================================================= */

function showFlashA() {
  announceScreen.classList.remove("flash-b");
  flashTimeout = setTimeout(showFlashB, FLASH_A_DURATION);
}

function showFlashB() {
  announceScreen.classList.add("flash-b");
  flashTimeout = setTimeout(showFlashA, FLASH_B_DURATION);
}

function startFlash() {
  stopFlash();    // sécurité : on arrête une ancienne boucle
  showFlashA();   // on commence par le message A
}

function stopFlash() {
  clearTimeout(flashTimeout);   // casse la boucle
  flashTimeout = null;
  announceScreen.classList.remove("flash-b");
}


/* =========================================================
   11. ESPACE : PASSER À L'ÉCRAN SUIVANT
   Selon l'écran actuel, on décide lequel vient après.
   ========================================================= */

function nextScreen() {
  if (currentScreen === "instructions") {
    showScreen("round1");
    startTimer();                      // le timer du Round 1 démarre ici
    startMusic("round1");              // SON : musique de fond du Round 1

  } else if (currentScreen === "tryagain") {
    clearTimeout(tryAgainTimeout);     // retour au Round 1 sans attendre
    showScreen("round1");

  } else if (currentScreen === "fail" || currentScreen === "success") {
    showScreen("announce");            // || veut dire "OU"

  } else if (currentScreen === "announce") {
    showScreen("round2");
    startTimer();                      // nouveau timer pour le Round 2
    startMusic("round2");              // SON : musique de fond du Round 2 (après l'annonce)

  } else if (currentScreen === "round2") {
    // Le visiteur a appuyé sur une carte : écran noir, puis "Wrong."
    stopTimer();
    showScreen("blackout");
    stopMusic();                                   // SON : fin de la musique du Round 2
    playSound("finalpart").catch(function () {});  // SON : "Final Part" (début de la séquence de fin)
    blackoutTimeout = setTimeout(function () {
      showScreen("wrong");
    }, BLACKOUT_DURATION);

  } else if (END_SCREENS.includes(currentScreen)) {
    // Écrans de fin : includes() vérifie si l'écran est dans la liste.
    // indexOf() donne sa position, on affiche celui d'après (+1).
    const index = END_SCREENS.indexOf(currentScreen);
    if (index < END_SCREENS.length - 1) {
      showScreen(END_SCREENS[index + 1]);
    } else {
      resetToWelcome();                // après le dernier écran : retour à l'accueil
    }
  }
}


/* =========================================================
   12. ÉCHAP : RETOUR À L'ACCUEIL (prêt pour le visiteur suivant)
   On arrête tout ce qui tourne et on remet le jeu à zéro.
   ========================================================= */

function resetToWelcome() {
  stopTimer();
  clearTimeout(tryAgainTimeout);
  clearTimeout(blackoutTimeout);
  playerName = "";
  wrongCount = 0;
  elapsed = 0;
  lastEntryId = null;
  nameInput.value = "";   // on vide le champ du nom
  renderLeaderboard();
  resetAudio();           // SON : on coupe tout
  showScreen("welcome");
  scheduleWelcome();      // SON : "Welcome" rejoue pour le visiteur suivant
}


/* =========================================================
   13. LE CLAVIER DE L'OPÉRATEUR
   "keydown" se déclenche à chaque touche pressée.
   event.key contient la touche ("t", " ", "Escape"...).
   ========================================================= */

document.addEventListener("keydown", function (event) {
  // toLowerCase() : "T" et "t" marchent pareil
  const key = event.key.toLowerCase();

  // CTRL + SHIFT + X : vider le leaderboard (marche sur tous les écrans)
  if (event.ctrlKey && event.shiftKey && key === "x") {
    event.preventDefault();
    clearLeaderboard();
    return;
  }

  // Sur l'accueil, le clavier sert au visiteur pour taper son nom :
  // on ignore les touches de l'opérateur
  if (currentScreen === "welcome") {
    return;
  }

  if (key === "escape") {
    resetToWelcome();
  } else if (key === "h") {
    help.classList.toggle("show");   // toggle = ajoute la classe si absente, l'enlève si présente
  } else if (key === " ") {
    event.preventDefault();          // empêche la page de défiler avec ESPACE
    nextScreen();
  }

  // Touches de réponse : seulement pendant le Round 1
  if (currentScreen === "round1" || currentScreen === "tryagain") {
    if (key === "t") {
      wrongCard();
    } else if (key === "s") {
      success();
    } else if (key === "f") {
      fail();
    }
  }
});


/* =========================================================
   14. AU DÉMARRAGE DE LA PAGE
   ========================================================= */

renderLeaderboard();     // affiche le leaderboard sauvegardé
updateTimers();          // le timer affiche 00:00.00
showScreen("welcome");   // on commence sur l'accueil
scheduleWelcome();       // SON : "Welcome to the Cloud" 1,5 s après l'ouverture
