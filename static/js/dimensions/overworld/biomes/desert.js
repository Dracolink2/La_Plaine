overworldBiomeRegistry.register({
    id: 'desert',
    name: 'Désert',
    surfaceBlock: 9,
    subSurfaceBlock: 9,
    stoneBlock: 1,

    baseHeight: 16,
    elevationScale: 5,
    detailScale: 2,

    ambiance: { tint: 0xffe6b3, fogDensity: 0.95 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const cactusNoise = perlin.noise(x * 0.16, z * 0.16);
        if (cactusNoise > 0.50 && ((x * 3 + z * 7) % 19 === 0)) {
            const height = 2 + Math.floor(Math.abs(perlin.noise(x * 0.7, z * 0.7)) * 3);
            for (let h = 1; h <= height; h++) {
                if (world.getBlock(x, surfaceY + h, z) !== 0) break;
                world.setBlock(x, surfaceY + h, z, 10);
            }
        }
    }
});
