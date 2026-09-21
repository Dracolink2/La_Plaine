import os
from flask import Flask, render_template, jsonify

app = Flask(__name__)

@app.route('/')
def menu():
    return render_template('menu.html') #[cite: 3]

@app.route('/game')
def game():
    return render_template('index.html') #[cite: 3]

# Route API pour découvrir automatiquement tous les scripts de registres
@app.route('/api/modules')
def get_modules():
    blocks_dir = os.path.join(app.static_folder, 'js', 'blocks')
    biomes_dir = os.path.join(app.static_folder, 'js', 'biomes')

    block_files = []
    if os.path.exists(blocks_dir):
        block_files = sorted(f for f in os.listdir(blocks_dir) if f.lower().endswith('.js') and f.lower() != 'register.js')

    biome_files = []
    if os.path.exists(biomes_dir):
        biome_files = sorted(f for f in os.listdir(biomes_dir) if f.lower().endswith('.js') and f.lower() != 'register.js')

    return jsonify({
        'blocks': block_files,
        'biomes': biome_files
    })

if __name__ == '__main__':
    app.run(debug=True)