(function () {
    const loadingText = document.getElementById('loading-text');
    const setStatus = (t) => { if (loadingText) loadingText.textContent = t; };

    main().catch((err) => {
        console.error(err);
        setStatus('Erreur : ' + (err && err.message ? err.message : err) + ' (voir la console)');
    });

    async function main() {
        const params = new URLSearchParams(window.location.search);
        const worldId = params.get('world');

        if (!worldId) {
            window.location.href = '/';
            return;
        }

        const worldResponse = await fetch(`/api/worlds/${encodeURIComponent(worldId)}`);
        if (!worldResponse.ok) {
            window.location.href = '/';
            return;
        }

        const worldInfo = await worldResponse.json();

        const changesResponse = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/changes`);
        if (!changesResponse.ok) throw new Error('Impossible de charger les modifications du monde.');
        const changesInfo = await changesResponse.json();

        const playerResponse = await fetch(`/api/worlds/${encodeURIComponent(worldId)}/player`);
        if (!playerResponse.ok) throw new Error('Impossible de charger la position du joueur.');
        const playerInfo = await playerResponse.json();

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

        const waterOverlay = document.createElement('div');
        waterOverlay.style.cssText = 'position:fixed;inset:0;background:rgba(20,80,170,0.32);pointer-events:none;display:none;z-index:12;';
        document.body.appendChild(waterOverlay);

        setStatus('Chargement des textures...');
        const world = new World(scene, {
            worldId: Number(worldInfo.id),
            seed: worldInfo.seed,
            dimensionId: 'overworld'
        });

        world.loadPersistedChanges(changesInfo.changes || []);
        world.loadPlayerStates(playerInfo.states || []);

        if (window.dimensionRegistry) window.dimensionRegistry.setInitialDimension(world, 'overworld');
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

        const chatContainer = document.createElement('div');
        chatContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            width: 380px;
            max-height: 250px;
            display: flex;
            flex-direction: column;
            z-index: 20;
            font-family: monospace;
            font-size: 14px;
            pointer-events: none;
        `;

        const chatLogs = document.createElement('div');
        chatLogs.style.cssText = `
            flex: 1;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.4);
            color: #fff;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 5px;
            text-shadow: 1px 1px 2px #000;
            display: flex;
            flex-direction: column;
            gap: 4px;
        `;

        const chatInput = document.createElement('input');
        chatInput.type = 'text';
        chatInput.placeholder = 'Appuyez sur Entrée pour envoyer une commande...';
        chatInput.style.cssText = `
            width: 100%;
            padding: 8px;
            background: rgba(0, 0, 0, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.4);
            color: #fff;
            border-radius: 4px;
            outline: none;
            display: none;
            pointer-events: auto;
            box-sizing: border-box;
        `;

        chatContainer.appendChild(chatLogs);
        chatContainer.appendChild(chatInput);
        document.body.appendChild(chatContainer);

        let isChatOpen = false;

        function addChatMessage(msg, color = '#ffffff') {
            const line = document.createElement('div');
            line.style.color = color;
            line.textContent = msg;
            chatLogs.appendChild(line);
            chatLogs.scrollTop = chatLogs.scrollHeight;
        }

        function openChat() {
            if (isChatOpen) return;
            isChatOpen = true;
            chatInput.style.display = 'block';
            chatInput.focus();
            if (player.controls) player.controls.unlock();
        }

        function closeChat() {
            if (!isChatOpen) return;
            isChatOpen = false;
            chatInput.value = '';
            chatInput.style.display = 'none';
            if (player.controls) player.controls.lock();
        }

        function executeCommand(cmdText) {
            const trimmed = cmdText.trim();
            if (!trimmed) return;

            addChatMessage('> ' + trimmed, '#aaaaaa');

            const lower = trimmed.toLowerCase();

            if (lower === 'list biomes') {
                let biomes = [];
                if (typeof biomeRegistry !== 'undefined' && biomeRegistry) {
                    biomes = Object.keys(biomeRegistry);
                } else if (world.biomeRegistry) {
                    biomes = Object.keys(world.biomeRegistry);
                } else if (world.biomes) {
                    biomes = Object.keys(world.biomes);
                }

                if (biomes.length > 0) {
                    addChatMessage('Biomes disponibles : ' + biomes.join(', '), '#55ff55');
                } else {
                    addChatMessage('Aucun biome répertorié ou registre indisponible.', '#ff5555');
                }
                return;
            }

            if (lower.startsWith('tp biome ')) {
                const targetBiomeName = trimmed.substring(9).trim();
                if (!targetBiomeName) {
                    addChatMessage('Usage: TP biome <nom_du_biome>', '#ffaa00');
                    return;
                }

                addChatMessage(`Recherche du biome "${targetBiomeName}"...`, '#ffff55');

                let found = false;
                const startX = Math.floor(player.position.x);
                const startZ = Math.floor(player.position.z);
                const step = 32;
                const maxRadius = 3000;

                for (let r = step; r <= maxRadius; r += step) {
                    for (let dx = -r; dx <= r; dx += step) {
                        for (let dz = -r; dz <= r; dz += step) {
                            if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

                            const testX = startX + dx;
                            const testZ = startZ + dz;
                            const biomeAtPos = typeof world.getBiomeAt === 'function' ? world.getBiomeAt(testX, testZ) : null;
                            const biomeName = (typeof biomeAtPos === 'string' ? biomeAtPos : (biomeAtPos && biomeAtPos.name)) || '';

                            if (biomeName.toLowerCase() === targetBiomeName.toLowerCase()) {
                                // Biome trouvé ! Téléportation
                                let surfaceY = 64;
                                if (typeof world.getTerrainHeight === 'function') {
                                    surfaceY = world.getTerrainHeight(testX, testZ);
                                } else if (typeof world.getGroundHeight === 'function') {
                                    surfaceY = world.getGroundHeight(testX, testZ);
                                }

                                player.position.set(testX + 0.5, surfaceY + 2, testZ + 0.5);
                                player.velocity.set(0, 0, 0);
                                world.updateChunks(testX, testZ, true);

                                addChatMessage(`Téléporté au biome "${targetBiomeName}" en [${testX}, ${surfaceY + 2}, ${testZ}]`, '#55ff55');
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                    }
                    if (found) break;
                }

                if (!found) {
                    addChatMessage(`Biome "${targetBiomeName}" introuvable dans un rayon de ${maxRadius} blocs.`, '#ff5555');
                }
                return;
            }

            addChatMessage('Commande inconnue. Essayez "list biomes" ou "TP biome <nom>".', '#ff5555');
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === 't' || e.key === 'T') {
                if (!isChatOpen && player.controls && player.controls.isLocked) {
                    e.preventDefault();
                    openChat();
                }
            } else if (e.key === 'Enter') {
                if (isChatOpen) {
                    executeCommand(chatInput.value);
                    closeChat();
                }
            } else if (e.key === 'Escape') {
                if (isChatOpen) {
                    closeChat();
                }
            }
        });

        const preRadius = Math.min(world.renderDistance, 2);
        await world.preload(0, 0, preRadius, (p) => setStatus('Génération du terrain... ' + Math.round(p * 100) + '%'));

        const savedPlayer = world.getSavedPlayerState('overworld');
        const spawn = world.findSpawn(preRadius * 16 - 4);

        if (savedPlayer) {
            player.position.set(Number(savedPlayer.x), Number(savedPlayer.y), Number(savedPlayer.z));
            player.velocity.set(0, 0, 0);
            if (Number.isFinite(Number(savedPlayer.rot_x)) && Number.isFinite(Number(savedPlayer.rot_y))) {
                player.camera.rotation.set(Number(savedPlayer.rot_x), Number(savedPlayer.rot_y), 0);
            }
        } else {
            player.position.set(spawn.x, spawn.y + 0.05, spawn.z);
            player.velocity.set(0, 0, 0);
        }

        player.isReady = true;
        player.updateCameraPosition();
        world.updateChunks(player.position.x, player.position.z, true);

        world.onDimensionChanged = (dimensionId) => {
            const state = world.getSavedPlayerState(dimensionId);
            if (!state) return;
            player.position.set(Number(state.x), Number(state.y), Number(state.z));
            player.velocity.set(0, 0, 0);
            if (Number.isFinite(Number(state.rot_x)) && Number.isFinite(Number(state.rot_y))) {
                player.camera.rotation.set(Number(state.rot_x), Number(state.rot_y), 0);
            }
            player.updateCameraPosition();
        };

        async function savePlayerState() {
            if (!world.worldId || !player.isReady) return;
            const dimension = world.currentDimensionId || 'overworld';
            const payload = {
                dimension,
                x: player.position.x,
                y: player.position.y,
                z: player.position.z,
                rot_x: player.camera.rotation.x,
                rot_y: player.camera.rotation.y
            };

            world.savedPlayerStates.set(dimension, payload);

            try {
                await fetch(`/api/worlds/${encodeURIComponent(world.worldId)}/player`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.warn('Sauvegarde de la position impossible :', error);
            }
        }

        setInterval(() => { world.flushChanges(); }, 3000);
        setInterval(() => { savePlayerState(); }, 5000);
        window.addEventListener('pagehide', () => {
            savePlayerState();
            world.flushChanges();
        });

        let isWorldLoading = false;
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (clickOverlay) clickOverlay.style.display = 'flex';

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
                // Si le chat est ouvert, on n'affiche pas le menu pause
                if (pauseOverlay && !player.inventory.isOpen && !isChatOpen) pauseOverlay.style.display = 'flex';
            });
        }
        window.addEventListener('inventory-toggle', (e) => {
            if (!e.detail.open && player.controls && !isChatOpen) player.controls.lock();
        });

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

            let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
            if (world.plantT[hit.id]) { px = hit.x; py = hit.y; pz = hit.z; }
            if (py < 0 || py >= world.maxHeight) return;

            const cur = world.getBlockI(px, py, pz);
            if (cur !== 0 && !world.fluidT[cur] && !world.plantT[cur]) return;

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

            // Si on vient de poser un bloc de portail, on regarde si un cadre complet vient de se former
            if (window.dimensionRegistry && type === window.dimensionRegistry.PORTAL_FRAME_ID) {
                window.dimensionRegistry.tryActivatePortal(world, px, py, pz);
            }
        }

        function interact(button) {
            if (!updateTarget()) return;
            if (button === 0) breakBlock();
            else if (button === 2) placeBlock();
        }

        let lastRepeat = 0;
        window.addEventListener('mousedown', (e) => {
            if (!player.controls || !player.controls.isLocked || isWorldLoading || isChatOpen) return;
            if (e.button !== 0 && e.button !== 2) return;
            mouseHeld = e.button;
            lastRepeat = performance.now();
            interact(e.button);
        });
        window.addEventListener('mouseup', (e) => { if (e.button === mouseHeld) mouseHeld = -1; });
        window.addEventListener('contextmenu', (e) => e.preventDefault());

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

            if (minFrame && now - lastFrame < minFrame - 1) return;
            lastFrame = now;

            const delta = Math.min((now - prevTime) * 0.001, 0.1);
            prevTime = now;

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

            if (window.dimensionRegistry) window.dimensionRegistry.checkPlayerInPortal(world, player, now);

            if (now - lastChunkUpdate > 250) {
                world.updateChunks(player.position.x, player.position.z);
                lastChunkUpdate = now;
            }

            const locked = player.controls && player.controls.isLocked;
            if (locked && !isChatOpen && updateTarget()) {
                selBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
                selBox.visible = true;
                if (mouseHeld !== -1 && now - lastRepeat > 220) {
                    lastRepeat = now;
                    if (mouseHeld === 0) breakBlock(); else placeBlock();
                }
            } else {
                selBox.visible = false;
            }

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