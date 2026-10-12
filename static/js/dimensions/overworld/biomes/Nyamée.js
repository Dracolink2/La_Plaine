biomeRegistry.register({
    id: 'Nyamée',
    name: 'Nyamée',
    surfaceBlock: 26,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 18,
    elevationScale: 6,
    detailScale: 2,

    ambiance: { tint: 0xfff2c2, fogDensity: 0.95 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (typeof window.trySpawnPortalStructure === 'function' &&
            window.trySpawnPortalStructure(world, x, surfaceY, z, perlin)) return;

        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const treeNoise = perlin.noise(x * 0.08, z * 0.08);
        if (treeNoise > 0.60 && ((x * 19 + z * 23) % 13 === 0)) {
            this.spawnTree(world, x, surfaceY + 1, z, perlin);
            return;
        }

        const flowerNoise = perlin.noise(x * 0.3, z * 0.3);
        if (flowerNoise > -0.12) world.setBlock(x, surfaceY + 1, z, 22);
    },

    spawnTree(world, x, startY, z, perlin) {
        const height = 4 + Math.floor(Math.abs(perlin.noise(x * 0.45, z * 0.45)) * 2);
        for (let y = 0; y < height; y++) world.setBlock(x, startY + y, z, 25);

        const leafStart = startY + height - 2;
        const leafEnd = startY + height + 1;
        for (let ly = leafStart; ly <= leafEnd; ly++) {
            const radius = ly >= leafEnd - 1 ? 1 : 2;
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if (world.getBlock(lx, ly, lz) !== 0) continue;
                    if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius && ((lx + ly + lz) & 1) === 0) continue;
                    world.setBlock(lx, ly, lz, 24);
                }
            }
        }
    }
});
