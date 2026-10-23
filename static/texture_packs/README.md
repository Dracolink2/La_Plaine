# Packs de textures — La Plaine 0.2.5.0

Placez ici un fichier ZIP par pack. Les chemins internes peuvent reprendre ceux du jeu, par exemple `static/textures/grass/grass_top.png`, `textures/grass/grass_top.png` ou simplement `grass/grass_top.png`.

Un `manifest.json` à la racine est recommandé :

```json
{
  "id": "mon-pack",
  "name": "Mon pack",
  "description": "Une courte description.",
  "version": "1.0.0"
}
```

Toute texture absente du ZIP utilise automatiquement la texture originale. Les archives sont lues à la demande sans extraction sur disque.
