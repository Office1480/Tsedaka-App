// Sauvegarde automatique sur Google Drive (dossier « Tsédaka »).
// Portée drive.file : l'app ne voit que les fichiers qu'elle a créés elle-même.
import { store, onSave } from './store.js';
import { getFile, putFile } from './files.js';
import { GOOGLE_CLIENT_ID } from './config.js';

const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
const SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.file';
const KEY = 'tsedaka.drive';
const FOLDER = 'Tsédaka';
const BACKUP = 'tsedaka-sauvegarde.json';

let st = load();
let busy = false;
let error = null;
let seq = 0;
let timer = null;
const listeners = new Set();

function load() {
  try { return { receipts: {}, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { receipts: {} }; }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {}
  listeners.forEach((f) => f(status()));
}

export const onDriveChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const clientId = () => GOOGLE_CLIENT_ID;
const tokenValid = () => !!st.token && st.exp > Date.now() + 30000;

export function status() {
  return { configured: !!clientId(), connected: !!st.connected, lastBackup: st.lastBackup || null, dirty: !!st.dirty, busy, error, tokenValid: tokenValid(), user: st.user || null, folderId: st.folderId || null };
}

export function disconnect() {
  try { if (st.token) window.google?.accounts.oauth2.revoke(st.token, () => {}); } catch {}
  st = { receipts: {} };
  persist();
}

// ---------- Authentification (Google Identity Services) ----------
let gis = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return (gis ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { gis = null; reject(new Error('Google est injoignable (connexion internet ?)')); };
    document.head.append(s);
  }));
}

// À appeler depuis un geste de l'utilisateur (sinon la fenêtre Google est bloquée).
export async function authorize() {
  if (!clientId()) throw new Error('Identifiant Google non configuré');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      prompt: st.connected ? '' : 'select_account',
      ...(st.user?.email ? { login_hint: st.user.email } : {}),
      callback: (r) => {
        if (r.error) return reject(new Error(r.error_description || r.error));
        st.token = r.access_token;
        st.exp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
        st.connected = true;
        persist();
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${r.access_token}` } })
          .then((x) => (x.ok ? x.json() : null))
          .then((u) => { if (u) { st.user = { email: u.email, name: u.name, picture: u.picture }; persist(); } })
          .catch(() => {})
          .finally(resolve);
      },
      error_callback: (e) => reject(new Error(e?.type === 'popup_closed' ? 'Connexion annulée' : e?.message || 'Connexion impossible')),
    });
    client.requestAccessToken();
  });
}

// ---------- Appels Drive ----------
async function call(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${st.token}`, ...(opts.headers || {}) } });
  if (!res.ok) {
    const err = new Error(res.status === 401 ? 'Session Google expirée' : `Erreur Google Drive (${res.status})`);
    err.status = res.status;
    if (res.status === 401) { st.token = null; persist(); }
    throw err;
  }
  return res;
}
const json = async (url, opts) => (await call(url, opts)).json();

function upload(meta, blob, fileId) {
  const b = 'tsedaka' + Math.random().toString(36).slice(2);
  const body = new Blob([
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`,
    blob,
    `\r\n--${b}--`,
  ]);
  return json(`${UP}/files${fileId ? '/' + fileId : ''}?uploadType=multipart&fields=id`, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body,
  });
}

async function find(q) {
  const r = await json(`${API}/files?q=${encodeURIComponent(q + ' and trashed=false')}&orderBy=modifiedTime desc&fields=files(id,modifiedTime)`);
  return r.files[0] || null;
}

async function ensureFolder() {
  if (st.folderId) return st.folderId;
  const found = await find(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder'`);
  st.folderId = found ? found.id : (await json(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  })).id;
  persist();
  return st.folderId;
}

// ---------- Sauvegarde ----------
async function doBackup() {
  const folder = await ensureFolder();
  if (!st.backupId) st.backupId = (await find(`name='${BACKUP}'`))?.id || null; // reprend la sauvegarde existante
  const s = store.get();
  for (const d of s.donations) {
    for (const a of d.attachments || []) {
      if (st.receipts[a.id]) continue;
      const blob = await getFile(a.id);
      if (!blob) continue;
      const r = await upload({ name: `recu-${d.date}-${a.name}`, parents: [folder], appProperties: { attId: a.id } }, blob);
      st.receipts[a.id] = r.id;
      persist();
    }
  }
  const data = new Blob([JSON.stringify({ app: 'tsedaka', savedAt: new Date().toISOString(), state: s, receipts: st.receipts })], { type: 'application/json' });
  const r = await upload(st.backupId ? { name: BACKUP } : { name: BACKUP, parents: [folder] }, data, st.backupId);
  st.backupId = r.id;
}

export async function backup({ interactive = false } = {}) {
  if (busy || !st.connected) return false;
  if (!tokenValid()) {
    if (!interactive) return false;
    await authorize();
  }
  busy = true;
  error = null;
  const started = seq;
  persist();
  try {
    try {
      await doBackup();
    } catch (e) {
      if (e.status !== 404) throw e;
      st.folderId = null; st.backupId = null; st.receipts = {}; // dossier supprimé dans Drive : on recrée tout
      await doBackup();
    }
    st.lastBackup = Date.now();
    st.dirty = seq !== started;
    return true;
  } catch (e) {
    error = e.message;
    st.dirty = true;
    throw e;
  } finally {
    busy = false;
    persist();
  }
}

function schedule(delay) {
  clearTimeout(timer);
  timer = setTimeout(() => { if (st.dirty && tokenValid()) backup().catch(() => {}); }, delay);
}

onSave(() => {
  seq++;
  if (!st.connected) return;
  if (!st.dirty) { st.dirty = true; persist(); }
  schedule(4000);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && st.dirty && tokenValid()) backup().catch(() => {});
});

if (clientId()) loadGis().catch(() => {});
if (st.connected && st.dirty) schedule(1500);

// ---------- Restauration ----------
export async function fetchLatestBackup() {
  if (!tokenValid()) await authorize();
  const f = await find(`name='${BACKUP}'`);
  if (!f) throw new Error('Aucune sauvegarde trouvée sur ce Google Drive');
  const data = await (await call(`${API}/files/${f.id}?alt=media`)).json();
  if (data.app !== 'tsedaka' || !data.state) throw new Error('Sauvegarde illisible');
  return { ...data, fileId: f.id };
}

export async function applyBackup(data) {
  for (const [attId, fileId] of Object.entries(data.receipts || {})) {
    if (await getFile(attId)) continue;
    try { await putFile(attId, await (await call(`${API}/files/${fileId}?alt=media`)).blob()); } catch {}
  }
  store.replace(data.state);
  st.backupId = data.fileId;
  st.receipts = data.receipts || {};
  st.lastBackup = Date.parse(data.savedAt) || Date.now();
  st.dirty = false;
  persist();
}
