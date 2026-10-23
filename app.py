import os
import sqlite3
import secrets
from datetime import datetime, timezone
import math
import json
import sys
import shutil
import io
import zipfile
import re

from flask import Flask, render_template, jsonify, request, send_file, send_from_directory, abort

# En mode PyInstaller, les ressources (templates/static) sont dans _MEIPASS,
# mais les sauvegardes doivent rester à côté de l'exécutable, jamais dans le
# dossier temporaire qui est supprimé à la fermeture.
RESOURCE_DIR = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
if getattr(sys, "frozen", False):
    DATA_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    DATA_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=os.path.join(RESOURCE_DIR, "templates"),
    static_folder=os.path.join(RESOURCE_DIR, "static"),
)

                                                                              
                                
                                                                              

BASE_DIR = DATA_DIR
DATABASE = os.path.join(DATA_DIR, "worlds.db")
# Migration douce des anciennes versions PyInstaller qui plaçaient la base dans
# le dossier des ressources (_internal). On ne remplace jamais une base existante.
_legacy_database = os.path.join(RESOURCE_DIR, "worlds.db")
if not os.path.exists(DATABASE) and os.path.isfile(_legacy_database) and os.path.abspath(_legacy_database) != os.path.abspath(DATABASE):
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        shutil.copy2(_legacy_database, DATABASE)
    except OSError:
        # Le démarrage doit rester possible même si l'ancien dossier est en lecture seule.
        pass




# Les packs et mods sont des ressources utilisateur : les sauvegardes restent
# indépendantes de ces dossiers, ce qui évite de modifier les mondes existants.
TEXTURE_PACK_DIRS = [
    os.path.join(DATA_DIR, "texture_packs"),
    os.path.join(RESOURCE_DIR, "static", "texture_packs"),
]
MOD_DIRS = [
    os.path.join(DATA_DIR, "mods"),
    os.path.join(RESOURCE_DIR, "static", "mods"),
]
SHADER_DIRS = [
    os.path.join(DATA_DIR, "shaders"),
    os.path.join(RESOURCE_DIR, "static", "shaders"),
]

def _safe_id(value):
    """Valide un identifiant de pack/mod avant tout accès au système de fichiers."""
    return bool(value and re.fullmatch(r"[A-Za-z0-9_-]{1,80}", value))

