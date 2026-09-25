biomeRegistry.register({
    id: 'desert',
    name: 'Désert',
    surfaceBlock: 9,
    subSurfaceBlock: 9,
    stoneBlock: 1,

    baseHeight: 16,
    elevationScale: 5,
    detailScale: 2,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const cactusNoise = perlin.noise(x * 0.2, z * 0.2);
        if (cactusNoise > 0.52 && (x * 3 + z * 7) % 19 === 0) {
            const height = 2 + Math.floor(Math.abs(perlin.noise(x, z)) * 2);
            for (let h = 1; h <= height; h++) {
                if (world.getBlock(x, surfaceY + h, z) === 0) {
                    world.setBlock(x, surfaceY + h, z, 10);
                }
            }
        }
    }
});