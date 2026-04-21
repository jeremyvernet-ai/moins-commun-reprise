# Moins Commun Reprise v4

Version 4 du site avec :
- ajout de morceaux depuis le site
- panneau d'administration
- favoris
- relations entre morceaux
- suppression du texte « version spéciale déploiement gratuit »

## Déploiement rapide

Le projet est statique et fonctionne avec Supabase + Vercel.

1. Importe le repo dans Vercel
2. Garde :
   - Framework preset : `Other`
   - Output directory : `public`
3. Vérifie que `public/config.js` contient tes clés Supabase
4. Déploie

## Fichiers importants

- `public/index.html` : accueil
- `public/song.html` : fiche morceau
- `public/login.html` : connexion / inscription
- `public/submit.html` : proposition d'un morceau
- `public/favorites.html` : favoris utilisateur
- `public/admin.html` : panneau admin
- `supabase/schema-v4.sql` : structure SQL et politiques RLS
- `docs/email-automatique.md` : mise en place d'un email automatique de bienvenue

## Email automatique après inscription

Je recommande 2 niveaux :

### Option simple
Utiliser les emails d'auth Supabase avec :
- confirmation d'inscription
- SMTP personnalisé
- template personnalisé

### Option plus pro
Créer un **Send Email Hook** ou une **Edge Function** Supabase connectée à Resend pour envoyer un vrai email de bienvenue personnalisé après création du compte.

Voir `docs/email-automatique.md`.
