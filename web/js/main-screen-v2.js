import { applyUiScale } from './tilezilla-ui-scale.js';
import {
  applyMainScreenV2Art,
  applyMainScreenV2Layout,
  loadMainScreenV2Layout,
  reloadMainScreenV2Layout,
} from './main-screen-v2-layout.js';
import { applyBottomNavLayout, loadBottomNavLayout } from './bottom-nav-layout.js';

let tilebagExpandedPreview = false;

function $(id) {
  return document.getElementById(id);
}

function closeBottomMenu() {
  const drawer = $('bottomMenuDrawer');
  const open = $('bottomMenuOpenBtn');
  const close = $('bottomMenuCloseBtn');
  if (!drawer || !open) return;
  drawer.hidden = true;
  open.hidden = false;
  if (close) close.hidden = true;
  open.setAttribute('aria-expanded', 'false');
  document.querySelector('.tz-app')?.classList.remove('is-bottom-menu-open');
}

function openBottomMenu() {
  if (tilebagExpandedPreview) return;
  const drawer = $('bottomMenuDrawer');
  const open = $('bottomMenuOpenBtn');
  const close = $('bottomMenuCloseBtn');
  if (!drawer || !open) return;
  drawer.hidden = false;
  open.hidden = true;
  if (close) close.hidden = false;
  open.setAttribute('aria-expanded', 'true');
  document.querySelector('.tz-app')?.classList.add('is-bottom-menu-open');
}

function setPreviewMode(mode) {
  const app = document.querySelector('.tz-app');
  const tilebagMock = $('tilebagMock');
  tilebagExpandedPreview = mode === 'tilebag-expanded';

  if (mode === 'menu-open') {
    openBottomMenu();
  } else {
    closeBottomMenu();
  }

  tilebagMock?.classList.toggle('is-expanded', tilebagExpandedPreview);

  for (const btn of document.querySelectorAll('.tz-main-v2__draft-btn[data-preview]')) {
    if (btn.id === 'guidesToggle') continue;
    btn.classList.toggle('is-active', btn.dataset.preview === mode);
  }
}

async function applyLayouts() {
  const layout = await loadMainScreenV2Layout();
  applyMainScreenV2Layout(layout);
  applyMainScreenV2Art($('mainV2Art'), layout);
  applyBottomNavLayout(await loadBottomNavLayout());
}

function wireBottomMenu() {
  $('bottomMenuOpenBtn')?.addEventListener('click', openBottomMenu);
  $('bottomMenuCloseBtn')?.addEventListener('click', closeBottomMenu);
}

function wireDraftBar() {
  const app = document.querySelector('.tz-app');
  const guides = $('mainV2Guides');
  let guidesVisible = true;

  document.getElementById('draftBar')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tz-main-v2__draft-btn');
    if (!btn) return;

    if (btn.id === 'guidesToggle') {
      guidesVisible = !guidesVisible;
      app?.classList.toggle('is-guides-hidden', !guidesVisible);
      btn.classList.toggle('is-active', guidesVisible);
      if (guides) guides.setAttribute('aria-hidden', guidesVisible ? 'true' : 'false');
      return;
    }

    const mode = btn.dataset.preview;
    if (!mode) return;
    setPreviewMode(mode);
  });
}

async function init() {
  await applyLayouts();
  wireBottomMenu();
  wireDraftBar();
  setPreviewMode('menu-closed');

  const applyScale = () => applyUiScale();
  applyScale();
  window.addEventListener('resize', applyScale);
  window.visualViewport?.addEventListener('resize', applyScale);

  window.addEventListener('storage', (e) => {
    if (e.key === 'tilezilla:layouts:main-screen-v2' || e.key === 'tilezilla:tilebag-v2-layout-version') {
      void applyLayouts();
    }
  });
  window.addEventListener('tilezilla:main-screen-v2-layout-saved', () => {
    void reloadMainScreenV2Layout().then((layout) => {
      applyMainScreenV2Layout(layout);
      applyMainScreenV2Art($('mainV2Art'), layout);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void applyLayouts();
  });
}

init().catch((err) => {
  console.error('[main-screen-v2]', err);
});
