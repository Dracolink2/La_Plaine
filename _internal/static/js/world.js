// ============================================================================
//  world.js — La Plaine (version optimisée)
//  - Meshing par FACES VISIBLES (1 mesh / chunk / type) au lieu d'1 cube instancié par bloc
//  - Atlas de textures unique + ombrage des faces + occlusion ambiante (AO) dans les sommets
//  - Matériaux "Basic" (aucun calcul de lumière) : très léger pour les petits GPU
//  - Génération de terrain directe dans les tableaux, éviction des chunks lointains
// ============================================================================

const WORLD_HEIGHT = 128;

class PerlinNoise {
    constructor() {
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
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

// --- STOCKAGE COMPACT D'UN CHUNK (16 x 128 x 16, 1 octet / bloc, 0 = air) ---
class ChunkData {
    constructor(cx, cz) {
        this.cx = cx;
        this.cz = cz;
        this.blocks = new Uint8Array(16 * WORLD_HEIGHT * 16);
        this.heights = null;      // hauteur de surface par colonne (rempli à la génération)
        this.generated = false;
        this.modified = false;    // modifié par le joueur/fluides -> jamais évincé de la mémoire
        this.maxY = 0;            // plus haut bloc non vide (accélère le meshing)
    }
}

// --- DÉFINITION DES 6 FACES D'UN CUBE (ordre : -x, +x, -y, +y, -z, +z), sens anti-horaire ---
const FACE_DEFS = [
    { c: [{ p: [0, 1, 0], u: [0, 1] }, { p: [0, 0, 0], u: [0, 0] }, { p: [0, 1, 1], u: [1, 1] }, { p: [0, 0, 1], u: [1, 0] }] },
    { c: [{ p: [1, 1, 1], u: [0, 1] }, { p: [1, 0, 1], u: [0, 0] }, { p: [1, 1, 0], u: [1, 1] }, { p: [1, 0, 0], u: [1, 0] }] },
    { c: [{ p: [1, 0, 1], u: [1, 0] }, { p: [0, 0, 1], u: [0, 0] }, { p: [1, 0, 0], u: [1, 1] }, { p: [0, 0, 0], u: [0, 1] }] },
    { c: [{ p: [0, 1, 1], u: [1, 1] }, { p: [1, 1, 1], u: [0, 1] }, { p: [0, 1, 0], u: [1, 0] }, { p: [1, 1, 0], u: [0, 0] }] },
    { c: [{ p: [1, 0, 0], u: [0, 0] }, { p: [0, 0, 0], u: [1, 0] }, { p: [1, 1, 0], u: [0, 1] }, { p: [0, 1, 0], u: [1, 1] }] },
    { c: [{ p: [0, 0, 1], u: [0, 0] }, { p: [1, 0, 1], u: [1, 0] }, { p: [0, 1, 1], u: [0, 1] }, { p: [1, 1, 1], u: [1, 1] }] }
];
const FACE_DIR = [[-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]];
const FACE_POS = FACE_DEFS.map(f => Float32Array.from(f.c.flatMap(c => c.p)));
const FACE_UV = FACE_DEFS.map(f => Float32Array.from(f.c.flatMap(c => c.u)));
const FACE_SHADE = [0.8, 0.8, 0.5, 1.0, 0.65, 0.65];
const AO_LEVEL = [0.5, 0.68, 0.84, 1.0];

// Pour chaque coin de chaque face : les 3 cellules voisines qui servent à calculer l'AO
const FACE_AO = FACE_DEFS.map((f, fi) => f.c.map(c => {
    const d = FACE_DIR[fi];
    const axes = [0, 1, 2].filter(a => d[a] === 0);
    const a1 = axes[0], a2 = axes[1];
    const s1 = c.p[a1] * 2 - 1, s2 = c.p[a2] * 2 - 1;
    const o1 = d.slice(); o1[a1] += s1;
    const o2 = d.slice(); o2[a2] += s2;
    const oc = d.slice(); oc[a1] += s1; oc[a2] += s2;
    return Int8Array.from([...o1, ...o2, ...oc]);
}));

// Types de rendu
const KIND_OPAQUE = 1, KIND_CUTOUT = 2, KIND_FLUID = 3, KIND_PLANT = 4;

class World {
    constructor(scene) {
        this.scene = scene;

        this.chunkSize = 16;
        this.maxHeight = WORLD_HEIGHT;
        this.seaLevel = 12;

        const rd = parseInt(localStorage.getItem('renderDistance'), 10);
        this.renderDistance = Math.max(1, Math.min(8, isFinite(rd) ? rd : 3));

        this.dataChunks = new Map();   // données (blocs)
        this.chunks = new Map();       // meshes affichés
        this.chunkQueue = [];
        this.dirty = new Set();
        this.activeFluids = new Set();
        this.perlin = new PerlinNoise();
        this.generating = false;
        this.ready = false;

        this.chunksGroup = new THREE.Group();
        this.scene.add(this.chunksGroup);

        this.lastPlayerChunkX = null;
        this.lastPlayerChunkZ = null;

        this.dayDuration = 240;
        this.dayTime = this.dayDuration * 0.2; // on démarre le matin
        this.clock = { elapsed: 0 };
        this.underwater = false;
        this.lastFluidUpdate = 0;

        this.settings = {
            waterShader: localStorage.getItem('fxWaterShader') !== 'false',
        };

        // Tables de propriétés par id de bloc (lookup ultra rapide, pas de Map dans les boucles chaudes)
        this.kindT = new Uint8Array(256).fill(KIND_OPAQUE);
        this.opaqueT = new Uint8Array(256).fill(1);
        this.solidT = new Uint8Array(256).fill(1);
        this.fluidT = new Uint8Array(256);
        this.plantT = new Uint8Array(256);
        this.noCullT = new Uint8Array(256);
        this.tileT = new Int16Array(256 * 6);
        this.opaqueT[0] = 0; this.solidT[0] = 0;

        this.tileU = new Float32Array(1);
        this.tileV = new Float32Array(1);
        this.tileSpan = 1;
        this.tileAvg = [0x888888];

        this._lc = null; this._lcx = 0; this._lcz = 0;   // cache du dernier chunk lu
        this._ch3 = new Array(9).fill(null);
        this._bld = [this._newBuilder(), this._newBuilder(), this._newBuilder()];

        this._sky = new THREE.Color(0x87ceeb);
        this._cDay = new THREE.Color(0x87ceeb);
        this._cNight = new THREE.Color(0x050b14);
        this._cDusk = new THREE.Color(0xff7733);
        this._under = new THREE.Color(0x0f3868);
        this._bg = new THREE.Color();
        this._lastF = -1;

        this.fogNear = 20; this.fogFar = 44;

        // --- Ambiance de biome (brouillard/teinte spécifiques, activable/désactivable) ---
        this.shadersEnabled = localStorage.getItem('fxShaders') !== 'false';
        this.currentBiomeId = null;
        this._ambTint = new THREE.Color(1, 1, 1);       // teinte lumière appliquée actuellement (lissée)
        this._ambTintTarget = new THREE.Color(1, 1, 1);
        this._ambFogMul = 1;                             // multiplicateur de densité de brouillard (lissé)
        this._ambFogMulTarget = 1;
        this._ambCheckTimer = 0;
        window.addEventListener('shaders-toggled', (e) => {
            this.shadersEnabled = e.detail.enabled;
            if (!this.shadersEnabled) { this._ambTintTarget.set(1, 1, 1); this._ambFogMulTarget = 1; }
        });

        this.initSkyAndClouds();
        this.setCloudsVisible(localStorage.getItem('showClouds') !== 'false');
        this.applyFog();
    }

    // ============ INITIALISATION ASYNCHRONE (textures) ============

    async init(onStatus) {
        if (onStatus) onStatus('Chargement des textures...');
        const paths = this._collectPaths();
        const imgs = await this._loadImages(paths);
        this._buildAtlas(paths, imgs);
        this._buildTables(paths);
        this._createMaterials();
        this.ready = true;
    }

    _collectPaths() {
        const paths = new Map(); // chemin -> index de tuile (0 = tuile par défaut grise)
        if (typeof blockRegistry === 'undefined') return paths;
        blockRegistry.getAll().forEach(b => {
            const t = b.textures || {};
            [t.all, t.top, t.bottom, t.sides].forEach(p => {
                if (p && !paths.has(p)) paths.set(p, paths.size + 1);
            });
        });
        return paths;
    }

    _loadImages(paths) {
        const jobs = [...paths.keys()].map(path => new Promise(resolve => {
            const img = new Image();
            img.onload = () => resolve([path, img]);
            img.onerror = () => { console.warn('Texture introuvable :', path); resolve([path, null]); };
            img.src = path;
        }));
        return Promise.all(jobs).then(list => new Map(list));
    }

    _setTileLayout(count, T) {
        const cols = Math.ceil(Math.sqrt(count));
        let size = 16;
        while (size < cols * T) size <<= 1;
        this.atlasCols = cols;
        this.atlasSize = size;
        this.atlasTile = T;

        const inset = 0.02; // px, évite les débordements entre tuiles
        this.tileU = new Float32Array(count);
        this.tileV = new Float32Array(count);
        this.tileSpan = (T - 2 * inset) / size;
        for (let t = 0; t < count; t++) {
            const col = t % cols, row = Math.floor(t / cols);
            this.tileU[t] = (col * T + inset) / size;
            this.tileV[t] = 1 - ((row + 1) * T) / size + inset / size;
        }
    }

    _buildAtlas(paths, imgs) {
        let T = 16;
        imgs.forEach(img => { if (img && img.naturalWidth > T) T = Math.min(64, img.naturalWidth); });

        const count = paths.size + 1;
        this._setTileLayout(count, T);

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = this.atlasSize;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;

        this.tileAvg = new Array(count).fill(0x888888);
        const drawTile = (t, img) => {
            const x = (t % this.atlasCols) * T, y = Math.floor(t / this.atlasCols) * T;
            if (img) {
                const s = Math.min(img.naturalWidth, img.naturalHeight); // ignore les bandes animées
                ctx.drawImage(img, 0, 0, s, s, x, y, T, T);
            } else {
                ctx.fillStyle = t === 0 ? '#888888' : '#ff00ff';
                ctx.fillRect(x, y, T, T);
            }
            try {
                const d = ctx.getImageData(x, y, T, T).data;
                let r = 0, g = 0, b = 0, n = 0;
                for (let i = 0; i < d.length; i += 4) {
                    if (d[i + 3] < 128) continue;
                    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
                }
                if (n) this.tileAvg[t] = ((r / n) << 16) | ((g / n) << 8) | (b / n);
            } catch (e) { /* canvas non lisible : couleur par défaut */ }
        };

        drawTile(0, null);
        paths.forEach((t, path) => drawTile(t, imgs.get(path)));

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        this.atlasTexture = tex;
    }

    _buildTables(paths) {
        if (typeof blockRegistry === 'undefined') return;
        blockRegistry.getAll().forEach(b => {
            const id = b.id;
            if (id < 1 || id > 254) return;
            const t = b.textures || {};
            let kind = KIND_OPAQUE;
            if (b.isFluid) kind = KIND_FLUID;
            else if (b.isPlant) kind = KIND_PLANT;
            else if (b.transparent || b.alphaTest > 0) kind = KIND_CUTOUT;

            this.kindT[id] = kind;
            this.opaqueT[id] = kind === KIND_OPAQUE ? 1 : 0;
            this.solidT[id] = (kind === KIND_FLUID || kind === KIND_PLANT) ? 0 : 1;
            this.fluidT[id] = kind === KIND_FLUID ? 1 : 0;
            this.plantT[id] = kind === KIND_PLANT ? 1 : 0;
            // feuillages "pleins" (une seule texture) : on garde les faces internes (trous du feuillage)
            this.noCullT[id] = (kind === KIND_CUTOUT && t.all) ? 1 : 0;

            const pick = (...keys) => {
                for (const k of keys) if (t[k] && paths.has(t[k])) return paths.get(t[k]);
                return 0;
            };
            const top = pick('top', 'all', 'sides');
            const bottom = pick('bottom', 'all', 'sides');
            const side = pick('sides', 'all', 'top');
            const base = id * 6;
            this.tileT[base] = side; this.tileT[base + 1] = side;
            this.tileT[base + 2] = bottom; this.tileT[base + 3] = top;
            this.tileT[base + 4] = side; this.tileT[base + 5] = side;
        });
        this.opaqueT[255] = 1; // sentinelle "sous le monde"
    }

    getBlockColor(id) {
        return this.tileAvg[this.tileT[id * 6]] || 0x888888;
    }

    // ============ MATÉRIAUX ============

    _createWaterShader(tex) {
        const uniforms = THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                uTime: { value: 0 },
                uLight: { value: 1 },
                uMap: { value: tex },
                uDeep: { value: new THREE.Color(0x0b3d5c) },
                uShallow: { value: new THREE.Color(0x3f9ec9) }
            }
        ]);

