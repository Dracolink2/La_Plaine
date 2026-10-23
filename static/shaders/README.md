# Packs de shaders — La Plaine V0.2.5.0

Dépose les packs au format `.zip` dans `static/shaders/`. Ils sont détectés par le bouton **Actualiser les shaders** dans Paramètres > Shaders. Le choix est sauvegardé dans le navigateur et appliqué au prochain lancement d’un monde.

Chaque ZIP doit contenir à sa racine :
- `manifest.json`
- `fragment.glsl` (ou le fichier indiqué par `fragment_shader`)
- éventuellement un vertex shader indiqué par `vertex_shader`

Exemple de manifeste :
```json
{
  "name": "Couleurs vives",
  "description": "Augmente la saturation et le contraste.",
  "version": "1.0.0",
  "fragment_shader": "fragment.glsl"
}
```

Le shader fragment reçoit `uniform sampler2D tDiffuse`, `uniform float uTime`, `uniform vec2 uResolution` et `varying vec2 vUv`. Il doit écrire le résultat dans `gl_FragColor`. Le vertex shader standard est fourni automatiquement si aucun `vertex_shader` n’est indiqué. Les shaders sont compilés par WebGL : un pack invalide est ignoré ou ne pourra pas être activé.
## Résolution du post-traitement

Dans Paramètres → Shaders, le réglage « Résolution des shaders » permet de choisir une échelle de 50 % à 100 %. Une échelle plus basse peut réduire le coût des shaders plein écran, avec une image moins nette. Le réglage est appliqué au prochain lancement du monde. La cible de post-traitement n’alloue pas de tampon de profondeur inutile.
