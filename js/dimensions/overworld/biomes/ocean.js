overworldBiomeRegistry.register({
    id: 'ocean',
    name: 'Océan',
    surfaceBlock: 9,
    subSurfaceBlock: 9,
    stoneBlock: 1,

    baseHeight: 7,
    elevationScale: 4,
    detailScale: 1,

    ambiance: { tint: 0xc9e6ff, fogDensity: 0.72 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        // Le terrain est volontairement vide sous l'eau pour garder les océans légers.
    }
});
