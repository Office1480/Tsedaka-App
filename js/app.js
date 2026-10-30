import {
  store, PAYMENTS, SIF, FREQ, uid, todayISO, parseISO, normName, occurrences, stats, yearsAvailable,
  getBeneficiary, findBeneficiary, ensureBeneficiary, usageCount, tzAdd, tzUndo, tzReset,
} from './store.js';
import { parseDonation, isYes, isNo } from './parser.js';
import * as voice from './voice.js';
import { quoteFor } from './quotes.js';
import { putFile, getFile, deleteFile, allFileIds, prepareFile, blobToDataURL, dataURLToBlob } from './files.js';

// ---------- Utilitaires ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const money = (n) => `${nf.format(Math.round((n || 0) * 100) / 100)} ₪`;
const pct = (n) => `${nf.format(Math.round(n * 10) / 10)} %`;
const fmtDate = (iso, o = { day: 'numeric', month: 'long', year: 'numeric' }) => parseISO(iso).toLocaleDateString('fr-FR', o);
const S = () => store.get();
const hue = (name) => [...String(name || '')].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
const initial = (name) => (String(name || '?').trim()[0] || '?').toUpperCase();
const parseAmount = (v) => parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
const vibrate = (ms = 12) => { try { navigator.vibrate?.(ms); } catch {} };

const ICON = {
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
  clip: '<svg viewBox="0 0 24 24"><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1L13 4.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4L14.6 7.3"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>',
  bank: '<svg viewBox="0 0 24 24"><path d="M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5h2M3 9h18"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  repeat: '<svg viewBox="0 0 24 24"><path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
};

// ---------- État de l'interface ----------
const ui = { view: 'dons', year: new Date().getFullYear(), search: '', give: false };
try { ui.view = localStorage.getItem('tsedaka.view') || 'dons'; } catch {}
if (ui.view === 'donner') ui.view = 'dons';

function go(view) {
  ui.view = view;
  try { localStorage.setItem('tsedaka.view', view); } catch {}
  render();
  window.scrollTo({ top: 0 });
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Feuilles (bottom sheets) avec gestion du bouton retour Android ----------
let sheet = null;
let sheetCleanup = null;

function openSheet(html, onMount) {
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.className = 'sheet-wrap';
    sheet.innerHTML = '<div class="sheet-overlay" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div><div class="sheet-body"></div></div>';
    document.body.append(sheet);
    document.body.classList.add('no-scroll');
    history.pushState({ sheet: true }, '');
    requestAnimationFrame(() => requestAnimationFrame(() => sheet?.classList.add('open')));
  } else {
    runSheetCleanup();
  }
  const body = $('.sheet-body', sheet);
  body.innerHTML = html;
  body.scrollTop = 0;
  sheetCleanup = onMount?.(body) || null;
}

function runSheetCleanup() {
  const f = sheetCleanup;
  sheetCleanup = null;
  if (typeof f === 'function') f();
}

let closeWaiters = [];
function closeSheet() {
  return new Promise((resolve) => {
    if (!sheet) return resolve();
    closeWaiters.push(resolve);
    history.back();
  });
}

window.addEventListener('popstate', () => {
  if (!sheet) return;
  runSheetCleanup();
  const el = sheet;
  sheet = null;
  el.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => el.remove(), 280);
  const w = closeWaiters;
  closeWaiters = [];
  w.forEach((f) => f());
});

// ---------- Rendu principal ----------
const views = {};

function render() {
  if (ui.view !== 'donner') ui.give = false;
  $('#view').innerHTML = views[ui.view]();
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === ui.view));
  if (ui.view === 'dons') renderDonList();
}

store.subscribe(() => {
  if (ui.view === 'tsedaka') updateTzAmount();
  else render();
});

function yearPicker() {
  const ys = yearsAvailable();
  return `<div class="year-picker">
    <button class="yp-arrow" data-act="year" data-d="-1" aria-label="Année précédente">‹</button>
    <select class="yp-select" data-change="year" aria-label="Année">${[...new Set([...ys, ui.year])].sort((a, b) => b - a)
      .map((y) => `<option value="${y}" ${y === ui.year ? 'selected' : ''}>${y}</option>`).join('')}</select>
    <button class="yp-arrow" data-act="year" data-d="1" aria-label="Année suivante">›</button>
  </div>`;
}

// ---------- Citations du Sefer HaMidot ----------
const quoteShift = {};
function quoteCard(topics, compact = false) {
  const key = topics.join('+');
  const q = quoteFor(topics, quoteShift[key] || 0);
  return `<figure class="quote-card ${compact ? 'compact' : ''}" data-act="next-quote" data-key="${key}" title="Citation suivante">
    <blockquote lang="he" dir="rtl">${esc(q.he)}</blockquote>
    <figcaption><span class="quote-fr">${esc(q.fr)}</span><span class="quote-ref">Sefer HaMidot · ${esc(q.ref)}</span></figcaption>
  </figure>`;
}

// ---------- Vue : Dons ----------
views.dons = () => `
  <section class="page">
    <div class="action-row">
      <button class="btn gold big" data-act="new-don">${ICON.plus}<span>Nouveau don</span></button>
      <button class="btn blue big" data-act="voice">${ICON.mic}<span>Dicter</span></button>
    </div>
    <div class="list-head">
      <h2 class="title">Mes dons</h2>
      ${yearPicker()}
    </div>
    ${quoteCard(['tsedaka', 'joie'], true)}
    <label class="search">${ICON.search}<input type="search" placeholder="Rechercher un bénéficiaire, une remarque…" value="${esc(ui.search)}" data-input="search"></label>
    <div id="don-list"></div>
  </section>`;

function donRows(year) {
  const ys = String(year);
  const today = todayISO();
  const rows = [];
  for (const d of S().donations) {
    if (d.recurring) {
      const occ = occurrences(d, today).filter((x) => x.startsWith(ys));
      const startsLater = d.date.startsWith(ys) && d.date > today;
      if (!occ.length && !startsLater) continue;
      rows.push({ d, sort: occ.at(-1) || d.date, n: occ.length });
    } else if (d.date.startsWith(ys)) {
      rows.push({ d, sort: d.date, n: 1 });
    }
  }
  return rows.sort((a, b) => b.sort.localeCompare(a.sort) || (b.d.createdAt || 0) - (a.d.createdAt || 0));
}

