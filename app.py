import os
import sqlite3
import secrets
from datetime import datetime, timezone

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
            PRIMARY KEY (world_id, dimension),
            FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_block_changes_world_dimension
            ON block_changes(world_id, dimension);

        CREATE INDEX IF NOT EXISTS idx_player_state_world
            ON player_state(world_id);
    """)
    db.commit()
    db.close()


# Création automatique de la base au lancement du serveur.
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

    # Une seed vide signifie : génération aléatoire.
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


@app.route('/api/worlds/<int:world_id>/player', methods=['GET'])
def get_player_state(world_id):
    dimension = str(request.args.get("dimension", "")).strip()

    db = get_db()

    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    if dimension:
        row = db.execute("""
            SELECT dimension, x, y, z, rot_x, rot_y
            FROM player_state
            WHERE world_id = ? AND dimension = ?
        """, (world_id, dimension)).fetchone()

        db.close()

        return jsonify({
            "state": None if row is None else {
                "dimension": row["dimension"],
                "x": row["x"],
                "y": row["y"],
                "z": row["z"],
                "rot_x": row["rot_x"],
                "rot_y": row["rot_y"],
            }
        })

    rows = db.execute("""
        SELECT dimension, x, y, z, rot_x, rot_y
        FROM player_state
        WHERE world_id = ?
    """, (world_id,)).fetchall()

    db.close()

    return jsonify({
        "states": [
            {
                "dimension": row["dimension"],
                "x": row["x"],
                "y": row["y"],
                "z": row["z"],
                "rot_x": row["rot_x"],
                "rot_y": row["rot_y"],
            }
            for row in rows
        ]
    })


@app.route('/api/worlds/<int:world_id>/player', methods=['PUT'])
def save_player_state(world_id):
    data = request.get_json(silent=True) or {}

    dimension = str(data.get("dimension", "")).strip()

    if not dimension:
        return jsonify({"error": "Dimension manquante."}), 400

    if len(dimension) > 64:
        return jsonify({"error": "Nom de dimension trop long."}), 400

    try:
        x = float(data["x"])
        y = float(data["y"])
        z = float(data["z"])
        rot_x = float(data.get("rot_x", 0))
        rot_y = float(data.get("rot_y", 0))
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Position du joueur invalide."}), 400

    db = get_db()

    if get_world_or_404(db, world_id) is None:
        db.close()
        return jsonify({"error": "Monde introuvable."}), 404

    db.execute("""
        INSERT INTO player_state (
            world_id, dimension, x, y, z, rot_x, rot_y
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(world_id, dimension)
        DO UPDATE SET
            x = excluded.x,
            y = excluded.y,
            z = excluded.z,
            rot_x = excluded.rot_x,
            rot_y = excluded.rot_y
    """, (
        world_id,
        dimension,
        x,
        y,
        z,
        rot_x,
        rot_y
    ))

    db.commit()
    db.close()

    return jsonify({
        "ok": True
    })

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
