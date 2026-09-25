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

    getBiomeAt(x, z, perlin) {
        const temp = perlin.noise(x * 0.0008 + 1000, z * 0.0008 + 1000);
        const humid = perlin.noise(x * 0.0008 - 1000, z * 0.0008 - 1000);

        if (temp > 0.35 && humid > 0.251) {
            return this.get('Savane') || this._defaultBiome();
        }

        // Zone brûlée : chaud + sec (déjà présent chez toi)
        if (temp > 0.3 && humid > 0.25) {
            return this.get('terres_brulees') || this._defaultBiome();
        }

        // Forêt champignon : tempéré + très humide (déjà présent chez toi)
        if (humid > 0.35) {
            return this.get('foret_champignon') || this._defaultBiome();
        }

        // Nyamée : climat doux, humidité modérée
        if (temp > -0.1 && temp <= 0.2 && humid > 0.05 && humid <= 0.35) {
            return this.get('Nyamée') || this._defaultBiome();
        }

        // Forêt d'automne : climat frais, humidité modérée
        if (temp <= -0.1 && humid > 0) {
            return this.get('foret_automne') || this._defaultBiome();
        }

        // Reste (plaine par défaut, non fourni ici)
        return this.get('plaine') || this._defaultBiome();
    }

    _defaultBiome() {
        return {
            id: 'default',
            surfaceBlock: 3,
            subSurfaceBlock: 2,
            stoneBlock: 1,
            baseHeight: 18,
            elevationScale: 8,
            detailScale: 2,
            generateDecorations: () => {}
        };
    }
}

window.biomeRegistry = new BiomeRegistry();