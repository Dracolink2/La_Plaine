// Gère l'affichage et les interactions du panneau d'inventaire complet (36 cases),
// ouvert/fermé via la touche E (voir player.js -> toggleInventory).
class InventoryUI {
    constructor(player) {
        this.player = player;
        this.inventory = player.inventory;

        this.panel = document.getElementById('inventory-panel');
        this.grid = document.getElementById('inventory-grid');
        this.dragIndex = null;

        this.buildSlots();

        window.addEventListener('inventory-toggle', (e) => {
            this.panel.style.display = e.detail.open ? 'flex' : 'none';
            if (e.detail.open) this.render();
        });

        this.inventory.onChange = () => {
            if (this.inventory.isOpen) this.render();
        };

        // Fermer avec Échap aussi, en plus de E
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
                const blockObj = typeof blockRegistry !== 'undefined' ? blockRegistry.get(slot.type) : null;
                const hasIcon = applyBlockIcon(el, blockObj);
                el.title = blockObj ? blockObj.name : 'Bloc';
                nameEl.textContent = hasIcon ? '' : (blockObj ? blockObj.name : 'Bloc');
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
}