/* Gestionnaire de shaders plein écran au format ZIP de La Plaine.
 * La cible de post-traitement n'a pas besoin de profondeur : la scène 3D
 * est déjà rendue dans sa propre cible avant le passage plein écran.
 */
(function () {
    'use strict';

    class ShaderPackRenderer {
        constructor(renderer) {
            this.renderer = renderer;
            this.target = null;
            this.targetWidth = 0;
            this.targetHeight = 0;
            this.scene = new THREE.Scene();
            this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
            this.material = null;
            this.mesh = null;
            this.startedAt = performance.now();
            this.disposed = false;
            this.resize();
        }

        getScale() {
            let value = 1;
            try {
                const stored = Number(localStorage.getItem('laPlaine.shaderRenderScale'));
                if (Number.isFinite(stored) && stored > 0) value = stored;
            } catch (_) {}
            return Math.min(1, Math.max(0.5, value));
        }

        resize() {
            if (this.disposed || !this.renderer || !this.renderer.domElement) return;
            const canvas = this.renderer.domElement;
            const scale = this.getScale();
            const width = Math.max(2, Math.round((canvas.width || 2) * scale));
            const height = Math.max(2, Math.round((canvas.height || 2) * scale));

            // Évite de recréer la texture GPU lors d'un resize qui ne change
            // pas réellement sa résolution.
            if (this.target && width === this.targetWidth && height === this.targetHeight) {
                if (this.material && this.material.uniforms.uResolution) {
                    this.material.uniforms.uResolution.value.set(width, height);
                }
                return;
            }

            if (this.target) this.target.dispose();
            this.target = new THREE.WebGLRenderTarget(width, height, {
                minFilter: THREE.LinearFilter,
                magFilter: THREE.LinearFilter,
                format: THREE.RGBAFormat,
                depthBuffer: false,
                stencilBuffer: false
            });
            this.targetWidth = width;
            this.targetHeight = height;
            if (this.material && this.material.uniforms.uResolution) {
                this.material.uniforms.uResolution.value.set(width, height);
            }
        }

        async setActive(id) {
            if (!id || id === 'off') { this.clear(); return; }
            const response = await fetch('/api/shaders/' + encodeURIComponent(id), { cache: 'no-store' });
            if (!response.ok) throw new Error('Shader introuvable : ' + id);
            const pack = await response.json();
            const vertexShader = pack.vertex_shader || `
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
            `;
            const fragmentShader = pack.fragment_shader;
            if (typeof fragmentShader !== 'string' || !fragmentShader.trim()) {
                throw new Error('Le pack ne contient pas de fragment shader.');
            }
            const width = this.targetWidth || Math.max(2, this.renderer.domElement.width || 2);
            const height = this.targetHeight || Math.max(2, this.renderer.domElement.height || 2);
            const next = new THREE.ShaderMaterial({
                uniforms: {
                    tDiffuse: { value: null },
                    uTime: { value: 0 },
                    uResolution: { value: new THREE.Vector2(width, height) }
                },
                vertexShader,
                fragmentShader,
                depthTest: false,
                depthWrite: false
            });
            if (this.mesh) {
                this.scene.remove(this.mesh);
                this.mesh.geometry.dispose();
            }
            if (this.material) this.material.dispose();
            this.material = next;
            this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
            this.scene.add(this.mesh);
            this.resize();
        }

        clear() {
            if (this.mesh) {
                this.scene.remove(this.mesh);
                this.mesh.geometry.dispose();
            }
            if (this.material) this.material.dispose();
            this.material = null;
            this.mesh = null;
        }

        render(scene, camera) {
            if (this.disposed || !this.material || !this.target) {
                this.renderer.render(scene, camera);
                return;
            }
            this.material.uniforms.uTime.value = (performance.now() - this.startedAt) / 1000;
            this.material.uniforms.tDiffuse.value = this.target.texture;
            try {
                this.renderer.setRenderTarget(this.target);
                this.renderer.render(scene, camera);
            } finally {
                this.renderer.setRenderTarget(null);
            }
            this.renderer.render(this.scene, this.camera);
        }

        dispose() {
            if (this.disposed) return;
            this.clear();
            if (this.target) this.target.dispose();
            this.target = null;
            this.targetWidth = 0;
            this.targetHeight = 0;
            this.disposed = true;
        }
    }

    window.ShaderPackRenderer = ShaderPackRenderer;
})();
