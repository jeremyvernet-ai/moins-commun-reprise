# Email automatique après inscription

## Recommandation

Pour Moins Commun, je recommande ce plan :

### Niveau 1 — rapide
Utiliser les emails d'authentification Supabase :
- confirmation d'inscription
- reset password
- templates personnalisés
- SMTP personnalisé

C'est le plus simple pour commencer.

### Niveau 2 — propre et pro
Ajouter un vrai email de bienvenue personnalisé :

1. l'utilisateur s'inscrit
2. Supabase déclenche un **Send Email Hook** ou une **Edge Function**
3. la fonction envoie un email via Resend
4. le message peut contenir :
   - bienvenue sur Moins Commun
   - lien vers les favoris
   - lien vers proposer un morceau
   - lien vers la page de connexion

## Exemple de contenu

Sujet :
`Bienvenue sur Moins Commun`

Contenu :
- merci pour l'inscription
- présentation rapide du site
- lien direct vers l'accueil
- lien vers proposer un morceau

## Pourquoi éviter un envoi direct depuis le navigateur

Le navigateur exposerait la clé d'envoi email.
Il faut donc envoyer les emails côté serveur / fonction.

## Stack recommandée

- Supabase Auth
- SMTP personnalisé ou Resend
- Edge Function Supabase pour le mail de bienvenue

## Mise en place possible

### Option A
Uniquement confirmation d'inscription Supabase.

### Option B
Confirmation Supabase + email de bienvenue personnalisé via Edge Function.

## Fichier à ajouter plus tard

- `supabase/functions/send-welcome-email/index.ts`
- secret `RESEND_API_KEY`
- configuration d'un hook d'envoi ou d'un flux post-inscription

## Quand le faire

Je te conseille :
1. terminer la v4
2. tester inscription / admin / favoris
3. ajouter ensuite l'email automatique
