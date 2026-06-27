/** Nested layouts inside preview v2 data zones (User_data, Game_Data, Info_data, Timer_data). */

export const PREVIEW_V2_DATA_SECTIONS = {
  userData: {
    label: 'User_data',
    previewZoneKey: 'userData',
    file: 'user_data_v2_layout.json',
    lsKey: 'tilezilla:layouts:user-data-v2',
    lsPendingKey: 'tilezilla:layouts:user-data-v2:pending',
    cssPrefix: 'user-data',
    frame: { w: 104, h: 72 },
    items: {
      badgeStack: { label: 'Rank badge stack', cssKey: 'badge-stack' },
      sublevelIcon: { label: 'Sublevel icon', cssKey: 'sublevel' },
      progressTrack: { label: 'Progress bar', cssKey: 'progress-track' },
      progressText: { label: 'Progress %', cssKey: 'progress-text' },
    },
    defaults: {
      badgeStack: { x: 8, y: 0, w: 88, h: 42 },
      sublevelIcon: { x: 30, y: 30, w: 44, h: 24 },
      progressTrack: { x: 4, y: 54, w: 96, h: 5 },
      progressText: { x: 4, y: 62, w: 96, h: 10 },
    },
  },
  gameData: {
    label: 'Game_Data',
    previewZoneKey: 'gameData',
    file: 'game_data_v2_layout.json',
    lsKey: 'tilezilla:layouts:game-data-v2',
    lsPendingKey: 'tilezilla:layouts:game-data-v2:pending',
    cssPrefix: 'game-data',
    frame: { w: 70, h: 46 },
    items: {
      gameType: { label: 'Challenge type', cssKey: 'type' },
      gameDate: { label: 'Date', cssKey: 'date' },
      advId: { label: 'Adv_ID', cssKey: 'adv-id' },
      puzzleId: { label: 'Puzzle ID', cssKey: 'id' },
    },
    textLayout: true,
    defaults: {
      gameType: { x: 0, y: 2, w: 70, h: 14, fontScale: 1, justify: 'center', align: 'center' },
      gameDate: { x: 0, y: 15, w: 70, h: 14, fontScale: 1, justify: 'center', align: 'center' },
      advId: { x: 0, y: 15, w: 70, h: 14, fontScale: 0.92, justify: 'center', align: 'center' },
      puzzleId: { x: 0, y: 29, w: 70, h: 15, fontScale: 1, justify: 'center', align: 'center' },
    },
  },
  infoData: {
    label: 'Info_data',
    previewZoneKey: 'infoData',
    file: 'info_data_v2_layout.json',
    lsKey: 'tilezilla:layouts:info-data-v2',
    lsPendingKey: 'tilezilla:layouts:info-data-v2:pending',
    cssPrefix: 'info-data',
    frame: { w: 68, h: 46 },
    items: {
      solutionCount: { label: 'Solution count', cssKey: 'count' },
      solutionPossible: { label: 'Possible line', cssKey: 'possible' },
      solutionSolutions: { label: 'Solutions line', cssKey: 'solutions' },
    },
    textLayout: true,
    defaults: {
      solutionCount: { x: 0, y: 2, w: 68, h: 14, fontScale: 1, justify: 'center', align: 'center' },
      solutionPossible: { x: 0, y: 16, w: 68, h: 14, fontScale: 0.92, justify: 'center', align: 'center' },
      solutionSolutions: { x: 0, y: 30, w: 68, h: 14, fontScale: 0.92, justify: 'center', align: 'center' },
    },
  },
  timerData: {
    label: 'Timer_data',
    previewZoneKey: 'timerData',
    file: 'timer_data_v2_layout.json',
    lsKey: 'tilezilla:layouts:timer-data-v2',
    lsPendingKey: 'tilezilla:layouts:timer-data-v2:pending',
    cssPrefix: 'timer-data',
    frame: { w: 58, h: 44 },
    items: {
      timerCurrent: { label: 'Current time', cssKey: 'current' },
      timerBest: { label: 'Best time', cssKey: 'best' },
    },
    textLayout: true,
    defaults: {
      timerCurrent: { x: 0, y: 2, w: 58, h: 20, fontScale: 1, justify: 'flex-end', align: 'center' },
      timerBest: { x: 0, y: 22, w: 58, h: 19, fontScale: 0.92, justify: 'flex-end', align: 'center' },
    },
  },
};

