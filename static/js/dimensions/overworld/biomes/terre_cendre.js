overworldBiomeRegistry.register({
    id: 'terres_brulees',
    name: 'Terres Brûlées',
    surfaceBlock: 17,
    subSurfaceBlock: 17,
    stoneBlock: 1,

    baseHeight: 16,
    elevationScale: 8,
    detailScale: 4,

    ambiance: { tint: 0xffb27a, fogDensity: 0.58 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const spireNoise = perlin.noise(x * 0.15, z * 0.15);
        if (spireNoise > 0.45 && ((x * 5 + z * 11) % 9 === 0)) {
            const height = 2 + Math.floor(Math.abs(perlin.noise(x * 0.8, z * 0.8)) * 4);
            for (let h = 1; h <= height; h++) {
                if (world.getBlock(x, surfaceY + h, z) !== 0) break;
                world.setBlock(x, surfaceY + h, z, 17);
            }
            return;
        }

        
        const ashNoise = perlin.noise(x * 0.25, z * 0.25);
        if (ashNoise > 0.36) world.setBlock(x, surfaceY + 1, z, 23);
    }
});
