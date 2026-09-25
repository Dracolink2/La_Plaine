biomeRegistry.register({
    id: 'montagne',
    name: 'Montagne',
    surfaceBlock: 17,
    subSurfaceBlock: 17,
    stoneBlock: 17,

    baseHeight: 24,       // Baissé pour lisser la transition avec les plaines
    elevationScale: 20,   // Garde un haut relief progressif
    detailScale: 5,

    generateDecorations: function(world, x, surfaceY, z, perlin) {
        if (surfaceY >= 38) {
            world.setBlock(x, surfaceY, z, 12);
            if (surfaceY >= 42 && world.getBlock(x, surfaceY + 1, z) === 0) {
                world.setBlock(x, surfaceY + 1, z, 12);
            }
        }
    }
});