- Créer une route API pour la création de bot, sachant que :
  - Le token est stocké de façon hardcodée en .env,
  - La route doit supporter :
    - le nombre de shards au total,
    - le nombre de clusters (dans lesquels les shards seront réparties),
    - le code source du bot (au format .zip).
- Créer des routes API pour gérer les clusters :
  - Création, Démarrage, Redémarrage, Arrêt, Mise à jour, Suppression, Consultation d'état
  - Operation en bulk : liste d'identifiants de clusters
- Création d'un système permettant l'exécution de commande Docker (shell).
- Le bot doit également pouvoir être ajouté à partir d'un registry Docker suivant ce schéma :

`<registry>:<port=5000>/<repository>/<image>:<tag>`

Cela se présente sous la forme d'une variable d'environnement appelée `DOCKER_REGISTRY_IMAGE`
