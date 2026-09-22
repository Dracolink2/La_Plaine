biomeRegistry.register({
    id: 'montagne',
    name: 'Montagne',
    surfaceBlock: 17,   // Deepslate apparente par défaut
    subSurfaceBlock: 17,// Deepslate
    stoneBlock: 17,     // Deepslate

    baseHeight: 32,
    elevationScale: 28,
    detailScale: 6,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        // Au-dessus d'une certaine altitude (ex: Y >= 48), on pose une couche de neige (ID 12)
        if (surfaceY >= 48) {
            world.setBlock(x, surfaceY, z, 12);
            
            // Si la montagne est très haute (Y >= 52), on ajoute une deuxième couche pour faire du relief
            if (surfaceY >= 52 && world.getBlock(x, surfaceY + 1, z) === 0) {
                world.setBlock(x, surfaceY + 1, z, 12);
            }
        }
    }
});