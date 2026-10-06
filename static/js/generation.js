// ============================================================================
// generation.js — Bibliothèque de génération du monde
// V0.2.0.0
// - Seed déterministe
// - Bruit Perlin
// - Hauteur du terrain
// - Génération des arbres
// - Génération des chunks de terrain + décorations des biomes
//
// Ce fichier ne gère PAS les meshes, le streaming ou le rendu.
// World.js lui fournit le monde et lui demande simplement de générer.
// ============================================================================

function hashSeed(seed) {
    seed = String(seed ?? '0');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function getWorldSeed() {
    let seed = localStorage.getItem('worldSeed');
    if (seed === null || seed === '') {
        seed = String((Date.now() ^ (Math.random() * 0xFFFFFFFF)) >>> 0);
        localStorage.setItem('worldSeed', seed);
    }
    return seed;
}

class SeededRandom {
    constructor(seed) {
        this.state = hashSeed(seed) || 0x6D2B79F5;
    }

    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

class PerlinNoise {
    constructor(seed = '0') {
        this.seed = seed;
        this.p = new Uint8Array(256);

        const random = new SeededRandom(seed);
        for (let i = 0; i < 256; i++) this.p[i] = i;

        // Fisher-Yates déterministe : même seed = même permutation.
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(random.next() * (i + 1));
            const tmp = this.p[i];
            this.p[i] = this.p[j];
            this.p[j] = tmp;
        }

        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255];
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }

    grad(hash, x, y) {
        const h = hash & 7;
        const u = h < 4 ? x : y;
        const v = h < 4 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;

        x -= Math.floor(x);
        y -= Math.floor(y);

        const u = this.fade(x);
        const v = this.fade(y);

        const A = this.perm[X] + Y;
        const B = this.perm[X + 1] + Y;

        return this.lerp(v,
            this.lerp(u, this.grad(this.perm[A], x, y), this.grad(this.perm[B], x - 1, y)),
            this.lerp(u, this.grad(this.perm[A + 1], x, y - 1), this.grad(this.perm[B + 1], x - 1, y - 1))
        );
    }
}

const Generation = {
    // Version indépendante de la version du jeu : elle identifie la génération historique.
    GENERATION_VERSION: 1,
    computeHeight(world, biome, x, z) {
        const elevation = world.perlin.noise(x * 0.03, z * 0.03) * biome.elevationScale;
        const detail = world.perlin.noise(x * 0.1, z * 0.1) * biome.detailScale;
        const h = Math.floor(biome.baseHeight + elevation + detail);
        return Math.max(2, Math.min(world.maxHeight - 12, h));
    },

    generateTree(world, x, startY, z) {
        const treeHeight = 4 + Math.floor(Math.abs(world.perlin.noise(x * 0.5, z * 0.5)) * 2);

        for (let y = startY; y < startY + treeHeight; y++) {
            world.setBlock(x, y, z, 4);
        }

        const leafStart = startY + treeHeight - 2;
        const leafEnd = startY + treeHeight + 1;

        for (let ly = leafStart; ly <= leafEnd; ly++) {
            const radius = ly >= leafEnd - 1 ? 1 : 2;
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if (world.getBlock(lx, ly, lz) === 0) {
                        if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius && ((lx + ly + lz) & 1) === 0) continue;
                        world.setBlock(lx, ly, lz, 5);
                    }
                }
            }
        }
    },

    generateTerrainData(world, cx, cz, requestedVersion = this.GENERATION_VERSION) {
        const chunk = world.getChunkAt(cx, cz, true);
        if (chunk.generated) return;

        // Pour l'instant V1 est la seule génération disponible.
        // L'API est déjà versionnée afin que les futures versions puissent
        // conserver leurs anciens générateurs sans toucher aux chunks existants.
        const version = Number(requestedVersion) || this.GENERATION_VERSION;
        if (version !== this.GENERATION_VERSION) {
            console.warn(`Génération historique V${version} indisponible, utilisation de V${this.GENERATION_VERSION}.`);
        }
        if (!world.biomeRegistry) return;

        world.generating = true;
        const B = chunk.blocks;
        const heights = new Uint8Array(256);
        chunk.heights = heights;
        const startX = cx << 4, startZ = cz << 4;
        const sea = world.seaLevel;
        let maxY = 0;

        for (let lz = 0; lz < 16; lz++) {
            for (let lx = 0; lx < 16; lx++) {
                const x = startX + lx, z = startZ + lz;
                const biome = world.biomeRegistry.getBiomeAt(x, z, world.perlin);
                const h = this.computeHeight(world, biome, x, z);
                heights[(lz << 4) | lx] = h;

                const stoneH = Math.max(0, h - 3);
                const col = (lz << 4) | lx;
                for (let y = 0; y < stoneH; y++) B[(y << 8) | col] = biome.stoneBlock;
                for (let y = stoneH; y < h; y++) B[(y << 8) | col] = biome.subSurfaceBlock;
                B[(h << 8) | col] = h <= sea + 1 ? 9 : biome.surfaceBlock;

                if (h > maxY) maxY = h;
                if (h < sea) {
                    for (let y = h + 1; y <= sea; y++) B[(y << 8) | col] = 11;
                    if (sea > maxY) maxY = sea;
                }
            }
        }
        chunk.maxY = maxY;

        // Marge de 2 blocs : évite de générer une décoration trop proche d'un bord.
        for (let x = startX + 2; x < startX + 14; x++) {
            for (let z = startZ + 2; z < startZ + 14; z++) {
                const surfaceY = heights[((z - startZ) << 4) | (x - startX)];
                if (surfaceY > sea) {
                    world.biomeRegistry.getBiomeAt(x, z, world.perlin).generateDecorations(
                        world, x, surfaceY, z, world.perlin
                    );
                }
            }
        }

        world.generating = false;
        chunk.generated = true;
        chunk.generationVersion = this.GENERATION_VERSION;
        if (typeof world._recordGeneratedChunk === 'function') {
            world._recordGeneratedChunk(cx, cz, this.GENERATION_VERSION);
        }
    }
};

// API globale volontairement simple : world.js et les biomes peuvent l'utiliser.
window.Generation = Generation;
window.GENERATION_VERSION = Generation.GENERATION_VERSION;
window.PerlinNoise = PerlinNoise;
window.getWorldSeed = getWorldSeed;
window.SeededRandom = SeededRandom;
