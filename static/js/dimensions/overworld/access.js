

blockRegistry.register({
    id: 240,
    name: 'Bloc de Portail',
    textures: { all: '/static/textures/deepslate.png' }, 
    transparent: false
});



blockRegistry.register({
    id: 241,
    name: 'Portail',
    textures: { all: '/static/textures/water.png' }, 
    transparent: true,
    alphaTest: 0.1,
    isPlant: true,
    lightLevel: 12,
    emitColor: 0x9b30ff
});


dimensionRegistry.register({
    id: 'overworld',
    name: 'La Plaine',
    biomeRegistry: window.overworldBiomeRegistry,
    portalTarget: 'aether'
});
