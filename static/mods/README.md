# Installer un mod — La Plaine 0.2.5.0

Créez un dossier par mod dans `mods/` à côté de l'application (ou dans `static/mods/` en mode développement). Chaque mod doit contenir un `manifest.json` et un fichier d'entrée JavaScript.

Exemple de `manifest.json` :

```json
{
  "id": "exemple",
  "name": "Mon premier mod",
  "description": "Ajoute un bloc de démonstration.",
  "version": "1.0.0",
  "api_version": "1",
  "entry": "main.js",
  "dependencies": []
}
```

Exemple de `main.js` :

```js
window.LaPlaineAPI.on("game:ready", ({ world, player }) => {
  console.log("Mon mod est prêt", world, player);
});

window.LaPlaineAPI.registerBlock({
  id: 9001,
  name: "Bloc de démonstration",
  textures: { all: "/static/textures/pierres/stone/stone.png" }
});
```

## À savoir

- Les mods sont chargés au démarrage d'une partie ; changer leur activation demande de revenir au menu puis de relancer le jeu.
- Les identifiants de blocs doivent être uniques et ne doivent pas entrer en conflit avec le jeu ou d'autres mods.
- Les scripts de mods s'exécutent dans le contexte JavaScript du jeu et ne sont **pas isolés**. N'installez que du code de confiance.
- Les points d'extension pour les comportements avancés (entités, recettes, événements et interfaces) restent à compléter avant de considérer l'API comme stable.
