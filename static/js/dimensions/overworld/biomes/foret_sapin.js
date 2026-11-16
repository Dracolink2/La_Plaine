overworldBiomeRegistry.register({
    id: 'foret_sapin',
    name: 'Forêt de Sapins',
    surfaceBlock: 13,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 21,
    elevationScale: 9,
    detailScale: 3,

    ambiance: { tint: 0xcfe4d2, fogDensity: 0.88 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const treeNoise = perlin.noise(x * 0.105, z * 0.105);
        if (treeNoise > 0.02 && ((x * 11 + z * 13) % 6 === 0)) {
            this.spawnPineTree(world, x, surfaceY + 1, z, perlin);
            return;
        }

        const snowNoise = perlin.noise(x * 0.32, z * 0.32);
        if (snowNoise > 0.25) world.setBlock(x, surfaceY + 1, z, 14);
    },

    spawnPineTree(world, x, startY, z, perlin) {
        const trunkHeight = 5 + Math.floor(Math.abs(perlin.noise(x * 0.5, z * 0.5)) * 3);
        for (let h = 0; h < trunkHeight; h++) world.setBlock(x, startY + h, z, 15);

        let radius = 2;
        for (let h = 2; h <= trunkHeight; h++) {
            const y = startY + h;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
                    if (world.getBlock(x + dx, y, z + dz) === 0) world.setBlock(x + dx, y, z + dz, 16);
                }
            }
            if (h % 2 === 0 && radius > 0) radius--;
        }
        if (world.getBlock(x, startY + trunkHeight + 1, z) === 0) world.setBlock(x, startY + trunkHeight + 1, z, 16);
    }
});
