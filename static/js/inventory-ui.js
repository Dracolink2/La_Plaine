class InventoryUI {
    constructor(player) {
        this.player = player;
        this.inventory = player.inventory;
        this.panel = document.getElementById('inventory-panel');
        this.grid = document.getElementById('inventory-grid');
        this.dragSource = null;
        this.carriedStack = null;
        this.craftGrid = Array.from({ length: 4 }, () => ({ type: 0, count: 0 }));
        this.tableGrid = Array.from({ length: 9 }, () => ({ type: 0, count: 0 }));
        this.craftPanel = null;
        this.craftSize = 2;
        this.furnaceSlots = Array.from({ length: 3 }, () => ({ type: 0, count: 0 })); // entrée, combustible, sortie
        this.furnaceBurn = 0; this.furnaceProgress = 0;
        this.buildSlots();
        this.buildCrafting();
        window.addEventListener('inventory-toggle', (e) => {
            if (!e.detail.open && (!this.returnCarriedStack() || !this.returnGrid(this.craftGrid))) { this.inventory.isOpen = true; this.panel.style.display = 'flex'; return; }
            this.panel.style.display = e.detail.open ? 'flex' : 'none';
            if (e.detail.open) { this.render(); this.renderCrafting(); }
        });
        this.inventory.onChange = () => {
            if (this.inventory.isOpen) { this.render(); this.renderCrafting(); }
            window.dispatchEvent(new Event('inventory-changed'));
        };
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                if (this.furnacePanel?.style.display === 'flex') this.closeFurnace();
                else if (this.craftPanel?.style.display === 'flex') this.closeCraftingTable();
                else if (this.inventory.isOpen) this.player.toggleInventory();
            }
        });
    }
    buildSlots() {
        this.grid.innerHTML = ''; this.slotEls = [];
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            const el = document.createElement('div');
            el.className = 'inv-slot' + (i < HOTBAR_SIZE ? ' inv-slot-hotbar' : '');
            el.dataset.index = i; el.draggable = true;
            el.innerHTML = '<span class="inv-slot-name"></span><span class="inv-slot-count"></span>';
            el.addEventListener('dragstart', (e) => { this.dragSource = { kind: 'inventory', index: i }; e.dataTransfer.effectAllowed = 'move'; });
            el.addEventListener('dragover', e => e.preventDefault());
            el.addEventListener('drop', e => { e.preventDefault(); this.handleDrop({ kind: 'inventory', index: i }, e); });
            el.addEventListener('click', e => this.handleSlotClick({ kind: 'inventory', index: i }, e));
            el.addEventListener('contextmenu', e => { e.preventDefault(); this.handleSlotClick({ kind: 'inventory', index: i }, e); });
            this.grid.appendChild(el); this.slotEls.push(el);
        }
    }
    buildCrafting() {
        const box = this.panel?.querySelector('.inv-box');
        if (!box || document.getElementById('crafting-panel')) return;
        const panel = document.createElement('section');
        panel.id = 'crafting-panel';
        panel.innerHTML = '<div class="craft-area"><div><h3>Fabrication · 2×2</h3><div id="craft-grid-2" class="crafting-grid"></div></div><span class="craft-arrow">➜</span><button id="craft-output-2" class="craft-output" aria-label="Récupérer le résultat">?</button></div><p class="crafting-help">Dépose les objets dans la grille. Clique sur le résultat pour fabriquer.</p><p id="crafting-message" role="status"></p>';
        box.appendChild(panel);
        this.makeCraftSlots(document.getElementById('craft-grid-2'), this.craftGrid, 2, 'craft');
        document.getElementById('craft-output-2').addEventListener('click', () => this.takeCraftResult(2));
        this.craftPanel = document.createElement('div');
        this.craftPanel.id = 'crafting-table-panel'; this.craftPanel.style.display = 'none';
        this.craftPanel.innerHTML = '<div class="craft-table-box"><h2>Table de craft · 3×3</h2><div class="craft-area"><div id="craft-grid-3" class="crafting-grid"></div><span class="craft-arrow">➜</span><button id="craft-output-3" class="craft-output" aria-label="Récupérer le résultat">?</button></div><p class="crafting-help">Clic gauche : prendre/poser un stack · clic droit : prendre la moitié ou poser 1 objet.</p><h3>Inventaire</h3><div id="craft-table-inventory" class="craft-table-inventory"></div><button id="craft-close" class="craft-close">Fermer (Échap)</button></div>'; 
        document.body.appendChild(this.craftPanel);
        this.makeCraftSlots(document.getElementById('craft-grid-3'), this.tableGrid, 3, 'table');
        this.buildTableInventory();
        document.getElementById('craft-output-3').addEventListener('click', () => this.takeCraftResult(3));
        document.getElementById('craft-close').addEventListener('click', () => this.closeCraftingTable());
        this.furnacePanel = document.createElement('div');
        this.furnacePanel.id = 'furnace-panel'; this.furnacePanel.style.display = 'none';
        this.furnacePanel.innerHTML = '<div class="craft-table-box"><h2>Four</h2><p class="crafting-help">Place un aliment ou un minerai dans l’entrée et du charbon ou du bois comme combustible.</p><div class="furnace-slots"><div><label>À cuire</label><div id="furnace-input" class="inv-slot"></div></div><div><label>Combustible</label><div id="furnace-fuel" class="inv-slot"></div></div><span class="craft-arrow">➜</span><div><label>Résultat</label><div id="furnace-output" class="inv-slot"></div></div></div><p id="furnace-status" class="crafting-help" role="status">Four prêt.</p><h3>Inventaire</h3><div id="furnace-inventory" class="craft-table-inventory"></div><button id="furnace-close" class="craft-close">Fermer (Échap)</button></div>';
        document.body.appendChild(this.furnacePanel);
        this.furnaceInventoryEls = [];
        for (const [i, id] of ['furnace-input','furnace-fuel','furnace-output'].entries()) {
            const el = document.getElementById(id); el.innerHTML = '<span class="inv-slot-name"></span><span class="inv-slot-count"></span>';
            el.addEventListener('click', e => this.handleSlotClick({ kind: ['furnaceInput','furnaceFuel','furnaceOutput'][i], index: 0 }, e));
            el.addEventListener('contextmenu', e => { e.preventDefault(); this.handleSlotClick({ kind: ['furnaceInput','furnaceFuel','furnaceOutput'][i], index: 0 }, e); });
        }
        const furnaceInventory = document.getElementById('furnace-inventory');
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            const el = document.createElement('div'); el.className = 'inv-slot'; el.dataset.index = i;
            el.innerHTML = '<span class="inv-slot-name"></span><span class="inv-slot-count"></span>';
            el.addEventListener('click', e => this.handleSlotClick({ kind: 'inventory', index: i }, e));
            el.addEventListener('contextmenu', e => { e.preventDefault(); this.handleSlotClick({ kind: 'inventory', index: i }, e); });
            furnaceInventory.appendChild(el); this.furnaceInventoryEls.push(el);
        }
        document.getElementById('furnace-close').addEventListener('click', () => this.closeFurnace());
    }
    buildTableInventory() {
        const root = document.getElementById('craft-table-inventory');
        if (!root || root.dataset.ready) return;
        root.dataset.ready = '1';
        this.tableInventoryEls = [];
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            const el = document.createElement('div');
            el.className = 'inv-slot'; el.dataset.index = i; el.draggable = true;
            el.innerHTML = '<span class="inv-slot-name"></span><span class="inv-slot-count"></span>';
            el.addEventListener('dragstart', e => { this.dragSource = { kind: 'inventory', index: i }; e.dataTransfer.effectAllowed = 'move'; });
            el.addEventListener('dragover', e => e.preventDefault());
            el.addEventListener('drop', e => { e.preventDefault(); this.handleDrop({ kind: 'inventory', index: i }, e); });
            el.addEventListener('click', e => this.handleSlotClick({ kind: 'inventory', index: i }, e));
            el.addEventListener('contextmenu', e => { e.preventDefault(); this.handleSlotClick({ kind: 'inventory', index: i }, e); });
            root.appendChild(el); this.tableInventoryEls.push(el);
        }
    }
    handleSlotClick(target, event) {
        const arr = kind => kind === 'inventory' ? this.inventory.slots : kind === 'craft' ? this.craftGrid : kind === 'furnaceInput' ? [this.furnaceSlots[0]] : kind === 'furnaceFuel' ? [this.furnaceSlots[1]] : kind === 'furnaceOutput' ? [this.furnaceSlots[2]] : this.tableGrid;
        const slots = arr(target.kind), slot = slots[target.index];
        if (target.kind === 'furnaceOutput') {
            if (!this.carriedStack && slot.type && slot.count) {
                const amount = slot.count;
                if (this.inventory.canAdd(slot.type, amount)) { this.inventory.addItem(slot.type, amount); slot.type = 0; slot.count = 0; this.refreshAll(); this.renderFurnace(); }
                else this.message('Inventaire plein.');
            }
            return;
        }
        if (!slot) return;
        const right = event.button === 2;
        if (event.type === 'contextmenu') event.preventDefault();
        if (!this.carriedStack) {
            if (!slot.type || !slot.count) return;
            const amount = right ? Math.ceil(slot.count / 2) : slot.count;
            this.carriedStack = { type: slot.type, count: amount };
            slot.count -= amount;
            if (!slot.count) { slot.type = 0; slot.count = 0; }
        } else if (!slot.type) {
            const amount = right ? 1 : this.carriedStack.count;
            slot.type = this.carriedStack.type;
            slot.count = Math.min(amount, stackLimitFor(slot.type));
            this.carriedStack.count -= slot.count;
            if (!this.carriedStack.count) this.carriedStack = null;
        } else if (slot.type === this.carriedStack.type) {
            const cap = stackLimitFor(slot.type), amount = Math.min(right ? 1 : this.carriedStack.count, cap - slot.count);
            slot.count += amount; this.carriedStack.count -= amount;
            if (!this.carriedStack.count) this.carriedStack = null;
        } else if (!right) {
            const temp = { type: slot.type, count: slot.count };
            slot.type = this.carriedStack.type; slot.count = this.carriedStack.count;
            this.carriedStack = temp;
        }
        this.refreshAll();
    }
    refreshAll() {
        this.inventory.updateUI(); this.render(); this.renderCrafting();
        if (this.tableInventoryEls) this.tableInventoryEls.forEach((el, i) => this.renderSlot(el, this.inventory.slots[i]));
        window.dispatchEvent(new Event('inventory-changed'));
    }
    makeCraftSlots(container, grid, size, kind) {
        container.innerHTML = ''; container.style.gridTemplateColumns = `repeat(${size}, 44px)`;
        grid.forEach((_, i) => {
            const el = document.createElement('div'); el.className = 'inv-slot craft-input-slot'; el.draggable = true; el.innerHTML = '<span class="inv-slot-name"></span><span class="inv-slot-count"></span>';
            el.addEventListener('dragstart', e => { this.dragSource = { kind, index: i }; e.dataTransfer.effectAllowed = 'move'; });
            el.addEventListener('dragover', e => e.preventDefault());
            el.addEventListener('drop', e => { e.preventDefault(); this.handleDrop({ kind, index: i }, e); });
            el.addEventListener('click', e => this.handleSlotClick({ kind, index: i }, e));
            el.addEventListener('contextmenu', e => { e.preventDefault(); this.handleSlotClick({ kind, index: i }, e); });
            container.appendChild(el);
        });
    }
    handleDrop(target, event = null) {
        const source = this.dragSource; this.dragSource = null;
        if (!source || (source.kind === target.kind && source.index === target.index)) return;
        if (source.kind === 'inventory' && target.kind === 'inventory') { this.inventory.swapSlots(source.index, target.index); this.render(); this.renderCrafting(); return; }
        const arr = kind => kind === 'inventory' ? this.inventory.slots : kind === 'craft' ? this.craftGrid : this.tableGrid;
        const a = arr(source.kind), b = arr(target.kind), from = a[source.index], to = b[target.index];
        if (!from || !to) return;
        if (target.kind === 'inventory' && source.kind !== 'inventory') {
            if (to.type && to.type !== from.type) { const tmp = { ...to }; Object.assign(to, from); Object.assign(from, tmp); }
            else if (!to.type) { Object.assign(to, from); from.type = 0; from.count = 0; }
            else { const cap = stackLimitFor(to.type); const n = Math.min(from.count, cap - to.count); to.count += n; from.count -= n; if (!from.count) from.type = 0; }
        } else if (source.kind === 'inventory' && target.kind !== 'inventory') {
            if (!to.type) { const amount = event?.button === 2 ? 1 : from.count; to.type = from.type; to.count = Math.min(amount, stackLimitFor(to.type)); from.count -= to.count; if (!from.count) from.type = 0; }
            else if (to.type === from.type) { const amount = event?.button === 2 ? 1 : from.count; const moved = Math.min(amount, stackLimitFor(to.type) - to.count); to.count += moved; from.count -= moved; if (!from.count) from.type = 0; }
            else { return; }
        } else {
            const tmp = { ...to }; Object.assign(to, from); Object.assign(from, tmp);
        }
        this.inventory.updateUI(); this.render(); this.renderCrafting();
        window.dispatchEvent(new Event('inventory-changed'));
    }
    renderSlot(el, slot) {
        const name = el.querySelector('.inv-slot-name'), count = el.querySelector('.inv-slot-count');
        const item = slot?.type ? window.itemsRegistry?.get(slot.type) : null;
        const block = slot?.type ? window.blockRegistry?.get(slot.type) : null;
        el.style.backgroundImage = '';
        if (slot?.type && slot.count > 0) {
            const hasIcon = item?.texture ? (el.style.backgroundImage = `url('${item.texture}')`, true) : applyBlockIcon(el, block);
            el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center';
            el.title = item?.name || block?.name || `Objet ${slot.type}`;
            name.textContent = hasIcon ? '' : (item?.name || block?.name || 'Objet'); count.textContent = slot.count;
            el.classList.add('filled');
        } else { applyBlockIcon(el, null); el.title = ''; name.textContent = ''; count.textContent = ''; el.classList.remove('filled'); }
    }
    render() { this.slotEls.forEach((el, i) => this.renderSlot(el, this.inventory.slots[i])); if (this.tableInventoryEls) this.tableInventoryEls.forEach((el, i) => this.renderSlot(el, this.inventory.slots[i])); }
    renderCrafting() {
        this.renderGrid(this.craftGrid, 2, 'craft-grid-2');
        this.renderOutput(2);
        if (this.craftPanel) { this.renderGrid(this.tableGrid, 3, 'craft-grid-3'); this.renderOutput(3); }
        this.renderFurnace();
    }
    renderGrid(grid, size, id) {
        const root = document.getElementById(id); if (!root) return;
        [...root.children].forEach((el, i) => this.renderSlot(el, grid[i]));
    }
    renderOutput(size) {
        const grid = size === 2 ? this.craftGrid : this.tableGrid;
        const output = document.getElementById(`craft-output-${size}`); if (!output) return;
        const recipe = window.craftRegistry?.findMatch(grid, size);
        output.innerHTML = ''; output.style.backgroundImage = '';
        if (!recipe) { output.textContent = '?'; output.title = 'Aucune recette correspondante'; output.disabled = true; return; }
        const item = window.itemsRegistry?.get(recipe.output.id), block = window.blockRegistry?.get(recipe.output.id);
        const icon = item?.texture || block?.textures?.all || block?.textures?.top || '';
        if (icon) { output.style.backgroundImage = `url('${icon}')`; output.style.backgroundSize = 'contain'; output.style.backgroundPosition = 'center'; output.style.backgroundRepeat = 'no-repeat'; }
        else output.textContent = item?.name?.slice(0, 2) || block?.name?.slice(0, 2) || '?';
        output.title = `${item?.name || block?.name || recipe.id} ×${recipe.output.count || 1}`; output.disabled = false;
        output.dataset.recipe = recipe.id;
    }
    takeCraftResult(size) {
        const grid = size === 2 ? this.craftGrid : this.tableGrid;
        const recipe = window.craftRegistry?.findMatch(grid, size); if (!recipe) return;
        const outputId = Number(recipe.output.id), count = Math.max(1, Number(recipe.output.count) || 1);
        if (!this.inventory.canAdd(outputId, count)) { this.message('Inventaire plein.'); return; }
        // Remove exactly the ingredients used by the matched shaped recipe.
        const pattern = recipe.pattern, used = [];
        const maxY = size - pattern.length, maxX = size - Math.max(...pattern.map(r => r.length));
        outer: for (let y = 0; y <= maxY; y++) for (let x = 0; x <= maxX; x++) {
            for (const mirror of [false, true]) {
                let ok = true;
                for (let gy = 0; gy < size && ok; gy++) for (let gx = 0; gx < size; gx++) {
                    const py = gy-y, px = gx-x; let expected = 0;
                    if (py >= 0 && py < pattern.length) { const row = pattern[py] || []; const ix = mirror ? row.length-1-px : px; if (ix >= 0 && ix < row.length) expected = Number(row[ix]) || 0; }
                    if ((Number(grid[gy*size+gx]?.type)||0) !== expected) { ok = false; break; }
                }
                if (ok) { for (let gy=0; gy<size; gy++) for (let gx=0; gx<size; gx++) if (grid[gy*size+gx].type) used.push(gy*size+gx); break outer; }
            }
        }
        if (!used.length) return;
        for (const i of used) { grid[i].count--; if (grid[i].count <= 0) { grid[i].type = 0; grid[i].count = 0; } }
        this.inventory.addItem(outputId, count); this.inventory.updateUI(); this.render(); this.renderCrafting();
        window.dispatchEvent(new Event('inventory-changed'));
        this.message(`Fabriqué : ${recipe.name || itemName(outputId)} ×${count}`);
    }
    message(text) { const el = document.getElementById('crafting-message'); if (el) el.textContent = text; }
    returnCarriedStack() {
        if (!this.carriedStack) return true;
        if (!this.inventory.canAdd(this.carriedStack.type, this.carriedStack.count)) { this.message('Inventaire plein : repose le stack avant de fermer.'); return false; }
        this.inventory.addItem(this.carriedStack.type, this.carriedStack.count);
        this.carriedStack = null;
        return true;
    }
    returnGrid(grid) {
        const totals = new Map();
        for (const slot of grid) if (slot.type && slot.count) totals.set(slot.type, (totals.get(slot.type) || 0) + slot.count);
        for (const [id, amount] of totals) {
            if (!this.inventory.canAdd(id, amount)) { this.message('Inventaire plein : libère une place avant de fermer la grille.'); return false; }
        }
        for (const slot of grid) { if (slot.type && slot.count) this.inventory.addItem(slot.type, slot.count); slot.type = 0; slot.count = 0; }
        this.inventory.updateUI(); this.render(); this.renderCrafting();
        if (grid === this.craftGrid) window.dispatchEvent(new Event('inventory-changed'));
        return true;
    }
    renderFurnace() {
        if (!this.furnacePanel) return;
        ['furnace-input','furnace-fuel','furnace-output'].forEach((id, i) => this.renderSlot(document.getElementById(id), this.furnaceSlots[i]));
        if (this.furnaceInventoryEls) this.furnaceInventoryEls.forEach((el, i) => this.renderSlot(el, this.inventory.slots[i]));
        const status = document.getElementById('furnace-status');
        if (status) status.textContent = this.furnaceBurn > 0 ? `Cuisson en cours… ${Math.round(this.furnaceProgress / 3 * 100)} %` : 'Four prêt.';
    }
    openFurnace() { if (!this.furnacePanel) return; this.furnacePanel.style.display = 'flex'; this.renderFurnace(); if (this.player.controls?.isLocked) this.player.controls.unlock(); }
    closeFurnace() {
        if (this.carriedStack) { if (!this.inventory.canAdd(this.carriedStack.type, this.carriedStack.count)) { this.message('Inventaire plein : repose le stack avant de fermer.'); return; } this.inventory.addItem(this.carriedStack.type, this.carriedStack.count); this.carriedStack = null; }
        for (const slot of this.furnaceSlots) { if (slot.type && slot.count) { if (!this.inventory.canAdd(slot.type, slot.count)) { this.message('Inventaire plein : vide le four avant de fermer.'); return; } this.inventory.addItem(slot.type, slot.count); slot.type = 0; slot.count = 0; } }
        this.furnacePanel.style.display = 'none'; this.furnaceBurn = 0; this.furnaceProgress = 0; this.renderFurnace();
    }
    updateFurnace(delta) {
        if (!this.furnacePanel || this.furnacePanel.style.display !== 'flex') return;
        const input = this.furnaceSlots[0], fuel = this.furnaceSlots[1], output = this.furnaceSlots[2];
        const smelts = { 1103: 1104, 1114: 1116, 1107: 1105, 1118: 1119, 1120: 1121, 1122: 1123 };
        const fuels = new Set([1102, 1112, 1117, 4, 15, 25, 28, 35, 41, 42, 43, 44, 45]);
        const inputType = Number(input.type), resultId = smelts[inputType];
        if (!inputType || !resultId || (output.type && output.type !== resultId) || output.count >= 100) {
            this.furnaceProgress = 0;
            return;
        }
        if (this.furnaceBurn <= 0) {
            if (!fuel.type || !fuels.has(Number(fuel.type))) return;
            fuel.count--;
            if (fuel.count <= 0) { fuel.type = 0; fuel.count = 0; }
            this.furnaceBurn = 8;
        }
        this.furnaceBurn = Math.max(0, this.furnaceBurn - delta);
        this.furnaceProgress += Math.min(delta, 0.25);
        if (this.furnaceProgress >= 3) {
            this.furnaceProgress -= 3;
            input.count--;
            if (input.count <= 0) { input.type = 0; input.count = 0; }
            if (!output.type) output.type = resultId;
            output.count++;
            this.renderFurnace();
            this.inventory.updateUI();
        }
    }
    openCraftingTable() { this.craftPanel.style.display = 'flex'; this.render(); this.renderCrafting(); if (this.player.controls?.isLocked) this.player.controls.unlock(); }
    closeCraftingTable() { if (this.returnCarriedStack() && this.returnGrid(this.tableGrid) && this.craftPanel) this.craftPanel.style.display = 'none'; }
}
function itemName(id) { return window.itemsRegistry?.get(id)?.name || window.blockRegistry?.get(id)?.name || `Objet ${id}`; }
