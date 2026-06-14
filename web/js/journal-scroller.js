/** Journal list pane — fancy scroller wrapper (uses fancy-scroller.js). */

import { initFancyScroller } from './fancy-scroller.js';

export { initFancyScroller };

export function initJournalListScroller({
  scrollEl,
  scrollerRoot,
  trackEl,
  pinEl,
} = {}) {
  return initFancyScroller({ scrollEl, scrollerRoot, trackEl, pinEl });
}
