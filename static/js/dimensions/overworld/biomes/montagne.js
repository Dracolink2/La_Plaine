overworldBiomeRegistry.register({
    id: 'montagne',
    name: 'Montagnes',
    surfaceBlock: 17,
    subSurfaceBlock: 17,
    stoneBlock: 17,

    baseHeight: 24,
    elevationScale: 20,
    detailScale: 5,

    ambiance: { tint: 0xd8e2ee, fogDensity: 0.82 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (surfaceY >= 38) {
            world.setBlock(x, surfaceY, z, 12);
            if (surfaceY >= 42 && world.getBlock(x, surfaceY + 1, z) === 0) {
                world.setBlock(x, surfaceY + 1, z, 12);
            }
        }
    }
});
