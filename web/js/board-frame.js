/**
 * Size-specific board frame art under /img/boardframes/.
 * Frame dimensions follow the active puzzle grid; the shell slot stays at least 5×6
 * so smaller puzzles center in the original board area.
 */

/** @type {Record<string, string>} */
export const BOARD_FRAME_FILES = {
  '2x4': 'BoardArea-2x4.png',
  '3x3': 'BoardArea-3x3.png',
  '3x4': 'BoardArea-3x4.png',
  '3x5': 'BoardArea-3x5.png',
  '3x6': 'BoardArea-3x6.png',
  '4x4': 'BoardArea-4x4.png',
  '4x5': 'BoardArea-4x5.png',
  '4x6': 'BoardArea-4x6.png',
  '5x5': 'BoardArea-5x5.png',
  '5x6': 'Board Area-5x6.png',
};

const DEFAULT_BOARD_SIZE = '5x6';
const FRAME_BASE = '/img/boardframes';

/**
 * Canonical size key from level board dimensions (matches catalog size labels).
 * @param {number} rows
 * @param {number} cols
 */
export function boardSizeKey(rows, cols) {
  const r = Number(rows);
  const c = Number(cols);
  if ((r === 6 && c === 5) || (r === 5 && c === 6)) return '5x6';
  if (!Number.isFinite(r) || !Number.isFinite(c) || r < 1 || c < 1) return DEFAULT_BOARD_SIZE;
  return `${r}x${c}`;
}

/**
 * @param {string} sizeKey
 */
export function boardFrameAssetUrl(sizeKey) {
  const file = BOARD_FRAME_FILES[sizeKey] || BOARD_FRAME_FILES[DEFAULT_BOARD_SIZE];
  const segments = file.split('/').map((part) => encodeURIComponent(part));
  return `${FRAME_BASE}/${segments.join('/')}`;
}

/**
 * Flex on .tz-board-section centers the size-specific frame in the 5×6 slot.
 */
export function centerBoardInFrame() {
  const section = document.querySelector('.tz-board-section');
  const frame = document.querySelector('.tz-board-frame');
  if (section) {
    section.style.display = 'flex';
    section.style.alignItems = 'center';
    section.style.justifyContent = 'center';
  }
  if (frame) {
    frame.style.display = 'flex';
    frame.style.alignItems = 'center';
    frame.style.justifyContent = 'center';
  }
}

/**
 * @param {number} rows
 * @param {number} cols
 * @returns {string} size key applied
 */
export function applyBoardFrame(rows, cols) {
  const sizeKey = boardSizeKey(rows, cols);
  const root = document.documentElement;
  const r = Number(rows) || 6;
  const c = Number(cols) || 5;

  root.style.setProperty('--tz-board-rows', String(r));
  root.style.setProperty('--tz-board-cols', String(c));
  root.style.setProperty('--tz-img-board-frame', `url("${boardFrameAssetUrl(sizeKey)}")`);
  root.style.setProperty('--tz-board-frame-scale', '1');
  root.dataset.boardSize = sizeKey;

  const appRoot = document.querySelector('.tz-app');
  if (appRoot) appRoot.dataset.boardSize = sizeKey;

  centerBoardInFrame();
  return sizeKey;
}

/**
 * @param {{ board?: { rows?: number, cols?: number } } | null | undefined} level
 */
export function applyBoardFrameForLevel(level) {
  const rows = level?.board?.rows;
  const cols = level?.board?.cols;
  return applyBoardFrame(rows, cols);
}
