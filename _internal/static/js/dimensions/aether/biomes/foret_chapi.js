biomeRegistry.register({
    id: 'foret_champignon',
    name: 'Forêt Champignon',
    surfaceBlock: 20,
    subSurfaceBlock: 2,
    stoneBlock: 1,

    baseHeight: 19,
    elevationScale: 7,
    detailScale: 3,

    ambiance: { tint: 0xd9b3ff, fogDensity: 0.7 },

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const shroomNoise = perlin.noise(x * 0.1, z * 0.1);
        if (shroomNoise > 0.2 && (x * 7 + z * 13) % 11 === 0) {
            if (world.getBlock(x, surfaceY + 1, z) === 0) {
                this.spawnGiantMushroom(world, x, surfaceY + 1, z, perlin);
                return;
            }
        }

        const veg = perlin.noise(x * 0.3, z * 0.3);
        if (world.getBlock(x, surfaceY + 1, z) === 0 && veg > 0.3) {
            world.setBlock(x, surfaceY + 1, z, 21);
        }
    },

    spawnGiantMushroom: function(world, x, startY, z, perlin) {
        const height = 4 + Math.floor(Math.abs(perlin.noise(x, z)) * 3);
        for (let h = 0; h < height; h++) {
            world.setBlock(x, startY + h, z, 18);
        }

        const capY = startY + height;
        const radius = 2;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
                world.setBlock(x + dx, capY, z + dz, 19);
                if (Math.abs(dx) === radius || Math.abs(dz) === radius) {
                    world.setBlock(x + dx, capY - 1, z + dz, 19);
                }
            }
        }
    }
});