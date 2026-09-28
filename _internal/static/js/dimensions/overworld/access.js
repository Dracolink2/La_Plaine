// static/js/blocks/portal.js
// Bloc de cadre : à poser en rectangle plein (intérieur vide) pour activer un portail.
blockRegistry.register({
    id: 240,
    name: 'Bloc de Portail',
    textures: { all: '/static/textures/deepslate.png' }, // remplace par une texture dédiée si tu en crées une
    transparent: false
});

// Bloc généré automatiquement au centre d'un cadre complet : marcher dedans téléporte.
// isPlant:true => pas solide (traversable) et pas de logique de fluide/écoulement.
blockRegistry.register({
    id: 241,
    name: 'Portail',
    textures: { all: '/static/textures/water.png' }, // texture provisoire, remplace-la si tu veux un effet dédié
    transparent: true,
    alphaTest: 0.1,
    isPlant: true,
    lightLevel: 12,
    emitColor: 0x9b30ff
});