# Tsédaka — mes dons, Sif 46 et Maasser

Application Android (PWA installable) pour gérer ses dons en toute simplicité, dans une ambiance Breslev.

## Fonctionnalités

- **Dons** : date, montant, bénéficiaire (association ou personne, mémorisés pour la fois suivante ; « Pauvre » préenregistré), statut **Sif 46** (pas de Sif 46 / en attente / reçu), moyen de paiement, remarque.
- **Dons récurrents** (mensuel / annuel, ex. 150 ₪ par mois en prélèvement automatique) : chaque échéance passée est comptée automatiquement.
- **Reçus** : sur chaque don, « Charger un fichier » (PDF, image) ou « Scanner » (ouvre la caméra). Les fichiers restent sur le téléphone.
- **Dictée vocale** : « Le 16 février j’ai donné 2000 shekels pour l’association XYZ et j’attends le Sif 46 ». L’app remplit tous les champs, relit à voix haute et demande confirmation : dire « oui » valide, « non » ouvre le formulaire pour corriger.
- **Synthèse** par année (année en cours par défaut) : total, avec / sans Sif 46, remboursement d’impôt espéré (33 %, réglable), cumul par bénéficiaire.
- **Maasser** : saisie des revenus perçus, 10 % dû (réglable), pourcentage réellement donné et reste à distribuer.
- **Donner** : pour chaque bénéficiaire, lien de don en ligne, site, Bit, PayBox, téléphone, coordonnées bancaires — en un clic.
- **Tsédaka quotidienne** : pièces de 1, 2, 5, 10 ₪ et billets de 20, 50, 100 ₪ qui s’ajoutent à une boîte de tsédaka. Ensuite « Verser cette tsédaka » (formulaire prérempli) ou « Donner cet argent » (choix du bénéficiaire, ouverture de son lien, puis validation). Le don est enregistré et le compteur remis à zéro.
- **Sauvegarde** : export / restauration JSON (reçus inclus) et export CSV des dons de l’année, dans les Réglages.

Les données vivent sur le téléphone (localStorage + IndexedDB) et sont **sauvegardées automatiquement sur Google Drive** : après chaque modification, une copie complète (dons, revenus, bénéficiaires, reçus) part dans un dossier « Tsédaka » de votre Drive. Sur un nouveau téléphone : Réglages → *Restaurer depuis Drive*. L’icône nuage en haut indique l’état (vert = sauvegardé, orange = en attente : la toucher sauvegarde).

L’app utilise la permission `drive.file` : elle ne voit **que les fichiers qu’elle a créés**, pas le reste de votre Drive.

## Activer la sauvegarde Google Drive (une seule fois, ~5 min)

1. Aller sur https://console.cloud.google.com/ et créer un projet (ex. « Tsedaka »).
2. *API et services → Bibliothèque* : activer **Google Drive API**.
3. *API et services → Écran de consentement OAuth* : type **Externe**, nom « Tsédaka », votre e-mail ; dans *Utilisateurs test*, ajouter votre adresse Gmail.
4. *API et services → Identifiants → Créer des identifiants → ID client OAuth* : type **Application Web**. Dans *Origines JavaScript autorisées*, ajouter :
   - `http://localhost:5180` (tests sur le PC)
   - `https://<votre-compte>.github.io` (l’app en ligne)
5. Copier l’**ID client** (`…apps.googleusercontent.com`) et le coller dans l’app : Réglages → Sauvegarde Google Drive. (Ou le mettre dans `js/config.js` pour tous les appareils.)
6. Toucher **Connecter Google Drive** et accepter.

Google exige HTTPS : sur le téléphone, la sauvegarde Drive (comme la dictée) fonctionne avec l’adresse GitHub Pages, pas avec l’adresse locale `http://192.168…`.

## Lancer en local

```bash
npm start
```

Puis ouvrir http://localhost:5180. Tests du décodeur vocal : `npm test`.

## Installer sur Android

La PWA doit être servie en **HTTPS** (le micro et l’installation l’exigent). Le plus simple : GitHub Pages.

1. Pousser ce dépôt sur GitHub, puis *Settings → Pages → Deploy from branch → `main` / root*.
2. Sur le téléphone, ouvrir l’URL dans **Chrome** → menu ⋮ → **Installer l’application** (ou « Ajouter à l’écran d’accueil »).
3. L’icône Tsédaka apparaît comme une application normale et fonctionne hors-ligne.

## Structure

```
index.html            page unique + barre d'onglets
css/style.css         design (parchemin, bleu royal, or)
js/app.js             interface : vues, formulaires, reçus, flux tsédaka
js/store.js           données, récurrences, statistiques
js/parser.js          décodage des phrases dictées (testé dans tests/)
js/voice.js           reconnaissance et synthèse vocale (Web Speech API)
js/files.js           stockage des reçus (IndexedDB)
sw.js                 service worker (hors-ligne)
tools/                serveur local et générateur d'icônes
```