function renderDonList() {
  const box = $('#don-list');
  if (!box) return;
  const q = normName(ui.search);
  let rows = donRows(ui.year);
  if (q) {
    rows = rows.filter(({ d }) => {
      const b = getBeneficiary(d.beneficiaryId);
      return normName(`${b?.name || d.beneficiaryName} ${d.remark} ${PAYMENTS[d.payment] || ''}`).includes(q);
    });
  }
  if (!rows.length) {
    box.innerHTML = `<div class="empty"><div class="empty-he">צדקה</div><p>${q ? 'Aucun don ne correspond.' : `Aucun don en ${ui.year}.`}</p>
      ${q ? '' : '<p class="muted">Ajoutez votre premier don, ou dictez-le d’une seule phrase.</p>'}</div>`;
    return;
  }
  let html = '';
  let month = '';
  for (const { d, sort, n } of rows) {
    const m = sort.slice(0, 7);
    if (m !== month) {
      month = m;
      const total = S().donations.reduce((s, d) => s + d.amount * occurrences(d).filter((o) => o.startsWith(m)).length, 0);
      html += `<div class="month"><span>${esc(fmtDate(m + '-01', { month: 'long', year: 'numeric' }))}</span><span>${money(total)}</span></div>`;
    }
    const b = getBeneficiary(d.beneficiaryId);
    const name = b?.name || d.beneficiaryName;
    const rec = d.recurring
      ? `<span class="chip rec">${ICON.repeat}${FREQ[d.recurring.freq]} · ${n}×${d.recurring.end ? ` · fin ${fmtDate(d.recurring.end, { day: 'numeric', month: 'short' })}` : ''}</span>` : '';
    html += `<article class="don" data-act="edit-don" data-id="${d.id}" tabindex="0">
      <span class="avatar" style="--h:${hue(name)}">${esc(initial(name))}</span>
      <span class="don-main">
        <span class="don-name">${esc(name)}${d.attachments?.length ? `<span class="clip" title="Reçu joint">${ICON.clip}</span>` : ''}</span>
        <span class="don-meta">${esc(fmtDate(d.recurring ? sort : d.date, { day: 'numeric', month: 'short' }))} · ${esc(PAYMENTS[d.payment] || '—')}</span>
        ${rec}
        ${d.remark ? `<span class="don-remark">${esc(d.remark)}</span>` : ''}
      </span>
      <span class="don-side">
        <span class="don-amount">${money(d.amount)}${d.recurring ? '<small>/' + (d.recurring.freq === 'yearly' ? 'an' : 'mois') + '</small>' : ''}</span>
        <button class="badge sif-${d.sif46}" data-act="cycle-sif" data-id="${d.id}" title="Changer le statut Sif 46">${d.sif46 === 'none' ? 'Sans Sif 46' : 'Sif 46 · ' + SIF[d.sif46]}</button>
      </span>
    </article>`;
  }
  box.innerHTML = html;
}

