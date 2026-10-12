overworldBiomeRegistry.register({
    id: 'plaine_enneigee',
    name: 'Plaine Enneigée',
    surfaceBlock: 13,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 18,
    elevationScale: 6,
    detailScale: 2,

    ambiance: { tint: 0xdcecff, fogDensity: 0.9 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const treeNoise = perlin.noise(x * 0.08, z * 0.08);
        if (treeNoise > 0.72 && ((x * 31 + z * 17) % 19 === 0)) {
            if (window.Generation?.generateTree) {
                window.Generation.generateTree(world, x, surfaceY + 1, z);
            }
            return;
        }

        const snowNoise = perlin.noise(x * 0.3, z * 0.3);
        if (snowNoise > -0.05) world.setBlock(x, surfaceY + 1, z, 14);
    }
});
