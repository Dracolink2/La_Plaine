


class ShaderRegistry {
    constructor() {
        this.byBlock = new Map();
        this.byBiome = new Map();
        this.enabled = localStorage.getItem('fxShaders') !== 'false';
    }

    registerForBlock(blockId, factory) {
        
        this.byBlock.set(blockId, factory);
    }

    registerForBiome(biomeId, factory) {
        this.byBiome.set(biomeId, factory);
    }

    getMaterialForBlock(blockId, baseTexture, fallback) {
        if (!this.enabled) return fallback;
        const factory = this.byBlock.get(blockId);
        return factory ? factory(baseTexture) : fallback;
    }

    getMaterialForBiome(biomeId, baseTexture, fallback) {
        if (!this.enabled) return fallback;
        const factory = this.byBiome.get(biomeId);
        return factory ? factory(baseTexture) : fallback;
    }

    setEnabled(v) {
        this.enabled = v;
        localStorage.setItem('fxShaders', v);
        window.dispatchEvent(new CustomEvent('shaders-toggled', { detail: { enabled: v } }));
    }
}

window.shaderRegistry = new ShaderRegistry();


shaderRegistry.registerForBlock(11, (baseTexture) => {
    return new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            uTime: { value: 0 },
            uTexture: { value: baseTexture }
        },
        vertexShader: `
            varying vec2 vUv;
            uniform float uTime;
            void main() {
                vUv = uv;
                vec3 pos = position;
                pos.y += sin(pos.x * 3.0 + uTime * 1.5) * 0.03;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            varying vec2 vUv;
            void main() {
                vec4 tex = texture2D(uTexture, vUv);
                gl_FragColor = vec4(tex.rgb, 0.75);
            }
        `
    });
});


shaderRegistry.registerForBiome('terres_brulees', (baseTexture) => {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uTexture: { value: baseTexture }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D uTexture;
            uniform float uTime;
            varying vec2 vUv;
            void main() {
                vec4 tex = texture2D(uTexture, vUv);
                float pulse = 0.08 + 0.04 * sin(uTime * 2.0);
                gl_FragColor = vec4(tex.rgb + vec3(pulse, pulse * 0.3, 0.0), 1.0);
            }
        `
    });
});