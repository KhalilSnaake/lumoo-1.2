# 🛍️ Lumoo - Boutique Alimentaire & Légumes Frais (Mali)

Lumoo est une application e-commerce moderne conçue pour le marché Malien, permettant la vente de produits alimentaires de base (riz, sucre, huile) et de légumes frais avec un système de suivi de commande et de gestion logistique complet.

## 🚀 Fonctionnalités Clés

### 👤 Espace Client
- **Catalogue Dynamique** : Navigation par catégories (Alimentaire / Légumes).
- **Produits Populaires** : Section dédiée aux meilleures ventes avec badges "Top", "Promo", "Bio".
- **Détails Produits** : Informations complètes, photos réelles et sélection de quantité via Modal.
- **Composeur de Panier** : Interface guidée pour créer et valider son panier facilement.
- **Suivi de Commande** : Interface en temps réel pour suivre l'état de sa livraison avec code de sécurité unique.
- **Mon Compte** : Gestion du profil (nom, email, téléphone, mot de passe) et photo de profil personnalisée.

### 🛵 Espace Livreur
- **Mon Compte (Bord Livreur)** : Liste des missions assignées.
- **Preuve de Livraison** : Système de validation par code unique (4 chiffres) fourni par le client.
- **Contact Client** : Accès rapide aux informations de livraison.

### 👨‍💼 Tableau de Bord Administrateur
- **Statistiques (Dashboard)** : Visualisation du CA total, commandes du jour, panier moyen et répartition des ventes.
- **Gestion des Commandes** : Suivi, modification, annulation et assignation des livreurs.
- **Gestion du Catalogue** : Ajout/Modification de produits avec téléchargement d'images et gestion des stocks.
- **Gestion Excel** : Importation et Exportation complète du catalogue au format Excel (sécurisé via `exceljs`).
- **Publicités** : Système de bannières publicitaires gérables par position (Top, Middle, Footer).
- **Gestion Utilisateurs** : Création, modification et blocage de comptes (Admin, Client, Livreur).

### 💳 Paiements Mobiles (Mali)
- 🟠 Orange Money
- 🔵 Moov Money
- 🐧 Wave
- 💵 Paiement à la livraison (Cash)

## 🛠️ Stack Technique
- **Frontend** : React 19, TypeScript, Vite.
- **Styling** : Tailwind CSS 4.
- **Backend** : Supabase (PostgreSQL, Storage, Realtime).
- **Excel** : ExcelJS & read-excel-file.

## ⚙️ Installation Locale

1. **Cloner le projet** :
   ```bash
   git clone https://github.com/KhalilSnaake/Lumoo-app.git
   cd Lumoo-app
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement** :
   Créer un fichier `.env` à la racine :
   ```env
   VITE_SUPABASE_URL=votre_url_supabase
   VITE_SUPABASE_PUBLISHABLE_KEY=votre_cle_anon
   ```

4. **Lancer l'application** :
   ```bash
   npm run dev
   ```

## 🗄️ Configuration Supabase
Exécutez les fichiers SQL suivants dans votre SQL Editor :
1. `supabase-schema.sql` : Tables de base.
2. `notifications-schema.sql` : Système de notifications temps réel.
3. `update_schema.sql` : Nouvelles colonnes (images, stocks, pubs).

**Note** : Créez un bucket public nommé `images` dans Supabase Storage pour les photos.

## 📄 Licence
Propriété de KhalilSnaake - Lumoo App.
