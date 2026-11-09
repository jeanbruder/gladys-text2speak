# Intégration Gladys Assistant – Text2Speak

Cette intégration ajoute une action de scène Gladys permettant de diffuser un message vocal avec [Text2Speak](https://github.com/jeanbruder/Text2Speak), un serveur TTS multi-pièces.

## Fonctionnalités

- Envoi du texte vers `POST /dire`.
- Prise en charge des variables de scène Gladys : le cœur Gladys résout les variables avant d'appeler l'intégration.
- Priorité Text2Speak de 0 à 9 (0 = priorité la plus urgente, 9 = la moins urgente).
- Diffusion vers une pièce, plusieurs pièces ou une zone Text2Speak.
- Si le champ des cibles est laissé vide, Text2Speak applique sa cible par défaut.
- Vérification des pièces et zones via `GET /pieces` avant l'envoi lorsqu'une cible est indiquée.
- Bouton de test de connexion dans la configuration de l'intégration.

## Prérequis

- Gladys Assistant 5.1.0 ou ultérieur.
- Un serveur Text2Speak démarré et accessible depuis le conteneur de l'intégration.
- Docker avec prise en charge de l'architecture de l'hôte (image publiée pour `linux/amd64` et `linux/arm64`).

Text2Speak ne fournit pas d'authentification dans sa version actuelle. Gardez son API sur un réseau local de confiance et ne l'exposez pas directement à Internet.

## Installation

1. Installez l'intégration depuis le catalogue Gladys ou depuis l'URL du dépôt GitHub.
2. Ouvrez l'onglet Configuration de l'intégration.
3. Renseignez l'adresse complète de l'API, par exemple `http://192.168.1.50:1337`.
4. Laissez le délai HTTP à 5 secondes ou adaptez-le si nécessaire.
5. Cliquez sur **Tester la connexion Text2Speak**. Le résultat indique le nombre de pièces et de zones détectées.

L'adresse doit être joignable depuis le réseau du conteneur Gladys. Si Text2Speak tourne sur un autre Rock64, utilisez son adresse IP ou son nom DNS local, pas `localhost`.

## Utilisation dans une scène

Ajoutez l'action **Intégrations → Text2Speak → Diffuser un message vocal avec Text2Speak**.

### Message

Saisissez le texte à prononcer. Les variables Gladys disponibles dans l'éditeur de scène peuvent être insérées dans ce champ. Gladys les remplace avant l'appel à l'intégration.

Exemple :

`Attention, la température du salon est de {{variable_de_temperature}} degrés.`

La syntaxe exacte d'une variable dépend du déclencheur et des étapes précédentes de votre scène ; utilisez le sélecteur de variables de l'éditeur Gladys.

### Priorité

Nombre entier de 0 à 9 :

| Valeur | Signification |
|---:|---|
| 0 | Urgence maximale |
| 1–3 | Très prioritaire |
| 4–6 | Normal |
| 7–9 | Faible priorité |

À priorité égale, Text2Speak conserve l'ordre d'arrivée. Une annonce urgente passe devant les annonces en attente, mais n'interrompt pas celle qui est déjà en cours de lecture.

### Pièces et zones

Saisissez un ou plusieurs noms séparés par des virgules, par exemple :

- `salon`
- `cuisine, salon`
- `rez_de_chaussee`
- `maison`

Les noms doivent correspondre aux clés déclarées dans `pieces.yml` de Text2Speak. Les noms sont insensibles à la casse. Les espaces autour des virgules sont ignorés.

L'intégration vérifie les noms via `GET /pieces`. Les listes de choix des champs d'action de scène Gladys étant déclaratives, le champ cible est un champ texte validé à l'exécution plutôt qu'une liste déroulante dynamique.

Si le champ est vide, la propriété `cibles` est omise de la requête : Text2Speak utilise alors sa cible `defaut`.

## API utilisée

Pour une action configurée avec le message `Le repas est prêt`, la priorité `5` et la cible `maison`, l'intégration envoie :

```json
{
  "dire": "Le repas est prêt",
  "priorite": 5,
  "cibles": ["maison"]
}
```

L'API Text2Speak répond normalement avec HTTP `202 Accepted` et un identifiant de tâche. Cela signifie que le message a été accepté dans la file d'attente, pas que sa lecture est déjà terminée.

L'action expose deux sorties de scène :
- `job_id` : identifiant de la tâche Text2Speak ;
- `queue_position` : position renvoyée dans la file au moment de l'acceptation.

L'intégration ne surveille pas ensuite la fin de lecture. Le suivi reste accessible par l'API Text2Speak `GET /file/<id>`.

## Dépannage

- **Impossible de joindre Text2Speak** : vérifiez l'adresse IP, le port `1337`, le réseau Docker et les règles de pare-feu.
- **Cible inconnue** : vérifiez les clés `pieces` et `zones` de `config/pieces.yml` et redémarrez Text2Speak après modification de ce fichier.
- **HTTP 413** : le texte dépasse la limite `TTS_TEXT_MAX_CHARS` de Text2Speak (500 caractères par défaut).
- **HTTP 503** : la file d'attente Text2Speak est pleine.
- **Connexion réussie mais aucune diffusion** : consultez les journaux et l'endpoint `GET /file/<id>` de Text2Speak pour connaître le statut de lecture par pièce.

## Développement et publication

Voir le `README.md` à la racine du dépôt pour les tests, la construction Docker et la publication sur GitHub Container Registry.
