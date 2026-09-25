biomeRegistry.register({
    id: 'terres_brulees',
    name: 'Terres Brûlées',
    surfaceBlock: 22,
    subSurfaceBlock: 17,
    stoneBlock: 17,

    baseHeight: 16,
    elevationScale: 8,
    detailScale: 4,

    // Ambiance auto quand le joueur est dans ce biome (désactivable via le bouton "Shaders").
    // tint = teinte de lumière/ciel, fogDensity = densité du brouillard (1 = normal, <1 = plus dense)
    ambiance: { tint: 0xffb27a, fogDensity: 0.55 },

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        const spireNoise = perlin.noise(x * 0.15, z * 0.15);
        if (spireNoise > 0.45 && (x * 5 + z * 11) % 9 === 0) {
            const height = 3 + Math.floor(Math.abs(perlin.noise(x, z)) * 4);
            for (let h = 1; h <= height; h++) {
                world.setBlock(x, surfaceY + h, z, 22);
            }
            return;
        }

        const magmaNoise = perlin.noise(x * 0.25, z * 0.25);
        if (magmaNoise > 0.35) {
            world.setBlock(x, surfaceY, z, 23);
        } else if (world.getBlock(x, surfaceY + 1, z) === 0) {
            world.setBlock(x, surfaceY + 1, z, 24);
        }
    }
});