def _manifest_from_folder(folder, fallback_id):
    manifest_path = os.path.join(folder, "manifest.json")
    try:
        with open(manifest_path, "r", encoding="utf-8") as stream:
            data = json.load(stream)
        if not isinstance(data, dict):
            return None
        data.setdefault("id", fallback_id)
        data.setdefault("name", fallback_id)
        data.setdefault("description", "")
        data.setdefault("version", "1.0.0")
        return data
    except (OSError, ValueError, TypeError):
        return None


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS worlds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            seed TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_played_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS block_changes (
            world_id INTEGER NOT NULL,
            dimension TEXT NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            z INTEGER NOT NULL,
            block_id INTEGER NOT NULL,
            PRIMARY KEY (world_id, dimension, x, y, z),
            FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS player_state (
            world_id INTEGER NOT NULL,
            dimension TEXT NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            z REAL NOT NULL,
            rot_x REAL NOT NULL DEFAULT 0,
            rot_y REAL NOT NULL DEFAULT 0,
            health REAL NOT NULL DEFAULT 9,
            selected_slot INTEGER NOT NULL DEFAULT 0,
            camera_mode INTEGER NOT NULL DEFAULT 0,
            velocity_x REAL NOT NULL DEFAULT 0,
            velocity_y REAL NOT NULL DEFAULT 0,
            velocity_z REAL NOT NULL DEFAULT 0,
            inventory_json TEXT NOT NULL DEFAULT '[]',
            PRIMARY KEY (world_id, dimension),
            FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS world_state (
            world_id INTEGER PRIMARY KEY,
            current_dimension TEXT NOT NULL DEFAULT 'overworld',
            day_time REAL NOT NULL DEFAULT 48,
            generation_version INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS generated_chunks (
            world_id INTEGER NOT NULL,
            dimension TEXT NOT NULL,
            chunk_x INTEGER NOT NULL,
            chunk_z INTEGER NOT NULL,
            generation_version INTEGER NOT NULL DEFAULT 1,
            generated_at TEXT NOT NULL,
            PRIMARY KEY (world_id, dimension, chunk_x, chunk_z),
            FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_block_changes_world_dimension
            ON block_changes(world_id, dimension);

        CREATE INDEX IF NOT EXISTS idx_player_state_world
            ON player_state(world_id);

        CREATE INDEX IF NOT EXISTS idx_generated_chunks_world_dimension
            ON generated_chunks(world_id, dimension);
    """)
                                                                          
                                                
    existing = {row[1] for row in db.execute("PRAGMA table_info(player_state)").fetchall()}
    migrations = {
        "health": "REAL NOT NULL DEFAULT 9",
        "selected_slot": "INTEGER NOT NULL DEFAULT 0",
        "camera_mode": "INTEGER NOT NULL DEFAULT 0",
        "velocity_x": "REAL NOT NULL DEFAULT 0",
        "velocity_y": "REAL NOT NULL DEFAULT 0",
        "velocity_z": "REAL NOT NULL DEFAULT 0",
        "inventory_json": "TEXT NOT NULL DEFAULT '[]'",
    }
    for column, definition in migrations.items():
        if column not in existing:
            db.execute(f"ALTER TABLE player_state ADD COLUMN {column} {definition}")

    db.commit()
    db.close()


                                                          
init_db()


def world_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "seed": row["seed"],
        "created_at": row["created_at"],
        "last_played_at": row["last_played_at"],
    }


def get_world_or_404(db, world_id):
    row = db.execute(
        "SELECT * FROM worlds WHERE id = ?",
        (world_id,)
    ).fetchone()

    if row is None:
        return None

    return row


                                                                              
       
                                                                              

@app.route('/')
def menu():
    return render_template('menu.html')


@app.route('/game')
def game():
    return render_template('index.html')


                                                                              
              
                                                                              

@app.route('/api/worlds', methods=['GET'])
def list_worlds():
    db = get_db()

    rows = db.execute("""
        SELECT *
        FROM worlds
        ORDER BY last_played_at DESC, id DESC
    """).fetchall()

    db.close()

    return jsonify({
        "worlds": [world_to_dict(row) for row in rows]
    })


@app.route('/api/worlds', methods=['POST'])
def create_world():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    raw_seed = data.get("seed", "")
    seed = "" if raw_seed is None else str(raw_seed).strip()

    if not name:
        return jsonify({
            "error": "Le nom du monde est obligatoire."
        }), 400

    if len(name) > 64:
        return jsonify({
            "error": "Le nom du monde est trop long (64 caractères maximum)."
        }), 400

                                                    
    if not seed:
        seed = str(secrets.randbits(32))

    if len(seed) > 128:
        return jsonify({
            "error": "La seed est trop longue (128 caractères maximum)."
        }), 400

    now = utc_now()

    db = get_db()
    cursor = db.execute("""
        INSERT INTO worlds (name, seed, created_at, last_played_at)
        VALUES (?, ?, ?, ?)
    """, (name, seed, now, now))

    world_id = cursor.lastrowid
    db.execute("""
        INSERT INTO world_state (world_id, current_dimension, day_time, generation_version, updated_at)
        VALUES (?, 'overworld', 48, 3, ?)
    """, (world_id, now))
    db.commit()

    row = db.execute(
        "SELECT * FROM worlds WHERE id = ?",
        (world_id,)
    ).fetchone()

    db.close()

    return jsonify({
        "world": world_to_dict(row)
    }), 201


@app.route('/api/worlds/<int:world_id>', methods=['GET'])
def get_world(world_id):
    db = get_db()
    row = get_world_or_404(db, world_id)

    if row is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

                                                                
    now = utc_now()
    db.execute(
        "UPDATE worlds SET last_played_at = ? WHERE id = ?",
        (now, world_id)
    )
    db.commit()

    row = db.execute(
        "SELECT * FROM worlds WHERE id = ?",
        (world_id,)
    ).fetchone()

    db.close()

    return jsonify({
        "world": world_to_dict(row)
    })


@app.route('/api/worlds/<int:world_id>', methods=['DELETE'])
def delete_world(world_id):
    db = get_db()

    row = get_world_or_404(db, world_id)
    if row is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    db.execute(
        "DELETE FROM worlds WHERE id = ?",
        (world_id,)
    )
    db.commit()
    db.close()

    return jsonify({
        "ok": True,
        "deleted": world_id
    })


                                                                              
                      
 
             
                                       
                                                                    
                                            
                                                                              

@app.route('/api/worlds/<int:world_id>/changes', methods=['GET'])
def get_block_changes(world_id):
    dimension = str(request.args.get("dimension", "")).strip()

    db = get_db()

    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    if dimension:
        rows = db.execute("""
            SELECT dimension, x, y, z, block_id
            FROM block_changes
            WHERE world_id = ? AND dimension = ?
        """, (world_id, dimension)).fetchall()
    else:
        rows = db.execute("""
            SELECT dimension, x, y, z, block_id
            FROM block_changes
            WHERE world_id = ?
        """, (world_id,)).fetchall()

    db.close()

    return jsonify({
        "changes": [
            {
                "dimension": row["dimension"],
                "x": row["x"],
                "y": row["y"],
                "z": row["z"],
                "block_id": row["block_id"],
            }
            for row in rows
        ]
    })


@app.route('/api/worlds/<int:world_id>/changes', methods=['POST'])
def save_block_changes(world_id):
    data = request.get_json(silent=True) or {}
    changes = data.get("changes")

    if not isinstance(changes, list):
        return jsonify({
            "error": "Le champ 'changes' doit être une liste."
        }), 400

    if len(changes) > 5000:
        return jsonify({
            "error": "Trop de modifications dans une seule requête (5000 maximum)."
        }), 400

    db = get_db()

    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    try:
        for change in changes:
            if not isinstance(change, dict):
                raise ValueError("Modification invalide.")

            dimension = str(change.get("dimension", "")).strip()
            x = int(change["x"])
            y = int(change["y"])
            z = int(change["z"])
            block_id = int(change["block_id"])

            if not dimension:
                raise ValueError("Dimension manquante.")

            if len(dimension) > 64:
                raise ValueError("Nom de dimension trop long.")

            if y < 0 or y >= 128:
                raise ValueError("Coordonnée Y hors limites.")

            if block_id < 0 or block_id > 255:
                raise ValueError("ID de bloc invalide.")

            db.execute("""
                INSERT INTO block_changes (
                    world_id, dimension, x, y, z, block_id
                )
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(world_id, dimension, x, y, z)
                DO UPDATE SET block_id = excluded.block_id
            """, (
                world_id,
                dimension,
                x,
                y,
                z,
                block_id
            ))

        db.commit()

    except (KeyError, TypeError, ValueError, OverflowError) as exc:
        db.rollback()
        db.close()
        return jsonify({
            "error": str(exc)
        }), 400

    db.close()

    return jsonify({
        "ok": True,
        "saved": len(changes)
    })


                                                                              
                                       
                                                                              

@app.route('/api/worlds/<int:world_id>/state', methods=['GET'])
def get_world_state(world_id):
    db = get_db()
    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    row = db.execute("SELECT * FROM world_state WHERE world_id = ?", (world_id,)).fetchone()
    if row is None:
        now = utc_now()
        db.execute("""
            INSERT INTO world_state (world_id, current_dimension, day_time, generation_version, updated_at)
            VALUES (?, 'overworld', 48, 3, ?)
        """, (world_id, now))
        db.commit()
        row = db.execute("SELECT * FROM world_state WHERE world_id = ?", (world_id,)).fetchone()

    db.close()
    return jsonify({
        "state": {
            "current_dimension": row["current_dimension"],
            "day_time": row["day_time"],
            "generation_version": row["generation_version"],
            "updated_at": row["updated_at"],
        }
    })


@app.route('/api/worlds/<int:world_id>/state', methods=['PUT'])
def save_world_state(world_id):
    data = request.get_json(silent=True) or {}
    dimension = str(data.get("current_dimension", "overworld")).strip()
    try:
        day_time = float(data.get("day_time", 48))
        generation_version = int(data.get("generation_version", 1))
    except (TypeError, ValueError):
        return jsonify({"error": "État du monde invalide."}), 400

    if not dimension or len(dimension) > 64 or not math.isfinite(day_time) or generation_version < 1:
        return jsonify({"error": "État du monde invalide."}), 400

    db = get_db()
    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    now = utc_now()
    db.execute("""
        INSERT INTO world_state (world_id, current_dimension, day_time, generation_version, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(world_id) DO UPDATE SET
            current_dimension = excluded.current_dimension,
            day_time = excluded.day_time,
            generation_version = excluded.generation_version,
            updated_at = excluded.updated_at
    """, (world_id, dimension, day_time, generation_version, now))
    db.execute("UPDATE worlds SET last_played_at = ? WHERE id = ?", (now, world_id))
    db.commit()
    db.close()
    return jsonify({"ok": True})


@app.route('/api/worlds/<int:world_id>/generated-chunks', methods=['GET'])
def get_generated_chunks(world_id):
    dimension = str(request.args.get("dimension", "")).strip()
    db = get_db()
    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    if dimension:
        rows = db.execute("""
            SELECT dimension, chunk_x, chunk_z, generation_version
            FROM generated_chunks
            WHERE world_id = ? AND dimension = ?
        """, (world_id, dimension)).fetchall()
    else:
        rows = db.execute("""
            SELECT dimension, chunk_x, chunk_z, generation_version
            FROM generated_chunks
            WHERE world_id = ?
        """, (world_id,)).fetchall()
    db.close()

    return jsonify({"chunks": [{
        "dimension": row["dimension"],
        "chunk_x": row["chunk_x"],
        "chunk_z": row["chunk_z"],
        "generation_version": row["generation_version"],
    } for row in rows]})


@app.route('/api/worlds/<int:world_id>/generated-chunks', methods=['POST'])
def save_generated_chunks(world_id):
    data = request.get_json(silent=True) or {}
    chunks = data.get("chunks")
    if not isinstance(chunks, list):
        return jsonify({"error": "Le champ 'chunks' doit être une liste."}), 400
    if len(chunks) > 5000:
        return jsonify({"error": "Trop de chunks dans une seule requête (5000 maximum)."}), 400

    db = get_db()
    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    try:
        now = utc_now()
        for chunk in chunks:
            if not isinstance(chunk, dict):
                raise ValueError("Chunk invalide.")
            dimension = str(chunk.get("dimension", "")).strip()
            cx = int(chunk["chunk_x"])
            cz = int(chunk["chunk_z"])
            generation_version = int(chunk.get("generation_version", 1))
            if not dimension or len(dimension) > 64 or generation_version < 1:
                raise ValueError("Métadonnées de chunk invalides.")
            db.execute("""
                INSERT INTO generated_chunks (world_id, dimension, chunk_x, chunk_z, generation_version, generated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(world_id, dimension, chunk_x, chunk_z)
                DO UPDATE SET generation_version = excluded.generation_version
            """, (world_id, dimension, cx, cz, generation_version, now))
        db.commit()
    except (KeyError, TypeError, ValueError, OverflowError):
        db.rollback()
        db.close()
        return jsonify({"error": "Métadonnées de chunk invalides."}), 400

    db.close()
    return jsonify({"ok": True, "saved": len(chunks)})


                                                                              
                          
                                                                              

@app.route('/api/worlds/<int:world_id>/player', methods=['GET'])
def get_player_state(world_id):
    dimension = str(request.args.get("dimension", "")).strip()
    db = get_db()
    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    query = """
        SELECT dimension, x, y, z, rot_x, rot_y, health, selected_slot, camera_mode,
               velocity_x, velocity_y, velocity_z, inventory_json
        FROM player_state
        WHERE world_id = ?
    """
    params = [world_id]
    if dimension:
        query += " AND dimension = ?"
        params.append(dimension)
    rows = db.execute(query, params).fetchall()
    db.close()

    def row_to_state(row):
        try:
            inventory = json.loads(row["inventory_json"] or "[]")
        except (TypeError, ValueError):
            inventory = []
        return {
            "dimension": row["dimension"],
            "x": row["x"], "y": row["y"], "z": row["z"],
            "rot_x": row["rot_x"], "rot_y": row["rot_y"],
            "health": row["health"],
            "selected_slot": row["selected_slot"],
            "camera_mode": row["camera_mode"],
            "velocity_x": row["velocity_x"], "velocity_y": row["velocity_y"], "velocity_z": row["velocity_z"],
            "inventory": inventory,
        }

    if dimension:
        return jsonify({"state": row_to_state(rows[0]) if rows else None})
    return jsonify({"states": [row_to_state(row) for row in rows]})


@app.route('/api/worlds/<int:world_id>/player', methods=['PUT'])
def save_player_state(world_id):
    data = request.get_json(silent=True) or {}
    dimension = str(data.get("dimension", "")).strip()
    if not dimension or len(dimension) > 64:
        return jsonify({"error": "Dimension manquante ou invalide."}), 400

    try:
        values = {
            "x": float(data["x"]), "y": float(data["y"]), "z": float(data["z"]),
            "rot_x": float(data.get("rot_x", 0)), "rot_y": float(data.get("rot_y", 0)),
            "health": float(data.get("health", 9)),
            "selected_slot": int(data.get("selected_slot", 0)),
            "camera_mode": int(data.get("camera_mode", 0)),
            "velocity_x": float(data.get("velocity_x", 0)),
            "velocity_y": float(data.get("velocity_y", 0)),
            "velocity_z": float(data.get("velocity_z", 0)),
        }
        inventory = data.get("inventory", [])
        if not isinstance(inventory, list) or len(inventory) != 36:
            raise ValueError("Inventaire invalide.")
        if not all(math.isfinite(values[key]) for key in ("x", "y", "z", "rot_x", "rot_y", "health", "velocity_x", "velocity_y", "velocity_z")):
            raise ValueError("Valeurs numériques non finies.")
        if values["health"] < 0 or values["health"] > 10 or values["selected_slot"] < 0 or values["selected_slot"] > 8:
            raise ValueError("Vie ou emplacement sélectionné invalide.")
        for slot in inventory:
            if not isinstance(slot, dict): raise ValueError("Objet d’inventaire invalide.")
            item_id, count = int(slot.get("type", 0)), int(slot.get("count", 0))
            if item_id < 0 or item_id > 9007199254740991 or count < 0 or count > 100:
                raise ValueError("Pile d’inventaire invalide.")
        inventory_json = json.dumps(inventory, separators=(",", ":"))
    except (KeyError, TypeError, ValueError, OverflowError):
        return jsonify({"error": "État du joueur invalide."}), 400

    db = get_db()
    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    db.execute("""
        INSERT INTO player_state (
            world_id, dimension, x, y, z, rot_x, rot_y, health, selected_slot,
            camera_mode, velocity_x, velocity_y, velocity_z, inventory_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(world_id, dimension) DO UPDATE SET
            x = excluded.x, y = excluded.y, z = excluded.z,
            rot_x = excluded.rot_x, rot_y = excluded.rot_y,
            health = excluded.health, selected_slot = excluded.selected_slot,
            camera_mode = excluded.camera_mode,
            velocity_x = excluded.velocity_x, velocity_y = excluded.velocity_y, velocity_z = excluded.velocity_z,
            inventory_json = excluded.inventory_json
    """, (world_id, dimension, values["x"], values["y"], values["z"], values["rot_x"], values["rot_y"],
          values["health"], values["selected_slot"], values["camera_mode"], values["velocity_x"],
          values["velocity_y"], values["velocity_z"], inventory_json))
    db.execute("UPDATE worlds SET last_played_at = ? WHERE id = ?", (utc_now(), world_id))
    db.commit()
    db.close()
    return jsonify({"ok": True})


                                                                              
                                        
                                                                              



@app.route('/api/texture-packs')
def list_texture_packs():
    """Expose les packs installés sans extraire leurs archives ZIP."""
    packs = [{"id": "default", "name": "Textures de La Plaine", "description": "Textures originales du jeu", "version": "base", "built_in": True}]
    seen = {"default"}
    for root in TEXTURE_PACK_DIRS:
        if not os.path.isdir(root):
            continue
        for entry in sorted(os.listdir(root)):
            path = os.path.join(root, entry)
            if os.path.isfile(path) and not entry.lower().endswith('.zip'):
                continue
            pack_id = os.path.splitext(entry)[0] if entry.lower().endswith('.zip') else entry
            if not _safe_id(pack_id) or pack_id in seen:
                continue
            manifest = None
            if os.path.isfile(path) and entry.lower().endswith('.zip'):
                try:
                    with zipfile.ZipFile(path) as archive:
                        names = set(archive.namelist())
                        manifest_name = next((n for n in ('manifest.json', 'texture_pack/manifest.json') if n in names), None)
                        if manifest_name:
                            manifest_info = archive.getinfo(manifest_name)
                            if manifest_info.file_size > 1024 * 1024:
                                continue
                            manifest = json.loads(archive.read(manifest_name).decode('utf-8'))
                except (OSError, zipfile.BadZipFile, ValueError, KeyError):
                    continue
            elif os.path.isdir(path):
                manifest = _manifest_from_folder(path, pack_id)
            if not isinstance(manifest, dict):
                manifest = {"id": pack_id, "name": pack_id, "description": "Pack sans manifeste", "version": "?"}
            if not _safe_id(str(manifest.get('id', pack_id))):
                continue
            manifest.update({"id": pack_id, "built_in": False})
            packs.append({k: manifest.get(k) for k in ("id", "name", "description", "version", "built_in")})
            seen.add(pack_id)
    return jsonify({"packs": packs})

@app.route('/api/texture-packs/<pack_id>/textures/<path:asset_path>')
def get_texture_pack_asset(pack_id, asset_path):
    """Renvoie la texture du pack, puis retombe sur celle du jeu si absente."""
    if not _safe_id(pack_id) or asset_path.startswith('/') or '\\' in asset_path or any(part in ('.', '..') for part in asset_path.split('/')):
        abort(400)
    if pack_id != 'default':
        for root in TEXTURE_PACK_DIRS:
            zip_path = os.path.join(root, pack_id + '.zip')
            folder_path = os.path.join(root, pack_id)
            if os.path.isfile(zip_path):
                try:
                    with zipfile.ZipFile(zip_path) as archive:
                        candidates = (f"static/textures/{asset_path}", f"textures/{asset_path}", asset_path)
                        name = next((n for n in candidates if n in archive.namelist() and not n.startswith('/') and '..' not in n.split('/')), None)
                        if name:
                            info = archive.getinfo(name)
                            if info.file_size > 16 * 1024 * 1024:
                                abort(413)
                            data = archive.read(name)
                            mimetype = 'image/png' if asset_path.lower().endswith('.png') else 'application/octet-stream'
                            return send_file(io.BytesIO(data), mimetype=mimetype, max_age=0)
                except zipfile.BadZipFile:
                    pass
            if os.path.isdir(folder_path):
                for relative in (os.path.join('static', 'textures', asset_path), os.path.join('textures', asset_path), asset_path):
                    candidate = os.path.realpath(os.path.join(folder_path, relative))
                    if candidate.startswith(os.path.realpath(folder_path) + os.sep) and os.path.isfile(candidate):
                        return send_file(candidate, max_age=0)
    base = os.path.realpath(os.path.join(app.static_folder, 'textures', asset_path))
    texture_root = os.path.realpath(os.path.join(app.static_folder, 'textures'))
    if not base.startswith(texture_root + os.sep) or not os.path.isfile(base):
        abort(404)
    return send_file(base, max_age=0)

def _read_shader_pack(zip_path, pack_id, include_source=False):
    """Lit un pack shader ZIP avec des limites strictes et des chemins internes sûrs."""
    try:
        if os.path.getsize(zip_path) > 32 * 1024 * 1024:
            return None
        with zipfile.ZipFile(zip_path) as archive:
            files = {info.filename: info for info in archive.infolist() if not info.is_dir()}
            manifest_info = files.get('manifest.json')
            if not manifest_info or manifest_info.file_size > 128 * 1024:
                return None
            manifest = json.loads(archive.read('manifest.json').decode('utf-8'))
            if not isinstance(manifest, dict):
                return None
            frag_name = manifest.get('fragment_shader', manifest.get('fragmentShader', 'fragment.glsl'))
            vert_name = manifest.get('vertex_shader', manifest.get('vertexShader'))
            def safe_shader_file(name):
                return (isinstance(name, str) and name in files and not name.startswith('/')
                        and '\\' not in name and all(part not in ('.', '..', '') for part in name.split('/'))
                        and name.lower().endswith(('.glsl', '.frag', '.vert'))
                        and files[name].file_size <= 512 * 1024)
            if not safe_shader_file(frag_name):
                return None
            if vert_name is not None and not safe_shader_file(vert_name):
                return None
            item = {
                'id': pack_id,
                'name': str(manifest.get('name', pack_id))[:120],
                'description': str(manifest.get('description', 'Shader personnalisé'))[:500],
                'version': str(manifest.get('version', '1.0.0'))[:40],
                'type': 'screen'
            }
            if include_source:
                item['fragment_shader'] = archive.read(frag_name).decode('utf-8')
                item['vertex_shader'] = archive.read(vert_name).decode('utf-8') if vert_name else None
            return item
    except (OSError, zipfile.BadZipFile, ValueError, KeyError, UnicodeDecodeError, json.JSONDecodeError):
        return None


@app.route('/api/shaders')
def list_shader_packs():
    """Liste les packs de shaders ZIP installés dans static/shaders ou shaders/."""
    packs, seen = [], set()
    for folder in SHADER_DIRS:
        if not os.path.isdir(folder):
            continue
        for entry in sorted(os.listdir(folder)):
            if not entry.lower().endswith('.zip'):
                continue
            pack_id = os.path.splitext(entry)[0]
            if not _safe_id(pack_id) or pack_id in seen:
                continue
            item = _read_shader_pack(os.path.join(folder, entry), pack_id)
            if item:
                packs.append(item)
                seen.add(pack_id)
    return jsonify({'shaders': packs})


@app.route('/api/shaders/<shader_id>')
def get_shader_pack(shader_id):
    """Retourne les sources GLSL d'un pack shader validé."""
    if not _safe_id(shader_id):
        abort(400)
    for folder in SHADER_DIRS:
        candidate = os.path.realpath(os.path.join(folder, shader_id + '.zip'))
        if candidate.startswith(os.path.realpath(folder) + os.sep) and os.path.isfile(candidate):
            item = _read_shader_pack(candidate, shader_id, include_source=True)
            if item:
                return jsonify(item)
    abort(404)


@app.route('/api/mods')
def list_mods():
    """Liste les mods déclarés. L'activation reste un choix local de l'utilisateur."""
    mods, seen = [], set()
    for root in MOD_DIRS:
        if not os.path.isdir(root):
            continue
        for folder in sorted(os.listdir(root)):
            if not _safe_id(folder) or folder in seen:
                continue
            mod_path = os.path.join(root, folder)
            if not os.path.isdir(mod_path):
                continue
            manifest = _manifest_from_folder(mod_path, folder)
            if not manifest:
                continue
            if not _safe_id(str(manifest.get('id', folder))):
                continue
            mods.append({
                "id": folder, "name": str(manifest.get("name", folder))[:120],
                "description": str(manifest.get("description", ""))[:500],
                "version": str(manifest.get("version", "1.0.0"))[:40],
                "entry": manifest.get("entry", "main.js"),
                "api_version": str(manifest.get("api_version", "1")),
                "dependencies": manifest.get("dependencies", []) if isinstance(manifest.get("dependencies", []), list) else [],
                "menu_settings": manifest.get("menu_settings", False) is True,
            })
            seen.add(folder)
    return jsonify({"mods": mods})

@app.route('/api/mods/<mod_id>/<path:asset_path>')
def get_mod_asset(mod_id, asset_path):
    """Sert uniquement des fichiers d'un mod dont l'identifiant et le chemin sont sûrs."""
    if not _safe_id(mod_id) or asset_path.startswith('/') or '\\' in asset_path or any(part in ('.', '..') for part in asset_path.split('/')):
        abort(400)
    for root in MOD_DIRS:
        folder = os.path.realpath(os.path.join(root, mod_id))
        candidate = os.path.realpath(os.path.join(folder, asset_path))
        if candidate.startswith(folder + os.sep) and os.path.isfile(candidate):
            return send_file(candidate, max_age=0)
    abort(404)


@app.route('/api/modules')
def get_modules():
    blocks_dir = os.path.join(app.static_folder, 'js', 'blocks')
    mobs_dir = os.path.join(app.static_folder, 'js', 'mobs')
    dims_dir = os.path.join(app.static_folder, 'js', 'dimensions')
    recipes_dir = os.path.join(app.static_folder, 'js', 'crafts', 'recipes')

    block_files = []
    if os.path.exists(blocks_dir):
        block_files = sorted(
            f for f in os.listdir(blocks_dir)
            if f.lower().endswith('.js') and f.lower() != 'register.js'
        )

    mob_files = []
    if os.path.exists(mobs_dir):
        mob_files = sorted(
            f for f in os.listdir(mobs_dir)
            if f.lower().endswith('.js') and f.lower() not in ('register.js', 'animal.js')
        )

    dimensions = []
    if os.path.exists(dims_dir):
        for dim_name in sorted(os.listdir(dims_dir)):
            dim_path = os.path.join(dims_dir, dim_name)
            if not os.path.isdir(dim_path):
                continue

            biomes_dir = os.path.join(dim_path, 'biomes')
            biome_files = []
            structure_files = []

            if os.path.exists(biomes_dir):
                biome_files = sorted(
                    f for f in os.listdir(biomes_dir)
                    if f.lower().endswith('.js') and f.lower() != 'register.js'
                )

                structures_dir = os.path.join(biomes_dir, 'structures')
                if os.path.exists(structures_dir):
                    structure_files = sorted(
                        f for f in os.listdir(structures_dir)
                        if f.lower().endswith('.js')
                    )

            dimensions.append({
                'id': dim_name,
                'biomes': biome_files,
                'structures': structure_files
            })

    recipes = sorted(f for f in os.listdir(recipes_dir) if f.lower().endswith('.json')) if os.path.isdir(recipes_dir) else []
    return jsonify({
        'blocks': block_files,
        'mobs': mob_files,
        'dimensions': dimensions,
        'recipes': recipes
    })


if __name__ == '__main__':
    app.run(debug=True)
