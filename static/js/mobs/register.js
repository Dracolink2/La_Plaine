/**
 * Systèmes d'entités vivantes et registre de leurs définitions. Garder les limites
 * de population et les recherches de terrain mesurées : elles sont appelées pendant
 * la partie et peuvent devenir coûteuses si elles parcourent trop de blocs.
 */

function mobBoxUv(size, offset) {
    const [w, h, d] = size;
    const [u, v] = offset;
    return {
        right: [u + d + w, v + d, u + d + w + d, v + d + h],
        left: [u, v + d, u + d, v + d + h],
        bottom: [u + d, v, u + d + w, v + d],
        top: [u + d + w, v + d, u + d + w + w, v],
        front: [u + d, v + d, u + d + w, v + d + h],
        back: [u + d + w + d, v + d, u + d + w + d + d, v + d + h]
    };
}

function createMobBox(texture, textureSize, part) {
    const size = part.size;
    const uv = part.uvFaces || part.uvMap || mobBoxUv(size, part.uv || [0, 0]);
    const positions = [];
    const uvs = [];
    const indices = [];
    const inflate = part.inflate || 0;
    const hx = size[0] * 0.5 + inflate;
    const hy = size[1] * 0.5 + inflate;
    const hz = size[2] * 0.5 + inflate;
    const actualWidth = texture.image?.width || textureSize[0];
    const actualHeight = texture.image?.height || textureSize[1];

    const addFace = (name, corners, rect) => {
        const start = positions.length / 3;
        for (const p of corners) positions.push(p[0], p[1], p[2]);
        const [u1, v1, u2, v2] = rect;
        const sx = 1 / actualWidth;
        const sy = 1 / actualHeight;
        const orders = {
            front: [[u1, v2], [u2, v2], [u2, v1], [u1, v1]],
            back: [[u2, v2], [u1, v2], [u1, v1], [u2, v1]],
            right: [[u2, v2], [u1, v2], [u1, v1], [u2, v1]],
            left: [[u2, v2], [u1, v2], [u1, v1], [u2, v1]],
            top: [[u1, v1], [u2, v1], [u2, v2], [u1, v2]],
            bottom: [[u1, v2], [u2, v2], [u2, v1], [u1, v1]]
        };
        const uvCorners = orders[name] || orders.front;
        const finalUv = part.mirror
            ? uvCorners.map(([u, v]) => [u1 + u2 - u, v])
            : uvCorners;
        for (const [u, v] of finalUv) uvs.push(u * sx, 1 - v * sy);
        indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
    };

    addFace('front', [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz]], uv.front);
    addFace('back', [[hx, -hy, hz], [-hx, -hy, hz], [-hx, hy, hz], [hx, hy, hz]], uv.back);
    addFace('right', [[hx, -hy, -hz], [hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz]], uv.right);
    addFace('left', [[-hx, -hy, hz], [-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz]], uv.left);
    addFace('top', [[-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz]], uv.top);
    addFace('bottom', [[-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz]], uv.bottom);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Les mobs doivent recevoir l'éclairage de la scène : MeshBasicMaterial
    // ignorait les lumières et donnait aux créatures un aspect toujours lumineux.
    // Lambert conserve un rendu simple adapté aux textures pixelisées.
    const material = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1,
        side: THREE.FrontSide,
        vertexColors: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...(part.position || [0, 0, 0]));
    mesh.rotation.set(...(part.rotation || [0, 0, 0]));
    mesh.userData.mobPart = part.name || '';
    return mesh;
}

function createMobSound(definition, kind) {
    const profile = definition.soundProfile;
    if (!profile || (!window.AudioContext && !window.webkitAudioContext)) return;
    const now = performance.now();
    if (definition._lastSound && now - definition._lastSound < 180) return;
    definition._lastSound = now;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = window._mobAudioContext || (window._mobAudioContext = new AudioCtx());
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = profile.base || 180;
    const offset = profile[kind] || 0;
    const frequency = Math.max(45, base + offset + (Math.random() - 0.5) * base * 0.16);
    const duration = kind === 'death' ? 0.22 : kind === 'hurt' ? 0.16 : 0.3;
    const sfxScale = Math.max(0, Math.min(1, Number(window.soundManager?.sfxVolume ?? 0.8)));
    const masterScale = Math.max(0, Math.min(1, Number(window.soundManager?.masterVolume ?? 0.8)));
    const volume = (profile.volume || 0.03) * sfxScale * masterScale;
    if (volume <= 0) return;
    osc.type = profile.wave || 'triangle';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.72), ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
}