export const PREVIEW_V2_DATA_SECTION_KEYS = Object.keys(PREVIEW_V2_DATA_SECTIONS);

const layoutCache = new Map();

const LEGACY_FRAMES = {
  gameData: { legacy: { w: 154, h: 54 }, current: { w: 70, h: 46 }, defaultItemH: 14 },
  infoData: { legacy: { w: 154, h: 18 }, current: { w: 68, h: 46 }, defaultItemH: 14 },
  timerData: { legacy: { w: 104, h: 52 }, current: { w: 58, h: 44 }, defaultItemH: 20 },
};

function migrateLegacyDataLayout(sectionKey, layout) {
  const spec = LEGACY_FRAMES[sectionKey];
  if (!layout?.items || !spec) return layout;
  const frame = layout.frame || {};
  const isLegacyFrame = frame.w === spec.legacy.w && frame.h === spec.legacy.h;
  if (!isLegacyFrame) return layout;

  const sx = spec.current.w / spec.legacy.w;
  const sy = spec.current.h / spec.legacy.h;
  const migrated = {
    frame: { ...spec.current },
    items: {},
  };
  for (const [key, item] of Object.entries(layout.items)) {
    if (!item || typeof item !== 'object') continue;
    migrated.items[key] = {
      ...item,
      x: Math.round((item.x ?? 0) * sx),
      y: Math.round((item.y ?? 0) * sy),
      w: Math.max(4, Math.round((item.w ?? spec.legacy.w) * sx)),
      h: Math.max(4, Math.round((item.h ?? spec.defaultItemH) * sy)),
    };
  }
  return migrated;
}

export function syncDataSublayoutFrameFromPreviewZone(sectionKey, previewLayout, layout) {
  const def = sectionDef(sectionKey);
  if (!def || !layout) return layout;
  const zone = previewLayout?.items?.[def.previewZoneKey];
  if (!zone?.w || !zone?.h) return layout;
  if (layout.frame?.w === zone.w && layout.frame?.h === zone.h) return layout;
  const oldFrame = layout.frame || def.frame;
  const spec = LEGACY_FRAMES[sectionKey];
  const defaultItemH = spec?.defaultItemH ?? 14;
  const sx = zone.w / (oldFrame.w || def.frame.w);
  const sy = zone.h / (oldFrame.h || def.frame.h);
  const synced = {
    frame: { w: zone.w, h: zone.h },
    items: {},
  };
  for (const [key, item] of Object.entries(layout.items || {})) {
    if (!item || typeof item !== 'object') continue;
    synced.items[key] = {
      ...item,
      x: Math.round((item.x ?? 0) * sx),
      y: Math.round((item.y ?? 0) * sy),
      w: Math.max(4, Math.round((item.w ?? oldFrame.w) * sx)),
      h: Math.max(4, Math.round((item.h ?? defaultItemH) * sy)),
    };
  }
  return synced;
}

/** @deprecated use syncDataSublayoutFrameFromPreviewZone */
export function syncGameDataFrameFromPreviewZone(previewLayout, layout) {
  return syncDataSublayoutFrameFromPreviewZone('gameData', previewLayout, layout);
}

function sectionDef(sectionKey) {
  return PREVIEW_V2_DATA_SECTIONS[sectionKey] || null;
}

function defaultLayout(sectionKey) {
  const def = sectionDef(sectionKey);
  if (!def) return null;
  return {
    frame: { ...def.frame },
    items: JSON.parse(JSON.stringify(def.defaults)),
  };
}

export function clearPreviewV2DataSublayoutCache(sectionKey) {
  if (sectionKey) layoutCache.delete(sectionKey);
  else layoutCache.clear();
}

