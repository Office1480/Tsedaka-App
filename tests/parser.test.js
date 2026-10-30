import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDonation, wordsToDigits, isYes, isNo } from '../js/parser.js';

const today = new Date(2026, 9, 30); // 30 octobre 2026
const beneficiaries = [
  { id: 'pauvre', name: 'Pauvre', type: 'person' },
  { id: 'ys', name: 'Yad Sarah', type: 'association' },
];
const p = (s) => parseDonation(s, { beneficiaries, today });

test('exemple principal', () => {
  const r = p("le 16 février j'ai donné 2000 shekels pour l'association XYZ et j'attends le CIF 46");
  assert.equal(r.date, '2026-02-16');
  assert.equal(r.amount, 2000);
  assert.equal(r.beneficiaryName, 'XYZ');
  assert.equal(r.beneficiaryType, 'association');
  assert.equal(r.beneficiaryId, null);
  assert.equal(r.sif46, 'pending');
});

test('récurrent, bénéficiaire connu, Sif reçu', () => {
  const r = p("j'ai donné 150 shekels par mois à Yad Sarah, j'ai reçu le sif 46");
  assert.equal(r.amount, 150);
  assert.equal(r.beneficiaryId, 'ys');
  assert.deepEqual(r.recurring, { freq: 'monthly', end: null });
  assert.equal(r.payment, 'standing');
  assert.equal(r.sif46, 'received');
});

test('pauvre avec nom en remarque', () => {
  const r = p("hier 50 shekels à un pauvre qui s'appelle Moshe");
  assert.equal(r.date, '2026-10-29');
  assert.equal(r.amount, 50);
  assert.equal(r.beneficiaryId, 'pauvre');
  assert.equal(r.remark, 'Moshe');
  assert.equal(r.sif46, 'none');
});

test('nombres en lettres + yeshiva', () => {
  const r = p('deux mille cinq cents shekels pour la yeshiva Or Hahaim le 3 mars par virement');
  assert.equal(r.amount, 2500);
  assert.equal(r.date, '2026-03-03');
  assert.equal(r.beneficiaryName, 'Yeshiva Or Hahaim');
  assert.equal(r.payment, 'transfer');
});

test('pas de sif, milliers avec espace', () => {
  const r = p("le 1er janvier 1 500 shekels à l'association Ezra pas de sif 46");
  assert.equal(r.amount, 1500);
  assert.equal(r.date, '2026-01-01');
  assert.equal(r.beneficiaryName, 'Ezra');
  assert.equal(r.sif46, 'none');
});

test('date future lointaine = année précédente', () => {
  const r = p('le 20 décembre 300 shekels pour Kupat Ha Ir');
  assert.equal(r.date, '2025-12-20');
  assert.equal(r.beneficiaryName, 'Kupat Ha Ir');
});

test('46 shekels est un montant, pas un Sif', () => {
  const r = p('46 shekels à Yad Sarah');
  assert.equal(r.amount, 46);
  assert.equal(r.sif46, 'none');
});

test('nombres', () => {
  assert.equal(wordsToDigits('quatre vingt dix sept'), '97');
  assert.equal(wordsToDigits('soixante et onze'), '71');
  assert.equal(wordsToDigits('un pauvre'), 'un pauvre');
});

test('oui / non', () => {
  assert.ok(isYes("Oui c'est bon"));
  assert.ok(isNo('non, corrige'));
  assert.ok(!isYes('non'));
});
