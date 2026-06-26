/** Align auth pages (login / passport / profile) with main-screen v2 chrome + backgrounds. */

import {
  applyMainScreenV2Layout,
  getMainScreenV2ItemLayout,
  loadMainScreenV2Layout,
  mergeMainScreenV2Layout,
} from './main-screen-v2-layout.js';

export function applyAuthScreenChrome(layout, target = document.documentElement) {
  const merged = mergeMainScreenV2Layout(layout);
  applyMainScreenV2Layout(merged, target);
  const title = getMainScreenV2ItemLayout('title', merged);
  const board = getMainScreenV2ItemLayout('board', merged);
  target.style.setProperty('--auth-chrome-title-x', `${title.x}%`);
  target.style.setProperty('--auth-chrome-title-y', `${title.y}%`);
  target.style.setProperty('--auth-chrome-title-w', `${title.w}%`);
  target.style.setProperty('--auth-chrome-title-h', `${title.h}%`);
  target.style.setProperty('--auth-chrome-stage-top', `${board.y}%`);
}

export async function initAuthScreenChrome({ force = false } = {}) {
  const layout = await loadMainScreenV2Layout({ force });
  applyAuthScreenChrome(layout);
  return layout;
}
