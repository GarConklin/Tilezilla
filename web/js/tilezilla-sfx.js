/**
 * Game sound effects — preload + play; gated by Settings → Sound effects.
 */

export const SFX_CLIPS = {
  uiClick: '/audio/ui-click.mp3',
  tilePlace: '/audio/tile-place.mp3',
  tilePickup: '/audio/tile-pickup.mp3',
  tileInvalid: '/audio/tile-bump.mp3',
  solveOk: '/audio/solve-ok.mp3',
  spinCWTile: '/audio/spinCWTile.mp3',
  spinCCWTile: '/audio/spinCCWTile.mp3',
  backButton: '/audio/closebuttonclick.mp3',
  swipeStartScreen: '/audio/Swipe.mp3',
  generalSelection: '/audio/ChimeChirp.mp3',
  levelSuccess: '/audio/Success-fanfare.mp3',
};

let enabled = true;
let unlocked = false;
let unlockInFlight = null;
const cache = new Map();

export function setSfxEnabled(on) {
  enabled = on !== false && on !== 'OFF';
}

export function isSfxEnabled() {
  return enabled;
}

export function isSfxUnlocked() {
  return unlocked;
}

function getAudio(name) {
  const src = SFX_CLIPS[name];
  if (!src) return null;
  if (!cache.has(name)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    cache.set(name, audio);
  }
  return cache.get(name);
}

function playClip(audio) {
  if (!audio.paused) {
    const clone = audio.cloneNode();
    clone.volume = audio.volume;
    return clone.play();
  }
  audio.currentTime = 0;
  return audio.play();
}

/** Browser autoplay policy — call from a user gesture; retries until one clip plays. */
export function unlockAudio() {
  if (unlocked) return Promise.resolve(true);
  if (unlockInFlight) return unlockInFlight;

  unlockInFlight = (async () => {
    const audio = getAudio('uiClick');
    if (!audio) return false;
    const prev = audio.volume;
    audio.volume = 0.001;
    try {
      audio.currentTime = 0;
      await playClip(audio);
      audio.pause();
      audio.currentTime = 0;
      unlocked = true;
      return true;
    } catch {
      return false;
    } finally {
      audio.volume = prev;
      unlockInFlight = null;
    }
  })();

  return unlockInFlight;
}

export function playSfx(name) {
  if (!enabled) return;
  const audio = getAudio(name);
  if (!audio) return;

  const attempt = () => {
    void playClip(audio)
      .then(() => {
        unlocked = true;
      })
      .catch(() => {});
  };

  if (unlocked) {
    attempt();
    return;
  }

  void unlockAudio().finally(attempt);
}

const BACK_SELECTORS = [
  '.tz-settings-hit--back',
  '.tz-settings-hit--exit',
  '.tz-cartographers-journal__exit',
  '.tz-hint-rules__exit',
  '.tz-profile-root__backdrop',
  '.tz-pinfo-root__backdrop',
  '.tz-settings-root__backdrop',
  '.tz-menu-root__backdrop',
  '[data-sfx="back"]',
].join(', ');

const SELECTION_SELECTORS = [
  '.tz-segment',
  '.tz-bottom-nav__hit',
  '.tz-bottom-menu-v2__tab',
  '[data-sfx="select"]',
].join(', ');

const UI_CLICK_SELECTORS = [
  'button',
  '.tz-menu-plaque__hit',
  'a.tz-menu-plaque__hit',
  '.tz-settings-hit',
].join(', ');

export function initTilezillaSfx({ root = document } = {}) {
  const unlock = () => { void unlockAudio(); };
  root.addEventListener('pointerdown', unlock, { capture: true });
  root.addEventListener('touchstart', unlock, { capture: true, passive: true });
  root.addEventListener('keydown', unlock, { capture: true });

  root.addEventListener('click', (e) => {
    unlock();
    if (!enabled) return;
    if (e.target.closest(BACK_SELECTORS)) {
      playSfx('backButton');
      return;
    }
    if (e.target.closest(SELECTION_SELECTORS)) {
      playSfx('generalSelection');
      return;
    }
    if (e.target.closest(UI_CLICK_SELECTORS)) {
      playSfx('uiClick');
    }
  }, true);
}
