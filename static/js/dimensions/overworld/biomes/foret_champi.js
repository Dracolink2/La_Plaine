overworldBiomeRegistry.register({
    id: 'foret_champignon',
    name: 'Forêt Champignon',
    surfaceBlock: 20,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 19,
    elevationScale: 7,
    detailScale: 3,

    ambiance: { tint: 0xd9b3ff, fogDensity: 0.72 },

    generateDecorations(world, x, surfaceY, z, perlin) {
        if (world.getBlock(x, surfaceY + 1, z) !== 0) return;

        const shroomNoise = perlin.noise(x * 0.10, z * 0.10);
        if (shroomNoise > 0.18 && ((x * 7 + z * 13) % 11 === 0)) {
            this.spawnGiantMushroom(world, x, surfaceY + 1, z, perlin);
            return;
        }

        const veg = perlin.noise(x * 0.3, z * 0.3);
        if (veg > 0.22) world.setBlock(x, surfaceY + 1, z, 21);
    },

    spawnGiantMushroom(world, x, startY, z, perlin) {
        const height = 4 + Math.floor(Math.abs(perlin.noise(x * 0.6, z * 0.6)) * 3);
        for (let h = 0; h < height; h++) world.setBlock(x, startY + h, z, 18);

        const capY = startY + height;
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                if (world.getBlock(x + dx, capY, z + dz) === 0) world.setBlock(x + dx, capY, z + dz, 19);
                if ((Math.abs(dx) === 2 || Math.abs(dz) === 2) && world.getBlock(x + dx, capY - 1, z + dz) === 0) {
                    world.setBlock(x + dx, capY - 1, z + dz, 19);
                }
            }
        }
    }
});
