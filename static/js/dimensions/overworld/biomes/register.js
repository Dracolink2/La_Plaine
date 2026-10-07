







class OverworldBiomeRegistry {
    constructor() {
        this.biomes = new Map();
        this.defaultBiome = null;
    }

    register(biomeData) {
        if (!biomeData || typeof biomeData.id !== 'string' || !biomeData.id ||
            typeof biomeData.name !== 'string' || !biomeData.name) {
            console.error('Échec d’enregistrement du biome : id et name sont requis.', biomeData);
            return null;
        }

        const requiredNumbers = ['surfaceBlock', 'subSurfaceBlock', 'stoneBlock', 'baseHeight', 'elevationScale', 'detailScale'];
        for (const key of requiredNumbers) {
            if (!Number.isFinite(biomeData[key])) {
                console.error(`Échec d’enregistrement du biome "${biomeData.id}" : ${key} doit être numérique.`);
                return null;
            }
        }

        if (typeof biomeData.generateDecorations !== 'function') {
            biomeData.generateDecorations = () => {};
        }

        const biome = {
            ...biomeData,
            baseHeight: Math.floor(biomeData.baseHeight),
            elevationScale: Number(biomeData.elevationScale),
            detailScale: Number(biomeData.detailScale)
        };

        if (this.biomes.has(biome.id)) {
            console.warn(`Biome déjà enregistré, remplacement : ${biome.id}`);
        }

        this.biomes.set(biome.id, biome);
        if (!this.defaultBiome || biome.id === 'plaine') this.defaultBiome = biome;
        return biome;
    }

    get(id) {
        return this.biomes.get(id) || null;
    }

    getAll() {
        return Array.from(this.biomes.values());
    }

    getBiomeAt(x, z, perlin) {
        if (!perlin || typeof perlin.noise !== 'function') return this._defaultBiome();

        
        
        const temp = perlin.noise(x * 0.00065 + 1000, z * 0.00065 + 1000);
        const humid = perlin.noise(x * 0.00065 - 1000, z * 0.00065 - 1000);
        const continental = perlin.noise(x * 0.00042 + 2500, z * 0.00042 - 2500);

        
        if (continental < -0.34) return this.get('ocean') || this._defaultBiome();

        
        if (continental > 0.50 && temp < 0.45) return this.get('montagne') || this._defaultBiome();

        
        if (temp > 0.40 && humid < -0.18) return this.get('desert') || this._defaultBiome();
        if (temp > 0.18 && humid < 0.18) return this.get('Savane') || this._defaultBiome();

        
        if (temp > 0.55 && humid < 0.30 && continental > -0.05) {
            return this.get('terres_brulees') || this._defaultBiome();
        }

        
        if (temp < -0.38) {
            if (humid > 0.05) return this.get('foret_sapin') || this._defaultBiome();
            return this.get('plaine_enneigee') || this._defaultBiome();
        }

        
        if (temp < -0.05 && humid > 0.05) return this.get('foret_automne') || this._defaultBiome();

        
        if (humid > 0.48 && temp > -0.05 && temp < 0.45) {
            return this.get('foret_champignon') || this._defaultBiome();
        }

        
        if (temp > -0.02 && temp < 0.28 && humid > 0.08 && humid < 0.45) {
            return this.get('Nyamée') || this._defaultBiome();
        }

        
        if (humid > 0.05) return this.get('foret') || this._defaultBiome();

        return this.get('plaine') || this._defaultBiome();
    }

    _defaultBiome() {
        if (this.defaultBiome) return this.defaultBiome;
        return {
            id: 'default',
            name: 'Biome par défaut',
            surfaceBlock: 3,
            subSurfaceBlock: 2,
            stoneBlock: 1,
            baseHeight: 18,
            elevationScale: 6,
            detailScale: 2,
            generateDecorations: () => {}
        };
    }
}

window.overworldBiomeRegistry = new OverworldBiomeRegistry();
