class ParticleManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world || null;

        this.geometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        this.materials = new Map();
        this.free = [];
        this.active = [];
        this.MAX = 128;

        for (let i = 0; i < this.MAX; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.getMaterial(0x888888));
            mesh.visible = false;
            scene.add(mesh);
            this.free.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
        }
    }

    getMaterial(color) {
        let m = this.materials.get(color);
        if (!m) {
            m = new THREE.MeshLambertMaterial({ color });
            this.materials.set(color, m);
        }
        return m;
    }

    spawnBlockBreakParticles(pos, blockId) {
        const color = (this.world && this.world.getBlockColor) ? this.world.getBlockColor(blockId) : 0x888888;
        const material = this.getMaterial(color);

        for (let i = 0; i < 16 && this.free.length > 0; i++) {
            const p = this.free.pop();
            p.mesh.material = material;
            p.mesh.visible = true;
            p.mesh.scale.set(1, 1, 1);
            p.mesh.position.set(
                pos.x + 0.5 + (Math.random() - 0.5) * 0.7,
                pos.y + 0.5 + (Math.random() - 0.5) * 0.7,
                pos.z + 0.5 + (Math.random() - 0.5) * 0.7
            );
            p.vx = (Math.random() - 0.5) * 5;
            p.vy = Math.random() * 4 + 1.5;
            p.vz = (Math.random() - 0.5) * 5;
            p.life = p.maxLife = 0.35 + Math.random() * 0.35;
            this.active.push(p);
        }
    }

    update(delta) {
        const gravity = 20.0;
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            p.life -= delta;

            if (p.life <= 0) {
                p.mesh.visible = false;
                this.active[i] = this.active[this.active.length - 1];
                this.active.pop();
                this.free.push(p);
                continue;
            }

            p.vy -= gravity * delta;
            p.mesh.position.x += p.vx * delta;
            p.mesh.position.y += p.vy * delta;
            p.mesh.position.z += p.vz * delta;

            // Réduction progressive de la taille des particules
            const s = Math.max(0.01, (p.life / p.maxLife));
            p.mesh.scale.set(s, s, s);
        }
    }
}