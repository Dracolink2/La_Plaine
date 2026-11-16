/* Effets de particules natifs de La Plaine. Désactivables dans Paramètres > Particules. */
class ParticleManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world || null;
        this.geometry = new THREE.BoxGeometry(0.10, 0.10, 0.10);
        this.materials = new Map();
        this.free = [];
        this.active = [];
        this.MAX = 180;
        this.enabled = this.readEnabled();
        for (let i = 0; i < this.MAX; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.getMaterial(0x888888));
            mesh.visible = false;
            mesh.frustumCulled = true;
            scene.add(mesh);
            this.free.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, drag: 0.98 });
        }
    }
    readEnabled() {
        try { return localStorage.getItem('laPlaine.particlesEnabled') !== 'false'; }
        catch (_) { return true; }
    }
    setEnabled(enabled) {
        this.enabled = !!enabled;
        try { localStorage.setItem('laPlaine.particlesEnabled', String(this.enabled)); } catch (_) {}
        if (!this.enabled) {
            for (const p of this.active) { p.mesh.visible = false; this.free.push(p); }
            this.active.length = 0;
        }
    }
    getMaterial(color) {
        if (!this.materials.has(color)) this.materials.set(color, new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.95 }));
        return this.materials.get(color);
    }
    spawnBurst(pos, color = 0xb7a58a, count = 8, options = {}) {
        if (!this.enabled || !pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) return;
        const material = this.getMaterial(color);
        const amount = Math.min(count, this.free.length);
        for (let i = 0; i < amount; i++) {
            const p = this.free.pop();
            p.mesh.material = material;
            p.mesh.visible = true;
            p.mesh.scale.setScalar(0.55 + Math.random() * 0.8);
            p.mesh.position.set(pos.x + (Math.random() - .5) * (options.spread || .35), pos.y + (Math.random() - .5) * (options.spread || .35), pos.z + (Math.random() - .5) * (options.spread || .35));
            p.vx = (Math.random() - .5) * (options.speed || 2.8);
            p.vy = Math.random() * (options.up || 2.5) + .25;
            p.vz = (Math.random() - .5) * (options.speed || 2.8);
            p.life = p.maxLife = options.life || (0.25 + Math.random() * .35);
            p.drag = options.drag || 0.98;
            this.active.push(p);
        }
    }
    spawnBlockBreakParticles(pos, blockId) {
        const color = this.world?.getBlockColor ? this.world.getBlockColor(blockId) : 0x888888;
        this.spawnBurst({ x: pos.x + .5, y: pos.y + .5, z: pos.z + .5 }, color, 12, { spread: .75, speed: 4.5, up: 3, life: .48 });
    }
    spawnBlockPlaceParticles(pos, blockId) {
        const color = this.world?.getBlockColor ? this.world.getBlockColor(blockId) : 0x9a9a9a;
        this.spawnBurst({ x: pos.x + .5, y: pos.y + .5, z: pos.z + .5 }, color, 5, { spread: .42, speed: 1.4, up: .8, life: .2 });
    }
    spawnEntityHitParticles(pos, color = 0xb84c42) {
        this.spawnBurst(pos, color, 7, { spread: .32, speed: 2.1, up: 1.4, life: .28 });
    }
    spawnEntityDeathParticles(pos, color = 0xc4b08a) {
        this.spawnBurst(pos, color, 15, { spread: .8, speed: 2.8, up: 2.1, life: .55 });
    }
    spawnStepParticles(pos, color = 0x9c927d) {
        this.spawnBurst(pos, color, 2, { spread: .18, speed: .65, up: .25, life: .18 });
    }
    update(delta) {
        if (!this.enabled) return;
        const gravity = 12;
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i]; p.life -= delta;
            if (p.life <= 0) {
                p.mesh.visible = false; this.active[i] = this.active[this.active.length - 1]; this.active.pop(); this.free.push(p); continue;
            }
            p.vy -= gravity * delta;
            const drag = Math.pow(p.drag, delta * 60);
            p.vx *= drag; p.vz *= drag;
            p.mesh.position.x += p.vx * delta; p.mesh.position.y += p.vy * delta; p.mesh.position.z += p.vz * delta;
            const t = p.life / p.maxLife;
            p.mesh.scale.setScalar(Math.max(.015, t) * .8);
        }
    }
}
window.ParticleManager = ParticleManager;