class MobEntity {
    constructor(definition, world, scene, x, y, z) {
        this.definition = definition;
        this.world = world;
        this.scene = scene;
        this.position = new THREE.Vector3(x, y, z);
        this.health = definition.health ?? 1;
        this.dead = false;
        this.direction = Math.random() * Math.PI * 2;
        this.wanderTime = 0;
        this.idleSoundTime = 4 + Math.random() * 8;
        this.walkTime = Math.random() * Math.PI * 2;
        this.texture = null;
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        // Ombre circulaire légère, sans lumière ni shadow map coûteuse.
        this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide }));
        this.shadow.rotation.x = -Math.PI / 2;
        this.shadow.position.set(x, y + 0.015, z);
        this.shadow.renderOrder = 1;
        scene.add(this.shadow);
        this.parts = [];
        this.legs = [];
        this.namedParts = Object.create(null);
        this.animationTime = Math.random() * Math.PI * 2;
        this.hurtTimer = 0;
        this._createVisual();
        scene.add(this.group);
    }

    _createVisual() {
        const loader = new THREE.TextureLoader();
        loader.load(this.definition.texture, texture => {
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.generateMipmaps = false;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            this.texture = texture;
            const model = this.definition.model;
            if (!model) return;
            for (const part of model.parts || []) {
                const mesh = createMobBox(texture, model.textureSize, part);
                this.group.add(mesh);
                this.parts.push(mesh);
                if (part.leg) this.legs.push(mesh);
                if (part.name) this.namedParts[part.name] = { mesh, basePosition: mesh.position.clone(), baseRotation: mesh.rotation.clone() };
            }
            this.group.scale.setScalar(model.scale || 1 / 16);
            this.group.position.y = this.position.y + (model.yOffset || 0);
        });
    }

    _playSound(kind) {
        createMobSound(this.definition, kind);
    }

    update(delta) {
        if (this.dead) return;
        this.wanderTime -= delta;
        if (this.wanderTime <= 0) {
            this.wanderTime = 1.5 + Math.random() * 4;
            this.direction += (Math.random() - 0.5) * 1.8;
        }
        const speed = this.definition.speed || 1;
        const moving = speed > 0 && this.wanderTime > 0.05;
        const dx = Math.cos(this.direction) * speed * delta;
        const dz = Math.sin(this.direction) * speed * delta;
        const nx = this.position.x + dx;
        const nz = this.position.z + dz;
        const ny = this.world.getTerrainHeight(Math.floor(nx), Math.floor(nz)) + 1;
        const id = this.world.getBlockI(Math.floor(nx), Math.floor(ny - 1), Math.floor(nz));
        if (this.world.solidT[id]) {
            this.position.x = nx;
            this.position.z = nz;
            this.position.y = ny;
            if (moving) this.walkTime += delta * speed * 5;
        } else {
            this.direction += Math.PI * 0.5 + Math.random() * Math.PI;
        }
        const model = this.definition.model || {};
        this.animationTime += delta;
        this.hurtTimer = Math.max(0, this.hurtTimer - delta);
        this.group.position.set(this.position.x, this.position.y + (model.yOffset || 0), this.position.z);
        if (this.shadow) {
            const groundY = this.world.getTerrainHeight(Math.floor(this.position.x), Math.floor(this.position.z));
            this.shadow.position.set(this.position.x, groundY + 1.025, this.position.z);
            const heightAboveGround = Math.max(0, this.position.y - (groundY + 1));
            const scale = Math.max(0.55, 1 - heightAboveGround * 0.12);
            this.shadow.scale.setScalar(scale);
            this.shadow.material.opacity = Math.max(0.06, 0.20 - heightAboveGround * 0.025);
        }
        this.group.rotation.y = -this.direction - Math.PI / 2;
        const swing = Math.sin(this.walkTime) * 0.58;
        const idle = Math.sin(this.animationTime * 1.8);
        for (let i = 0; i < this.legs.length; i++) {
            this.legs[i].rotation.x = (i % 2 === 0 ? swing : -swing) * (moving ? 1 : 0.12);
        }
        // Animations organiques inspirées des mods d'ambiance : respiration,
        // mouvements de tête et battements d'ailes, sans shader ni mod externe.
        const body = this.namedParts.body?.mesh;
        const head = this.namedParts.head?.mesh;
        if (body) {
            const base = this.namedParts.body.basePosition;
            body.position.y = base.y + (moving ? Math.abs(Math.sin(this.walkTime * 2)) * 0.22 : idle * 0.055);
            body.rotation.z = moving ? Math.sin(this.walkTime) * 0.035 : Math.sin(this.animationTime * 0.8) * 0.018;
        }
        if (head) {
            const baseRot = this.namedParts.head.baseRotation;
            head.rotation.x = baseRot.x + Math.sin(this.animationTime * 1.35) * (moving ? 0.07 : 0.12);
            head.rotation.z = baseRot.z + Math.sin(this.animationTime * 0.9) * 0.035;
        }
        for (const wingName of ['wing1', 'wing2']) {
            const wing = this.namedParts[wingName]?.mesh;
            if (wing) {
                const sign = wingName === 'wing1' ? -1 : 1;
                wing.rotation.z = this.namedParts[wingName].baseRotation.z + Math.sin(this.animationTime * (moving ? 10 : 2.8)) * (moving ? 0.48 : 0.10) * sign;
            }
        }
        // Flash bref lors d'un coup reçu, en conservant les matériaux d'origine.
        if (this.hurtTimer > 0) {
            const flash = this.hurtTimer > 0.12;
            for (const part of this.parts) {
                if (!part.material) continue;
                if (flash) part.material.color.setRGB(1, 0.55, 0.55);
                else part.material.color.setRGB(1, 1, 1);
            }
            this.group.position.x += Math.sin(this.hurtTimer * 65) * 0.025;
        } else {
            for (const part of this.parts) if (part.material) part.material.color.setRGB(1, 1, 1);
        }
        this.idleSoundTime -= delta;
        if (this.idleSoundTime <= 0) {
            this.idleSoundTime = 6 + Math.random() * 14;
            this._playSound('idle');
        }
    }

    damage(amount, player = null) {
        if (this.dead) return false;
        this.health -= Math.max(0, amount);
        this.hurtTimer = 0.22;
        this._playSound('hurt');
        window.particleManager?.spawnEntityHitParticles({ x: this.position.x, y: this.position.y + 0.65, z: this.position.z });
        window.soundManager?.playEntityHit?.();
        if (this.health <= 0) {
            this.die(player);
            return true;
        }
        return false;
    }

    die(player = null) {
        if (this.dead) return;
        this.dead = true;
        this._playSound('death');
        window.particleManager?.spawnEntityDeathParticles({ x: this.position.x, y: this.position.y + 0.55, z: this.position.z });
        window.soundManager?.playEntityDeath?.();
        if (player?.inventory) {
            for (const drop of (this.definition.drops || [])) {
                if (Math.random() > (drop.chance ?? 1)) continue;
                const min = Math.max(1, Number(drop.min) || 1), max = Math.max(min, Number(drop.max) || min);
                const dropId = Number(drop.id);
                if (Number.isSafeInteger(dropId) && dropId > 0 && (window.itemsRegistry?.get(dropId) || window.blockRegistry?.get(dropId))) {
                    player.inventory.addItem(dropId, min + Math.floor(Math.random() * (max - min + 1)));
                } else {
                    console.warn(`[La Plaine] Drop ignoré : identifiant d'objet invalide (${drop.id}) pour ${this.definition.id}`);
                }
            }
        }
        this.scene.remove(this.group);
        if (this.shadow) { this.scene.remove(this.shadow); this.shadow.geometry.dispose(); this.shadow.material.dispose(); this.shadow = null; }
        for (const part of this.parts) {
            part.geometry.dispose();
            part.material.dispose();
        }
        if (this.texture) this.texture.dispose();
    }
}

class MobManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.mobs = new Set();
        this.spawnTimer = 0;
        this.maxMobs = 48;
        this.spawnInterval = 1.5;
        this.attackTimer = 0;
    }
    _getDefinitions() { return window.mobRegistry ? window.mobRegistry.getAll() : []; }
    _trySpawn(playerX, playerZ) {
        if (this.mobs.size >= this.maxMobs) return;
        for (let attempt = 0; attempt < 8; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 12 + Math.random() * 28;
            const x = Math.floor(playerX + Math.cos(angle) * distance);
            const z = Math.floor(playerZ + Math.sin(angle) * distance);
            const biome = this.world.biomeRegistry?.getBiomeAt(x, z, this.world.perlin);
            const biomeId = typeof biome === 'string' ? biome : biome?.id || biome?.name;
            const y = this.world.getTerrainHeight(x, z);
            if (y < 1 || y >= this.world.maxHeight - 3) continue;
            const ground = this.world.getBlockI(x, y, z);
            if (!this.world.solidT[ground]) continue;
            if (this.world.getBlockI(x, y + 1, z) !== 0 || this.world.getBlockI(x, y + 2, z) !== 0) continue;
            const definitions = this._getDefinitions().filter(d => {
                const biomes = d.spawn?.biomes;
                return (!biomes || !biomes.length || biomes.includes(biomeId)) && Math.random() < (d.spawn?.chance ?? 1);
            });
            if (!definitions.length) continue;
            const definition = definitions[Math.floor(Math.random() * definitions.length)];
            const groupMin = Math.max(1, definition.spawn?.minGroup || 1);
            const groupMax = Math.max(groupMin, definition.spawn?.maxGroup || groupMin);
            const count = Math.min(groupMin + Math.floor(Math.random() * (groupMax - groupMin + 1)), this.maxMobs - this.mobs.size);
            for (let i = 0; i < count; i++) {
                const ox = x + (Math.random() - 0.5) * 3;
                const oz = z + (Math.random() - 0.5) * 3;
                const oy = this.world.getTerrainHeight(Math.floor(ox), Math.floor(oz)) + 1;
                this.mobs.add(new MobEntity(definition, this.world, this.scene, ox + 0.5, oy, oz + 0.5));
            }
            return;
        }
    }
    hitTarget(origin, direction, reach, player) {
        let best = null, bestAlong = reach + 1;
        for (const mob of this.mobs) {
            if (mob.dead) continue;
            const model = mob.definition.model || {};
            const centerY = mob.position.y + (model.targetHeight || 0.85);
            const dx = mob.position.x - origin.x, dy = centerY - origin.y, dz = mob.position.z - origin.z;
            const along = dx * direction.x + dy * direction.y + dz * direction.z;
            if (along < 0 || along > reach || along >= bestAlong) continue;
            const px = dx - direction.x * along, py = dy - direction.y * along, pz = dz - direction.z * along;
            const radius = Number(model.targetRadius) || 1.15;
            if (px*px + py*py + pz*pz < radius*radius) { best = mob; bestAlong = along; }
        }
        if (best) { const slot = player.inventory.getSelectedSlot(); const tool = window.itemsRegistry?.get(slot?.type); best.damage(tool?.tool ? (tool.level >= 2 ? 4 : 2) : 1, player); return true; }
        return false;
    }
    update(delta, player) {
        if (!player) return;
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = this.spawnInterval;
            this._trySpawn(player.position.x, player.position.z);
        }
        const maxDistance = Math.max(48, this.world.renderDistance * 16 + 24);
        const maxDistanceSq = maxDistance * maxDistance;
        for (const mob of this.mobs) {
            if (mob.dead) { this.mobs.delete(mob); continue; }
            const dx = mob.position.x - player.position.x;
            const dz = mob.position.z - player.position.z;
            if (dx * dx + dz * dz > maxDistanceSq) { mob.die(); this.mobs.delete(mob); continue; }
            mob.update(delta);
            if (mob.definition.hostile && Math.abs(dx) < 1.1 && Math.abs(dz) < 1.1 && Math.abs(mob.position.y - player.position.y) < 2.2) {
                this.attackTimer -= delta;
                if (this.attackTimer <= 0) { player.takeDamage(this.world.dayTime > this.world.dayDuration * 0.5 ? 1 : 0.5); this.attackTimer = 1.25; }
            }
        }
    }
}

class MobRegistry {
    constructor() { this.definitions = []; }
    register(definition) { this.definitions.push(definition); }
    getAll() { return this.definitions; }
}

window.mobRegistry = window.mobRegistry || new MobRegistry();
for (const definition of (window.mobDefinitions || [])) window.mobRegistry.register(definition);
window.MobEntity = MobEntity;
window.MobManager = MobManager;