// ---------- Formulaire de don ----------
function beneficiaryOptions(type, selected) {
  const list = S().beneficiaries.filter((b) => b.type === type)
    .sort((a, b) => usageCount(b.id) - usageCount(a.id) || a.name.localeCompare(b.name, 'fr'));
  return `<option value="">Choisir…</option>${list.map((b) => `<option value="${b.id}" ${b.id === selected ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}
    <option value="__new" ${selected === '__new' ? 'selected' : ''}>＋ Nouveau ${type === 'person' ? 'bénéficiaire' : 'organisme'}…</option>`;
}

function seg(name, options, value) {
  return `<div class="seg" role="radiogroup">${Object.entries(options).map(([k, label]) =>
    `<label class="seg-opt"><input type="radio" name="${name}" value="${k}" ${k === value ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
}

function openDonationForm(init = {}, { onSaved, title } = {}) {
  const existing = init.id ? S().donations.find((d) => d.id === init.id) : null;
  const d = {
    date: todayISO(), amount: '', beneficiaryId: null, beneficiaryName: '', beneficiaryType: 'association',
    sif46: 'none', payment: 'cash', recurring: null, remark: '', attachments: [], ...(existing || init),
  };
  let b = d.beneficiaryId ? getBeneficiary(d.beneficiaryId) : (d.beneficiaryName ? findBeneficiary(d.beneficiaryName) : null);
  const type = b?.type || d.beneficiaryType || 'association';
  const selected = b ? b.id : (d.beneficiaryName ? '__new' : '');
  let atts = [...(d.attachments || [])];
  const added = new Set();
  const removed = new Set();
  let saved = false;

  openSheet(`
    <form class="form" id="don-form" novalidate>
      <h3 class="sheet-title">${esc(title || (existing ? 'Modifier le don' : 'Nouveau don'))}</h3>
      <div class="grid2">
        <label class="field"><span>Date</span><input type="date" name="date" value="${d.date}" required></label>
        <label class="field"><span>Montant (₪)</span><input type="text" inputmode="decimal" name="amount" value="${d.amount === '' ? '' : d.amount}" placeholder="0" required class="amount-input"></label>
      </div>
      <div class="field"><span>Bénéficiaire</span>${seg('btype', { association: 'Association', person: 'Personne' }, type)}</div>
      <label class="field"><select name="benef">${beneficiaryOptions(type, selected)}</select></label>
      <label class="field new-benef ${selected === '__new' ? '' : 'hidden'}"><span>Nom du nouveau bénéficiaire</span>
        <input type="text" name="newName" value="${esc(selected === '__new' ? d.beneficiaryName : '')}" placeholder="Ex. Kupat Ha’Ir"></label>
      <div class="field"><span>Reçu Sif 46</span>${seg('sif46', SIF, d.sif46)}</div>
      <label class="field"><span>Moyen de paiement</span>
        <select name="payment">${Object.entries(PAYMENTS).map(([k, v]) => `<option value="${k}" ${k === d.payment ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="toggle"><input type="checkbox" name="recurring" ${d.recurring ? 'checked' : ''}><span class="toggle-ui"></span><span>Don récurrent</span></label>
      <div class="recurring-box ${d.recurring ? '' : 'hidden'}">
        <div class="field"><span>Fréquence</span>${seg('freq', FREQ, d.recurring?.freq || 'monthly')}</div>
        <label class="field"><span>Date de fin (facultatif)</span><input type="date" name="end" value="${d.recurring?.end || ''}"></label>
        <p class="hint">La date ci-dessus est celle du premier versement. Chaque échéance passée est comptée automatiquement.</p>
      </div>
      <label class="field"><span>Remarque</span><textarea name="remark" rows="2" placeholder="Nom de la personne, contexte…">${esc(d.remark)}</textarea></label>
      <div class="field"><span>Reçu / justificatif</span>
        <div class="att-actions">
          <label class="btn ghost sm">${ICON.file}<span>Charger un fichier</span><input type="file" accept="image/*,application/pdf" multiple hidden data-att="file"></label>
          <label class="btn ghost sm">${ICON.camera}<span>Scanner</span><input type="file" accept="image/*" capture="environment" hidden data-att="camera"></label>
        </div>
        <div class="att-list"></div>
      </div>
      <div class="form-actions">
        ${existing ? `<button type="button" class="btn danger-ghost" data-del>${ICON.trash}<span>Supprimer</span></button>` : ''}
        <button type="submit" class="btn gold grow">${ICON.check}<span>Enregistrer</span></button>
      </div>
    </form>`, (root) => {
    const f = $('#don-form', root);
    const sel = f.elements.benef;
    const newBox = $('.new-benef', f);
    const urls = [];

    const drawAtts = async () => {
      const box = $('.att-list', f);
      urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
      if (!atts.length) { box.innerHTML = '<p class="hint">Aucun reçu joint. PDF, photo ou scan.</p>'; return; }
      box.innerHTML = atts.map((a) => `<div class="att" data-id="${a.id}">
          <button type="button" class="att-thumb" data-open="${a.id}">${a.type.startsWith('image/') ? '<img alt="">' : `<span class="pdf">${a.type === 'application/pdf' ? 'PDF' : 'DOC'}</span>`}</button>
          <span class="att-name">${esc(a.name)}</span>
          <button type="button" class="icon-btn sm" data-rm="${a.id}" aria-label="Retirer">${ICON.trash}</button></div>`).join('');
      for (const a of atts) {
        if (!a.type.startsWith('image/')) continue;
        const blob = await getFile(a.id);
        const img = $(`.att[data-id="${a.id}"] img`, box);
        if (blob && img) { const u = URL.createObjectURL(blob); urls.push(u); img.src = u; }
      }
    };
    drawAtts();

    f.addEventListener('change', async (e) => {
      const el = e.target;
      if (el.name === 'btype') {
        sel.innerHTML = beneficiaryOptions(el.value, '');
        newBox.classList.add('hidden');
      } else if (el.name === 'benef') {
        newBox.classList.toggle('hidden', el.value !== '__new');
        if (el.value === '__new') f.elements.newName.focus();
      } else if (el.name === 'recurring') {
        $('.recurring-box', f).classList.toggle('hidden', !el.checked);
        if (el.checked && f.elements.payment.value === 'cash') f.elements.payment.value = 'standing';
      } else if (el.dataset.att) {
        for (const file of el.files) {
          const blob = await prepareFile(file);
          const id = uid();
          await putFile(id, blob);
          added.add(id);
          const name = file.name && el.dataset.att === 'file' ? file.name : `Scan ${new Date().toLocaleDateString('fr-FR')}.jpg`;
          atts.push({ id, name, type: blob.type || file.type, size: blob.size });
        }
        el.value = '';
        drawAtts();
        if (f.elements.sif46.value === 'pending') toast('Reçu ajouté — pensez à passer le Sif 46 en « Reçu » si c’est lui.');
        else toast('Reçu ajouté');
      }
    });

    f.addEventListener('click', async (e) => {
      const rm = e.target.closest('[data-rm]');
      const op = e.target.closest('[data-open]');
      if (rm) { removed.add(rm.dataset.rm); atts = atts.filter((a) => a.id !== rm.dataset.rm); drawAtts(); }
      if (op) viewAttachment(atts.find((a) => a.id === op.dataset.open));
      if (e.target.closest('[data-del]') && confirm('Supprimer ce don ?')) {
        saved = true;
        for (const a of existing.attachments || []) deleteFile(a.id);
        for (const id of added) deleteFile(id);
        store.update((s) => { s.donations = s.donations.filter((x) => x.id !== existing.id); });
        await closeSheet();
        toast('Don supprimé');
      }
    });

    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseAmount(f.elements.amount.value);
      if (!(amount > 0)) { f.elements.amount.focus(); return toast('Indiquez un montant'); }
      const btype = f.elements.btype.value;
      let ben = null;
      if (sel.value === '__new') {
        const n = f.elements.newName.value.trim();
        if (!n) { f.elements.newName.focus(); return toast('Indiquez le nom du bénéficiaire'); }
        ben = ensureBeneficiary(n, btype);
      } else if (sel.value) ben = getBeneficiary(sel.value);
      if (!ben) { sel.focus(); return toast('Choisissez un bénéficiaire'); }
      const rec = f.elements.recurring.checked ? { freq: f.elements.freq.value, end: f.elements.end.value || null } : null;
      const don = {
        ...(existing || {}),
        id: existing?.id || uid(),
        date: f.elements.date.value || todayISO(),
        amount,
        beneficiaryId: ben.id,
        beneficiaryName: ben.name,
        beneficiaryType: ben.type,
        sif46: f.elements.sif46.value,
        payment: f.elements.payment.value,
        recurring: rec,
        remark: f.elements.remark.value.trim(),
        attachments: atts,
        source: existing?.source || init.source || 'manual',
        createdAt: existing?.createdAt || Date.now(),
      };
      saved = true;
      for (const id of removed) deleteFile(id);
      store.update((s) => {
        const i = s.donations.findIndex((x) => x.id === don.id);
        if (i >= 0) s.donations[i] = don; else s.donations.push(don);
      });
      await closeSheet();
      toast(existing ? 'Don modifié' : `Don de ${money(amount)} enregistré`);
      onSaved?.(don);
    });

    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      if (!saved) for (const id of added) deleteFile(id); // fichiers ajoutés puis formulaire abandonné
    };
  });
}

async function viewAttachment(a) {
  if (!a) return;
  const blob = await getFile(a.id);
  if (!blob) return toast('Fichier introuvable');
  const url = URL.createObjectURL(blob);
  const viewer = document.createElement('div');
  viewer.className = 'viewer';
  viewer.innerHTML = `<div class="viewer-bar"><span>${esc(a.name)}</span>
      <a class="btn ghost sm light" href="${url}" download="${esc(a.name)}">Télécharger</a>
      <button class="icon-btn light" data-close aria-label="Fermer">✕</button></div>
    <div class="viewer-body">${a.type.startsWith('image/') ? `<img src="${url}" alt="">` : `<iframe src="${url}" title="Reçu"></iframe>
      <p class="viewer-hint">Si le PDF ne s’affiche pas, utilisez « Télécharger ».</p>`}</div>`;
  document.body.append(viewer);
  viewer.querySelector('[data-close]').onclick = () => { viewer.remove(); URL.revokeObjectURL(url); };
}

