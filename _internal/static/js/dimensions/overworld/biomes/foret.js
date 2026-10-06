overworldBiomeRegistry.register({
    id: 'foret',
    name: 'Forêt',
    surfaceBlock: 3,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 20,
    elevationScale: 8,
    detailScale: 3,

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const treeNoise = perlin.noise(x * 0.11, z * 0.11);
        if (treeNoise > 0.08 && ((x * 11 + z * 13) % 6 === 0)) {
            if (window.Generation?.generateTree) {
                window.Generation.generateTree(world, x, surfaceY + 1, z);
            }
            return;
        }

        const veg = perlin.noise(x * 0.38, z * 0.38);
        if (veg > 0.20) world.setBlock(x, surfaceY + 1, z, 6);
        else if (veg < -0.35) world.setBlock(x, surfaceY + 1, z, 7);
        else if (veg > 0.05) world.setBlock(x, surfaceY + 1, z, 8);
    }
});
