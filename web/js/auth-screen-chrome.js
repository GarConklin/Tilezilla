/** Align auth pages (login / passport / profile) with main-screen v2 chrome + backgrounds. */

import {
  applyMainScreenV2Layout,
  getMainScreenV2ItemLayout,
  loadMainScreenV2Layout,
  mergeMainScreenV2Layout,
} from './main-screen-v2-layout.js';
import { applyWaterRippleLayout, loadWaterRippleLayout } from './water-ripple-layout.js';

export function applyAuthScreenChrome(layout, target = document.documentElement) {
  const merged = mergeMainScreenV2Layout(layout);
  applyMainScreenV2Layout(merged, target);
  const title = getMainScreenV2ItemLayout('title', merged);
  const board = getMainScreenV2ItemLayout('board', merged);
  target.style.setProperty('--auth-chrome-title-x', `${title.x}%`);
  target.style.setProperty('--auth-chrome-title-y', `${title.y}%`);
  target.style.setProperty('--auth-chrome-title-w', `${title.w}%`);
  target.style.setProperty('--auth-chrome-title-h', `${title.h}%`);
  const topFrac = board.y / 100;
  target.style.setProperty('--auth-chrome-stage-top', `${board.y}%`);
  target.style.setProperty('--auth-chrome-stage-top-frac', String(topFrac));
  target.style.setProperty(
    '--auth-passport-avail-h',
    `calc(100dvh - 100dvh * ${topFrac} - max(8px, env(safe-area-inset-bottom, 0px)))`,
  );
}

export async function initAuthScreenChrome({ force = false } = {}) {
  const [layout, ripple] = await Promise.all([
    loadMainScreenV2Layout({ force }),
    loadWaterRippleLayout({ fromDisk: true }),
  ]);
  applyAuthScreenChrome(layout);
  applyWaterRippleLayout(ripple);
  return layout;
}