// ---------- Dictée vocale ----------
function openVoice() {
  let stop = () => {};
  let parsed = null;
  let closed = false;

  openSheet(`
    <div class="voice">
      <h3 class="sheet-title">Dicter un don</h3>
      <p class="hint center">Ex. : « Le 16 février j’ai donné 2000 shekels pour l’association XYZ et j’attends le Sif 46 »</p>
      <button class="mic" data-mic aria-label="Parler">${ICON.mic}</button>
      <p class="voice-status" data-status>${voice.supported ? 'Touchez le micro et parlez' : 'Dictée indisponible sur ce navigateur — tapez la phrase.'}</p>
      <p class="transcript" data-tr></p>
      <form class="voice-type" data-typeform>
        <input type="text" name="q" placeholder="…ou tapez la phrase ici" autocomplete="off">
        <button class="btn blue sm" type="submit">Analyser</button>
      </form>
      <div data-result></div>
    </div>`, (root) => {
    const status = $('[data-status]', root);
    const tr = $('[data-tr]', root);
    const mic = $('[data-mic]', root);
    const result = $('[data-result]', root);

    const start = () => {
      stop();
      voice.stopSpeaking();
      mic.classList.add('on');
      status.textContent = 'Je vous écoute…';
      stop = voice.listen({
        onInterim: (t) => { tr.textContent = t; },
        onFinal: (t) => { tr.textContent = t; analyse(t); },
        onError: (err) => {
          status.textContent = err === 'not-allowed' ? 'Micro refusé — autorisez-le dans Chrome.' : err === 'no-speech' ? 'Je n’ai rien entendu. Réessayez.' : 'Dictée indisponible — tapez la phrase.';
        },
        onEnd: () => mic.classList.remove('on'),
      });
    };

    const analyse = (text) => {
      parsed = parseDonation(text, { beneficiaries: S().beneficiaries });
      tr.textContent = `« ${text} »`;
      const b = parsed.beneficiaryId ? getBeneficiary(parsed.beneficiaryId) : null;
      const row = (label, value, warn) => `<div class="kv ${warn ? 'warn' : ''}"><span>${label}</span><strong>${value}</strong></div>`;
      result.innerHTML = `<div class="card result">
        <div class="result-title">Est-ce bien ça&nbsp;?</div>
        ${row('Date', esc(fmtDate(parsed.date)))}
        ${row('Montant', parsed.amount ? money(parsed.amount) : 'non compris', !parsed.amount)}
        ${row('Bénéficiaire', parsed.beneficiaryName ? `${esc(parsed.beneficiaryName)} <em>${parsed.beneficiaryType === 'person' ? 'personne' : 'association'}${b ? '' : ' · nouveau'}</em>` : 'non compris', !parsed.beneficiaryName)}
        ${row('Sif 46', SIF[parsed.sif46])}
        ${row('Paiement', esc(PAYMENTS[parsed.payment || 'cash']))}
        ${parsed.recurring ? row('Récurrence', FREQ[parsed.recurring.freq]) : ''}
        ${parsed.remark ? row('Remarque', esc(parsed.remark)) : ''}
        <div class="form-actions">
          <button class="btn ghost" data-fix>Corriger</button>
          <button class="btn gold grow" data-ok ${parsed.missing.length ? 'disabled' : ''}>${ICON.check}<span>Valider</span></button>
        </div>
        <button class="link" data-retry>Recommencer la dictée</button>
      </div>`;
      if (parsed.missing.length) {
        status.textContent = 'Il manque une information — corrigez ou recommencez.';
        voice.speak('Il me manque une information. Vous pouvez corriger.');
        return;
      }
      const phrase = `${nf.format(parsed.amount)} shekels, le ${fmtDate(parsed.date, { day: 'numeric', month: 'long' })}, pour ${parsed.beneficiaryName}, ${parsed.sif46 === 'none' ? 'sans Sif 46' : 'Sif 46 ' + SIF[parsed.sif46].toLowerCase()}. C’est bien ça ?`;
      status.textContent = 'Dites « oui » pour valider, ou « non » pour corriger.';
      voice.speak(phrase).then(() => {
        if (closed || !voice.supported) return;
        mic.classList.add('on');
        stop = voice.listen({
          onFinal: (ans) => {
            if (isYes(ans)) validate();
            else if (isNo(ans)) fix();
            else status.textContent = `« ${ans} » — touchez Valider ou Corriger.`;
          },
          onEnd: () => mic.classList.remove('on'),
        });
      });
    };

    const toDonation = () => ({
      date: parsed.date, amount: parsed.amount, beneficiaryId: parsed.beneficiaryId, beneficiaryName: parsed.beneficiaryName,
      beneficiaryType: parsed.beneficiaryType, sif46: parsed.sif46, payment: parsed.payment || 'cash',
      recurring: parsed.recurring, remark: parsed.remark, source: 'voice',
    });

    const validate = async () => {
      if (!parsed || parsed.missing.length) return;
      stop();
      const ben = parsed.beneficiaryId ? getBeneficiary(parsed.beneficiaryId) : ensureBeneficiary(parsed.beneficiaryName, parsed.beneficiaryType);
      const don = { ...toDonation(), id: uid(), beneficiaryId: ben.id, beneficiaryName: ben.name, beneficiaryType: ben.type, attachments: [], createdAt: Date.now() };
      store.update((s) => s.donations.push(don));
      await closeSheet();
      voice.speak('C’est enregistré.');
      toast(`Don de ${money(don.amount)} enregistré`);
    };
    const fix = () => { stop(); voice.stopSpeaking(); openDonationForm(toDonation(), { title: 'Corriger le don dicté' }); };

    mic.onclick = start;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-ok]')) validate();
      if (e.target.closest('[data-fix]')) fix();
      if (e.target.closest('[data-retry]')) { result.innerHTML = ''; start(); }
    });
    $('[data-typeform]', root).addEventListener('submit', (e) => {
      e.preventDefault();
      const q = e.target.elements.q.value.trim();
      if (q) { stop(); analyse(q); }
    });
    if (voice.supported) start();
    return () => { closed = true; stop(); voice.stopSpeaking(); };
  });
}

