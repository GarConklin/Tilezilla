/** Application metadata (version, creator, dates) for the hamburger menu. */

export const DEFAULT_LOGOUT_REDIRECT_URL = 'https://www.skifflakegames.com/';

let infoCache = null;

function formatIsoDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso).trim());
  if (!m) return String(iso).trim();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return String(iso).trim();
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function fetchSystemInfo() {
  if (infoCache) return infoCache;
  try {
    const res = await fetch('/api/system-info', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (payload?.ok && payload.info) {
      infoCache = payload.info;
      return infoCache;
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch('/data/system_info.json', { cache: 'no-store' });
    if (res.ok) {
      infoCache = await res.json();
      return infoCache;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function getLogoutRedirectUrl(info) {
  const url = String(info?.logoutRedirectUrl || '').trim();
  return url || DEFAULT_LOGOUT_REDIRECT_URL;
}

export async function resolveLogoutRedirectUrl() {
  const info = await fetchSystemInfo();
  return getLogoutRedirectUrl(info);
}

export function renderMenuSystemInfo(info, root = document) {
  const el = root.getElementById('menuSystemInfo');
  if (!el) return;
  if (!info?.version) {
    el.hidden = true;
    return;
  }

  const lines = [`v${info.version}`];
  const updated = formatIsoDate(info.lastUpdated);
  if (updated) lines.push(`Updated ${updated}`);
  if (info.creator) lines.push(info.creator);
  if (info.creationDate) lines.push(`Created ${info.creationDate}`);

  el.replaceChildren();
  for (const text of lines) {
    const line = document.createElement('div');
    line.className = 'tz-menu-plaque__system-info-line';
    if (lines[0] === text) line.classList.add('tz-menu-plaque__system-info-line--version');
    line.textContent = text;
    el.appendChild(line);
  }
  el.hidden = false;
}

export async function initMenuSystemInfo(root = document) {
  const info = await fetchSystemInfo();
  renderMenuSystemInfo(info, root);
}