export function stashPreviewV2DataSublayoutDraft(sectionKey, layout) {
  const def = sectionDef(sectionKey);
  if (!def) return;
  try {
    localStorage.setItem(def.lsKey, JSON.stringify(layout));
    localStorage.setItem(def.lsPendingKey, '1');
  } catch {
    /* ignore */
  }
}

export function clearPreviewV2DataSublayoutDraft(sectionKey) {
  const def = sectionDef(sectionKey);
  if (!def) return;
  try {
    localStorage.removeItem(def.lsPendingKey);
  } catch {
    /* ignore */
  }
}

function migrateInfoDataToThreeLines(layout) {
  if (!layout?.items || layout.items.solutionCount) return layout;
  const legacy = layout.items.solutions;
  if (!legacy || typeof legacy !== 'object') return layout;
  const fs = legacy.fontScale ?? 1;
  const baseY = legacy.y ?? 0;
  const baseX = legacy.x ?? 0;
  const baseW = legacy.w ?? 68;
  const lineH = Math.max(10, Math.round((legacy.h ?? 46) / 3));
  const { solutions: _removed, ...rest } = layout.items;
  return {
    ...layout,
    items: {
      ...rest,
      solutionCount: {
        x: baseX,
        y: baseY,
        w: baseW,
        h: lineH,
        fontScale: fs,
        justify: legacy.justify ?? 'center',
        align: legacy.align ?? 'center',
      },
      solutionPossible: {
        x: baseX,
        y: baseY + lineH,
        w: baseW,
        h: lineH,
        fontScale: fs * 0.92,
        justify: legacy.justify ?? 'center',
        align: legacy.align ?? 'center',
      },
      solutionSolutions: {
        x: baseX,
        y: baseY + lineH * 2,
        w: baseW,
        h: lineH,
        fontScale: fs * 0.92,
        justify: legacy.justify ?? 'center',
        align: legacy.align ?? 'center',
      },
    },
  };
}

export function mergePreviewV2DataSublayout(sectionKey, raw) {
  const base = defaultLayout(sectionKey);
  if (!base) return null;
  let source = raw;
  if (source && LEGACY_FRAMES[sectionKey]) {
    source = migrateLegacyDataLayout(sectionKey, source);
  }
  if (sectionKey === 'infoData' && source) {
    source = migrateInfoDataToThreeLines(source);
  }
  if (!source || typeof source !== 'object') return base;
  if (source.frame && typeof source.frame === 'object') {
    base.frame = { ...base.frame, ...source.frame };
  }
  if (source.items && typeof source.items === 'object') {
    for (const [key, val] of Object.entries(source.items)) {
      if (!base.items[key] || typeof val !== 'object') continue;
      base.items[key] = { ...base.items[key], ...val };
    }
  }
  return base;
}

