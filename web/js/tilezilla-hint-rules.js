/**

 * Hint Rules — image overlay (mobile scroll panel + desktop/tablet art).

 * Which image shows is CSS-driven: MU below 780px, DT at ≥780px (see tilezilla-shell.css).

 * Scrolling uses FancyScrollerBar / FancyScrollerPin (see fancy-scroller.js).

 */



import { initFancyScroller } from './fancy-scroller.js';
import { syncHintRulesWindowGeometry } from './hint-rules-layout.js';



let menuApi = null;

let fancyScroller = null;



function $(id) {

  return document.getElementById(id);

}



function openHintRulesPopup() {

  const root = $('hintRulesRoot');

  if (!root) return;



  menuApi?.closeMenu?.();

  menuApi?.closePanel?.();



  root.hidden = false;

  document.body.classList.add('tz-modal-open');



  const scroll = $('hintRulesScroll');

  if (scroll) scroll.scrollTop = 0;

  requestAnimationFrame(() => {
    syncHintRulesWindowGeometry();
    fancyScroller?.sync?.();
  });

}



function closeHintRulesPopup() {

  const root = $('hintRulesRoot');

  if (!root) return;



  root.hidden = true;

  if (

    $('menuRoot')?.hidden !== false

    && $('menuPanelRoot')?.hidden !== false

    && $('settingsRoot')?.hidden !== false

    && $('puzzleInfoRoot')?.hidden !== false

    && $('stuckPopupRoot')?.hidden !== false

  ) {

    document.body.classList.remove('tz-modal-open');

  }

}



export function openHintRules() {

  openHintRulesPopup();

}



export function initHintRules({ menuApi: menu } = {}) {

  menuApi = menu || null;



  const root = $('hintRulesRoot');

  if (!root) return null;



  fancyScroller = initFancyScroller({

    scrollEl: $('hintRulesScroll'),

    scrollerRoot: $('hintRulesScroller'),

    trackEl: $('hintRulesScrollerTrack'),

    pinEl: $('hintRulesScrollerPin'),

  });



  $('menuHintRulesBtn')?.addEventListener('click', () => {

    openHintRules();

  });



  $('hintRulesExitBottom')?.addEventListener('click', closeHintRulesPopup);



  document.addEventListener('keydown', (e) => {

    if (e.key !== 'Escape') return;

    if (root.hidden) return;

    closeHintRulesPopup();

  });



  window.addEventListener('tilezilla:hint-rules-layout-saved', () => {

    requestAnimationFrame(() => {

      syncHintRulesWindowGeometry();

      fancyScroller?.sync?.();

    });

  });



  window.addEventListener('tilezilla:main-screen-v2-layout-saved', () => {

    requestAnimationFrame(() => syncHintRulesWindowGeometry());

  });



  window.addEventListener('resize', () => {

    if (root.hidden) return;

    syncHintRulesWindowGeometry();

  });



  return { openHintRules, closeHintRulesPopup };

}



