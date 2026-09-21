// Particules de bloc cassé : pool d'objets réutilisés (aucune allocation pendant le jeu)
class ParticleManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world || null;

        this.geometry = new THREE.BoxGeometry(0.14, 0.14, 0.14);
        this.materials = new Map();   // une seule matière par couleur
        this.free = [];               // meshes disponibles
        this.active = [];             // particules vivantes
        this.MAX = 96;

        for (let i = 0; i < this.MAX; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.getMaterial(0x888888));
            mesh.visible = false;
            scene.add(mesh);
            this.free.push({ mesh, vx: 0, vy: 0, vz: 0, life: 0 });
        }
    }

    getMaterial(color) {
        let m = this.materials.get(color);
        if (!m) {
            m = new THREE.MeshBasicMaterial({ color });
            this.materials.set(color, m);
        }
        return m;
    }

    spawnBlockBreakParticles(pos, blockId) {
        const color = (this.world && this.world.getBlockColor) ? this.world.getBlockColor(blockId) : 0x888888;
        const material = this.getMaterial(color);

        for (let i = 0; i < 12 && this.free.length > 0; i++) {
            const p = this.free.pop();
            p.mesh.material = material;
            p.mesh.visible = true;
            p.mesh.scale.set(1, 1, 1);
            p.mesh.position.set(
                pos.x + 0.5 + (Math.random() - 0.5) * 0.6,
                pos.y + 0.5 + (Math.random() - 0.5) * 0.6,
                pos.z + 0.5 + (Math.random() - 0.5) * 0.6
            );
            p.vx = (Math.random() - 0.5) * 4;
            p.vy = Math.random() * 3 + 2;
            p.vz = (Math.random() - 0.5) * 4;
            p.life = 0.4 + Math.random() * 0.3;
            this.active.push(p);
        }
    }

    update(delta) {
        const gravity = 18.0;
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

            const s = Math.max(0.01, p.life * 2);
            p.mesh.scale.set(s, s, s);
        }
    }
}