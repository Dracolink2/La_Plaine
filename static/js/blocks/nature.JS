// Blocs existants
blockRegistry.register({ id: 1, name: 'Pierre', textures: { all: '/static/textures/stone.png' }, transparent: false });
blockRegistry.register({ id: 2, name: 'Terre', textures: { all: '/static/textures/dirt.png' }, transparent: false });
blockRegistry.register({ id: 3, name: 'Herbe', textures: { top: '/static/textures/grass_top.png', bottom: '/static/textures/dirt.png', sides: '/static/textures/grass_side.png' }, transparent: false });
blockRegistry.register({ id: 4, name: 'Bois', textures: { top: '/static/textures/oak_top.png', bottom: '/static/textures/oak_top.png', sides: '/static/textures/oak_side.png' }, transparent: false });
blockRegistry.register({ id: 5, name: 'Feuilles', textures: { all: '/static/textures/oak_leaves.png' }, transparent: true, alphaTest: 0.5 });

// Plantes & Décorations
blockRegistry.register({ id: 6, name: 'Haute Herbe', textures: { all: '/static/textures/tall_grass.png' }, transparent: true, alphaTest: 0.5, isPlant: true });
blockRegistry.register({ id: 7, name: 'Rose', textures: { all: '/static/textures/rose.png' }, transparent: true, alphaTest: 0.5, isPlant: true });
blockRegistry.register({ id: 8, name: 'Pissenlit', textures: { all: '/static/textures/dandelion.png' }, transparent: true, alphaTest: 0.5, isPlant: true });
blockRegistry.register({ id: 9, name: 'Sable', textures: { all: '/static/textures/sand.png' }, transparent: false });
blockRegistry.register({ id: 10, name: 'Cactus', textures: { top: '/static/textures/cactus_top.png', bottom: '/static/textures/cactus_bottom.png', sides: '/static/textures/cactus_side.png' }, transparent: true, alphaTest: 0.5 });

// Eau
blockRegistry.register({
    id: 11,
    name: 'Eau',
    textures: { all: '/static/textures/water.png' },
    transparent: true,
    alphaTest: 0.1,
    isFluid: true,
    viscosity: 1
});

// Neige
blockRegistry.register({
    id: 12,
    name: 'Neige',
    textures: { all: '/static/textures/neige.png' },
    transparent: false
});