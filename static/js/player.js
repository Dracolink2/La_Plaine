// --- INVENTAIRE ---
// 36 cases : 9 pour la hotbar (0-8), 27 pour le sac (9-35). Stack max : 100.
const INVENTORY_SIZE = 36;
const HOTBAR_SIZE = 9;
const STACK_LIMIT = 100;

// Icône d'un bloc (texture) pour la hotbar et l'inventaire
function applyBlockIcon(el, def) {
    const t = def && def.textures;
    const url = t ? (t.all || t.sides || t.top || '') : '';
    if (url) {
        el.style.backgroundImage = `url('${url}')`;
        el.style.backgroundSize = '68%';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
        el.style.imageRendering = 'pixelated';
    } else {
        el.style.backgroundImage = '';
    }
    return !!url;
}

class Inventory {
    constructor() {
        this.slots = Array.from({ length: INVENTORY_SIZE }, () => ({ type: 0, count: 0 }));
        this.selectedSlotIndex = 0;
        this.isOpen = false;
        this.onChange = null;
    }

    getSelectedSlot() {
        return this.slots[this.selectedSlotIndex];
    }

    selectSlot(index) {
        if (index >= 0 && index < HOTBAR_SIZE) {
            this.selectedSlotIndex = index;
            if (typeof soundManager !== 'undefined' && soundManager?.playSelectSlot) {
                soundManager.playSelectSlot();
            }
            this.updateUI();
        }
    }

    addBlock(blockId, amount = 1) {
        if (!blockId || blockId === 0 || amount <= 0) return amount;

        let remaining = amount;

        // Fill existing stacks first
        for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot.type === blockId && slot.count < STACK_LIMIT) {
                const space = STACK_LIMIT - slot.count;
                const toAdd = Math.min(space, remaining);
                slot.count += toAdd;
                remaining -= toAdd;
            }
        }

        // Fill empty slots
        for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot.type === 0) {
                const toAdd = Math.min(STACK_LIMIT, remaining);
                slot.type = blockId;
                slot.count = toAdd;
                remaining -= toAdd;
            }
        }

        this.updateUI();
        return remaining;
    }

    useSelectedBlock() {
        const current = this.getSelectedSlot();
        if (current && current.type !== 0 && current.count > 0) {
            current.count--;
            const placedType = current.type;
            if (current.count === 0) {
                current.type = 0;
            }
            this.updateUI();
            return placedType;
        }
        return null;
    }

    swapSlots(indexA, indexB) {
        if (indexA === indexB || indexA < 0 || indexA >= INVENTORY_SIZE || indexB < 0 || indexB >= INVENTORY_SIZE) {
            return;
        }

        const a = this.slots[indexA];
        const b = this.slots[indexB];

        if (a.type !== 0 && a.type === b.type) {
            const space = STACK_LIMIT - b.count;
            const toMove = Math.min(space, a.count);
            b.count += toMove;
            a.count -= toMove;
            if (a.count === 0) a.type = 0;
        } else {
            this.slots[indexA] = b;
            this.slots[indexB] = a;
        }

        this.updateUI();
    }

    toggleOpen() {
        this.isOpen = !this.isOpen;
        this.updateUI();
        return this.isOpen;
    }

    close() {
        if (this.isOpen) {
            this.isOpen = false;
            this.updateUI();
        }
    }

    updateUI() {
        for (let i = 0; i < HOTBAR_SIZE; i++) {
            const slotEl = document.getElementById(`slot-${i}`);
            if (!slotEl) continue;

            const nameEl = slotEl.querySelector('.slot-name');
            const countEl = slotEl.querySelector('.slot-count');

            slotEl.classList.toggle('active', i === this.selectedSlotIndex);

            const slot = this.slots[i];
            if (slot && slot.type !== 0 && slot.count > 0) {
                const blockObj = typeof blockRegistry !== 'undefined' ? blockRegistry.get(slot.type) : null;
                const hasIcon = applyBlockIcon(slotEl, blockObj);
                slotEl.title = blockObj ? blockObj.name : 'Bloc';
                if (nameEl) nameEl.textContent = hasIcon ? '' : (blockObj ? blockObj.name : 'Bloc');
                if (countEl) countEl.textContent = slot.count;
            } else {
                applyBlockIcon(slotEl, null);
                slotEl.title = '';
                if (nameEl) nameEl.textContent = '';
                if (countEl) countEl.textContent = '';
            }
        }

        if (typeof this.onChange === 'function') {
            this.onChange(this);
        }
    }
}

