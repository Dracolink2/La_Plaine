

class InventoryUI {
    constructor(player) {
        this.player = player;
        this.inventory = player.inventory;

        this.panel = document.getElementById('inventory-panel');
        this.grid = document.getElementById('inventory-grid');
        this.dragIndex = null;

        this.buildSlots();
        this.buildCrafting();

        window.addEventListener('inventory-toggle', (e) => {
            this.panel.style.display = e.detail.open ? 'flex' : 'none';
            if (e.detail.open) { this.render(); this.renderCrafting(); }
        });

        this.inventory.onChange = () => {
            if (this.inventory.isOpen) { this.render(); this.renderCrafting(); }
            window.dispatchEvent(new Event('inventory-changed'));
        };

        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' && this.inventory.isOpen) {
                this.player.toggleInventory();
            }
        });
    }

    buildSlots() {
        this.grid.innerHTML = '';
        this.slotEls = [];

        for (let i = 0; i < INVENTORY_SIZE; i++) {
            const slotEl = document.createElement('div');
            slotEl.className = 'inv-slot' + (i < HOTBAR_SIZE ? ' inv-slot-hotbar' : '');
            slotEl.dataset.index = i;
            slotEl.draggable = true;

            slotEl.innerHTML = `
                <span class="inv-slot-name"></span>
                <span class="inv-slot-count"></span>
            `;

            slotEl.addEventListener('dragstart', (e) => {
                this.dragIndex = i;
                e.dataTransfer.effectAllowed = 'move';
            });

            slotEl.addEventListener('dragover', (e) => e.preventDefault());

            slotEl.addEventListener('drop', (e) => {
                e.preventDefault();
                if (this.dragIndex !== null) {
                    this.inventory.swapSlots(this.dragIndex, i);
                    this.dragIndex = null;
                }
            });

            this.grid.appendChild(slotEl);
            this.slotEls.push(slotEl);
        }
    }

    render() {
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            const slot = this.inventory.slots[i];
            const el = this.slotEls[i];
            const nameEl = el.querySelector('.inv-slot-name');
            const countEl = el.querySelector('.inv-slot-count');

            if (slot && slot.type !== 0 && slot.count > 0) {
                const itemObj = window.itemsRegistry?.get(slot.type);
                const blockObj = typeof blockRegistry !== 'undefined' ? blockRegistry.get(slot.type) : null;
                const hasIcon = itemObj?.texture ? (el.style.backgroundImage = `url('${itemObj.texture}')`, true) : applyBlockIcon(el, blockObj);
                el.title = itemObj?.name || blockObj?.name || 'Objet';
                nameEl.textContent = hasIcon ? '' : (itemObj?.name || blockObj?.name || 'Objet');
                countEl.textContent = slot.count;
                el.classList.add('filled');
            } else {
                applyBlockIcon(el, null);
                el.title = '';
                nameEl.textContent = '';
                countEl.textContent = '';
                el.classList.remove('filled');
            }
        }
    }

    buildCrafting() {
        const box = this.panel?.querySelector('.inv-box');
        if (!box || document.getElementById('crafting-panel')) return;
        const panel = document.createElement('section');
        panel.id = 'crafting-panel';
        panel.innerHTML = '<h3>Fabrication</h3><div id="crafting-recipes"></div><p id="crafting-message">Choisis une recette pour voir les ingrédients.</p>';
        box.appendChild(panel);
    }

    renderCrafting() {
        const list = document.getElementById('crafting-recipes');
        const message = document.getElementById('crafting-message');
        if (!list || !window.craftRegistry) return;
        list.innerHTML = '';
        for (const recipe of window.craftRegistry.getAll()) {
            const item = window.itemsRegistry?.get(recipe.output.id);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'craft-recipe';
            button.disabled = !window.craftRegistry.canCraft(recipe, this.inventory);
            const size = Number(recipe.grid) || recipe.pattern.length;
            const label = document.createElement('span');
            label.className = 'craft-recipe-label';
            label.textContent = `${recipe.name || item?.name || recipe.id} ×${recipe.output.count || 1}`;
            const preview = document.createElement('span');
            preview.className = 'craft-grid-preview';
            preview.style.gridTemplateColumns = `repeat(${size}, 20px)`;
            preview.title = `${size}×${size}`;
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                const id = Number(recipe.pattern[y]?.[x] || 0);
                const cell = document.createElement('span');
                cell.className = 'craft-grid-cell';
                if (id) {
                    const ingredient = window.itemsRegistry?.get(id);
                    cell.title = ingredient?.name || `Objet ${id}`;
                    if (ingredient?.texture) cell.style.backgroundImage = `url('${ingredient.texture}')`;
                    else cell.textContent = ingredient?.name?.slice(0, 2) || '?';
                }
                preview.appendChild(cell);
            }
            button.append(label, preview);
            button.title = `${size}×${size} · recette depuis l’inventaire`;
            button.addEventListener('click', () => {
                if (window.craftRegistry.craft(recipe, this.inventory)) {
                    this.render(); this.renderCrafting();
                    if (message) message.textContent = `Fabriqué : ${item?.name || recipe.id}`;
                } else if (message) message.textContent = 'Il manque des ingrédients ou de la place dans l’inventaire.';
            });
            list.appendChild(button);
        }
    }

}