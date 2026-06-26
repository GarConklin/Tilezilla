import { initAuthScreenChrome } from './auth-screen-chrome.js';
import {
  AUTH_SCREEN_DEFS,
  PROFILE_FIELD_SECTIONS,
  PROFILE_HIT_ART,
  PROFILE_ICON_MOCK,
  PROFILE_LAYOUT_MOCK,
  applyAuthScreenLayout,
  authScreenTunerBoxClass,
  buildAuthScreenLayoutSavePayload,
  clearAuthScreenLayoutCache,
  clearAuthScreenLayoutDraft,
  getAuthScreenItemLayout,
  hasAuthScreenLayoutDraft,
  isAuthIconItem,
  isAuthTextItem,
  loadAuthScreenLayout,
  mergeAuthScreenLayout,
  mergeAuthScreenSection,
  readAuthScreenLayoutDraftSection,
  stashAuthScreenLayoutDraft,
} from './auth-screen-layout.js';
import { refreshProfileRankIcons } from './profile-rank-icons.js';

const POS_STEP = 0.5;
const SIZE_STEP = 0.5;
const ARROW_STEP = 0.25;
const FONT_STEP = 0.05;
const DIALOG_ITEM = '__dialog__';

const LOGIN_OUTSIDE = new Set();
const CREATE_OUTSIDE = new Set();
const PROFILE_OUTSIDE = new Set(Object.keys(AUTH_SCREEN_DEFS.profile.items));

function outsideKeysFor(screenKey) {
  if (screenKey === 'profile') return PROFILE_OUTSIDE;
  if (screenKey === 'create') return CREATE_OUTSIDE;
  return LOGIN_OUTSIDE;
}

function mockTextForItem(itemKey) {
  return PROFILE_LAYOUT_MOCK[itemKey] || '…';
}

function buildProfileRankStack(screenKey) {
  const stack = document.createElement('div');
  stack.className = 'auth-screen__profile-rank-stack tuner-box';
  stack.dataset.item = 'rankBadge';

  const badge = document.createElement('img');
  badge.className = 'auth-screen__profile-rank-badge';
  badge.src = PROFILE_ICON_MOCK.rankBadge;
  badge.alt = 'Rank badge';

  const sub = document.createElement('img');
  sub.className = 'auth-screen__profile-rank-sublevel tz-rank-sublevel__img';
  sub.dataset.profileSlot = 'sublevelIcon';
  sub.alt = 'Sublevel';

  stack.append(badge, sub);
  stack.insertAdjacentHTML(
    'beforeend',
    `<span class="hit-label">Rank stack</span>
     <span class="tuner-handle tuner-handle--e" data-handle="e"></span>
     <span class="tuner-handle tuner-handle--s" data-handle="s"></span>
     <span class="tuner-handle tuner-handle--se" data-handle="se"></span>`,
  );
  return stack;
}

function buildTunerBox(meta, itemKey, screenKey) {
  const box = document.createElement('div');
  box.className = authScreenTunerBoxClass(meta);
  box.dataset.item = itemKey;
  if (meta.slot) box.dataset.profileSlot = meta.slot;

  if (meta.kind === 'text') {
    const label = meta.label || itemKey;
    if (screenKey === 'profile') {
      const mock = mockTextForItem(itemKey);
      box.innerHTML =
        `<span class="hit-label">${label}</span>` +
        `<span class="tuner-mock-value">${mock}</span>`;
    } else {
      box.textContent = label;
    }
  } else if (meta.kind === 'input') {
    const input = document.createElement('input');
    input.readOnly = true;
    input.tabIndex = -1;
    input.setAttribute('aria-label', meta.label || itemKey);
    if (itemKey === 'email') input.type = 'email';
    else if (itemKey === 'pass' || itemKey === 'pass2') input.type = 'password';
    else input.type = 'text';
    input.className = meta.baseClass || 'auth-screen__input';
    input.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;pointer-events:none;';
    box.appendChild(input);
  } else if (meta.kind === 'icon') {
    const src = meta.mockSrc || PROFILE_ICON_MOCK[itemKey] || '';
    box.innerHTML =
      `<img class="auth-screen__profile-icon__img" src="${src}" alt="" />` +
      `<span class="hit-label">${meta.label}</span>`;
  } else if (meta.art || (screenKey === 'profile' && PROFILE_HIT_ART[itemKey])) {
    const src = meta.art || PROFILE_HIT_ART[itemKey];
    box.innerHTML = `<img class="tuner-hit-art" src="${src}" alt="" /><span class="hit-label">${meta.label}</span>`;
  } else {
    box.innerHTML = `<span class="hit-label">${meta.label}</span>`;
  }

  box.insertAdjacentHTML(
    'beforeend',
    `<span class="tuner-handle tuner-handle--e" data-handle="e"></span>
     <span class="tuner-handle tuner-handle--s" data-handle="s"></span>
     <span class="tuner-handle tuner-handle--se" data-handle="se"></span>`,
  );
  return box;
}