class Player {
    constructor(camera, domElement, world) {
        this.camera = camera;
        this.world = world;

        // Fallback sécurisé pour la compatibilité PointerLockControls (Module ou UMD)
        const ControlsClass = THREE.PointerLockControls || window.PointerLockControls;
        if (typeof ControlsClass === 'function') {
            this.controls = new ControlsClass(camera, domElement);
        } else {
            console.error("PointerLockControls n'a pas été trouvé. Assurez-vous qu'il est inclus correctement.");
        }

        this.inventory = new Inventory();

        this.width = 0.6;
        this.height = 1.8;
        this.eyeHeight = 1.62;

        this.position = new THREE.Vector3(0.5, 100, 0.5);
        this.velocity = new THREE.Vector3();

        // Vector Pooling (Évite allocations de mémoire fréquentes pendant le loop)
        this.lookDir = new THREE.Vector3();
        this.pivot = new THREE.Vector3();
        this.desiredPos = new THREE.Vector3();
        this.testPoint = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.side = new THREE.Vector3();
        this.upVector = new THREE.Vector3(0, 1, 0);
        this.moveVector = new THREE.Vector3();
        this.tempRayPos = new THREE.Vector3();

        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.canJump = false;
        this.spaceHeld = false;

        this.speed = 4.3;
        this.jumpForce = 8.5;
        this.gravity = 28.0;

        this.stepTimer = 0;
        this.cameraMode = 0;
        this.thirdPersonDistance = 3.5;

        this.isReady = false;

        this.initMeshPlayer();
        this.initControls();
        this.updateCameraPosition();
    }

    getAABB() {
        const halfWidth = this.width / 2;
        return {
            min: new THREE.Vector3(this.position.x - halfWidth, this.position.y, this.position.z - halfWidth),
            max: new THREE.Vector3(this.position.x + halfWidth, this.position.y + this.height, this.position.z + halfWidth)
        };
    }

