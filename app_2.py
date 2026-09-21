import os
import threading
import webview
from flask import Flask, render_template, jsonify

app = Flask(__name__)

@app.route('/')
def menu():
    return render_template('menu.html')

@app.route('/game')
def game():
    return render_template('index.html')

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

def start_flask():
    # Lancement du serveur Flask sans le mode debug pour éviter les conflits de rechargement
    app.run(host='127.0.0.1', port=5000, debug=False, threaded=True)

if __name__ == '__main__':
    # Démarrage de Flask en arrière-plan
    server_thread = threading.Thread(target=start_flask)
    server_thread.daemon = True
    server_thread.start()

    # Ouverture de la fenêtre Pywebview pointant vers l'application Flask
    webview.create_window('Mon Jeu 3D', 'http://127.0.0.1:5000', width=1280, height=720)
    webview.start()