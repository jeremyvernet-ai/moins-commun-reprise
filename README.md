# Moins Commun Reprise — version spéciale déploiement gratuit

Cette version est pensée pour un déploiement **gratuit** avec :

- **Vercel** pour le site public statique
- **Supabase** pour la base de données, l'authentification et le stockage des images

## Pourquoi cette version ?

Ton ancienne version locale utilisait un serveur Node + SQLite + uploads locaux.
Pour un déploiement gratuit, ce n'est pas idéal, parce que le stockage local n'est pas fiable sur la plupart des offres gratuites.

Ici, tout repose sur Supabase :

- base Postgres hébergée
- comptes utilisateurs
- favoris
- upload de pochettes via Storage
- panneau admin protégé par les règles RLS

## Déploiement recommandé

- **Vercel Hobby** est gratuit pour les projets personnels. citeturn461697search0turn461697search3
- **Supabase Free** propose un projet gratuit pour démarrer. citeturn461697search2turn461697search8
- **Railway** n'est plus vraiment gratuit au long cours : la doc indique un essai avec crédit puis une offre payante/hobby. citeturn461697search1turn461697search4turn461697search7

## Étapes

### 1. Créer un projet Supabase

Dans Supabase :
- crée un nouveau projet
- ouvre l'éditeur SQL
- colle le contenu de `supabase/schema.sql`
- exécute le script

Ensuite dans **Storage** :
- crée un bucket nommé `covers`
- mets-le en **public**

### 2. Récupérer les clés

Dans Supabase > Settings > API, récupère :
- `Project URL`
- `anon public key`

Puis ouvre `public/config.example.js`, duplique-le en `public/config.js` et remplace les valeurs.

### 3. Tester en local

```bash
cd moins-commun-reprise-deploy-gratuit
python3 -m http.server 4173 -d public
```

Ouvre ensuite :

```bash
http://localhost:4173
```

### 4. Déployer sur Vercel

- crée un dépôt GitHub
- envoie ce projet dessus
- importe le dépôt dans Vercel
- le dossier racine peut rester tel quel
- le site sera déployé automatiquement

## Créer un compte admin

1. crée un compte depuis `/login`
2. dans Supabase, ouvre la table `profiles`
3. passe la colonne `is_admin` à `true` pour ton utilisateur

Ensuite ton compte verra `/admin` avec les formulaires de gestion.

## Ce que fait cette version

- page d'accueil avec recherche filtrée
- fiche morceau
- connexion / inscription
- espace compte
- favoris
- panneau admin
- gestion artistes / morceaux / relations
- upload de pochettes dans Supabase Storage

## Limites actuelles

- pas encore d'édition inline ultra avancée
- pas encore de commentaires
- pas encore de système de modération multi-rôles

## Fichiers importants

- `public/config.example.js` → modèle de config Supabase
- `public/supabase-app.js` → logique du site
- `supabase/schema.sql` → schéma complet + politiques de sécurité

Quand tu voudras, on pourra partir de cette base pour construire le vrai site section par section.
