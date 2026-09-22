biomeRegistry.register({
    id: 'ocean',
    name: 'Océan',
    surfaceBlock: 9,    // Sable au fond
    subSurfaceBlock: 9, // Sable
    stoneBlock: 1,      // Pierre

    baseHeight: 6,
    elevationScale: 4,
    detailScale: 1,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        // Le niveau de la mer remplira automatiquement d'eau jusqu'à Y=16-18 dans la boucle du monde
    }
});