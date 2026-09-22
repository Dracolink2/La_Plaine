biomeRegistry.register({
    id: 'terres_brulees',
    name: 'Terres Brûlées',
    surfaceBlock: 22,   // Basalte
    subSurfaceBlock: 17,// Deepslate
    stoneBlock: 17,     // Deepslate

    baseHeight: 14,
    elevationScale: 14,
    detailScale: 5,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        // 1. Pitons / Colonnes de basalte pointues
        const spireNoise = perlin.noise(x * 0.15, z * 0.15);
        if (spireNoise > 0.45 && (x * 5 + z * 11) % 9 === 0) {
            const height = 3 + Math.floor(Math.abs(perlin.noise(x, z)) * 4);
            for (let h = 1; h <= height; h++) {
                world.setBlock(x, surfaceY + h, z, 22); // Basalte
            }
            return;
        }

        // 2. Craquelures de Magma à la surface
        const magmaNoise = perlin.noise(x * 0.25, z * 0.25);
        if (magmaNoise > 0.35) {
            world.setBlock(x, surfaceY, z, 23); // Remplace le sol par du Magma
        } else if (world.getBlock(x, surfaceY + 1, z) === 0) {
            // 3. Couche de dalles de cendres au sol sur le reste
            world.setBlock(x, surfaceY + 1, z, 24); // Cendres
        }
    }
});