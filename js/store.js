// État de l'application, persistance (localStorage) et calculs.

const KEY = 'tsedaka.v1';

export const PAYMENTS = {
  cash: 'Espèces',
  card: 'Carte bancaire',
  transfer: 'Virement',
  standing: 'Prélèvement automatique',
  bit: 'Bit',
  paybox: 'PayBox',
  check: 'Chèque',
  other: 'Autre / non précisé',
};
export const SIF = { none: 'Pas de Sif 46', pending: 'En attente', received: 'Reçu' };
export const FREQ = { monthly: 'Mensuel', yearly: 'Annuel' };

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function normName(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

const defaults = () => ({
  version: 1,
  donations: [],
  incomes: [],
  beneficiaries: [{ id: 'pauvre', name: 'Pauvre', type: 'person' }],
  tzedaka: { amount: 0, since: null, log: [] },
  settings: { taxRate: 33, maaserRate: 10 },
});

function migrate(s) {
  const d = defaults();
  const out = { ...d, ...(s || {}) };
  out.settings = { ...d.settings, ...(out.settings || {}) };
  out.tzedaka = { ...d.tzedaka, ...(out.tzedaka || {}) };
  for (const k of ['donations', 'incomes', 'beneficiaries']) if (!Array.isArray(out[k])) out[k] = d[k];
  for (const don of out.donations) if (!Array.isArray(don.attachments)) don.attachments = [];
  return out;
}

function load() {
  try { return migrate(JSON.parse(localStorage.getItem(KEY))); } catch { return defaults(); }
}

let state = load();
const listeners = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); }
}

export const store = {
  get: () => state,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  update(mutator, { silent = false } = {}) {
    mutator(state);
    save();
    if (!silent) listeners.forEach((f) => f(state));
  },
  replace(next) {
    state = migrate(next);
    save();
    listeners.forEach((f) => f(state));
  },
};

// ---------- Bénéficiaires ----------
export const getBeneficiary = (id) => state.beneficiaries.find((b) => b.id === id) || null;
export const findBeneficiary = (name) => state.beneficiaries.find((b) => normName(b.name) === normName(name)) || null;

export function ensureBeneficiary(name, type = 'association') {
  const found = findBeneficiary(name);
  if (found) return found;
  const b = { id: uid(), name: String(name).trim(), type };
  store.update((s) => s.beneficiaries.push(b), { silent: true });
  return b;
}

export function usageCount(id) {
  return state.donations.filter((d) => d.beneficiaryId === id).length;
}

// ---------- Récurrence ----------
// Renvoie les dates (ISO) effectives d'un don jusqu'à `until` inclus.
export function occurrences(don, until = todayISO()) {
  if (!don.recurring) return [don.date];
  const end = don.recurring.end && don.recurring.end < until ? don.recurring.end : until;
  const [y, m, d] = don.date.split('-').map(Number);
  const step = don.recurring.freq === 'yearly' ? 12 : 1;
  const out = [];
  for (let i = 0; i < 1200; i++) {
    const total = m - 1 + i * step;
    const yy = y + Math.floor(total / 12);
    const mm = total % 12;
    const last = new Date(yy, mm + 1, 0).getDate();
    const iso = `${yy}-${pad(mm + 1)}-${pad(Math.min(d, last))}`;
    if (iso > end) break;
    out.push(iso);
  }
  return out;
}

// ---------- Statistiques ----------
export function yearsAvailable() {
  const ys = new Set([new Date().getFullYear()]);
  for (const d of state.donations) for (const o of occurrences(d)) ys.add(+o.slice(0, 4));
  for (const i of state.incomes) ys.add(+i.date.slice(0, 4));
  return [...ys].sort((a, b) => b - a);
}

export function stats(year) {
  const ys = String(year);
  const today = todayISO();
  let total = 0, received = 0, pending = 0, count = 0;
  const by = new Map();
  for (const d of state.donations) {
    const occ = occurrences(d, today).filter((x) => x.startsWith(ys));
    if (!occ.length) continue;
    const amt = d.amount * occ.length;
    total += amt;
    count += occ.length;
    if (d.sif46 === 'received') received += amt;
    else if (d.sif46 === 'pending') pending += amt;
    const b = d.beneficiaryId && getBeneficiary(d.beneficiaryId);
    const key = d.beneficiaryId || normName(d.beneficiaryName);
    const cur = by.get(key) || { id: d.beneficiaryId, name: b ? b.name : d.beneficiaryName, type: b ? b.type : d.beneficiaryType, amount: 0, count: 0 };
    cur.amount += amt;
    cur.count += occ.length;
    by.set(key, cur);
  }
  const withSif = received + pending;
  const rate = state.settings.taxRate / 100;
  const income = state.incomes.filter((i) => i.date.startsWith(ys)).reduce((s, i) => s + i.amount, 0);
  const due = (income * state.settings.maaserRate) / 100;
  return {
    total, count, received, pending, withSif,
    without: total - withSif,
    refund: withSif * rate,
    refundReceived: received * rate,
    refundPending: pending * rate,
    byBeneficiary: [...by.values()].sort((a, b) => b.amount - a.amount),
    income, due,
    pct: income ? (total / income) * 100 : 0,
    remaining: Math.max(0, due - total),
  };
}

// ---------- Tsédaka quotidienne ----------
export function tzAdd(v) {
  store.update((s) => {
    if (!s.tzedaka.amount) s.tzedaka.since = todayISO();
    s.tzedaka.amount += v;
    s.tzedaka.log.push(v);
    if (s.tzedaka.log.length > 200) s.tzedaka.log.shift();
  }, { silent: true });
}
export function tzUndo() {
  store.update((s) => {
    const v = s.tzedaka.log.pop();
    if (v) s.tzedaka.amount = Math.max(0, s.tzedaka.amount - v);
  });
}
export function tzReset() {
  store.update((s) => { s.tzedaka = { amount: 0, since: null, log: [] }; });
}
