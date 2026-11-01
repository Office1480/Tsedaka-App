// Décodage d'une phrase dictée en français, ex. :
// « le 16 février j'ai donné 2000 shekels pour l'association XYZ et j'attends le Sif 46 »

const MONTHS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const NUM = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
  septante: 70, huitante: 80, octante: 80, nonante: 90,
};
const MULT = { cent: 100, cents: 100, mille: 1000, milles: 1000, million: 1e6, millions: 1e6 };
const CUR = "(?:shekels?|sheqels?|shequels?|chekels?|chequels?|schekels?|shekalim|shkalim|sicles?|nis|₪|euros?|€|dollars?)";
const STOP = "(?=\\s+(?:et|en|par|avec|via|chaque|tous|j'|je|il|on|qui|car|parce|pas|sans|aucun|pour)\\b|\\s*[,.;!?]|$)";

// Minuscules + sans accents, en gardant exactement la même longueur que l'original
// (permet de retrouver la casse d'origine d'un nom).
export function norm(s) {
  return Array.from(s)
    .map((ch) => {
      const c = ch.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return c[0] || ch;
    })
    .join('')
    .replace(/[’`´]/g, "'");
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function wordsValue(ws) {
  let total = 0, cur = 0;
  for (const w of ws) {
    if (w === 'et') continue;
    if (w in NUM) {
      if ((w === 'vingt' || w === 'vingts') && cur % 100 === 4) cur += 76; // quatre-vingt
      else cur += NUM[w];
    } else {
      const m = MULT[w];
      if (m === 100) cur = (cur || 1) * 100;
      else { total += (cur || 1) * m; cur = 0; }
    }
  }
  return total + cur;
}

export function wordsToDigits(t) {
  const toks = t.split(' ');
  const out = [];
  let i = 0;
  while (i < toks.length) {
    let j = i;
    const words = [];
    while (j < toks.length) {
      const w = toks[j];
      const etJoin = w === 'et' && words.length && ['un', 'une', 'onze'].includes(toks[j + 1]);
      if (w in NUM || w in MULT || etJoin) { words.push(w); j++; } else break;
    }
    // « un » / « une » seuls sont des articles (« un pauvre »), pas des nombres.
    if (words.length && !(words.length === 1 && (words[0] === 'un' || words[0] === 'une'))) {
      out.push(String(wordsValue(words)));
      i = j;
    } else {
      out.push(toks[i]);
      i++;
    }
  }
  return out.join(' ');
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function prettify(name) {
  name = name.trim().replace(/^[\s'"«»-]+|[\s'"«»,.-]+$/g, '');
  if (name !== name.toLowerCase()) return name.charAt(0).toUpperCase() + name.slice(1);
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et']);
  return name
    .split(' ')
    .map((w, i) => (i && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function parseDonation(text, { beneficiaries = [], today = new Date() } = {}) {
  const orig = String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const base = norm(orig);
  const fromBase = (cap) => {
    const idx = base.indexOf(cap);
    return idx >= 0 ? orig.slice(idx, idx + cap.length) : cap;
  };

  let t = base.replace(/(?<=[a-z])-(?=[a-z])/g, ' ');
  t = wordsToDigits(t);
  t = t.replace(/(\d)[   .](?=\d{3}\b)/g, '$1');
  t = t.replace(/(\d),(\d{1,2})\b/g, '$1.$2');
  t = t.replace(/(\d+(?:\.\d+)?)\s?k\b/g, (_, n) => String(Math.round(parseFloat(n) * 1000)));

  const r = {
    date: iso(today), amount: null, beneficiaryName: '', beneficiaryType: 'association',
    beneficiaryId: null, sif46: 'none', payment: null, recurring: null, remark: '', transcript: orig,
  };
  const cut = (re) => { t = t.replace(re, ' ').replace(/\s+/g, ' '); };

  // ----- Promesse (don à faire plus tard) -----
  const rePromise = /\b(?:j'ai promis|j'ai promi|je promets|je promet|promis|promesse|je dois donner|je vais donner|je donnerai|a donner)\b/;
  r.promise = rePromise.test(t);
  if (r.promise) cut(rePromise);

  // ----- Date -----
  const shift = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
  let m;
  if (/\bavant hier\b/.test(t)) { r.date = shift(-2); cut(/\bavant hier\b/); }
  else if (/\bhier\b/.test(t)) { r.date = shift(-1); cut(/\bhier\b/); }
  else if (/\baujourd'?hui\b/.test(t)) cut(/\baujourd'?hui\b/);
  const reMonth = new RegExp(`\\b(?:le |du |ce )?(\\d{1,2}|1er|premier)\\s+(?:de )?(${MONTHS.join('|')})(?:\\s+(20\\d{2})\\b(?!\\s*${CUR}))?`);
  if ((m = t.match(reMonth))) {
    const day = /^\d+$/.test(m[1]) ? +m[1] : 1;
    const mon = MONTHS.indexOf(m[2]);
    r.date = buildDate(day, mon, m[3] ? +m[3] : null, today) || r.date;
    cut(reMonth);
  } else if ((m = t.match(/\b(?:le )?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/))) {
    let y = m[3] ? +m[3] : null;
    if (y && y < 100) y += 2000;
    r.date = buildDate(+m[1], +m[2] - 1, y, today) || r.date;
    cut(/\b(?:le )?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  }

  // ----- Sif 46 -----
  const sifWord = /^(?:[a-z.]*f|article|section|cerfa|recu|formulaire|attestation)$/;
  let mentioned = false;
  const re46 = new RegExp(`(\\S+)\\s?-?\\s?\\b46\\b(?!\\s*${CUR})`);
  if ((m = t.match(re46))) {
    const prev = m[1];
    if (sifWord.test(prev) || ['le', 'la', 'du', 'de', 'un', 'mon', 'mes', 'son'].includes(prev)) {
      mentioned = true;
      const before = t.slice(Math.max(0, m.index - 30), m.index);
      r.sif46 = classifySif(t, before);
      t = (t.slice(0, m.index) + (sifWord.test(prev) ? '' : prev) + t.slice(m.index + m[0].length)).replace(/\s+/g, ' ');
    }
  }
  if (!mentioned && (m = t.match(/\b(cif|sif|seif|saif|syf|cerfa|cif46|sif46)\b/))) {
    r.sif46 = classifySif(t, t.slice(Math.max(0, m.index - 30), m.index));
    cut(/\b(cif|sif|seif|saif|syf|cerfa|cif46|sif46)\b/);
  }

  // ----- Récurrence -----
  if (/\b(par mois|chaque mois|tous les mois|mensuel(?:lement|le)?)\b/.test(t)) {
    r.recurring = { freq: 'monthly', end: null };
    cut(/\b(par mois|chaque mois|tous les mois|mensuel(?:lement|le)?)\b/);
  } else if (/\b(par an|chaque annee|tous les ans|annuel(?:lement|le)?)\b/.test(t)) {
    r.recurring = { freq: 'yearly', end: null };
    cut(/\b(par an|chaque annee|tous les ans|annuel(?:lement|le)?)\b/);
  }

  // ----- Moyen de paiement -----
  const PAY = [
    ['standing', /\b(?:par |en )?(?:prelevement(?: automatique)?|ordre permanent|hora'?at keva|horaat keva)\b/],
    ['transfer', /\b(?:par |en )?virement(?: bancaire)?\b/],
    ['card', /\b(?:par |en |avec (?:la |ma )?)?(?:carte(?: bancaire| de credit| bleue)?|cb)\b/],
    ['cash', /\b(?:en )?(?:especes|liquide|cash|billets?|pieces)\b/],
    ['check', /\b(?:par |en )?cheques?\b/],
    ['bit', /\b(?:par |via |avec |sur )?bit\b/],
    ['paybox', /\b(?:par |via |avec |sur )?pay ?box\b/],
  ];
  for (const [k, re] of PAY) if (re.test(t)) { r.payment = k; cut(re); break; }
  if (!r.payment && r.recurring) r.payment = 'standing';

  // ----- Remarque explicite -----
  if ((m = t.match(/\b(?:remarque|note|commentaire)\s*:?\s*(.+)$/))) {
    r.remark = fromBase(m[1].trim());
    t = t.slice(0, m.index);
  }

  // ----- Montant -----
  const reAmt = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${CUR}`);
  if ((m = t.match(reAmt))) {
    r.amount = parseFloat(m[1]);
    t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
  } else if ((m = t.match(/\b(\d+(?:\.\d+)?)\b/))) {
    r.amount = parseFloat(m[1]);
    t = t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length);
  }
  t = t.replace(/\s+/g, ' ').trim();

  // ----- Bénéficiaire -----
  const known = beneficiaries
    .filter((b) => norm(b.name).trim().length >= 3)
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => new RegExp(`(^|[^a-z0-9])${escapeRe(norm(b.name).trim())}s?($|[^a-z0-9])`).test(t));
  if (known) {
    r.beneficiaryId = known.id;
    r.beneficiaryName = known.name;
    r.beneficiaryType = known.type;
    const mm = t.match(new RegExp(`\\b(?:qui s'appelle|il s'appelle|elle s'appelle|nomme|appele|du nom de|prenomme)\\s+(.+?)${STOP}`));
    if (mm && !r.remark) r.remark = prettify(fromBase(mm[1]));
  } else {
    const patterns = [
      [new RegExp(`\\b(?:l'association|association|l'asso|asso|la fondation|fondation|l'organisation|organisation|l'organisme|organisme|l'oeuvre)\\s+(.+?)${STOP}`), 'association'],
      [new RegExp(`\\b(?:la |le |l')?((?:yeshiva|yechiva|yeshivat|kollel|colel|synagogue|beth|beit|talmud torah|ezrat|ohel|hevrat|kupat|kupa|keren)\\b.+?)${STOP}`), 'association'],
    ];
    for (const [re, type] of patterns) {
      if ((m = t.match(re))) { r.beneficiaryName = m[1]; r.beneficiaryType = type; break; }
    }
    if (!r.beneficiaryName) {
      const reTo = new RegExp(`\\b(?:pour|a|au|aux|chez|au profit de|en faveur de)\\s+(la |le |les |l'|un |une |mon |ma |mes )?(.+?)${STOP}`, 'g');
      for (const mm of t.matchAll(reTo)) {
        const cap = mm[2].trim();
        if (!cap || /^\d/.test(cap) || /^(donne|verse|paye|fait)\b/.test(cap)) continue;
        r.beneficiaryName = cap;
        const personal = /^(mon |ma |mes )/.test(mm[1] || '') || /^(monsieur|madame|mme|mr|m\.|rav|rabbi|rabbin|famille|cousin|cousine|frere|soeur|voisin|voisine)\b/.test(cap);
        r.beneficiaryType = personal ? 'person' : 'association';
        break;
      }
    }
    if (r.beneficiaryName) {
      r.beneficiaryName = prettify(fromBase(r.beneficiaryName.slice(0, 60)));
      const again = beneficiaries.find((b) => norm(b.name).trim() === norm(r.beneficiaryName).trim());
      if (again) { r.beneficiaryId = again.id; r.beneficiaryName = again.name; r.beneficiaryType = again.type; }
    }
  }

  // Motif d'une promesse : « … pour une montée à la Torah »
  if (r.promise && !r.remark) {
    const ben = norm(r.beneficiaryName || '').trim();
    for (const mm of t.matchAll(new RegExp(`\\bpour (?:une |un |la |le |les |l')?(.+?)${STOP}`, 'g'))) {
      const cap = mm[1].trim();
      if (!cap || /^\d/.test(cap) || (ben && cap.includes(ben)) || /^(l'association|association|l'asso)\b/.test(cap)) continue;
      const txt = fromBase(cap);
      r.remark = txt.charAt(0).toUpperCase() + txt.slice(1);
      break;
    }
  }

  r.missing = [];
  if (!r.amount) r.missing.push('amount');
  if (!r.beneficiaryName) r.missing.push('beneficiary');
  return r;
}

function classifySif(t, before) {
  if (/\b(pas|sans|aucun|aucune|non)\b/.test(before) && !/pas encore/.test(before)) return 'none';
  if (/(attend|attente|a recevoir|pas encore|demande|en cours)/.test(t)) return 'pending';
  if (/\b(recu|j'ai eu|obtenu|deja|eu le|ai le)\b/.test(t)) return 'received';
  return 'pending';
}

function buildDate(day, mon, year, today) {
  if (mon < 0 || mon > 11 || day < 1 || day > 31) return null;
  let y = year || today.getFullYear();
  let d = new Date(y, mon, Math.min(day, new Date(y, mon + 1, 0).getDate()));
  if (!year && d - today > 31 * 864e5) {
    y -= 1;
    d = new Date(y, mon, Math.min(day, new Date(y, mon + 1, 0).getDate()));
  }
  return iso(d);
}

export const isYes = (s) => /\b(oui|ouais|ok|okay|d'accord|valide|valider|c'est bon|c'est ca|exact|exactement|parfait|correct|confirme|yes|ken)\b/.test(norm(s));
export const isNo = (s) => /\b(non|pas du tout|corrige|corriger|modifier|faux|erreur|no|lo)\b/.test(norm(s));
