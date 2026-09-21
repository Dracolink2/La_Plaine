class BiomeRegistry {
    constructor() {
        this.biomes = new Map();
    }

    register(biomeData) {
        if (!biomeData || !biomeData.id || !biomeData.name) {
            console.error("Échec d'enregistrement du biome : ID et nom requis.", biomeData);
            return;
        }

        this.biomes.set(biomeData.id, biomeData);
    }

    get(id) {
        return this.biomes.get(id) || null;
    }

    getAll() {
        return Array.from(this.biomes.values());
    }

    // Sélection automatique Plug & Play basée sur le terrain
    getBiomeAt(x, z, perlin) {
        const list = this.getAll();
        if (list.length === 0) {
            return {
                id: 'default',
                surfaceBlock: 3,
                subSurfaceBlock: 2,
                stoneBlock: 1,
                baseHeight: 18,
                elevationScale: 10,
                detailScale: 2,
                generateDecorations: () => {}
            };
        }

        // Bruit grande échelle pour la transition de biomes
        const climate = perlin.noise(x * 0.005, z * 0.005);
        const index = Math.floor(Math.abs(climate) * list.length) % list.length;
        return list[index];
    }
}

window.biomeRegistry = new BiomeRegistry();