export async function loadPreviewV2DataSublayout(sectionKey, { force = false } = {}) {
  const def = sectionDef(sectionKey);
  if (!def) return null;
  if (layoutCache.has(sectionKey) && !force) return layoutCache.get(sectionKey);

  let raw = null;
  let pendingDraft = false;
  try {
    pendingDraft = localStorage.getItem(def.lsPendingKey) === '1';
    if (pendingDraft) {
      const draft = localStorage.getItem(def.lsKey);
      if (draft) raw = JSON.parse(draft);
    }
  } catch {
    pendingDraft = false;
  }

  if (!pendingDraft) {
    try {
      const res = await fetch(`/data/${def.file}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) raw = await res.json();
    } catch {
      /* fall through */
    }
  }

  if (!raw && !pendingDraft) {
    try {
      const draft = localStorage.getItem(def.lsKey);
      if (draft) raw = JSON.parse(draft);
    } catch {
      /* ignore */
    }
  }

  const merged = mergePreviewV2DataSublayout(sectionKey, raw);
  layoutCache.set(sectionKey, merged);
  return merged;
}

export function getPreviewV2DataSublayoutItem(sectionKey, itemKey, layout) {
  const merged = mergePreviewV2DataSublayout(sectionKey, layout);
  const def = sectionDef(sectionKey);
  if (!merged || !def) return { x: 0, y: 0, w: 0, h: 0, fontScale: 1, justify: 'center', align: 'center' };
  const item = merged.items[itemKey] || {};
  const fallback = def.defaults[itemKey] || {};
  const box = {
    x: item.x ?? fallback.x ?? 0,
    y: item.y ?? fallback.y ?? 0,
    w: item.w ?? fallback.w ?? 0,
    h: item.h ?? fallback.h ?? 0,
  };
  if (def.textLayout) {
    box.fontScale = item.fontScale ?? fallback.fontScale ?? 1;
    box.justify = item.justify ?? fallback.justify ?? 'center';
    box.align = item.align ?? fallback.align ?? 'center';
  }
  return box;
}

function setBoxVars(target, cssPrefix, cssKey, box, { textLayout = false } = {}) {
  target.style.setProperty(`--tz-${cssPrefix}-${cssKey}-x-art`, String(box.x));
  target.style.setProperty(`--tz-${cssPrefix}-${cssKey}-y-art`, String(box.y));
  target.style.setProperty(`--tz-${cssPrefix}-${cssKey}-w-art`, String(box.w));
  target.style.setProperty(`--tz-${cssPrefix}-${cssKey}-h-art`, String(box.h));
  if (textLayout) {
    target.style.setProperty(`--tz-${cssPrefix}-${cssKey}-font-scale`, String(box.fontScale ?? 1));
    target.style.setProperty(`--tz-${cssPrefix}-${cssKey}-justify`, box.justify ?? 'center');
    target.style.setProperty(`--tz-${cssPrefix}-${cssKey}-align`, box.align ?? 'center');
  }
}

export function applyPreviewV2DataSublayout(sectionKey, layout, target = document.documentElement) {
  const def = sectionDef(sectionKey);
  const merged = mergePreviewV2DataSublayout(sectionKey, layout);
  if (!def || !merged) return;
  const frame = merged.frame || def.frame;
  target.style.setProperty(`--tz-${def.cssPrefix}-art-w`, String(frame.w ?? def.frame.w));
  target.style.setProperty(`--tz-${def.cssPrefix}-art-h`, String(frame.h ?? def.frame.h));
  for (const [key, meta] of Object.entries(def.items)) {
    setBoxVars(
      target,
      def.cssPrefix,
      meta.cssKey,
      getPreviewV2DataSublayoutItem(sectionKey, key, merged),
      { textLayout: Boolean(def.textLayout) },
    );
  }
}

export async function applyAllPreviewV2DataSublayouts(target = document.documentElement) {
  for (const sectionKey of PREVIEW_V2_DATA_SECTION_KEYS) {
    try {
      const layout = await loadPreviewV2DataSublayout(sectionKey);
      applyPreviewV2DataSublayout(sectionKey, layout, target);
    } catch {
      /* ignore */
    }
  }
}

export function buildPreviewV2DataSublayoutReport(sectionKey, layout) {
  const def = sectionDef(sectionKey);
  const merged = mergePreviewV2DataSublayout(sectionKey, layout);
  if (!def || !merged) return '';
  const frame = merged.frame || def.frame;
  const lines = [
    `${def.label} sub-layout (local artboard ${frame.w}×${frame.h}px)`,
    `Zone position: tune in preview-v2-tuner.html (${def.previewZoneKey})`,
    '',
  ];
  for (const [key, meta] of Object.entries(def.items)) {
    const box = getPreviewV2DataSublayoutItem(sectionKey, key, merged);
    let line = `${meta.label}: x ${box.x} · y ${box.y} · w ${box.w} · h ${box.h}`;
    if (def.textLayout) {
      line += ` · fontScale ${box.fontScale} · justify ${box.justify} · align ${box.align}`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

export function getPreviewV2DataSublayoutSavePath(sectionKey) {
  return sectionDef(sectionKey)?.file || null;
}

export function getPreviewV2DataSublayoutSaveApi(sectionKey) {
  const map = {
    userData: '/api/dev/save-user-data-v2-layout',
    gameData: '/api/dev/save-game-data-v2-layout',
    infoData: '/api/dev/save-info-data-v2-layout',
    timerData: '/api/dev/save-timer-data-v2-layout',
  };
  return map[sectionKey] || null;
}
