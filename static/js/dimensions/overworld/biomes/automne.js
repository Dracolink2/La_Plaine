overworldBiomeRegistry.register({
    id: 'foret_automne',
    name: "Forêt d'Automne",
    surfaceBlock: 3,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 20,
    elevationScale: 8,
    detailScale: 3,

    ambiance: { tint: 0xffd9a0, fogDensity: 0.9 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const treeNoise = perlin.noise(x * 0.11, z * 0.11);
        if (treeNoise > 0.10 && ((x * 17 + z * 7) % 7 === 0)) {
            this.spawnAutumnTree(world, x, surfaceY + 1, z, perlin);
            return;
        }

        const veg = perlin.noise(x * 0.35, z * 0.35);
        if (veg > 0.30) world.setBlock(x, surfaceY + 1, z, 6);
        else if (veg < -0.28) world.setBlock(x, surfaceY + 1, z, 7);
    },

    spawnAutumnTree(world, x, startY, z, perlin) {
        const treeHeight = 4 + Math.floor(Math.abs(perlin.noise(x * 0.5, z * 0.5)) * 2);
        for (let y = startY; y < startY + treeHeight; y++) world.setBlock(x, y, z, 4);

        const leafStart = startY + treeHeight - 2;
        const leafEnd = startY + treeHeight + 1;
        for (let ly = leafStart; ly <= leafEnd; ly++) {
            const radius = ly >= leafEnd - 1 ? 1 : 2;
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if (world.getBlock(lx, ly, lz) !== 0) continue;
                    if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius && ((lx + ly + lz) & 1) === 0) continue;
                    world.setBlock(lx, ly, lz, 23);
                }
            }
        }
    }
});
