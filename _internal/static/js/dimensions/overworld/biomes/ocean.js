biomeRegistry.register({
    id: 'ocean',
    name: 'Océan',
    surfaceBlock: 9,
    subSurfaceBlock: 9,
    stoneBlock: 1,

    baseHeight: 8,        // Creuse progressivement sous le niveau de la mer (Y=12)
    elevationScale: 3,
    detailScale: 1,

    generateDecorations: function(world, x, surfaceY, z, perlin) {}
});