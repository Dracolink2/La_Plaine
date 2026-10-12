overworldBiomeRegistry.register({
    id: 'plaine',
    name: 'Plaine',
    surfaceBlock: 3,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 18,
    elevationScale: 6,
    detailScale: 2,

    ambiance: { tint: 0xffffff, fogDensity: 1 },

    generateStructures(world, x, surfaceY, z) {
        if (typeof window.trySpawnPortalStructure === 'function' &&
            window.trySpawnPortalStructure(world, x, surfaceY, z, world.perlin)) return;

        if (!window.Generation?.trySpawnStructure) return;
        const structures = [window.BiomeStructures?.petiteMaison, window.BiomeStructures?.hameau, window.BiomeStructures?.ruines].filter(Boolean);
        for (const structure of structures) {
            if (window.Generation.trySpawnStructure(world, structure, x, surfaceY, z, { sameBiome: true, biomeId: 'plaine' })) break;
        }
    },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const treeNoise = perlin.noise(x * 0.08, z * 0.08);
        if (treeNoise > 0.68 && ((x * 31 + z * 17) % 17 === 0)) {
            if (window.Generation?.generateTree) {
                window.Generation.generateTree(world, x, surfaceY + 1, z);
            }
            return;
        }

        const vegNoise = perlin.noise(x * 0.3, z * 0.3);
        if (vegNoise > 0.42) world.setBlock(x, surfaceY + 1, z, 6);
        else if (vegNoise < -0.42) world.setBlock(x, surfaceY + 1, z, 7);
        else if (vegNoise > 0.18 && vegNoise < 0.22) world.setBlock(x, surfaceY + 1, z, 8);
    }
});