// ---------- Vue : Synthèse ----------
views.synthese = () => {
  const s = stats(ui.year);
  const st = S().settings;
  const max = s.byBeneficiary[0]?.amount || 1;
  const progress = s.due ? Math.min(100, (s.total / s.due) * 100) : 0;
  return `<section class="page">
    <div class="list-head"><h2 class="title">Synthèse</h2>${yearPicker()}</div>
    <div class="hero">
      <div class="hero-label">Total donné en ${ui.year}</div>
      <div class="hero-amount">${money(s.total)}</div>
      <div class="hero-sub">${s.count} don${s.count > 1 ? 's' : ''} · ${s.byBeneficiary.length} bénéficiaire${s.byBeneficiary.length > 1 ? 's' : ''}</div>
      <div class="hero-orn"></div>
    </div>
    <div class="tiles">
      <div class="tile"><span class="tile-label">Avec Sif 46</span><span class="tile-value">${money(s.withSif)}</span>
        <span class="tile-sub">${s.total ? pct((s.withSif / s.total) * 100) : '—'} du total</span></div>
      <div class="tile"><span class="tile-label">Sans Sif 46</span><span class="tile-value">${money(s.without)}</span>
        <span class="tile-sub">${s.total ? pct((s.without / s.total) * 100) : '—'} du total</span></div>
      <div class="tile wide gold-tile">
        <span class="tile-label">Remboursement d’impôt espéré · ${st.taxRate}&nbsp;%</span>
        <span class="tile-value">${money(s.refund)}</span>
        <div class="split">
          <span><i class="dot ok"></i>Reçus obtenus&nbsp;: <b>${money(s.refundReceived)}</b> <small>(sur ${money(s.received)})</small></span>
          <span><i class="dot wait"></i>En attente de reçu&nbsp;: <b>${money(s.refundPending)}</b> <small>(sur ${money(s.pending)})</small></span>
        </div>
      </div>
    </div>

    <h3 class="section-title">Maasser ${ui.year}</h3>
    <div class="card maaser-card" data-act="goto" data-view="maaser">
      ${s.income ? `
        <p class="maaser-sentence">Sur ${ui.year}, vous avez reçu <b>${money(s.income)}</b>. Vous devez donner <b>${money(s.due)}</b> de maasser (${st.maaserRate}&nbsp;%).
        À date, vous avez donné <b>${money(s.total)}</b>, soit <b>${pct(s.pct)}</b> au lieu de ${st.maaserRate}&nbsp;%.</p>
        <div class="bar"><span style="width:${progress}%"></span></div>
        <div class="maaser-foot">${s.remaining > 0 ? `Il vous reste <b>${money(s.remaining)}</b> à distribuer` : `<b>Maasser accompli</b> · ${money(s.total - s.due)} au-delà`}</div>`
      : `<p class="muted">Aucun revenu saisi pour ${ui.year}. Ajoutez vos revenus dans l’onglet Maasser pour suivre vos ${st.maaserRate}&nbsp;%.</p>`}
    </div>

    <h3 class="section-title">Par bénéficiaire</h3>
    <div class="card">
      ${s.byBeneficiary.length ? s.byBeneficiary.map((b) => `<div class="org">
        <div class="org-row"><span class="org-name">${esc(b.name)}</span><span class="org-amount">${money(b.amount)}</span></div>
        <div class="org-bar"><span style="width:${(b.amount / max) * 100}%"></span></div>
        <div class="org-sub">${b.count} don${b.count > 1 ? 's' : ''} · ${s.total ? pct((b.amount / s.total) * 100) : ''}</div>
      </div>`).join('') : `<p class="muted">Aucun don en ${ui.year}.</p>`}
    </div>
    ${quoteCard(['tsedaka', 'joie'])}
  </section>`;
};

// ---------- Vue : Tsédaka quotidienne ----------
const COINS = [1, 2, 5, 10];
const BILLS = [20, 50, 100];

views.tsedaka = () => {
  const tz = S().tzedaka;
  return `<section class="page tz-page">
    <div class="pushke" id="pushke">
      <div class="pushke-slot"></div>
      <div class="pushke-he" lang="he">צדקה</div>
      <div class="pushke-amount" id="tz-amount">${money(tz.amount)}</div>
      <div class="pushke-since" id="tz-since">${tz.since ? `depuis le ${esc(fmtDate(tz.since, { day: 'numeric', month: 'long' }))}` : 'Touchez une pièce pour commencer'}</div>
    </div>
    <div class="coins">${COINS.map((v) => `<button class="coin c${v}" data-act="tz-add" data-v="${v}" aria-label="${v} shekel"><span>${v}</span><small>₪</small></button>`).join('')}</div>
    <div class="bills">${BILLS.map((v) => `<button class="bill b${v}" data-act="tz-add" data-v="${v}" aria-label="${v} shekels"><span>${v}</span><small>שקלים חדשים</small></button>`).join('')}</div>
    <div class="tz-actions">
      <button class="btn gold big" data-act="tz-pay">${ICON.check}<span>Verser cette tsédaka</span></button>
      <button class="btn blue big" data-act="tz-give">${ICON.wallet}<span>Donner cet argent</span></button>
    </div>
    <div class="tz-mini">
      <button class="link" data-act="tz-undo">Annuler la dernière pièce</button>
      <button class="link" data-act="tz-reset">Remettre à zéro</button>
    </div>
    ${quoteCard(['tsedaka'])}
  </section>`;
};

function updateTzAmount() {
  const tz = S().tzedaka;
  const el = $('#tz-amount');
  if (!el) return render();
  el.textContent = money(tz.amount);
  $('#tz-since').textContent = tz.since ? `depuis le ${fmtDate(tz.since, { day: 'numeric', month: 'long' })}` : 'Touchez une pièce pour commencer';
}

