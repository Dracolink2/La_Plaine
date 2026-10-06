import os
import sqlite3
import secrets
from datetime import datetime, timezone
import json

from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "worlds.db")


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
    seed = str(data.get("seed", "")).strip()

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
        VALUES (?, 'overworld', 48, 1, ?)
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

    # Marque le monde comme récemment joué dès qu'il est ouvert.
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
            VALUES (?, 'overworld', 48, 1, ?)
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

    if not dimension or len(dimension) > 64 or not (day_time == day_time) or generation_version < 1:
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


@app.route('/api/modules')
def get_modules():
    blocks_dir = os.path.join(app.static_folder, 'js', 'blocks')
    dims_dir = os.path.join(app.static_folder, 'js', 'dimensions')

    block_files = []
    if os.path.exists(blocks_dir):
        block_files = sorted(
            f for f in os.listdir(blocks_dir)
            if f.lower().endswith('.js') and f.lower() != 'register.js'
        )

    dimensions = []
    if os.path.exists(dims_dir):
        for dim_name in sorted(os.listdir(dims_dir)):
            dim_path = os.path.join(dims_dir, dim_name)
            if not os.path.isdir(dim_path):
                continue

            biomes_dir = os.path.join(dim_path, 'biomes')
            biome_files = []

            if os.path.exists(biomes_dir):
                biome_files = sorted(
                    f for f in os.listdir(biomes_dir)
                    if f.lower().endswith('.js') and f.lower() != 'register.js'
                )

            dimensions.append({
                'id': dim_name,
                'biomes': biome_files
            })

    return jsonify({
        'blocks': block_files,
        'dimensions': dimensions
    })


if __name__ == '__main__':
    app.run(debug=True)