    extractFaceTexture(image, x, y, w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, x, y, w, h, 0, 0, w, h);

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.needsUpdate = true;
        return tex;
    }

    createBoxMaterials(img, u, v, w, h, d) {
        const texRight = this.extractFaceTexture(img, u, v + d, d, h);
        const texLeft  = this.extractFaceTexture(img, u + d + w, v + d, d, h);
        const texTop   = this.extractFaceTexture(img, u + d, v, w, d);
        const texBot   = this.extractFaceTexture(img, u + d + w, v, w, d);
        const texFront = this.extractFaceTexture(img, u + d, v + d, w, h);
        const texBack  = this.extractFaceTexture(img, u + d + w + d, v + d, w, h);

        const makeMat = (tex) => new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.1 });

        return [
            makeMat(texRight),
            makeMat(texLeft),
            makeMat(texTop),
            makeMat(texBot),
            makeMat(texFront),
            makeMat(texBack)
        ];
    }

    initMeshPlayer() {
        this.playerGroup = new THREE.Group();

        const img = new Image();
        img.onload = () => {
            const rightLegGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
            const rightLegMat = this.createBoxMaterials(img, 0, 16, 4, 12, 4);
            const rightLeg = new THREE.Mesh(rightLegGeo, rightLegMat);
            rightLeg.position.set(0.12, 0.375, 0);

            const leftLegGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
            const leftLegMat = this.createBoxMaterials(img, 0, 16, 4, 12, 4);
            const leftLeg = new THREE.Mesh(leftLegGeo, leftLegMat);
            leftLeg.position.set(-0.12, 0.375, 0);

            const bodyGeo = new THREE.BoxGeometry(0.48, 0.75, 0.24);
            const bodyMat = this.createBoxMaterials(img, 16, 16, 8, 12, 4);
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.set(0, 1.125, 0);

            const rightArmGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
            const rightArmMat = this.createBoxMaterials(img, 40, 16, 4, 12, 4);
            const rightArm = new THREE.Mesh(rightArmGeo, rightArmMat);
            rightArm.position.set(0.36, 1.125, 0);

            const leftArmGeo = new THREE.BoxGeometry(0.24, 0.75, 0.24);
            const leftArmMat = this.createBoxMaterials(img, 40, 16, 4, 12, 4);
            const leftArm = new THREE.Mesh(leftArmGeo, leftArmMat);
            leftArm.position.set(-0.36, 1.125, 0);

            const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            const headMat = this.createBoxMaterials(img, 0, 0, 8, 8, 8);
            const head = new THREE.Mesh(headGeo, headMat);
            head.position.set(0, 1.7, 0);

            this.playerGroup.add(rightLeg, leftLeg, body, rightArm, leftArm, head);
        };

        img.src = '/static/textures/Paul.png';
        this.playerGroup.visible = false;
        if (this.world?.scene) {
            this.world.scene.add(this.playerGroup);
        }
    }

    initControls() {
        const onKeyDown = (event) => {
            if (event.code === 'KeyE') {
                event.preventDefault();
                this.toggleInventory();
                return;
            }

            if (this.inventory.isOpen) return;

            switch (event.code) {
                case 'KeyW': case 'KeyZ': this.moveForward = true; break;
                case 'KeyA': case 'KeyQ': this.moveLeft = true; break;
                case 'KeyS': this.moveBackward = true; break;
                case 'KeyD': this.moveRight = true; break;
                case 'Space':
                    event.preventDefault();
                    this.spaceHeld = true;
                    if (this.canJump) {
                        this.velocity.y = this.jumpForce;
                        this.canJump = false;
                        soundManager?.playJump?.();
                    }
                    break;
                case 'F5':
                    event.preventDefault();
                    this.toggleCameraMode();
                    break;
                default:
                    if (event.code.startsWith('Digit')) {
                        const num = parseInt(event.code.replace('Digit', ''), 10);
                        if (num >= 1 && num <= 9) {
                            this.inventory.selectSlot(num - 1);
                        }
                    }
                    break;
            }
        };

        const onKeyUp = (event) => {
            switch (event.code) {
                case 'KeyW': case 'KeyZ': this.moveForward = false; break;
                case 'KeyA': case 'KeyQ': this.moveLeft = false; break;
                case 'KeyS': this.moveBackward = false; break;
                case 'KeyD': this.moveRight = false; break;
                case 'Space': this.spaceHeld = false; break;
            }
        };

        // Évite les touches "collées" quand on ouvre la pause/l'inventaire en marchant
        this.controls?.addEventListener('unlock', () => {
            this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = this.spaceHeld = false;
        });

        window.addEventListener('wheel', (event) => {
            if (!this.controls?.isLocked || this.inventory.isOpen) return;
            const delta = Math.sign(event.deltaY);
            const nextSlot = (this.inventory.selectedSlotIndex + delta + HOTBAR_SIZE) % HOTBAR_SIZE;
            this.inventory.selectSlot(nextSlot);
        }, { passive: true });

        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
    }

    toggleInventory() {
        if (!this.isReady) return;

        const nowOpen = this.inventory.toggleOpen();
        soundManager?.playInventoryToggle?.(nowOpen);

        window.dispatchEvent(new CustomEvent('inventory-toggle', { detail: { open: nowOpen } }));

        if (nowOpen) {
            if (this.controls?.isLocked) this.controls.unlock();
            this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;
        }
    }

    toggleCameraMode() {
        this.cameraMode = (this.cameraMode + 1) % 2;
        this.playerGroup.visible = (this.cameraMode === 1);
    }

    testCollision(posX, posY, posZ) {
        if (!this.world) return null;

        const halfWidth = this.width / 2;
        const minX = Math.floor(posX - halfWidth);
        const maxX = Math.floor(posX + halfWidth);
        const minY = Math.floor(posY);
        const maxY = Math.floor(posY + this.height - 0.001);
        const minZ = Math.floor(posZ - halfWidth);
        const maxZ = Math.floor(posZ + halfWidth);

        const w = this.world;

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (w.isSolidI(x, y, z)) {
                        return { x, y, z };
                    }
                }
            }
        }
        return null;
    }

    updateCameraPosition() {
        this.pivot.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);

        if (this.cameraMode === 0) {
            this.controls?.getObject().position.copy(this.pivot);
        } else {
            this.camera.getWorldDirection(this.lookDir);

            this.pivot.y += 0.3;
            this.desiredPos.copy(this.pivot).addScaledVector(this.lookDir, -this.thirdPersonDistance);
            const finalPos = this.raycastCameraCollision(this.pivot, this.desiredPos);

            this.controls?.getObject().position.copy(finalPos);
        }

        this.playerGroup.position.copy(this.position);

        this.camera.getWorldDirection(this.lookDir);
        this.lookDir.y = 0;
        if (this.lookDir.lengthSq() > 0) {
            this.lookDir.normalize();
            this.playerGroup.rotation.y = Math.atan2(this.lookDir.x, this.lookDir.z);
        }
    }

    raycastCameraCollision(from, to) {
        if (!this.world) return to;

        const fullDist = from.distanceTo(to);
        if (fullDist < 0.001) return to;

        const dir = this.desiredPos.copy(to).sub(from).normalize();
        const step = 0.1;
        const margin = 0.25;

        let travelled = 0;

        while (travelled < fullDist) {
            this.testPoint.copy(from).addScaledVector(dir, travelled);
            const isSolid = this.world.isSolid
                ? this.world.isSolid(this.testPoint.x, this.testPoint.y, this.testPoint.z)
                : this.world.hasBlock(this.testPoint.x, this.testPoint.y, this.testPoint.z);

            if (isSolid) {
                const safeDist = Math.max(0, travelled - margin);
                return this.tempRayPos.copy(from).addScaledVector(dir, safeDist);
            }
            travelled += step;
        }

        return to;
    }

    update(delta) {
        if (!this.isReady) return;

        const dt = Math.min(delta, 0.05);

        this.forward.set(0, 0, 0);
        if (this.controls?.isLocked && !this.inventory.isOpen) {
            this.camera.getWorldDirection(this.forward);
            this.forward.y = 0;
            this.forward.normalize();

            this.side.crossVectors(this.forward, this.upVector).normalize();

            this.moveVector.set(0, 0, 0);
            if (this.moveForward) this.moveVector.add(this.forward);
            if (this.moveBackward) this.moveVector.sub(this.forward);
            if (this.moveRight) this.moveVector.add(this.side);
            if (this.moveLeft) this.moveVector.sub(this.side);

            if (this.moveVector.lengthSq() > 0) {
                this.moveVector.normalize().multiplyScalar(this.speed);
            }

            this.velocity.x = this.moveVector.x;
            this.velocity.z = this.moveVector.z;
        } else {
            this.velocity.x = 0;
            this.velocity.z = 0;
        }

        // Nage : gravité réduite, Espace pour remonter (et sortir de l'eau)
        const inWater = this.world.isFluidAt(this.position.x, this.position.y + 0.5, this.position.z);
        if (inWater) {
            const headInWater = this.world.isFluidAt(this.position.x, this.position.y + this.eyeHeight, this.position.z);
            this.velocity.x *= 0.6;
            this.velocity.z *= 0.6;
            if (this.spaceHeld) {
                this.velocity.y = headInWater ? 3.5 : 5.5;
            } else {
                this.velocity.y = Math.max(this.velocity.y - this.gravity * 0.25 * dt, -3.0);
            }
        } else {
            this.velocity.y -= this.gravity * dt;
        }

        const halfWidth = this.width / 2;

        // Déplacement Axe X
        this.position.x += this.velocity.x * dt;
        let block = this.testCollision(this.position.x, this.position.y, this.position.z);
        if (block) {
            this.position.x = this.velocity.x > 0 ? block.x - halfWidth - 0.001 : block.x + 1 + halfWidth + 0.001;
            this.velocity.x = 0;
        }

        // Déplacement Axe Z
        this.position.z += this.velocity.z * dt;
        block = this.testCollision(this.position.x, this.position.y, this.position.z);
        if (block) {
            this.position.z = this.velocity.z > 0 ? block.z - halfWidth - 0.001 : block.z + 1 + halfWidth + 0.001;
            this.velocity.z = 0;
        }

        // Déplacement Axe Y
        const velocityBeforeY = this.velocity.y;
        this.position.y += this.velocity.y * dt;
        block = this.testCollision(this.position.x, this.position.y, this.position.z);
        if (block) {
            if (this.velocity.y < 0) {
                this.position.y = block.y + 1;
                this.velocity.y = 0;
                if (!this.canJump && velocityBeforeY < -6) {
                    soundManager?.playLand?.(Math.min(1.5, Math.abs(velocityBeforeY) / 12));
                }
                this.canJump = true;
            } else if (this.velocity.y > 0) {
                this.position.y = block.y - this.height - 0.001;
                this.velocity.y = 0;
            }
        } else {
            this.canJump = false;
        }

        // Bruits de pas
        if ((Math.abs(this.velocity.x) > 0 || Math.abs(this.velocity.z) > 0) && this.canJump) {
            this.stepTimer += dt;
            if (this.stepTimer > 0.35) {
                if (typeof soundManager !== 'undefined' && soundManager?.playStep) {
                    const blockUnderId = this.world.getBlock(
                        Math.floor(this.position.x),
                        Math.floor(this.position.y - 0.1),
                        Math.floor(this.position.z)
                    );
                    soundManager.playStep(blockUnderId);
                }
                this.stepTimer = 0;
            }
        }

        // Failsafe Chute dans le vide
        if (this.position.y < -5) {
            const currentX = Math.floor(this.position.x);
            const currentZ = Math.floor(this.position.z);
            let highestY = this.world.getTerrainHeight ? this.world.getTerrainHeight(currentX, currentZ) : 64;

            for (let y = 255; y >= highestY; y--) {
                if (this.world.hasBlock(currentX, y, currentZ)) {
                    highestY = y;
                    break;
                }
            }
            this.position.y = highestY + 2.0;
            this.velocity.set(0, 0, 0);
        }

        this.updateCameraPosition();
    }
}