function dropCoin(btn) {
  const box = $('#pushke');
  if (!box || !btn.animate) return;
  const a = btn.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  const ghost = btn.cloneNode(true);
  ghost.classList.add('ghost-coin');
  Object.assign(ghost.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' });
  document.body.append(ghost);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + 18 - (a.top + a.height / 2);
  ghost.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.6}px, ${dy - 60}px) scale(.8) rotate(90deg)`, opacity: 1, offset: 0.6 },
    { transform: `translate(${dx}px, ${dy}px) scale(.35) rotate(180deg)`, opacity: 0 },
  ], { duration: 560, easing: 'cubic-bezier(.3,.7,.4,1)' }).onfinish = () => ghost.remove();
  const amt = $('#tz-amount');
  amt.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 320, delay: 420 });
}

// ---------- Vue : Donner (partenaires) ----------
function methodsOf(b) {
  const m = [];
  if (b.donateUrl || b.website) m.push(['site', ICON.globe, 'Faire un don en ligne']);
  if (b.bit) m.push(['bit', ICON.wallet, 'Bit']);
  if (b.paybox) m.push(['paybox', ICON.wallet, 'PayBox']);
  if (b.bank) m.push(['bank', ICON.bank, 'Coordonnées bancaires']);
  if (b.phone) m.push(['phone', ICON.phone, 'Appeler']);
  return m;
}

views.donner = () => {
  const tz = S().tzedaka.amount;
  const year = new Date().getFullYear();
  const s = stats(year);
  const given = new Map(s.byBeneficiary.map((x) => [x.id, x.amount]));
  const list = [...S().beneficiaries].sort((a, b) =>
    (a.type === b.type ? 0 : a.type === 'association' ? -1 : 1) || usageCount(b.id) - usageCount(a.id) || a.name.localeCompare(b.name, 'fr'));
  return `<section class="page">
    ${ui.give ? `<div class="give-banner"><div><b>Donner ${money(tz)}</b><span>Choisissez le bénéficiaire, faites le don, puis validez.</span></div>
      <button class="link light" data-act="give-cancel">Annuler</button></div>` : ''}
    <div class="list-head"><h2 class="title">Faire un don</h2>
      <button class="btn ghost sm" data-act="new-benef">${ICON.plus}<span>Ajouter</span></button></div>
    <div class="partners">
    ${list.map((b) => {
      const ms = methodsOf(b);
      return `<div class="partner">
        <div class="partner-head">
          <span class="avatar" style="--h:${hue(b.name)}">${esc(initial(b.name))}</span>
          <div class="partner-id"><div class="partner-name">${esc(b.name)}</div>
            <div class="partner-sub">${b.type === 'person' ? 'Personne' : 'Association'}${given.get(b.id) ? ` · ${money(given.get(b.id))} en ${year}` : ''}</div></div>
          <button class="icon-btn sm" data-act="edit-benef" data-id="${b.id}" aria-label="Modifier">${ICON.edit}</button>
        </div>
        ${ms.length ? `<div class="methods">${ms.map(([k, ic, label]) => `<button class="method" data-act="method" data-m="${k}" data-id="${b.id}">${ic}<span>${label}</span></button>`).join('')}</div>`
          : `<button class="link" data-act="edit-benef" data-id="${b.id}">+ Ajouter un lien de don, Bit, RIB…</button>`}
        ${ui.give ? `<button class="btn gold sm full" data-act="give-here" data-id="${b.id}">${ICON.check}<span>J’ai donné ${money(tz)} ici</span></button>` : ''}
      </div>`;
    }).join('')}
    </div>
  </section>`;
};

async function runMethod(b, m) {
  const copy = async (txt, msg) => { try { await navigator.clipboard.writeText(txt); toast(msg); } catch { prompt('Copiez :', txt); } };
  const launchApp = (pkg) => { location.href = `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${pkg};end`; };
  if (m === 'site') window.open(b.donateUrl || b.website, '_blank', 'noopener');
  else if (m === 'phone') location.href = `tel:${b.phone.replace(/[^\d+]/g, '')}`;
  else if (m === 'bit') { await copy(b.bit, 'Numéro Bit copié — collez-le dans Bit'); if (/android/i.test(navigator.userAgent)) launchApp('com.bnhp.payments.paymentsapp'); }
  else if (m === 'paybox') { await copy(b.paybox, 'Numéro PayBox copié'); if (/android/i.test(navigator.userAgent)) launchApp('com.payboxapp'); }
  else if (m === 'bank') {
    openSheet(`<h3 class="sheet-title">${esc(b.name)}</h3><p class="hint">Coordonnées bancaires</p>
      <pre class="bank">${esc(b.bank)}</pre>
      <div class="form-actions"><button class="btn ghost grow" data-copy>Copier</button>
        ${ui.give ? `<button class="btn gold grow" data-done>${ICON.check}<span>Virement fait</span></button>` : ''}</div>`, (root) => {
      $('[data-copy]', root).onclick = () => copy(b.bank, 'Coordonnées copiées');
      $('[data-done]', root)?.addEventListener('click', () => confirmGive(b, 'bank'));
    });
    return;
  }
  if (ui.give) setTimeout(() => confirmGive(b, m), 400);
}

const METHOD_PAY = { site: 'card', bit: 'bit', paybox: 'paybox', bank: 'transfer', phone: 'card', here: 'cash' };

function confirmGive(b, m) {
  const amount = S().tzedaka.amount;
  openSheet(`<div class="confirm">
      <div class="confirm-he" lang="he">צדקה</div>
      <h3 class="sheet-title">Don effectué&nbsp;?</h3>
      <p>Confirmez le don de <b>${money(amount)}</b> à <b>${esc(b.name)}</b>. Il sera enregistré dans vos dons et le compteur de tsédaka sera remis à zéro.</p>
      <div class="field"><span>Reçu Sif 46</span>${seg('sif46', SIF, 'none')}</div>
      <div class="form-actions"><button class="btn ghost" data-no>Pas encore</button><button class="btn gold grow" data-yes>${ICON.check}<span>Oui, valider</span></button></div>
    </div>`, (root) => {
    $('[data-no]', root).onclick = () => closeSheet();
    $('[data-yes]', root).onclick = async () => {
      const sif = $('input[name="sif46"]:checked', root).value;
      store.update((s) => {
        s.donations.push({
          id: uid(), date: todayISO(), amount, beneficiaryId: b.id, beneficiaryName: b.name, beneficiaryType: b.type,
          sif46: sif, payment: METHOD_PAY[m] || 'other', recurring: null, remark: 'Tsédaka quotidienne',
          attachments: [], source: 'tzedaka', createdAt: Date.now(),
        });
        s.tzedaka = { amount: 0, since: null, log: [] };
      }, { silent: true });
      ui.give = false;
      await closeSheet();
      toast(`Tsédaka de ${money(amount)} versée à ${b.name}`);
      go('dons');
    };
  });
}

function openBeneficiaryForm(b = null) {
  const x = { name: '', type: 'association', donateUrl: '', website: '', bit: '', paybox: '', phone: '', bank: '', notes: '', ...(b || {}) };
  openSheet(`<form class="form" id="ben-form" novalidate>
      <h3 class="sheet-title">${b ? 'Modifier' : 'Nouveau bénéficiaire'}</h3>
      <label class="field"><span>Nom</span><input name="name" value="${esc(x.name)}" required placeholder="Ex. Yad Sarah"></label>
      <div class="field"><span>Type</span>${seg('type', { association: 'Association', person: 'Personne' }, x.type)}</div>
      <label class="field"><span>Lien de don en ligne</span><input type="url" name="donateUrl" value="${esc(x.donateUrl)}" placeholder="https://…"></label>
      <label class="field"><span>Site internet</span><input type="url" name="website" value="${esc(x.website)}" placeholder="https://…"></label>
      <div class="grid2">
        <label class="field"><span>Numéro Bit</span><input type="tel" name="bit" value="${esc(x.bit)}" placeholder="05x-xxx-xxxx"></label>
        <label class="field"><span>Numéro PayBox</span><input type="tel" name="paybox" value="${esc(x.paybox)}"></label>
      </div>
      <label class="field"><span>Téléphone</span><input type="tel" name="phone" value="${esc(x.phone)}"></label>
      <label class="field"><span>Coordonnées bancaires</span><textarea name="bank" rows="3" placeholder="Banque, agence, compte, bénéficiaire, IBAN…">${esc(x.bank)}</textarea></label>
      <label class="field"><span>Notes</span><textarea name="notes" rows="2">${esc(x.notes)}</textarea></label>
      <div class="form-actions">
        ${b && b.id !== 'pauvre' ? `<button type="button" class="btn danger-ghost" data-del>${ICON.trash}<span>Supprimer</span></button>` : ''}
        <button class="btn gold grow" type="submit">${ICON.check}<span>Enregistrer</span></button>
      </div></form>`, (root) => {
    const f = $('#ben-form', root);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = f.elements.name.value.trim();
      if (!name) return toast('Indiquez un nom');
      const dup = findBeneficiary(name);
      if (dup && dup.id !== b?.id) return toast('Ce bénéficiaire existe déjà');
      const fixUrl = (u) => (u && !/^https?:\/\//i.test(u) ? 'https://' + u : u);
      const data = {
        id: b?.id || uid(), name, type: f.elements.type.value,
        donateUrl: fixUrl(f.elements.donateUrl.value.trim()), website: fixUrl(f.elements.website.value.trim()),
        bit: f.elements.bit.value.trim(), paybox: f.elements.paybox.value.trim(), phone: f.elements.phone.value.trim(),
        bank: f.elements.bank.value.trim(), notes: f.elements.notes.value.trim(),
      };
      store.update((s) => {
        const i = s.beneficiaries.findIndex((y) => y.id === data.id);
        if (i >= 0) s.beneficiaries[i] = data; else s.beneficiaries.push(data);
        for (const d of s.donations) if (d.beneficiaryId === data.id) { d.beneficiaryName = data.name; d.beneficiaryType = data.type; }
      });
      await closeSheet();
      toast('Enregistré');
    });
    $('[data-del]', f)?.addEventListener('click', async () => {
      const n = usageCount(b.id);
      if (!confirm(n ? `Supprimer ${b.name} ? Ses ${n} don(s) resteront dans l’historique.` : `Supprimer ${b.name} ?`)) return;
      store.update((s) => { s.beneficiaries = s.beneficiaries.filter((y) => y.id !== b.id); });
      await closeSheet();
    });
  });
}

// ---------- Vue : Maasser ----------
views.maaser = () => {
  const s = stats(ui.year);
  const st = S().settings;
  const incomes = S().incomes.filter((i) => i.date.startsWith(String(ui.year))).sort((a, b) => b.date.localeCompare(a.date));
  const ratio = s.due ? Math.min(1, s.total / s.due) : 0;
  const C = 2 * Math.PI * 54;
  return `<section class="page">
    <div class="list-head"><h2 class="title">Maasser</h2>${yearPicker()}</div>
    <div class="maaser-hero">
      <svg class="ring" viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r="54" class="ring-bg"/>
        <circle cx="64" cy="64" r="54" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ratio)}" transform="rotate(-90 64 64)"/>
      </svg>
      <div class="ring-center"><span class="ring-pct">${pct(s.pct)}</span><span class="ring-sub">sur ${st.maaserRate}&nbsp;%</span></div>
    </div>
    <div class="tiles">
      <div class="tile"><span class="tile-label">Revenus perçus</span><span class="tile-value">${money(s.income)}</span></div>
      <div class="tile"><span class="tile-label">Maasser dû (${st.maaserRate}&nbsp;%)</span><span class="tile-value">${money(s.due)}</span></div>
      <div class="tile"><span class="tile-label">Donné à date</span><span class="tile-value">${money(s.total)}</span></div>
      <div class="tile ${s.remaining > 0 ? 'gold-tile' : 'ok-tile'}"><span class="tile-label">${s.remaining > 0 ? 'Reste à distribuer' : 'Accompli'}</span>
        <span class="tile-value">${money(s.remaining > 0 ? s.remaining : s.total - s.due)}</span></div>
    </div>
    ${quoteCard(['maaser'])}
    <button class="btn gold big full" data-act="new-income">${ICON.plus}<span>Ajouter un revenu</span></button>
    <h3 class="section-title">Revenus ${ui.year}</h3>
    ${incomes.length ? `<div class="card list">${incomes.map((i) => `<button class="income" data-act="edit-income" data-id="${i.id}">
        <span><span class="income-src">${esc(i.remark || 'Revenu')}</span><span class="don-meta">${esc(fmtDate(i.date))}</span></span>
        <span class="income-side"><span class="don-amount">${money(i.amount)}</span><span class="don-meta">maasser ${money((i.amount * st.maaserRate) / 100)}</span></span>
      </button>`).join('')}</div>` : `<div class="empty"><p class="muted">Aucun revenu saisi en ${ui.year}.</p></div>`}
  </section>`;
};

function openIncomeForm(inc = null) {
  const rate = S().settings.maaserRate;
  const x = { date: todayISO(), amount: '', remark: '', ...(inc || {}) };
  openSheet(`<form class="form" id="inc-form" novalidate>
      <h3 class="sheet-title">${inc ? 'Modifier le revenu' : 'Nouveau revenu'}</h3>
      <div class="grid2">
        <label class="field"><span>Date</span><input type="date" name="date" value="${x.date}"></label>
        <label class="field"><span>Montant reçu (₪)</span><input type="text" inputmode="decimal" name="amount" value="${x.amount}" class="amount-input" placeholder="0"></label>
      </div>
      <label class="field"><span>Source</span><input name="remark" value="${esc(x.remark)}" placeholder="Salaire, prime, loyer…"></label>
      <div class="maaser-preview">Maasser à donner (${rate}&nbsp;%)&nbsp;: <b data-prev>${money(((parseAmount(x.amount) || 0) * rate) / 100)}</b></div>
      <div class="form-actions">
        ${inc ? `<button type="button" class="btn danger-ghost" data-del>${ICON.trash}<span>Supprimer</span></button>` : ''}
        <button class="btn gold grow" type="submit">${ICON.check}<span>Enregistrer</span></button>
      </div></form>`, (root) => {
    const f = $('#inc-form', root);
    f.elements.amount.addEventListener('input', () => { $('[data-prev]', f).textContent = money(((parseAmount(f.elements.amount.value) || 0) * rate) / 100); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = parseAmount(f.elements.amount.value);
      if (!(amount > 0)) return toast('Indiquez un montant');
      const data = { id: inc?.id || uid(), date: f.elements.date.value || todayISO(), amount, remark: f.elements.remark.value.trim() };
      store.update((s) => {
        const i = s.incomes.findIndex((y) => y.id === data.id);
        if (i >= 0) s.incomes[i] = data; else s.incomes.push(data);
      });
      await closeSheet();
      toast(`Revenu enregistré · maasser ${money((amount * rate) / 100)}`);
    });
    $('[data-del]', f)?.addEventListener('click', async () => {
      if (!confirm('Supprimer ce revenu ?')) return;
      store.update((s) => { s.incomes = s.incomes.filter((y) => y.id !== inc.id); });
      await closeSheet();
    });
  });
}

// ---------- Réglages & sauvegarde ----------
function openSettings() {
  const st = S().settings;
  openSheet(`<form class="form" id="set-form">
      <h3 class="sheet-title">Réglages</h3>
      <div class="grid2">
        <label class="field"><span>Taux remboursement Sif 46 (%)</span><input type="text" inputmode="decimal" name="taxRate" value="${st.taxRate}"></label>
        <label class="field"><span>Taux du maasser (%)</span><input type="text" inputmode="decimal" name="maaserRate" value="${st.maaserRate}"></label>
      </div>
      <button class="btn gold full" type="submit">${ICON.check}<span>Enregistrer les taux</span></button>
      <h4 class="section-title">Sauvegarde</h4>
      <p class="hint">Vos données restent sur ce téléphone. Exportez régulièrement une sauvegarde (reçus inclus).</p>
      <div class="stack">
        <button type="button" class="btn ghost full" data-export>Exporter une sauvegarde (.json)</button>
        <label class="btn ghost full">Restaurer une sauvegarde<input type="file" accept="application/json,.json" hidden data-import></label>
        <button type="button" class="btn ghost full" data-csv>Exporter les dons ${ui.year} (.csv)</button>
        <button type="button" class="btn danger-ghost full" data-wipe>Effacer toutes les données</button>
      </div>
      <p class="colophon" lang="he">נ נח נחמ נחמן מאומן</p>
    </form>`, (root) => {
    const f = $('#set-form', root);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tr = parseAmount(f.elements.taxRate.value);
      const mr = parseAmount(f.elements.maaserRate.value);
      store.update((s) => {
        if (tr >= 0 && tr <= 100) s.settings.taxRate = tr;
        if (mr >= 0 && mr <= 100) s.settings.maaserRate = mr;
      });
      await closeSheet();
      toast('Réglages enregistrés');
    });
    $('[data-export]', f).onclick = exportBackup;
    $('[data-csv]', f).onclick = exportCSV;
    $('[data-import]', f).onchange = (e) => importBackup(e.target.files[0]);
    $('[data-wipe]', f).onclick = async () => {
      if (!confirm('Effacer TOUTES les données (dons, revenus, reçus) ? Cette action est définitive.')) return;
      if (!confirm('Vraiment ? Pensez à exporter une sauvegarde avant.')) return;
      for (const id of await allFileIds()) await deleteFile(id);
      store.replace(null);
      await closeSheet();
      toast('Données effacées');
    };
  });
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function exportBackup() {
  const files = {};
  for (const d of S().donations) for (const a of d.attachments || []) {
    const blob = await getFile(a.id);
    if (blob) files[a.id] = await blobToDataURL(blob);
  }
  const data = { app: 'tsedaka', exportedAt: new Date().toISOString(), state: S(), files };
  download(`tsedaka-sauvegarde-${todayISO()}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'tsedaka' || !data.state) throw new Error('format');
    if (!confirm('Remplacer les données actuelles par cette sauvegarde ?')) return;
    for (const [id, url] of Object.entries(data.files || {})) await putFile(id, await dataURLToBlob(url));
    store.replace(data.state);
    await closeSheet();
    toast('Sauvegarde restaurée');
  } catch {
    toast('Fichier de sauvegarde invalide');
  }
}

