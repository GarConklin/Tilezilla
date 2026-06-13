/**
 * Tilezilla production shell — placeholder interactivity only.
 * Game logic will be wired in from app_v16.js in a later step.
 */

const SHELL_STATE = {
  previewDeg: 90, // N→E→S→W→N; +90 = CW, −90 = CCW (matches app_v16.js)
  selectedBagIndex: 2,
  placedCells: [
    { r: 0, c: 0, head: false },
    { r: 1, c: 0, head: true },
    { r: 2, c: 0, head: false },
  ],
  bagTiles: [
    { id: 'SH', angle: 0, used: true },
    { id: 'UT', angle: 90, used: true },
    { id: 'VL', angle: 45, used: false },
    { id: 'HL', angle: 0, used: false },
    { id: 'LC', angle: 135, used: false },
    { id: 'LR', angle: 90, used: false },
    { id: 'LL', angle: 0, used: false },
    { id: 'DB', angle: 45, used: false },
  ],
};

function romanForRank(subLevel) {
  const numerals = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
  return numerals[subLevel - 1] || String(subLevel);
}

function buildBoard() {
  const board = document.getElementById('board');
  if (!board) return;

  const rows = Number(board.dataset.rows) || 5;
  const cols = Number(board.dataset.cols) || 6;
  board.style.gridTemplateColumns = `repeat(${cols}, var(--tz-cell-size))`;

  const placed = new Set(
    SHELL_STATE.placedCells.map(({ r, c }) => `${r},${c}`)
  );
  const headAt = SHELL_STATE.placedCells.find(p => p.head);
  const headKey = headAt ? `${headAt.r},${headAt.c}` : null;

  board.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'tz-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      const key = `${r},${c}`;
      if (placed.has(key)) {
        cell.classList.add('tz-cell--placed');
        const snake = document.createElement('div');
        snake.className = 'tz-cell__snake';
        if (key === headKey) snake.classList.add('tz-cell__snake--head');
        cell.appendChild(snake);
      }

      board.appendChild(cell);
    }
  }
}

function buildTileBag() {
  const track = document.getElementById('tileBagTrack');
  if (!track) return;

  track.innerHTML = '';
  SHELL_STATE.bagTiles.forEach((tile, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tz-bag-tile';
    btn.setAttribute('role', 'option');
    btn.dataset.index = String(index);
    btn.setAttribute('aria-label', `Tile ${tile.id}`);

    if (tile.used) btn.classList.add('tz-bag-tile--used');
    if (index === SHELL_STATE.selectedBagIndex) {
      btn.classList.add('tz-bag-tile--selected');
      btn.setAttribute('aria-selected', 'true');
    }

    const pattern = document.createElement('div');
    pattern.className = 'tz-bag-tile__pattern';
    pattern.style.setProperty('--tile-angle', `${tile.angle}deg`);
    btn.appendChild(pattern);

    btn.addEventListener('click', () => selectBagTile(index));
    track.appendChild(btn);
  });

  updateBagArrows();
}

function selectBagTile(index) {
  const tile = SHELL_STATE.bagTiles[index];
  if (!tile || tile.used) return;

  SHELL_STATE.selectedBagIndex = index;
  SHELL_STATE.previewDeg = 90;
  buildTileBag();
  updatePreviewRotation();
  scrollBagToSelected();
}

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function updatePreviewRotation() {
  const deg = normalizeDeg(SHELL_STATE.previewDeg);
  SHELL_STATE.previewDeg = deg;

  const dirEl = document.getElementById('previewDir');
  if (dirEl) dirEl.textContent = `${deg}°`;

  const domino = document.getElementById('previewDomino');
  if (domino) domino.style.setProperty('--preview-deg', `${deg}deg`);
}

/** @param {90|-90} delta — clockwise (+90) or counter-clockwise (−90) */
function rotatePreview(delta) {
  SHELL_STATE.previewDeg = normalizeDeg(SHELL_STATE.previewDeg + delta);
  updatePreviewRotation();
}

function scrollBagToSelected() {
  const track = document.getElementById('tileBagTrack');
  const selected = track?.querySelector('.tz-bag-tile--selected');
  selected?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function updateBagArrows() {
  const track = document.getElementById('tileBagTrack');
  const prev = document.getElementById('bagPrev');
  const next = document.getElementById('bagNext');
  if (!track || !prev || !next) return;

  const maxScroll = track.scrollWidth - track.clientWidth;
  prev.disabled = track.scrollLeft <= 2;
  next.disabled = track.scrollLeft >= maxScroll - 2;
}

function wireBagScroll() {
  const track = document.getElementById('tileBagTrack');
  const prev = document.getElementById('bagPrev');
  const next = document.getElementById('bagNext');
  if (!track) return;

  track.addEventListener('scroll', updateBagArrows, { passive: true });

  prev?.addEventListener('click', () => {
    track.scrollBy({ left: -80, behavior: 'smooth' });
  });
  next?.addEventListener('click', () => {
    track.scrollBy({ left: 80, behavior: 'smooth' });
  });
}

function wireRotationButtons() {
  document.getElementById('rotateCCW')?.addEventListener('click', () => rotatePreview(-90));
  document.getElementById('rotateCW')?.addEventListener('click', () => rotatePreview(90));
}

function wireBottomNav() {
  const app = document.querySelector('.tz-app');
  const items = document.querySelectorAll('.tz-bottom-nav__hit');

  items.forEach(item => {
    item.addEventListener('click', () => {
      const screen = item.dataset.nav;
      if (!screen) return;

      items.forEach(i => {
        i.classList.toggle('tz-bottom-nav__hit--active', i === item);
        i.toggleAttribute('aria-current', i === item ? 'page' : false);
      });

      app?.setAttribute('data-screen', screen);
    });
  });
}

function wirePlaceholderActions() {
  const noop = (id) => {
    document.getElementById(id)?.addEventListener('click', () => {
      console.info(`[shell] ${id} — not wired yet`);
    });
  };

  ['undoBtn', 'resetBtn', 'hintBtn'].forEach(noop);
}

function init() {
  buildBoard();
  buildTileBag();
  updatePreviewRotation();
  wireRotationButtons();
  wireBagScroll();
  wireBottomNav();
  wirePlaceholderActions();

  // Expose for future game integration
  window.TilezillaShell = {
    state: SHELL_STATE,
    romanForRank,
    rotatePreview,
    rebuild: () => {
      buildBoard();
      buildTileBag();
      updatePreviewRotation();
    },
  };
}

init();