export function initAuthScreenTuner(screenKey, root = document) {
  const def = AUTH_SCREEN_DEFS[screenKey];
  if (!def) throw new Error(`Unknown auth screen: ${screenKey}`);

  let workingLayout = mergeAuthScreenLayout(null);
  let currentItem = Object.keys(def.items)[0] || DIALOG_ITEM;
  let dragState = null;

  const els = {
    fieldGrid: root.getElementById('fieldGrid'),
    readout: root.getElementById('readout'),
    status: root.getElementById('status'),
    jsonOut: root.getElementById('jsonOut'),
    nudgeGrid: root.getElementById('nudgeGrid'),
    mockStage: root.getElementById('mockStage'),
    fontNudgeRow: root.getElementById('fontNudgeRow'),
  };

  function itemOrder() {
    return [DIALOG_ITEM, ...Object.keys(def.items)];
  }

  function patchItem(key, patch) {
    const screen = workingLayout[screenKey];
    if (!screen.items[key]) screen.items[key] = {};
    Object.assign(screen.items[key], patch);
    refresh();
  }

  function patchDialog(patch) {
    workingLayout[screenKey].dialog = {
      ...workingLayout[screenKey].dialog,
      ...patch,
    };
    refresh();
  }

  function exportJson() {
    return JSON.stringify({ [screenKey]: workingLayout[screenKey] }, null, 2);
  }

  function getFrameRect() {
    return root.getElementById('mockFrame')?.getBoundingClientRect();
  }

  function applyMoveDelta(dxPx, dyPx) {
    if (currentItem === DIALOG_ITEM) return;
    const rect = getFrameRect();
    if (!rect?.width || !rect?.height) return;
    const box = getAuthScreenItemLayout(screenKey, currentItem, workingLayout);
    patchItem(currentItem, {
      x: Math.max(0, Math.round((box.x + (dxPx / rect.width) * 100) * 10) / 10),
      y: Math.max(0, Math.round((box.y + (dyPx / rect.height) * 100) * 10) / 10),
    });
  }

  function applyResizeDelta(dxPx, dyPx, edges) {
    if (currentItem === DIALOG_ITEM) return;
    const rect = getFrameRect();
    if (!rect?.width || !rect?.height) return;
    const box = getAuthScreenItemLayout(screenKey, currentItem, workingLayout);
    const patch = {};
    if (edges.e || edges.se) {
      patch.w = Math.max(1, Math.round((box.w + (dxPx / rect.width) * 100) * 10) / 10);
    }
    if (edges.s || edges.se) {
      patch.h = Math.max(1, Math.round((box.h + (dyPx / rect.height) * 100) * 10) / 10);
    }
    if (Object.keys(patch).length) patchItem(currentItem, patch);
  }

  let saveTimer = null;
  let saveInFlight = false;
  let saveQueued = false;

  async function readSaveError(res) {
    const text = await res.text();
    const msgMatch = text.match(/<p>Message:\s*([^<]+)<\/p>/i);
    if (msgMatch) {
      const msg = msgMatch[1].trim();
      if (/Unknown item key/i.test(msg)) {
        return `${msg} — stop and restart: python scripts/server.py`;
      }
      return msg;
    }
    const trimmed = text.trim();
    if (trimmed.length > 240) return `HTTP ${res.status}`;
    return trimmed || `HTTP ${res.status}`;
  }

  async function saveToFile({ quiet = false } = {}) {
    if (saveInFlight) {
      saveQueued = true;
      return false;
    }
    saveInFlight = true;
    try {
      const payload = await buildAuthScreenLayoutSavePayload(screenKey, workingLayout);
      const res = await fetch('/api/dev/save-auth-screen-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload, null, 2),
      });
      if (!res.ok) {
        if (res.status === 404 || res.status === 501) {
          throw new Error('Save API not found — restart: python scripts/server.py');
        }
        throw new Error(await readSaveError(res));
      }
      clearAuthScreenLayoutCache();
      clearAuthScreenLayoutDraft(screenKey);
      els.status.textContent = quiet
        ? `Auto-saved ${screenKey} section to data/auth_screen_layout.json`
        : `Saved ${screenKey} section to data/auth_screen_layout.json`;
      return true;
    } catch (err) {
      els.status.textContent = `Save failed — ${err.message || err} · draft kept in browser`;
      return false;
    } finally {
      saveInFlight = false;
      if (saveQueued) {
        saveQueued = false;
        void saveToFile({ quiet: true });
      }
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveToFile({ quiet: true }), 600);
  }

  function formatReadout(key) {
    if (key === DIALOG_ITEM) {
      const d = workingLayout[screenKey].dialog;
      return ['<strong>Passport frame</strong>', `maxWidth: ${d.maxWidth ?? 420}px`].join('<br />');
    }
    const box = getAuthScreenItemLayout(screenKey, key, workingLayout);
    const meta = def.items[key];
    const fs = isAuthTextItem(screenKey, key)
      ? `<br />fontScale: ${box.fontScale}`
      : '';
    const subNote = key === 'sublevelIcon'
      ? '<br /><span style="font-size:0.65rem;color:#8fd49a">Sublevel on-badge fit: rank-sublevel-tuner.html</span>'
      : '';
    return `<strong>${meta?.label || key}</strong><br />x: ${box.x}% · y: ${box.y}%<br />w: ${box.w}% · h: ${box.h}%${fs}${subNote}`;
  }

  function applyTunerBoxPositions() {
    for (const box of root.querySelectorAll('.tuner-box[data-item]')) {
      const key = box.dataset.item;
      if (!def.items[key]) continue;
      // Geometry comes from the same CSS vars as the live page (applyAuthScreenLayout).
      box.style.left = '';
      box.style.top = '';
      box.style.width = '';
      box.style.height = '';
      if (isAuthTextItem(screenKey, key)) {
        const layout = getAuthScreenItemLayout(screenKey, key, workingLayout);
        const base = screenKey === 'profile' ? '0.72rem' : '0.85rem';
        box.style.fontSize = `calc(${base} * ${layout.fontScale})`;
      }
    }
  }

  function layoutTarget() {
    return root.getElementById('mockFrame') || root.getElementById('mockWrap') || document.documentElement;
  }

  function rebuildPreviewBoxes() {
    const wrap = root.getElementById('mockWrap');
    const frame = root.getElementById('mockFrame');
    const art = root.getElementById('mockArt');
    const overlay = root.getElementById('mockOverlay');
    const hitsOutside = root.getElementById('mockHitsOutside');
    wrap.className = `auth-screen auth-screen--${screenKey}`;
    art.src = def.art;
    const previewTitle = root.getElementById('previewTitle');
    if (previewTitle) previewTitle.textContent = `Preview — ${def.label}`;
    overlay.innerHTML = '';
    if (hitsOutside) hitsOutside.innerHTML = '';
    frame.querySelectorAll('.tuner-box[data-item]').forEach((el) => el.remove());
    frame.querySelector('.auth-screen__bottom-nav')?.remove();
    frame.querySelector('.auth-screen__profile-nav')?.remove();
    frame.querySelector('.auth-screen__hit--secondary')?.remove();

    const viewport = root.getElementById('mockViewport');
    const outside = outsideKeysFor(screenKey);
    const navWrapper = document.createElement('nav');
    navWrapper.className = screenKey === 'profile'
      ? 'auth-screen__profile-nav'
      : 'auth-screen__bottom-nav';
    navWrapper.setAttribute('aria-label', screenKey === 'profile' ? 'Main navigation' : 'Shortcuts');

    for (const [key, meta] of Object.entries(def.items)) {
      if (screenKey === 'profile' && key === 'sublevelIcon') continue;
      if (screenKey === 'profile' && key === 'rankBadge') {
        frame.appendChild(buildProfileRankStack(screenKey));
        continue;
      }
      const box = buildTunerBox(meta, key, screenKey);
      if (key.startsWith('nav')) {
        navWrapper.appendChild(box);
      } else if (screenKey === 'profile') {
        // Match live profile-screen.html — stats sit directly on the stage.
        frame.appendChild(box);
      } else if (key === 'secondary') {
        frame.appendChild(box);
      } else if (outside.has(key) && hitsOutside) {
        if (viewport && hitsOutside.parentElement !== viewport) {
          viewport.appendChild(hitsOutside);
        }
        hitsOutside.appendChild(box);
      } else {
        overlay.appendChild(box);
      }
    }

    if (navWrapper.childElementCount) {
      frame.appendChild(navWrapper);
    }
  }

  const fieldBtnKeys = new Set();

  function rebuildFieldGrid() {
    els.fieldGrid.innerHTML = '';
    fieldBtnKeys.clear();

    const plaqueBtn = document.createElement('button');
    plaqueBtn.type = 'button';
    plaqueBtn.className = 'field-btn';
    plaqueBtn.dataset.field = DIALOG_ITEM;
    plaqueBtn.textContent = 'Frame width';
    plaqueBtn.addEventListener('click', () => {
      currentItem = DIALOG_ITEM;
      refresh();
    });
    els.fieldGrid.appendChild(plaqueBtn);
    fieldBtnKeys.add(DIALOG_ITEM);

    if (screenKey === 'profile') {
      for (const section of PROFILE_FIELD_SECTIONS) {
        const title = document.createElement('div');
        title.className = 'field-section-title';
        title.textContent = section.title;
        els.fieldGrid.appendChild(title);
        for (const key of section.keys) {
          appendFieldBtn(key);
        }
      }
      for (const key of Object.keys(def.items)) {
        if (!fieldBtnKeys.has(key)) appendFieldBtn(key);
      }
    } else {
      for (const key of Object.keys(def.items)) {
        appendFieldBtn(key);
      }
    }
  }

  function appendFieldBtn(key) {
    const meta = def.items[key];
    if (!meta || fieldBtnKeys.has(key)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'field-btn';
    btn.dataset.field = key;
    btn.textContent = meta.label;
    fieldBtnKeys.add(key);
    btn.addEventListener('click', () => {
      currentItem = key;
      refresh();
    });
    els.fieldGrid.appendChild(btn);
  }

  function scrollSelectedBoxIntoView() {
    const box = root.querySelector(`.tuner-box[data-item="${currentItem}"]`);
    if (!box) return;
    const stage = els.mockStage;
    if (!stage) {
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const boxRect = box.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const boxCenter = boxRect.top + boxRect.height / 2;
    const stageCenter = stageRect.top + stageRect.height / 2;
    stage.scrollTop += boxCenter - stageCenter;
  }

  function refresh() {
    applyAuthScreenLayout(workingLayout, screenKey, layoutTarget());
    applyTunerBoxPositions();
    els.readout.innerHTML = formatReadout(currentItem);
    els.jsonOut.value = exportJson();
    stashAuthScreenLayoutDraft(workingLayout, screenKey);

    for (const btn of els.fieldGrid.querySelectorAll('.field-btn')) {
      btn.classList.toggle('is-active', btn.dataset.field === currentItem);
    }
    for (const box of root.querySelectorAll('.tuner-box[data-item]')) {
      box.classList.toggle('is-tuner-active', box.dataset.item === currentItem);
    }
    root.querySelector('.auth-screen__profile-rank-stack')?.classList.toggle(
      'is-tuner-active',
      screenKey === 'profile' && currentItem === 'sublevelIcon',
    );

    if (currentItem !== DIALOG_ITEM) {
      scrollSelectedBoxIntoView();
    }

    if (screenKey === 'profile') {
      void refreshProfileRankIcons(null, layoutTarget());
    }

    const isDialog = currentItem === DIALOG_ITEM;
    els.nudgeGrid.hidden = isDialog;
    if (els.fontNudgeRow) {
      els.fontNudgeRow.hidden = isDialog || !isAuthTextItem(screenKey, currentItem);
    }
    scheduleSave();
  }

  function onWheel(e) {
    if (e.target.matches('textarea, input')) return;
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    if (currentItem === DIALOG_ITEM) {
      const d = workingLayout[screenKey].dialog;
      patchDialog({ maxWidth: Math.max(280, Math.min(520, (d.maxWidth ?? 420) + dir * 4)) });
      return;
    }
    const box = getAuthScreenItemLayout(screenKey, currentItem, workingLayout);
    if (e.altKey && e.ctrlKey) {
      patchItem(currentItem, { h: Math.max(1, Math.round((box.h + dir * SIZE_STEP) * 10) / 10) });
      return;
    }
    if (e.ctrlKey && e.shiftKey && isAuthTextItem(screenKey, currentItem)) {
      patchItem(currentItem, {
        fontScale: Math.max(0.5, Math.round((box.fontScale + dir * FONT_STEP) * 100) / 100),
      });
      return;
    }
    if (e.ctrlKey) {
      patchItem(currentItem, { w: Math.max(1, Math.round((box.w + dir * SIZE_STEP) * 10) / 10) });
      return;
    }
    if (e.shiftKey) {
      patchItem(currentItem, { y: Math.max(0, Math.round((box.y + dir * POS_STEP) * 10) / 10) });
      return;
    }
    patchItem(currentItem, { x: Math.max(0, Math.round((box.x + dir * POS_STEP) * 10) / 10) });
  }

  function onNudge(action) {
    if (currentItem === DIALOG_ITEM) return;
    const box = getAuthScreenItemLayout(screenKey, currentItem, workingLayout);
    switch (action) {
      case 'left':
        patchItem(currentItem, { x: Math.max(0, Math.round((box.x - ARROW_STEP) * 10) / 10) });
        break;
      case 'right':
        patchItem(currentItem, { x: Math.round((box.x + ARROW_STEP) * 10) / 10 });
        break;
      case 'up':
        patchItem(currentItem, { y: Math.max(0, Math.round((box.y - ARROW_STEP) * 10) / 10) });
        break;
      case 'down':
        patchItem(currentItem, { y: Math.round((box.y + ARROW_STEP) * 10) / 10 });
        break;
      case 'wider':
        patchItem(currentItem, { w: Math.round((box.w + ARROW_STEP) * 10) / 10 });
        break;
      case 'narrower':
        patchItem(currentItem, { w: Math.max(1, Math.round((box.w - ARROW_STEP) * 10) / 10) });
        break;
      case 'taller':
        patchItem(currentItem, { h: Math.round((box.h + ARROW_STEP) * 10) / 10 });
        break;
      case 'shorter':
        patchItem(currentItem, { h: Math.max(1, Math.round((box.h - ARROW_STEP) * 10) / 10) });
        break;
      case 'fontUp':
        if (isAuthTextItem(screenKey, currentItem)) {
          patchItem(currentItem, {
            fontScale: Math.round((box.fontScale + FONT_STEP) * 100) / 100,
          });
        }
        break;
      case 'fontDown':
        if (isAuthTextItem(screenKey, currentItem)) {
          patchItem(currentItem, {
            fontScale: Math.max(0.5, Math.round((box.fontScale - FONT_STEP) * 100) / 100),
          });
        }
        break;
      default:
        break;
    }
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const handle = e.target.closest('.tuner-handle');
    const boxEl = e.target.closest('.tuner-box[data-item]');
    if (handle && boxEl) {
      e.preventDefault();
      currentItem = boxEl.dataset.item;
      refresh();
      handle.setPointerCapture?.(e.pointerId);
      dragState = {
        kind: 'resize',
        pointerId: e.pointerId,
        edges: {
          e: handle.classList.contains('tuner-handle--e') || handle.classList.contains('tuner-handle--se'),
          s: handle.classList.contains('tuner-handle--s') || handle.classList.contains('tuner-handle--se'),
          se: handle.classList.contains('tuner-handle--se'),
        },
      };
      return;
    }
    if (boxEl) {
      e.preventDefault();
      currentItem = boxEl.dataset.item;
      refresh();
      boxEl.setPointerCapture?.(e.pointerId);
      dragState = { kind: 'move', pointerId: e.pointerId };
    }
  }

  function onPointerMove(e) {
    if (!dragState || dragState.pointerId !== e.pointerId) return;
    e.preventDefault();
    if (dragState.kind === 'move') applyMoveDelta(e.movementX, e.movementY);
    else applyResizeDelta(e.movementX, e.movementY, dragState.edges);
  }

  function onPointerUp(e) {
    if (!dragState || dragState.pointerId !== e.pointerId) return;
    dragState = null;
  }

  function cycleItem(backward = false) {
    const order = itemOrder();
    const idx = order.indexOf(currentItem);
    const next = backward ? (idx - 1 + order.length) % order.length : (idx + 1) % order.length;
    currentItem = order[next];
    refresh();
  }

  function onKeyDown(e) {
    if (e.target.matches('textarea, input')) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      cycleItem(e.shiftKey);
      return;
    }
    if (currentItem === DIALOG_ITEM) return;
    const box = getAuthScreenItemLayout(screenKey, currentItem, workingLayout);
    const step = e.shiftKey ? POS_STEP : ARROW_STEP;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      patchItem(currentItem, { x: Math.max(0, Math.round((box.x - step) * 10) / 10) });
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      patchItem(currentItem, { x: Math.round((box.x + step) * 10) / 10 });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      patchItem(currentItem, { y: Math.max(0, Math.round((box.y - step) * 10) / 10) });
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      patchItem(currentItem, { y: Math.round((box.y + step) * 10) / 10 });
    }
  }

  async function boot() {
    els.nudgeGrid?.querySelectorAll('[data-nudge]').forEach((btn) => {
      btn.addEventListener('click', () => onNudge(btn.dataset.nudge));
    });
    root.getElementById('saveBtn')?.addEventListener('click', () => void saveToFile());
    root.getElementById('reloadBtn')?.addEventListener('click', async () => {
      await initAuthScreenChrome({ force: true });
      clearAuthScreenLayoutDraft(screenKey);
      workingLayout = mergeAuthScreenLayout(await loadAuthScreenLayout({ force: true, preferFile: true }));
      rebuildPreviewBoxes();
      rebuildFieldGrid();
      refresh();
      els.status.textContent = 'Reloaded from file';
    });

    els.mockStage?.addEventListener('wheel', onWheel, { passive: false });
    els.mockStage?.addEventListener('pointerdown', onPointerDown);
    els.mockStage?.addEventListener('pointermove', onPointerMove);
    els.mockStage?.addEventListener('pointerup', onPointerUp);
    els.mockStage?.addEventListener('pointercancel', onPointerUp);
    els.mockStage?.addEventListener('keydown', onKeyDown);

    await initAuthScreenChrome();
    workingLayout = mergeAuthScreenLayout(await loadAuthScreenLayout({ force: true, preferFile: true }));
    if (hasAuthScreenLayoutDraft(screenKey)) {
      const section = readAuthScreenLayoutDraftSection(screenKey);
      if (section) {
        workingLayout = mergeAuthScreenSection(workingLayout, screenKey, section);
      }
    }
    rebuildPreviewBoxes();
    rebuildFieldGrid();
    refresh();
    els.mockStage?.focus();
  }

  void boot();
}
