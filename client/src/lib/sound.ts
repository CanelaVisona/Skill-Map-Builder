// Tiny sound-effects helper. Most of these synthesize short chimes with the Web Audio API
// instead of shipping audio files -- there's nothing to load/cache and it works fully offline.

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextCtor();
  }
  // Browsers suspend new contexts until a user gesture; a node confirmation is always
  // triggered by a click/tap, so this resume is safe to fire-and-forget here.
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

// Plays a short, quiet rising "tick" -- used when a progress popup's bar/number starts
// growing (XP, insights count, body gain, area/today progress, bug victories). Deliberately
// subtle since it fires often, reading as "ping, moving up" rather than a loud confirmation.
export function playProgressAdvanceSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";

    const startTime = ctx.currentTime;
    const duration = 0.16;
    oscillator.frequency.setValueAtTime(420, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(720, startTime + duration);

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.14, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  } catch {
    // Sound is a nice-to-have; never let it break the progress popup.
  }
}

// Descending "you lost a life" jingle -- loosely modeled on the classic side-scroller death
// tune (a quick run of falling square-wave notes). Used when a bug fight ends in "derrota" and
// its last lit block falls off the progress bar.
export function playBugLossSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const startTime = ctx.currentTime;
    const notes = [523.25, 493.88, 440, 392, 349.23, 293.66, 261.63, 196];
    const noteDuration = 0.09;

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "square";

      const noteStart = startTime + i * noteDuration;
      oscillator.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.1, noteStart + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + noteDuration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + noteDuration + 0.02);
    });
  } catch {
    // Sound is a nice-to-have; never let it break the bug progress popup.
  }
}

// Real audio file (not synthesized) for "¡Subiste de nivel!" -- served from client/public, so
// it's just a static asset at this URL. Reused across plays instead of a `new Audio()` per
// call, and rewound before each play so back-to-back level-ups (e.g. two levels in a row)
// both play the full clip instead of the second call doing nothing on an already-playing
// element.
let levelUpAudio: HTMLAudioElement | null = null;

function getLevelUpAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!levelUpAudio) {
    levelUpAudio = new Audio(encodeURI("/Sounds/cuando se pasa de nivel.mp3"));
  }
  return levelUpAudio;
}

export function playLevelUpSound() {
  try {
    const audio = getLevelUpAudio();
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Autoplay can be blocked outside a user gesture; the level-up banner is always
      // triggered from a confirm click, so this is best-effort only.
    });
  } catch {
    // Sound is a nice-to-have; never let it break the level-up celebration.
  }
}

// iOS (and, to a lesser extent, other mobile browsers) only allows an AudioContext or an
// <audio> element's first play() to start if it happens *synchronously* inside a trusted
// user-gesture event handler (touchend/pointerdown/click) -- not from a useEffect or timeout
// that fires later, even if that callback was ultimately caused by a tap. All of our sound
// calls above fire from exactly that kind of delayed spot (after a node's status/props
// actually update, after a popup's fill animation kicks off, etc.), so without this, they'd
// be silently swallowed on an iPhone.
//
// The fix is the standard "unlock on first touch" trick: the very first tap anywhere in the
// app resumes the shared AudioContext and silently primes the level-up <audio> element while
// still inside that tap's call stack. Both then stay "unlocked" for the rest of the page's
// life, so every later async playX call above works normally from then on.
let audioUnlocked = false;

function unlockAudioForMobile() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const audio = getLevelUpAudio();
  if (audio) {
    const wasMuted = audio.muted;
    audio.muted = true;
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = wasMuted;
      })
      .catch(() => {
        audio.muted = wasMuted;
      });
  }
}

if (typeof window !== "undefined") {
  const unlockOnce: AddEventListenerOptions = { once: true, passive: true };
  window.addEventListener("touchend", unlockAudioForMobile, unlockOnce);
  window.addEventListener("pointerdown", unlockAudioForMobile, unlockOnce);
  window.addEventListener("keydown", unlockAudioForMobile, unlockOnce);
}