function exportCSV() {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Date', 'Montant', 'Bénéficiaire', 'Type', 'Sif 46', 'Paiement', 'Récurrence', 'Remarque'].map(q).join(';')];
  for (const d of S().donations) for (const o of occurrences(d).filter((x) => x.startsWith(String(ui.year)))) {
    const b = getBeneficiary(d.beneficiaryId);
    lines.push([o, String(d.amount).replace('.', ','), b?.name || d.beneficiaryName, (b?.type || d.beneficiaryType) === 'person' ? 'Personne' : 'Association',
      SIF[d.sif46], PAYMENTS[d.payment], d.recurring ? FREQ[d.recurring.freq] : '', d.remark].map(q).join(';'));
  }
  download(`dons-${ui.year}.csv`, new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }));
}

// ---------- Actions (délégation d'événements) ----------
const actions = {
  'close-sheet': () => closeSheet(),
  'next-quote': (el) => {
    quoteShift[el.dataset.key] = (quoteShift[el.dataset.key] || 0) + 1;
    const tmp = document.createElement('div');
    tmp.innerHTML = quoteCard(el.dataset.key.split('+'), el.classList.contains('compact'));
    el.replaceWith(tmp.firstElementChild);
  },
  goto: (el) => go(el.dataset.view),
  settings: () => openSettings(),
  'new-don': () => openDonationForm(),
  voice: () => openVoice(),
  'edit-don': (el) => openDonationForm({ id: el.dataset.id }),
  'cycle-sif': (el) => {
    const next = { none: 'pending', pending: 'received', received: 'none' };
    let label = '';
    store.update((s) => {
      const d = s.donations.find((x) => x.id === el.dataset.id);
      d.sif46 = next[d.sif46] || 'none';
      label = SIF[d.sif46];
    });
    vibrate();
    toast(`Sif 46 : ${label}`);
  },
  year: (el) => { ui.year += +el.dataset.d; render(); },
  'tz-add': (el) => { const v = +el.dataset.v; tzAdd(v); vibrate(8); dropCoin(el); updateTzAmount(); },
  'tz-undo': () => { if (!S().tzedaka.log.length) return toast('Rien à annuler'); tzUndo(); },
  'tz-reset': () => { if (S().tzedaka.amount && confirm('Remettre le compteur de tsédaka à zéro ?')) tzReset(); },
  'tz-pay': () => {
    const amount = S().tzedaka.amount;
    if (!amount) return toast('Le compteur est vide');
    openDonationForm({ amount, payment: 'cash', remark: 'Tsédaka quotidienne', source: 'tzedaka', beneficiaryType: 'person' }, {
      title: 'Verser la tsédaka',
      onSaved: () => { tzReset(); toast(`Tsédaka de ${money(amount)} versée · compteur remis à zéro`); },
    });
  },
  'tz-give': () => {
    if (!S().tzedaka.amount) return toast('Le compteur est vide');
    ui.give = true;
    go('donner');
  },
  'give-cancel': () => { ui.give = false; go('tsedaka'); },
  'give-here': (el) => confirmGive(getBeneficiary(el.dataset.id), 'here'),
  method: (el) => runMethod(getBeneficiary(el.dataset.id), el.dataset.m),
  'new-benef': () => openBeneficiaryForm(),
  'edit-benef': (el) => openBeneficiaryForm(getBeneficiary(el.dataset.id)),
  'new-income': () => openIncomeForm(),
  'edit-income': (el) => openIncomeForm(S().incomes.find((i) => i.id === el.dataset.id)),
};

document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) return go(tab.dataset.view);
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.stopPropagation();
  actions[el.dataset.act]?.(el, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('article.don')) actions['edit-don'](e.target);
});
document.addEventListener('input', (e) => {
  if (e.target.dataset.input === 'search') { ui.search = e.target.value; renderDonList(); }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.change === 'year') { ui.year = +e.target.value; render(); }
});

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
