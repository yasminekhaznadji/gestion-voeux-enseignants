#  Gestion des Vœux Pédagogiques

Application web permettant aux enseignants de soumettre leurs vœux pédagogiques (modules souhaités, heures supplémentaires, PFE) et aux chefs de département de les consulter, négocier et valider.

##  Fonctionnalités

- Authentification avec deux rôles distincts : `enseignant` et `chef_departement`
- Soumission de vœux : un enseignant choisit les modules qu'il souhaite enseigner (Cours / TD / TP) pour l'année
- Gestion des PFE : nombre de projets de fin d'études (licence/master) souhaités
- Système de messagerie interne entre enseignants et chef de département pour négocier les vœux
- Notifications en temps réel sur le statut des vœux (accepté, en négociation, refusé)
- Tableau de bord chef de département pour visualiser et gérer l'ensemble des vœux soumis

##  Technologies utilisées

- Backend : Node.js, Express.js
- Base de données : MySQL avec Sequelize (ORM)
- Authentification: JWT (JSON Web Tokens), bcrypt pour le hachage des mots de passe
- Frontend : HTML, CSS, JavaScript vanilla

##  Installation et lancement en local

### Prérequis
- [Node.js](https://nodejs.org) (v18 ou supérieur)
- [MySQL](https://dev.mysql.com/downloads/) installé et lancé

### Étapes

1. **Cloner le dépôt**
```bash
git clone https://github.com/yasminekhaznadji/gestion-voeux-enseignants.git
cd gestion-voeux-enseignants
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Créer la base de données**

Connecte-toi à MySQL :
```bash
mysql -u root -p
```

Puis crée la base et importe le schéma :
```sql
CREATE DATABASE gestion_voeux;
USE gestion_voeux;
SOURCE chemin/vers/gestion_voeux.sql;
```

4. **Configurer les variables d'environnement**

Crée un fichier `.env` à la racine du projet avec ce contenu :     
PORT=5000
JWT_SECRET=ton_secret_a_toi
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=ton_mot_de_passe_mysql
DB_NAME=gestion_voeux  


5. **Lancer le serveur**
```bash
node app.js
```

Le serveur démarre sur [http://localhost:5000](http://localhost:5000)

##  Notes

Ce projet a été réalisé dans un cadre académique. Les données de test présentes dans `gestion_voeux.sql` sont fictives.

                                                                                                                                                                                                                                                                   