        return new THREE.ShaderMaterial({
            uniforms,
            fog: true,
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            vertexShader: `
                uniform float uTime;
                attribute float aTop;
                varying vec2 vUv;
                varying vec3 vColor;
                varying float vWave;
                #include <fog_pars_vertex>
                void main() {
                    vUv = uv;
                    vColor = color;
                    vec3 p = position;
                    vec4 wp = modelMatrix * vec4(p, 1.0);
                    float w = sin(wp.x * 0.7 + uTime * 1.6) * 0.04 + cos(wp.z * 0.6 + uTime * 1.3) * 0.04;
                    p.y += w * aTop;
                    vWave = w * aTop;
                    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    #include <fog_vertex>
                }
            `,
            fragmentShader: `
                uniform sampler2D uMap;
                uniform vec3 uDeep;
                uniform vec3 uShallow;
                uniform float uLight;
                varying vec2 vUv;
                varying vec3 vColor;
                varying float vWave;
                #include <fog_pars_fragment>
                void main() {
                    vec4 tex = texture2D(uMap, vUv);
                    vec3 tint = mix(uDeep, uShallow, clamp(0.5 + vWave * 6.0, 0.0, 1.0));
                    vec3 col = mix(tint, tex.rgb, 0.35) * vColor * uLight;
                    col += vWave * 1.2;
                    gl_FragColor = vec4(col, 0.72);
                    #include <fog_fragment>
                }
            `
        });
    }

    _createMaterials() {
        const tex = this.atlasTexture;
        this.mats = {
            opaque: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }),
            cutout: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 }),
            waterSimple: new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, transparent: true, opacity: 0.62, depthWrite: false }),
            waterShader: this._createWaterShader(tex)
        };
        this.mats.water = this.settings.waterShader ? this.mats.waterShader : this.mats.waterSimple;
    }

    setWaterShaderEnabled(enabled) {
        this.settings.waterShader = enabled;
        localStorage.setItem('fxWaterShader', enabled);
        if (!this.mats) return;
        this.mats.water = enabled ? this.mats.waterShader : this.mats.waterSimple;
        for (const c of this.chunks.values()) {
            for (const m of c.meshes) if (m.userData.kind === KIND_FLUID) m.material = this.mats.water;
        }
    }

    // ============ BROUILLARD (masque le bord du monde) ============

    applyFog() {
        const R = this.renderDistance * 16;
        this.fogFar = Math.max(24, R - 4);
        this.fogNear = this.fogFar * 0.45;
        this._syncFog();
    }

    _syncFog() {
        const fog = this.scene.fog;
        if (!fog) return;
        fog.near = this.underwater ? 0.5 : this.fogNear;
        fog.far = this.underwater ? 18 : this.fogFar;
    }

    setUnderwater(flag) {
        if (this.underwater === flag) return;
        this.underwater = flag;
        this._syncFog();
    }

    // ============ CIEL / NUAGES / JOUR-NUIT ============

    initSkyAndClouds() {
        this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
        this.CLOUD_CELL = 16;
        this.CLOUD_R = 8;
        const max = (this.CLOUD_R * 2 + 1) ** 2;
        this.cloudMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(16, 3, 16), this.cloudMat, max);
        this.cloudMesh.frustumCulled = false;
        this.cloudMesh.count = 0;
        this.scene.add(this.cloudMesh);
        this._cloudI = null; this._cloudK = null;
        this._cloudDummy = new THREE.Object3D();

        this.sunMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ color: 0xfff066, fog: false }));
        this.moonMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0xdddddd, fog: false }));
        this.scene.add(this.sunMesh);
        this.scene.add(this.moonMesh);
    }

    setCloudsVisible(visible) {
        if (this.cloudMesh) this.cloudMesh.visible = visible;
    }

    _updateClouds(cx, cz) {
        const cell = this.CLOUD_CELL, R = this.CLOUD_R;
        const drift = this.clock.elapsed * 2;
        this.cloudMesh.position.x = drift;

        const i0 = Math.floor((cx - drift) / cell);
        const k0 = Math.floor(cz / cell);
        if (i0 === this._cloudI && k0 === this._cloudK) return;
        this._cloudI = i0; this._cloudK = k0;

        let n = 0;
        for (let i = i0 - R; i <= i0 + R; i++) {
            for (let k = k0 - R; k <= k0 + R; k++) {
                if (this.perlin.noise(i * 0.23 + 3.1, k * 0.23 + 7.7) > 0.05) {
                    this._cloudDummy.position.set(i * cell + cell / 2, 48, k * cell + cell / 2);
                    this._cloudDummy.updateMatrix();
                    this.cloudMesh.setMatrixAt(n++, this._cloudDummy.matrix);
                }
            }
        }
        this.cloudMesh.count = n;
        this.cloudMesh.instanceMatrix.needsUpdate = true;
    }

    updateDayNightCycle(delta, center) {
        this.dayTime = (this.dayTime + delta) % this.dayDuration;
        this.clock.elapsed += delta;

        const angle = (this.dayTime / this.dayDuration) * Math.PI * 2;
        const cosA = Math.cos(angle), sinA = Math.sin(angle);

        let light;
        const sky = this._sky;
        if (sinA > 0.2) {
            sky.copy(this._cDay); light = 1;
        } else if (sinA > -0.2) {
            const t = (sinA + 0.2) * 2.5;
            light = t;
            if (t < 0.5) sky.copy(this._cNight).lerp(this._cDusk, t * 2);
            else sky.copy(this._cDusk).lerp(this._cDay, (t - 0.5) * 2);
        } else {
            sky.copy(this._cNight); light = 0;
        }
        const f = 0.3 + 0.7 * light;

        // --- Ambiance de biome : détection (peu coûteuse, throttle à ~3x/s) + lissage ---
        if (this.shadersEnabled && center) {
            this._ambCheckTimer += delta;
            if (this._ambCheckTimer > 0.3) {
                this._ambCheckTimer = 0;
                this._updateBiomeAmbianceTarget(Math.floor(center.x), Math.floor(center.z));
            }
            const lerpSpeed = Math.min(1, delta * 0.8); // transition douce (~1.5s)
            this._ambTint.lerp(this._ambTintTarget, lerpSpeed);
            this._ambFogMul += (this._ambFogMulTarget - this._ambFogMul) * lerpSpeed;
        }

        // Teinte de biome appliquée sur la couleur du ciel/lumière ambiante
        const t = this._ambTint;
        const litF = f; // luminosité jour/nuit, appliquée en plus de la teinte
        let bg = sky;
        if (this.underwater) {
            this._bg.copy(this._under).multiplyScalar(f);
            bg = this._bg;
        } else if (this.shadersEnabled && (t.r !== 1 || t.g !== 1 || t.b !== 1)) {
            this._bg.copy(sky).multiply(t);
            bg = this._bg;
        }
        this.scene.background = bg;
        if (this.scene.fog) {
            this.scene.fog.color.copy(bg);
            // Le biome ne peut que DENSIFIER le brouillard (mul <= 1), jamais révéler des chunks
            // non générés au-delà de la distance d'affichage réglée par le joueur.
            const mul = this.shadersEnabled ? Math.min(1, this._ambFogMul) : 1;
            this.scene.fog.near = (this.underwater ? 0.5 : this.fogNear) * mul;
            this.scene.fog.far = (this.underwater ? 18 : this.fogFar) * mul;
        }

        const lf = litF * t.r; // luminosité effective des blocs = jour/nuit * teinte biome
        if ((Math.abs(f - this._lastF) > 0.003 || this.shadersEnabled) && this.mats) {
            this._lastF = f;
            this.mats.opaque.color.setRGB(litF * t.r, litF * t.g, litF * t.b);
            this.mats.cutout.color.setRGB(litF * t.r, litF * t.g, litF * t.b);
            this.mats.waterSimple.color.setRGB(litF * t.r, litF * t.g, litF * t.b);
            this.mats.waterShader.uniforms.uLight.value = lf;
            this.cloudMat.color.setRGB(f, f, f);
        }
        if (this.mats) this.mats.waterShader.uniforms.uTime.value = this.clock.elapsed;

        if (center) {
            const d = 130;
            this.sunMesh.position.set(center.x + cosA * d, sinA * d, center.z);
            this.moonMesh.position.set(center.x - cosA * d, -sinA * d, center.z);
            if (this.cloudMesh.visible) this._updateClouds(center.x, center.z);
        }
    }

    // Interroge le biome à la position du joueur et met à jour la CIBLE d'ambiance
    // (le lissage vers cette cible se fait dans updateDayNightCycle).
    // Un biome n'a rien à faire de particulier : il suffit de ne pas déclarer `ambiance`.
    _updateBiomeAmbianceTarget(x, z) {
        if (typeof biomeRegistry === 'undefined') return;
        const biome = biomeRegistry.getBiomeAt(x, z, this.perlin);
        const id = biome ? biome.id : null;
        if (id === this.currentBiomeId) return;
        this.currentBiomeId = id;

        const amb = biome && biome.ambiance;
        if (amb) {
            this._ambTintTarget.set(amb.tint !== undefined ? amb.tint : 0xffffff);
            this._ambFogMulTarget = amb.fogDensity !== undefined ? amb.fogDensity : 1;
        } else {
            this._ambTintTarget.set(0xffffff);
            this._ambFogMulTarget = 1;
        }
    }

    // ============ ACCÈS BLOCS ============

    getChunkKey(cx, cz) {
        return ((cx & 0xFFFF) << 16) | (cz & 0xFFFF);
    }

    getChunkAt(cx, cz, createIfMissing = false) {
        const key = this.getChunkKey(cx, cz);
        let chunk = this.dataChunks.get(key);
        if (!chunk && createIfMissing) {
            chunk = new ChunkData(cx, cz);
            this.dataChunks.set(key, chunk);
        }
        return chunk;
    }

    // Lecture avec coordonnées entières (chemin rapide)
    getBlockI(x, y, z) {
        if (y < 0 || y >= WORLD_HEIGHT) return 0;
        const cx = x >> 4, cz = z >> 4;
        let c;
        if (this._lc && cx === this._lcx && cz === this._lcz) {
            c = this._lc;
        } else {
            c = this.dataChunks.get(((cx & 0xFFFF) << 16) | (cz & 0xFFFF));
            if (!c) return 0;
            this._lc = c; this._lcx = cx; this._lcz = cz;
        }
        return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }

    getBlock(x, y, z) {
        return this.getBlockI(Math.floor(x), Math.floor(y), Math.floor(z));
    }

    setBlock(x, y, z, id) {
        x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
        if (y < 0 || y >= WORLD_HEIGHT) return;

        const chunk = this.getChunkAt(x >> 4, z >> 4, true);
        chunk.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] = id;
        if (id !== 0 && y > chunk.maxY) chunk.maxY = y;

        if (!this.generating) {
            chunk.modified = true;
            const key = this._packFluid(x, y, z);
            if (id !== 0 && this.fluidT[id]) this.activeFluids.add(key);
            else this.activeFluids.delete(key);
        }
    }

    hasBlock(x, y, z) { return this.getBlock(x, y, z) !== 0; }
    isSolidI(x, y, z) { return this.solidT[this.getBlockI(x, y, z)] === 1; }
    isSolid(x, y, z) { return this.solidT[this.getBlock(x, y, z)] === 1; }
    isFluidAt(x, y, z) { return this.fluidT[this.getBlock(x, y, z)] === 1; }

    _isChunkGenerated(x, z) {
        const c = this.dataChunks.get(this.getChunkKey(x >> 4, z >> 4));
        return !!(c && c.generated);
    }

    // ============ GÉNÉRATION DU TERRAIN ============

    _computeHeight(biome, x, z) {
        const elevation = this.perlin.noise(x * 0.03, z * 0.03) * biome.elevationScale;
        const detail = this.perlin.noise(x * 0.1, z * 0.1) * biome.detailScale;
        const h = Math.floor(biome.baseHeight + elevation + detail);
        return Math.max(2, Math.min(WORLD_HEIGHT - 12, h));
    }

    getTerrainHeight(x, z) {
        x = Math.floor(x); z = Math.floor(z);
        const chunk = this.dataChunks.get(this.getChunkKey(x >> 4, z >> 4));
        if (chunk && chunk.heights) return chunk.heights[((z & 15) << 4) | (x & 15)];
        if (typeof biomeRegistry === 'undefined') return 10;
        return this._computeHeight(biomeRegistry.getBiomeAt(x, z, this.perlin), x, z);
    }

    spawnTree(x, startY, z) {
        const treeHeight = 4 + Math.floor(Math.abs(this.perlin.noise(x * 0.5, z * 0.5)) * 2);

        for (let y = startY; y < startY + treeHeight; y++) {
            this.setBlock(x, y, z, 4);
        }

        const leafStart = startY + treeHeight - 2;
        const leafEnd = startY + treeHeight + 1;

        for (let ly = leafStart; ly <= leafEnd; ly++) {
            const radius = ly >= leafEnd - 1 ? 1 : 2;
            for (let lx = x - radius; lx <= x + radius; lx++) {
                for (let lz = z - radius; lz <= z + radius; lz++) {
                    if (this.getBlock(lx, ly, lz) === 0) {
                        if (Math.abs(lx - x) === radius && Math.abs(lz - z) === radius && ((lx + ly + lz) & 1) === 0) {
                            continue;
                        }
                        this.setBlock(lx, ly, lz, 5);
                    }
                }
            }
        }
    }

    generateTerrainData(cx, cz) {
        const chunk = this.getChunkAt(cx, cz, true);
        if (chunk.generated) return;
        chunk.generated = true;

        if (typeof biomeRegistry === 'undefined') return;

        this.generating = true;
        const B = chunk.blocks;
        const heights = new Uint8Array(256);
        chunk.heights = heights;
        const startX = cx << 4, startZ = cz << 4;
        const sea = this.seaLevel;
        let maxY = 0;

        for (let lz = 0; lz < 16; lz++) {
            for (let lx = 0; lx < 16; lx++) {
                const x = startX + lx, z = startZ + lz;
                const biome = biomeRegistry.getBiomeAt(x, z, this.perlin);
                const h = this._computeHeight(biome, x, z);
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

        // Décorations (arbres, cactus, fleurs) : marge de 2 blocs pour ne jamais déborder du chunk
        for (let x = startX + 2; x < startX + 14; x++) {
            for (let z = startZ + 2; z < startZ + 14; z++) {
                const surfaceY = heights[((z - startZ) << 4) | (x - startX)];
                if (surfaceY > sea) {
                    biomeRegistry.getBiomeAt(x, z, this.perlin).generateDecorations(this, x, surfaceY, z, this.perlin);
                }
            }
        }
        this.generating = false;
    }

    // ============ MESHING PAR FACES ============

    _newBuilder() {
        return { pos: [], uv: [], col: [], idx: [], top: [], n: 0 };
    }

    _blk(lx, y, lz) {
        if (y < 0) return 255;
        if (y >= WORLD_HEIGHT) return 0;
        const c = this._ch3[((lz >> 4) + 1) * 3 + (lx >> 4) + 1];
        return c ? c.blocks[(y << 8) | ((lz & 15) << 4) | (lx & 15)] : 0;
    }

    _hidden(kind, id, nid) {
        if (nid === 0) return false;
        if (this.opaqueT[nid]) return true;
        if (kind === KIND_FLUID) return nid === id;
        if (kind === KIND_CUTOUT) return nid === id && !this.noCullT[id];
        return false;
    }

    _emitFace(b, f, lx, y, lz, tile, shade, ao, water, waterTopH) {
        const fp = FACE_POS[f], fu = FACE_UV[f];
        const u0 = this.tileU[tile], v0 = this.tileV[tile], ts = this.tileSpan;
        const base = b.n;

        for (let k = 0; k < 4; k++) {
            let py = y + fp[k * 3 + 1];
            let isTop = 0;
            if (water && fp[k * 3 + 1] === 1) { py = y + waterTopH; isTop = 1; }
            b.pos.push(lx + fp[k * 3], py, lz + fp[k * 3 + 2]);
            b.uv.push(u0 + fu[k * 2] * ts, v0 + fu[k * 2 + 1] * ts);
            const c = ((shade * (ao ? AO_LEVEL[ao[k]] : 1)) * 255) | 0;
            b.col.push(c, c, c);
            if (water) b.top.push(isTop);
        }

        if (ao && ao[0] + ao[3] > ao[1] + ao[2]) {
            b.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
        } else {
            b.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
        b.n += 4;
    }

    _emitPlant(b, lx, y, lz, tile, wx, wz) {
        const r = (wx * 73856093) ^ (wz * 19349663);
        const ox = (((r & 15) / 15) - 0.5) * 0.3;
        const oz = ((((r >> 4) & 15) / 15) - 0.5) * 0.3;
        const cx = lx + 0.5 + ox, cz = lz + 0.5 + oz;
        const h = 0.45, s = 0.9;
        const u0 = this.tileU[tile], v0 = this.tileV[tile], ts = this.tileSpan;
        const c = (0.95 * 255) | 0;

        const quads = [
            [cx - h, cz - h, cx + h, cz + h],
            [cx - h, cz + h, cx + h, cz - h]
        ];
        for (let q = 0; q < 2; q++) {
            const [ax, az, bx, bz] = quads[q];
            const base = b.n;
            b.pos.push(ax, y, az, bx, y, bz, ax, y + s, az, bx, y + s, bz);
            b.uv.push(u0, v0, u0 + ts, v0, u0, v0 + ts, u0 + ts, v0 + ts);
            b.col.push(c, c, c, c, c, c, c, c, c, c, c, c);
            // les deux faces (le feuillage est visible des deux côtés)
            b.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3,
                       base, base + 2, base + 1, base + 1, base + 2, base + 3);
            b.n += 4;
        }
    }

    _makeMesh(b, material, kind, startX, startZ, maxY) {
        if (b.n === 0) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(b.uv), 2));
        g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(b.col), 3, true));
        if (kind === KIND_FLUID) g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(b.top), 1));
        g.setIndex(new THREE.BufferAttribute(b.n > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx), 1));

        const h = maxY + 2;
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, h / 2, 8), Math.sqrt(128 + (h / 2) * (h / 2)) + 2);

        const m = new THREE.Mesh(g, material);
        m.position.set(startX, 0, startZ);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        m.userData.kind = kind;
        if (kind === KIND_FLUID) m.renderOrder = 1;
        return m;
    }

    buildChunkMesh(cx, cz) {
        const key = this.getChunkKey(cx, cz);
        if (this.chunks.has(key)) this.removeChunk(cx, cz);

        const chunk = this.dataChunks.get(key);
        if (!chunk || !this.ready) return;
        this.dirty.delete(key);

        const ch3 = this._ch3;
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                ch3[(dz + 1) * 3 + dx + 1] = this.dataChunks.get(this.getChunkKey(cx + dx, cz + dz)) || null;
            }
        }

        const [bOpaque, bCutout, bWater] = this._bld;
        for (const b of this._bld) {
            b.pos.length = 0; b.uv.length = 0; b.col.length = 0; b.idx.length = 0; b.top.length = 0; b.n = 0;
        }

        const B = chunk.blocks;
        const startX = cx << 4, startZ = cz << 4;
        const topY = Math.min(chunk.maxY + 1, WORLD_HEIGHT - 1);
        const aoBuf = [3, 3, 3, 3];

        for (let y = 0; y <= topY; y++) {
            for (let lz = 0; lz < 16; lz++) {
                for (let lx = 0; lx < 16; lx++) {
                    const id = B[(y << 8) | (lz << 4) | lx];
                    if (id === 0) continue;
                    const kind = this.kindT[id];

                    if (kind === KIND_PLANT) {
                        this._emitPlant(bCutout, lx, y, lz, this.tileT[id * 6], startX + lx, startZ + lz);
                        continue;
                    }

                    const b = kind === KIND_OPAQUE ? bOpaque : (kind === KIND_CUTOUT ? bCutout : bWater);
                    let waterTopH = 1;
                    if (kind === KIND_FLUID && this._blk(lx, y + 1, lz) !== id) waterTopH = 0.9;

                    for (let f = 0; f < 6; f++) {
                        const d = FACE_DIR[f];
                        const nid = this._blk(lx + d[0], y + d[1], lz + d[2]);
                        if (this._hidden(kind, id, nid)) continue;

                        let ao = null;
                        if (kind === KIND_OPAQUE) {
                            const offs = FACE_AO[f];
                            for (let k = 0; k < 4; k++) {
                                const o = offs[k];
                                const s1 = this.opaqueT[this._blk(lx + o[0], y + o[1], lz + o[2])];
                                const s2 = this.opaqueT[this._blk(lx + o[3], y + o[4], lz + o[5])];
                                const cn = this.opaqueT[this._blk(lx + o[6], y + o[7], lz + o[8])];
                                aoBuf[k] = (s1 && s2) ? 0 : 3 - (s1 + s2 + cn);
                            }
                            ao = aoBuf;
                        }
                        this._emitFace(b, f, lx, y, lz, this.tileT[id * 6 + f], FACE_SHADE[f], ao, kind === KIND_FLUID, waterTopH);
                    }
                }
            }
        }

        const meshes = [];
        const add = (m) => { if (m) { this.chunksGroup.add(m); meshes.push(m); } };
        add(this._makeMesh(bOpaque, this.mats.opaque, KIND_OPAQUE, startX, startZ, chunk.maxY));
        add(this._makeMesh(bCutout, this.mats.cutout, KIND_CUTOUT, startX, startZ, chunk.maxY));
        add(this._makeMesh(bWater, this.mats.water, KIND_FLUID, startX, startZ, chunk.maxY));

        this.chunks.set(key, { cx, cz, meshes });
    }

    buildChunk(cx, cz) {
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                this.generateTerrainData(cx + x, cz + z);
            }
        }
        this.buildChunkMesh(cx, cz);
    }

    removeChunk(cx, cz) {
        const key = this.getChunkKey(cx, cz);
        const data = this.chunks.get(key);
        if (!data) return;
        for (const mesh of data.meshes) {
            this.chunksGroup.remove(mesh);
            mesh.geometry.dispose();
        }
        this.chunks.delete(key);
    }

    // ============ STREAMING DES CHUNKS ============

    updateChunks(playerX, playerZ, force = false) {
        const pcx = Math.floor(playerX) >> 4;
        const pcz = Math.floor(playerZ) >> 4;
        if (!force && pcx === this.lastPlayerChunkX && pcz === this.lastPlayerChunkZ) return;
        this.lastPlayerChunkX = pcx;
        this.lastPlayerChunkZ = pcz;

        const rd = this.renderDistance;
        const maxD2 = (rd + 0.9) * (rd + 0.9);
        const needed = new Set();
        const queue = [];

        for (let dx = -rd; dx <= rd; dx++) {
            for (let dz = -rd; dz <= rd; dz++) {
                const d2 = dx * dx + dz * dz;
                if (d2 > maxD2) continue; // distance circulaire : ~20% de chunks en moins
                const cx = pcx + dx, cz = pcz + dz;
                const key = this.getChunkKey(cx, cz);
                needed.add(key);
                if (!this.chunks.has(key)) queue.push({ cx, cz, key, dist: Math.sqrt(d2) });
            }
        }
        queue.sort((a, b) => a.dist - b.dist);
        this.chunkQueue = queue;

        for (const [key, c] of this.chunks) {
            if (!needed.has(key)) this.removeChunk(c.cx, c.cz);
        }
        for (const key of this.dirty) if (!this.chunks.has(key)) this.dirty.delete(key);

        // Libère la mémoire des chunks lointains non modifiés (ils seront régénérés à l'identique)
        const keep = rd + 2;
        for (const [key, d] of this.dataChunks) {
            if (!d.modified && (Math.abs(d.cx - pcx) > keep || Math.abs(d.cz - pcz) > keep)) {
                this.dataChunks.delete(key);
            }
        }
        this._lc = null;
    }

    // Une unité de travail : régénère un chunk sale, génère un terrain manquant, ou construit un mesh
    _processOne() {
        if (this.dirty.size) {
            const key = this.dirty.values().next().value;
            this.dirty.delete(key);
            const c = this.dataChunks.get(key);
            if (c && this.chunks.has(key)) this.buildChunkMesh(c.cx, c.cz);
            return true;
        }

        const item = this.chunkQueue[0];
        if (!item) return false;

        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const c = this.dataChunks.get(this.getChunkKey(item.cx + dx, item.cz + dz));
                if (!c || !c.generated) {
                    this.generateTerrainData(item.cx + dx, item.cz + dz);
                    return true;
                }
            }
        }
        this.chunkQueue.shift();
        if (!this.chunks.has(item.key)) this.buildChunkMesh(item.cx, item.cz);
        return true;
    }

    // Budget de temps par frame (ms) pour ne jamais faire chuter les FPS
    processQueue(budget = 4) {
        const t0 = performance.now();
        do {
            if (!this._processOne()) break;
        } while (performance.now() - t0 < budget);
    }

    async preload(cx, cz, radius, onProgress) {
        this.updateChunks(cx * 16 + 8, cz * 16 + 8, true);
        const near = () => this.chunkQueue.filter(c => c.dist <= radius + 0.01).length;
        const total = near() || 1;
        let left;
        while ((left = near()) > 0) {
            const t0 = performance.now();
            while (near() > 0 && performance.now() - t0 < 14) this._processOne();
            if (onProgress) onProgress(1 - near() / total);
            await new Promise(r => setTimeout(r, 0));
        }
    }

    // Cherche un point d'apparition sec et dégagé, le plus proche possible de (0,0)
    findSpawn(maxR = 28) {
        const sea = this.seaLevel;
        for (let r = 0; r <= maxR; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                    if (!this._isChunkGenerated(dx, dz)) continue;
                    const h = this.getTerrainHeight(dx, dz);
                    if (h <= sea + 1) continue;
                    if (this.solidT[this.getBlockI(dx, h + 1, dz)] || this.solidT[this.getBlockI(dx, h + 2, dz)]) continue;
                    return { x: dx + 0.5, y: h + 1, z: dz + 0.5 };
                }
            }
        }
        return { x: 0.5, y: this.getTerrainHeight(0, 0) + 3, z: 0.5 };
    }

    // ============ RAYON DANS LES VOXELS (DDA) : remplace le Raycaster Three.js ============

    raycast(ox, oy, oz, dx, dy, dz, maxDist, out) {
        let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
        const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
        const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
        const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
        const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
        let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
        let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
        let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
        let nx = 0, ny = 0, nz = 0, t = 0;

        while (t <= maxDist) {
            const id = this.getBlockI(x, y, z);
            if (id !== 0 && !this.fluidT[id] && (nx !== 0 || ny !== 0 || nz !== 0)) {
                out.x = x; out.y = y; out.z = z; out.id = id;
                out.nx = nx; out.ny = ny; out.nz = nz;
                return true;
            }
            if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
            else if (tmy < tmz)         { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
            else                        { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
            if (y < -1 || y > WORLD_HEIGHT) return false;
        }
        return false;
    }

    // ============ FLUIDES ============

    _packFluid(x, y, z) {
        return ((x + 1048576) * 2097152 + (z + 1048576)) * 128 + y;
    }

    _unpackFluid(key) {
        const y = key % 128;
        const rest = (key - y) / 128;
        const zz = rest % 2097152;
        const xx = (rest - zz) / 2097152;
        return [xx - 1048576, y, zz - 1048576];
    }

    _markDirtyAround(x, z) {
        const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
        const dxs = [0], dzs = [0];
        if (lx === 0) dxs.push(-1);
        if (lx === 15) dxs.push(1);
        if (lz === 0) dzs.push(-1);
        if (lz === 15) dzs.push(1);
        for (const dx of dxs) for (const dz of dzs) {
            const key = this.getChunkKey(cx + dx, cz + dz);
            if (this.chunks.has(key)) this.dirty.add(key);
        }
    }

    updateFluids(time) {
        if (time - this.lastFluidUpdate < 300 || this.activeFluids.size === 0) return;
        this.lastFluidUpdate = time;

        // Au plus 200 cellules par tick : l'eau coule progressivement sans jamais bloquer le jeu
        const batch = [];
        for (const key of this.activeFluids) {
            batch.push(key);
            if (batch.length >= 200) break;
        }

        for (const key of batch) {
            this.activeFluids.delete(key);
            const [x, y, z] = this._unpackFluid(key);
            const id = this.getBlockI(x, y, z);
            if (!this.fluidT[id]) continue;

            if (y > 0 && this.getBlockI(x, y - 1, z) === 0 && this._isChunkGenerated(x, z)) {
                this.setBlock(x, y - 1, z, id);
                this._markDirtyAround(x, z);
            } else if (y > 0) {
                const sides = [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]];
                for (let i = 0; i < 4; i++) {
                    const nx = sides[i][0], nz = sides[i][1];
                    if (this.getBlockI(nx, y, nz) === 0 && this._isChunkGenerated(nx, nz)) {
                        this.setBlock(nx, y, nz, id);
                        this._markDirtyAround(nx, nz);
                    }
                }
            }
        }
    }

    // ============ ÉDITION DE BLOCS ============

    rebuildAround(x, z) {
        const cx = x >> 4, cz = z >> 4, lx = x & 15, lz = z & 15;
        const dxs = [0], dzs = [0];
        if (lx === 0) dxs.push(-1);
        if (lx === 15) dxs.push(1);
        if (lz === 0) dzs.push(-1);
        if (lz === 15) dzs.push(1);
        for (const dx of dxs) for (const dz of dzs) {
            if ((dx === 0 && dz === 0) || this.chunks.has(this.getChunkKey(cx + dx, cz + dz))) {
                this.buildChunkMesh(cx + dx, cz + dz);
            }
        }
    }

    removeBlockAt(pos) {
        const x = Math.floor(pos.x), y = Math.floor(pos.y), z = Math.floor(pos.z);
        const blockId = this.getBlockI(x, y, z);
        if (blockId === 0 || this.fluidT[blockId]) return 0;

        this.setBlock(x, y, z, 0);

        // Une plante posée dessus disparaît avec son support
        if (this.plantT[this.getBlockI(x, y + 1, z)]) this.setBlock(x, y + 1, z, 0);

        // L'eau voisine vient combler le trou
        const nb = [[x + 1, y, z], [x - 1, y, z], [x, y + 1, z], [x, y - 1, z], [x, y, z + 1], [x, y, z - 1]];
        for (const [nx, ny, nz] of nb) {
            if (this.fluidT[this.getBlockI(nx, ny, nz)]) this.activeFluids.add(this._packFluid(nx, ny, nz));
        }

        this.rebuildAround(x, z);
        return blockId;
    }

    addBlock(pos, blockId) {
        const x = Math.floor(pos.x), y = Math.floor(pos.y), z = Math.floor(pos.z);
        this.setBlock(x, y, z, blockId);
        this.rebuildAround(x, z);
    }
}