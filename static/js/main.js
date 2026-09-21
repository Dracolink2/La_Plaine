// ============================================================================
//  main.js — La Plaine (version optimisée)
// ============================================================================
(function () {
    const loadingText = document.getElementById('loading-text');
    const setStatus = (t) => { if (loadingText) loadingText.textContent = t; };

    main().catch((err) => {
        console.error(err);
        setStatus('Erreur : ' + (err && err.message ? err.message : err) + ' (voir la console)');
    });

    async function main() {
        // --- 1. SCÈNE ET RENDU ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb);
        scene.fog = new THREE.Fog(0x87ceeb, 20, 44);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: false,
            stencil: false,
            powerPreference: 'high-performance'
        });
        const canvas = renderer.domElement;
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;display:block;z-index:0;';
        document.body.appendChild(canvas);

        // --- RÉSOLUTION : réglage du menu + adaptation automatique en mode "auto" ---
        let autoScale = 1; // ne fait que baisser si le PC n'arrive pas à tenir les FPS
        function applyResolution() {
            const setting = localStorage.getItem('gameResolution') || 'auto';
            const fixed = { '480p': 480, '720p': 720, '1080p': 1080, '2k': 1440, '4k': 2160 }[setting];
            const h = Math.max(2, Math.round(fixed || window.innerHeight * autoScale));
            const w = Math.max(2, Math.round(h * (window.innerWidth / window.innerHeight)));
            renderer.setSize(w, h, false);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
        applyResolution();
        window.addEventListener('resize', applyResolution);

        // Overlay "sous l'eau" : un simple div translucide (bien moins coûteux qu'un filtre CSS sur le canvas)
        const waterOverlay = document.createElement('div');
        waterOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(20,80,170,0.32);pointer-events:none;display:none;z-index:12;';
        document.body.appendChild(waterOverlay);

        // --- 2. MONDE, PARTICULES ET JOUEUR ---
        setStatus('Chargement des textures...');
        const world = new World(scene);
        await world.init(setStatus);

        const particleManager = new ParticleManager(scene, world);
        const player = new Player(camera, document.body, world);
        if (player.inventory && typeof player.inventory.updateUI === 'function') player.inventory.updateUI();
        new InventoryUI(player);

        const loadingOverlay = document.getElementById('loading-overlay');
        const clickOverlay = document.getElementById('click-overlay');
        const pauseOverlay = document.getElementById('pause-overlay');
        const btnStart = document.getElementById('btn-start');
        const btnResume = document.getElementById('btn-resume');
        const cloudToggleGame = document.getElementById('cloud-toggle-game');
        const waterShaderToggleGame = document.getElementById('water-shader-toggle-game');

        // --- 3. GÉNÉRATION DU MONDE DE DÉPART ---
        const preRadius = Math.min(world.renderDistance, 2);
        await world.preload(0, 0, preRadius, (p) => setStatus('Génération du terrain... ' + Math.round(p * 100) + '%'));

        const spawn = world.findSpawn(preRadius * 16 - 4);
        player.position.set(spawn.x, spawn.y + 0.05, spawn.z);
        player.velocity.set(0, 0, 0);
        player.isReady = true;
        player.updateCameraPosition();
        world.updateChunks(spawn.x, spawn.z, true);

        let isWorldLoading = false;
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (clickOverlay) clickOverlay.style.display = 'flex';

        // --- 4. OVERLAYS & CONTRÔLES ---
        if (cloudToggleGame) {
            cloudToggleGame.checked = localStorage.getItem('showClouds') !== 'false';
            cloudToggleGame.addEventListener('change', (e) => {
                world.setCloudsVisible(e.target.checked);
                localStorage.setItem('showClouds', e.target.checked);
            });
        }
        if (waterShaderToggleGame) {
            waterShaderToggleGame.checked = world.settings.waterShader;
            waterShaderToggleGame.addEventListener('change', (e) => world.setWaterShaderEnabled(e.target.checked));
        }

        const startGame = () => {
            if (window.soundManager && typeof window.soundManager.init === 'function') window.soundManager.init();
            if (player.controls) player.controls.lock();
        };
        if (btnStart) btnStart.addEventListener('click', startGame);
        if (btnResume) btnResume.addEventListener('click', startGame);

        let mouseHeld = -1;
        if (player.controls) {
            player.controls.addEventListener('lock', () => {
                if (clickOverlay) clickOverlay.style.display = 'none';
                if (pauseOverlay) pauseOverlay.style.display = 'none';
            });
            player.controls.addEventListener('unlock', () => {
                mouseHeld = -1;
                if (pauseOverlay && !player.inventory.isOpen) pauseOverlay.style.display = 'flex';
            });
        }
        window.addEventListener('inventory-toggle', (e) => {
            if (!e.detail.open && player.controls) player.controls.lock();
        });

        // --- 5. INTERACTION AVEC LES BLOCS (rayon DDA, zéro allocation) ---
        const REACH = 6;
        const hit = { x: 0, y: 0, z: 0, id: 0, nx: 0, ny: 0, nz: 0 };
        const dir = new THREE.Vector3();
        let hasTarget = false;

        const selBox = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
            new THREE.LineBasicMaterial({ color: 0x000000, fog: false })
        );
        selBox.visible = false;
        scene.add(selBox);

        function updateTarget() {
            camera.getWorldDirection(dir);
            hasTarget = world.raycast(camera.position.x, camera.position.y, camera.position.z, dir.x, dir.y, dir.z, REACH, hit);
            return hasTarget;
        }

        function breakBlock() {
            const removed = world.removeBlockAt(hit);
            if (removed > 0) {
                player.inventory.addBlock(removed);
                if (window.soundManager) window.soundManager.playBlockBreak(removed);
                particleManager.spawnBlockBreakParticles(hit, removed);
            }
        }

        function placeBlock() {
            const slot = player.inventory.getSelectedSlot();
            if (!slot || slot.type === 0 || slot.count <= 0) return;

            // Viser une plante la remplace ; sinon on pose contre la face visée
            let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
            if (world.plantT[hit.id]) { px = hit.x; py = hit.y; pz = hit.z; }
            if (py < 0 || py >= world.maxHeight) return;

            const cur = world.getBlockI(px, py, pz);
            if (cur !== 0 && !world.fluidT[cur] && !world.plantT[cur]) return;

            // Ne pas s'emmurer : refuse si un bloc plein chevauche le joueur
            if (world.solidT[slot.type]) {
                const p = player.position, hw = player.width / 2;
                if (px < p.x + hw && px + 1 > p.x - hw &&
                    py < p.y + player.height && py + 1 > p.y &&
                    pz < p.z + hw && pz + 1 > p.z - hw) return;
            }

            const type = player.inventory.useSelectedBlock();
            if (!type) return;
            world.addBlock({ x: px, y: py, z: pz }, type);
            if (window.soundManager) window.soundManager.playBlockPlace(type);
        }

        function interact(button) {
            if (!updateTarget()) return;
            if (button === 0) breakBlock();
            else if (button === 2) placeBlock();
        }

        let lastRepeat = 0;
        window.addEventListener('mousedown', (e) => {
            if (!player.controls || !player.controls.isLocked || isWorldLoading) return;
            if (e.button !== 0 && e.button !== 2) return;
            mouseHeld = e.button;
            lastRepeat = performance.now();
            interact(e.button);
        });
        window.addEventListener('mouseup', (e) => { if (e.button === mouseHeld) mouseHeld = -1; });
        window.addEventListener('contextmenu', (e) => e.preventDefault());

        // --- 6. BOUCLE PRINCIPALE ---
        const fpsVal = document.getElementById('fps-val');
        const savedLimit = localStorage.getItem('fpsLimit') || 'max';
        const limit = savedLimit === 'max' ? 0 : parseInt(savedLimit, 10) || 0;
        const minFrame = limit ? 1000 / limit : 0;

        let frameCount = 0, lastFpsUpdate = performance.now(), lastFrame = 0, prevTime = performance.now();
        let lastChunkUpdate = 0, wasUnderwater = false, slowSeconds = 0;
        const startedAt = performance.now();

        function animate(now) {
            requestAnimationFrame(animate);
            now = now || performance.now();

            // Limiteur de FPS (réglage du menu)
            if (minFrame && now - lastFrame < minFrame - 1) return;
            lastFrame = now;

            const delta = Math.min((now - prevTime) * 0.001, 0.1);
            prevTime = now;

            // Compteur FPS + résolution adaptative (mode auto uniquement)
            frameCount++;
            if (now - lastFpsUpdate >= 1000) {
                const fps = (frameCount * 1000) / (now - lastFpsUpdate);
                if (fpsVal) fpsVal.textContent = Math.round(fps);
                frameCount = 0;
                lastFpsUpdate = now;

                const isAuto = (localStorage.getItem('gameResolution') || 'auto') === 'auto';
                const target = limit ? Math.min(limit, 60) : 60;
                if (isAuto && now - startedAt > 4000 && fps < target * 0.8 && autoScale > 0.5) {
                    if (++slowSeconds >= 2) {
                        autoScale = Math.max(0.5, autoScale * 0.85);
                        slowSeconds = 0;
                        applyResolution();
                    }
                } else {
                    slowSeconds = 0;
                }
            }

            world.updateDayNightCycle(delta, camera.position);
            world.processQueue(4);

            player.update(delta);
            particleManager.update(delta);
            world.updateFluids(now);

            if (now - lastChunkUpdate > 250) {
                world.updateChunks(player.position.x, player.position.z);
                lastChunkUpdate = now;
            }

            // Bloc visé + répétition du clic maintenu
            const locked = player.controls && player.controls.isLocked;
            if (locked && updateTarget()) {
                selBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
                selBox.visible = true;
                if (mouseHeld !== -1 && now - lastRepeat > 220) {
                    lastRepeat = now;
                    if (mouseHeld === 0) breakBlock(); else placeBlock();
                }
            } else {
                selBox.visible = false;
            }

            // Sous l'eau : brouillard épais + voile bleu + son étouffé
            const underwater = world.isFluidAt(camera.position.x, camera.position.y, camera.position.z);
            if (underwater !== wasUnderwater) {
                wasUnderwater = underwater;
                world.setUnderwater(underwater);
                waterOverlay.style.display = underwater ? 'block' : 'none';
                if (window.soundManager) window.soundManager.setUnderwater(underwater);
            }

            renderer.render(scene, camera);
        }
        requestAnimationFrame(animate);
    }
})();