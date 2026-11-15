"""La Plaine Launcher - cœur (aucune dépendance Qt).

Le jeu est exécuté dans l'interpréteur Python embarqué du launcher,
dans un thread séparé, sans sous-processus.

Structure à côté du launcher :
    versions/   ZIP locaux
    cache/      versions extraites
    saves/      worlds.db (partagé), backups/, exports/
    logs/
    texture_packs/ mods/ shaders/   (partagés entre versions)
    settings.json
"""
import json
import contextlib
import logging
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import zipfile
from dataclasses import dataclass
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Callable, Optional
from urllib.parse import unquote, urlparse

log = logging.getLogger("plaine")

# --------------------------------------------------------------------------- #
# Chemins
# --------------------------------------------------------------------------- #

def _app_dir() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


BASE = Path(os.environ.get("PLAINE_HOME") or _app_dir())
VERSIONS_DIR = BASE / "versions"
CACHE_DIR = BASE / "cache"
SAVES_DIR = BASE / "saves"
BACKUPS_DIR = SAVES_DIR / "backups"
EXPORTS_DIR = SAVES_DIR / "exports"
LOGS_DIR = BASE / "logs"
SETTINGS_FILE = BASE / "settings.json"
WORLDS_DB = SAVES_DIR / "worlds.db"
SHARED_DIRS = ("texture_packs", "mods", "shaders")

MARKER = ".launcher_ok.json"
USER_AGENT = "LaPlaineLauncher/1.0"

DEFAULT_SETTINGS = {
    "versions_url": "https://github.com/Dracolink2/La_Plaine-Launcher/raw/refs/heads/versions/versions.txt",
    "auto_fetch": True,
    "open_browser": True,
    "keep_backups": 20,
    "last_version": "",
}


class Cancelled(Exception):
    pass


Progress = Callable[[int, str], None]


def _noop_progress(pct: int, msg: str) -> None:
    pass


def ensure_dirs() -> None:
    for d in (VERSIONS_DIR, CACHE_DIR, SAVES_DIR, BACKUPS_DIR, EXPORTS_DIR, LOGS_DIR,
              *(BASE / s for s in SHARED_DIRS)):
        d.mkdir(parents=True, exist_ok=True)


def setup_logging() -> None:
    if log.handlers:
        return
    log.setLevel(logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    try:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        h = RotatingFileHandler(LOGS_DIR / "launcher.log", maxBytes=512 * 1024,
                                backupCount=2, encoding="utf-8")
    except OSError:
        h = logging.StreamHandler()
    h.setFormatter(fmt)
    log.addHandler(h)


# --------------------------------------------------------------------------- #
# Réglages
# --------------------------------------------------------------------------- #

def load_settings() -> dict:
    data = dict(DEFAULT_SETTINGS)
    try:
        loaded = json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(loaded, dict):
            for k, default in DEFAULT_SETTINGS.items():
                if k in loaded and isinstance(loaded[k], type(default)):
                    data[k] = loaded[k]
    except (OSError, ValueError):
        pass
    return data


def save_settings(settings: dict) -> None:
    tmp = SETTINGS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(settings, indent=2, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, SETTINGS_FILE)


# --------------------------------------------------------------------------- #
# Versions
# --------------------------------------------------------------------------- #

_VERSION_RE = re.compile(r"(\d+(?:\.\d+)+(?:[-+][A-Za-z0-9._-]+)?)")


def extract_version(text: str) -> Optional[str]:
    """Conserve le nom complet de version, suffixes compris (beta, rc, dev...)."""
    value = Path(str(text).replace("\\", "/")).name
    value = re.sub(r"(?i)\.zip$", "", value)
    value = re.sub(r"(?i)^(?:la[_ -]?plaine)[_ -]*", "", value)
    value = value.strip()
    return value or None


def version_sort_key(v: str):
    """Tri naturel : les numéros sont comparés comme des nombres, suffixes conservés."""
    parts = re.split(r"(\d+)", str(v).casefold())
    return tuple((1, int(p)) if p.isdigit() else (0, p) for p in parts)


def safe_key(text: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", text).strip("._") or "version"


@dataclass
class VersionInfo:
    key: str
    version: str
    zip_path: Optional[Path] = None
    url: Optional[str] = None
    zip_ok: bool = False
    error: str = ""
    cached: bool = False

    @property
    def has_local(self) -> bool:
        return self.zip_path is not None


@dataclass
class ZipCheck:
    ok: bool
    prefix: str = ""
    error: str = ""


def inspect_zip(zf: zipfile.ZipFile) -> ZipCheck:
    names = [n for n in zf.namelist() if not n.startswith("__MACOSX/")]
    apps = [n for n in names if n == "app.py" or n.endswith("/app.py")]
    if not apps:
        return ZipCheck(False, error="app.py introuvable")
    app = min(apps, key=lambda n: (n.count("/"), n))
    prefix = app[: -len("app.py")]
    has_templates = any(n.startswith(prefix + "templates/") for n in names)
    has_static = any(n.startswith(prefix + "static/") for n in names)
    if not (has_templates and has_static):
        return ZipCheck(False, prefix, "templates/ ou static/ manquant")
    return ZipCheck(True, prefix)


def check_zip_file(path: Path) -> ZipCheck:
    try:
        with zipfile.ZipFile(path) as zf:
            return inspect_zip(zf)
    except zipfile.BadZipFile:
        return ZipCheck(False, error="archive corrompue")
    except OSError as e:
        return ZipCheck(False, error=f"lecture impossible ({e.strerror or e})")


def _marker(key: str) -> Optional[dict]:
    try:
        data = json.loads((CACHE_DIR / key / MARKER).read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def cached_game_dir(key: str, zip_path: Optional[Path] = None) -> Optional[Path]:
    """Dossier du jeu en cache si valide (et à jour par rapport au ZIP local)."""
    m = _marker(key)
    if not m:
        return None
    if zip_path is not None and m.get("source") == "local":
        try:
            st = zip_path.stat()
        except OSError:
            return None
        if m.get("size") != st.st_size or m.get("mtime_ns") != st.st_mtime_ns:
            return None
    game_dir = CACHE_DIR / key / str(m.get("root", ""))
    return game_dir if (game_dir / "app.py").is_file() else None


def scan_local() -> dict:
    found = {}
    if not VERSIONS_DIR.is_dir():
        return found
    for p in sorted(VERSIONS_DIR.iterdir(), key=lambda x: x.name.lower()):
        if not p.is_file() or p.suffix.lower() != ".zip":
            continue
        version = extract_version(p.stem) or p.stem
        key = safe_key(version)
        if key in found:  # doublon : on garde le premier, l'autre est ignoré
            log.warning("ZIP en double ignoré : %s", p.name)
            continue
        check = check_zip_file(p)
        found[key] = VersionInfo(key, version, zip_path=p, zip_ok=check.ok, error=check.error)
    return found


def parse_versions_txt(text: str) -> list:
    entries = []
    for raw in text.splitlines():
        line = raw.strip().lstrip("\ufeff")
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            version, url = (s.strip() for s in line.split("|", 1))
        else:
            version, url = "", line
        if not re.match(r"^https?://", url, re.I):
            log.warning("Ligne ignorée dans versions.txt : %r", raw)
            continue
        if "github.com" in url and "/blob/" in url:
            url = url.replace("/blob/", "/raw/", 1)
        if not version:
            name = unquote(urlparse(url).path.rsplit("/", 1)[-1])
            version = extract_version(name) or Path(name).stem
        entries.append((version, url))
    return entries


def _open(url: str, timeout: int = 20):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(req, timeout=timeout)


REMOTE_CACHE_FILE = BASE / "versions_cache.json"


def load_remote_cache() -> list:
    """Dernière liste en ligne connue (affichage immédiat au démarrage)."""
    try:
        data = json.loads(REMOTE_CACHE_FILE.read_text(encoding="utf-8"))
        return [(str(v), str(u)) for v, u in data] if isinstance(data, list) else []
    except (OSError, ValueError, TypeError):
        return []


def fetch_remote_entries(url: str) -> list:
    if not url:
        raise ValueError("URL de versions.txt non définie")
    last_error = "erreur inconnue"
    for attempt in (1, 2):  # délai court : une adresse IPv6 morte ne doit pas bloquer 15 s
        t0 = time.monotonic()
        try:
            with _open(url, 6) as r:
                data = r.read(1024 * 1024)
            entries = parse_versions_txt(data.decode("utf-8-sig", errors="replace"))
            log.info("versions.txt chargé en %.1f s (%d entrées, essai %d)",
                     time.monotonic() - t0, len(entries), attempt)
            try:
                REMOTE_CACHE_FILE.write_text(json.dumps(entries), encoding="utf-8")
            except OSError:
                pass
            return entries
        except urllib.error.HTTPError as e:
            last_error = f"HTTP {e.code}"
            if e.code in (403, 404):
                break  # inutile de réessayer
        except urllib.error.URLError as e:
            last_error = str(e.reason)
        except (socket.timeout, TimeoutError):
            last_error = "délai dépassé"
        log.warning("versions.txt essai %d échoué après %.1f s : %s", attempt, time.monotonic() - t0, last_error)
    raise RuntimeError(f"versions.txt inaccessible ({last_error})")


def build_catalog(remote_entries: list) -> list:
    catalog = scan_local()
    for version, url in remote_entries:
        key = safe_key(version)
        if key in catalog:
            catalog[key].url = url
        else:
            catalog[key] = VersionInfo(key, version, url=url)
    for info in catalog.values():
        info.cached = cached_game_dir(info.key, info.zip_path if info.zip_ok else None) is not None
    return sorted(catalog.values(), key=lambda i: version_sort_key(i.version), reverse=True)


# --------------------------------------------------------------------------- #
# Téléchargement / extraction
# --------------------------------------------------------------------------- #

def download_file(url: str, dest: Path, progress: Progress = _noop_progress,
                  cancel: Optional[threading.Event] = None, label: str = "Téléchargement") -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with _open(url, 20) as r, open(dest, "wb") as f:
            total = int(r.headers.get("Content-Length") or 0)
            done = 0
            while True:
                if cancel is not None and cancel.is_set():
                    raise Cancelled()
                chunk = r.read(256 * 1024)
                if not chunk:
                    break
                f.write(chunk)
                done += len(chunk)
                if total:
                    progress(int(done * 100 / total), f"{label} {done / 1048576:.1f} / {total / 1048576:.1f} Mo")
                else:
                    progress(0, f"{label} {done / 1048576:.1f} Mo")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Téléchargement impossible (HTTP {e.code})") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Téléchargement impossible ({e.reason})") from e
    except (socket.timeout, TimeoutError) as e:
        raise RuntimeError("Téléchargement impossible (délai dépassé)") from e


def _rmtree(path: Path) -> bool:
    shutil.rmtree(path, ignore_errors=True)
    return not path.exists()


def extract_to_cache(zip_path: Path, key: str, source: str,
                     progress: Progress = _noop_progress,
                     cancel: Optional[threading.Event] = None) -> Path:
    tmp = CACHE_DIR / f"{key}.tmp"
    final = CACHE_DIR / key
    _rmtree(tmp)
    tmp.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(zip_path) as zf:
            check = inspect_zip(zf)
            if not check.ok:
                raise RuntimeError(f"Version invalide : {check.error}")
            members = [i for i in zf.infolist() if not i.filename.startswith("__MACOSX/")]
            total = sum(i.file_size for i in members) or 1
            done = 0
            root = tmp.resolve()
            for info in members:
                if cancel is not None and cancel.is_set():
                    raise Cancelled()
                target = (tmp / info.filename).resolve()
                if target != root and root not in target.parents:
                    raise RuntimeError(f"Chemin dangereux dans l'archive : {info.filename}")
                if info.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(target, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                done += info.file_size
                progress(int(done * 100 / total), "Extraction")
        marker = {"root": check.prefix.rstrip("/"), "source": source}
        if source == "local":
            st = zip_path.stat()
            marker.update(size=st.st_size, mtime_ns=st.st_mtime_ns)
        (tmp / MARKER).write_text(json.dumps(marker), encoding="utf-8")
        if final.exists() and not _rmtree(final):
            raise RuntimeError("Cache verrouillé : ferme le jeu puis réessaie")
        os.replace(tmp, final)
    except BaseException:
        _rmtree(tmp)
        raise
    game_dir = final / check.prefix.rstrip("/")
    if not (game_dir / "app.py").is_file():
        raise RuntimeError("Extraction incomplète")
    return game_dir


def prepare_version(info: VersionInfo, progress: Progress = _noop_progress,
                    cancel: Optional[threading.Event] = None) -> Path:
    """Retourne un dossier de jeu prêt à lancer (cache > ZIP local > ZIP distant)."""
    game_dir = cached_game_dir(info.key, info.zip_path if info.zip_ok else None)
    if game_dir:
        return game_dir
    if info.zip_path and info.zip_ok:
        return extract_to_cache(info.zip_path, info.key, "local", progress, cancel)
    if info.url:
        tmp_zip = CACHE_DIR / "_dl" / f"{info.key}.zip"
        try:
            download_file(info.url, tmp_zip, progress, cancel)
            check = check_zip_file(tmp_zip)
            if not check.ok:
                raise RuntimeError(f"Archive distante invalide : {check.error}")
            return extract_to_cache(tmp_zip, info.key, "remote", progress, cancel)
        finally:
            try:
                tmp_zip.unlink()
            except OSError:
                pass
    raise RuntimeError(f"Version indisponible : {info.error or 'aucune source'}")


def download_local(info: VersionInfo, progress: Progress = _noop_progress,
                   cancel: Optional[threading.Event] = None) -> Path:
    """Télécharge (ou retélécharge) le ZIP dans versions/. L'ancien ZIP n'est remplacé qu'en cas de succès."""
    if not info.url:
        raise RuntimeError("Aucune URL pour cette version")
    VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
    dest = info.zip_path or VERSIONS_DIR / f"La_Plaine-{safe_key(info.version)}.zip"
    part = dest.with_name(dest.name + ".part")
    try:
        download_file(info.url, part, progress, cancel)
        check = check_zip_file(part)
        if not check.ok:
            raise RuntimeError(f"Archive téléchargée invalide : {check.error}")
        os.replace(part, dest)
    finally:
        try:
            part.unlink()
        except OSError:
            pass
    _rmtree(CACHE_DIR / info.key)  # le cache sera régénéré depuis le nouveau ZIP
    return dest


def format_size(n: int) -> str:
    if n < 1024:
        return f"{n} o"
    for unit in ("Ko", "Mo", "Go"):
        n /= 1024
        if n < 1024 or unit == "Go":
            return f"{n:.1f} {unit}"
    return f"{n} o"


def install_zip(src: Path) -> Path:
    """Copie un ZIP de version dans versions/ après validation (glisser-déposer)."""
    if src.suffix.lower() != ".zip":
        raise RuntimeError(f"{src.name} n'est pas un ZIP")
    check = check_zip_file(src)
    if not check.ok:
        raise RuntimeError(f"{src.name} : {check.error}")
    VERSIONS_DIR.mkdir(parents=True, exist_ok=True)
    dest = VERSIONS_DIR / src.name
    if dest.exists():
        raise RuntimeError(f"{src.name} existe déjà dans versions/")
    part = dest.with_name(dest.name + ".part")
    try:
        shutil.copy2(src, part)
        os.replace(part, dest)
    finally:
        part.unlink(missing_ok=True)
    return dest


def delete_local(info: VersionInfo) -> None:
    if info.zip_path:
        info.zip_path.unlink(missing_ok=True)
    if not _rmtree(CACHE_DIR / info.key):
        raise RuntimeError("Cache verrouillé : ferme le jeu puis réessaie")


def clear_cache() -> None:
    if not CACHE_DIR.exists():
        return
    failed = False
    for p in CACHE_DIR.iterdir():
        if p.is_dir():
            failed |= not _rmtree(p)
        else:
            try:
                p.unlink()
            except OSError:
                failed = True
    if failed:
        raise RuntimeError("Une partie du cache n'a pas pu être supprimée (jeu en cours ?)")


# --------------------------------------------------------------------------- #
# Mondes
# --------------------------------------------------------------------------- #

WORLD_TABLES = ("block_changes", "player_state", "world_state", "generated_chunks")


def _q(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def _ro(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)


def _columns(db: sqlite3.Connection, table: str) -> list:
    return [r[1] for r in db.execute(f"PRAGMA table_info({_q(table)})")]


def backup_db(keep: int = 20) -> Optional[Path]:
    if not WORLDS_DB.is_file():
        return None
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    out = BACKUPS_DIR / f"worlds-{datetime.now():%Y%m%d-%H%M%S-%f}.db"
    src = _ro(WORLDS_DB)
    dst = sqlite3.connect(out)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    files = sorted(BACKUPS_DIR.glob("worlds-*.db"))
    for old in files[: max(0, len(files) - max(1, keep))]:
        old.unlink(missing_ok=True)
    return out


def list_backups() -> list:
    return sorted(BACKUPS_DIR.glob("worlds-*.db"), reverse=True) if BACKUPS_DIR.is_dir() else []


def restore_backup(path: Path, keep: int = 20) -> None:
    """Remplace worlds.db par une sauvegarde (l'état actuel est sauvegardé avant)."""
    if not path.is_file():
        raise RuntimeError("Sauvegarde introuvable")
    backup_db(keep)
    src = _ro(path)
    dst = sqlite3.connect(WORLDS_DB, timeout=5)
    try:
        src.backup(dst)
    except sqlite3.OperationalError as e:
        if "locked" in str(e).lower():
            raise RuntimeError("Base verrouillée : ferme le jeu puis réessaie") from e
        raise RuntimeError(f"Restauration impossible ({e})") from e
    except sqlite3.DatabaseError as e:
        raise RuntimeError(f"Restauration impossible ({e})") from e
    finally:
        dst.close()
        src.close()


def delete_world(world_id: int) -> None:
    db = sqlite3.connect(WORLDS_DB, timeout=5)
    db.execute("PRAGMA foreign_keys = ON")
    try:
        with db:
            for table in WORLD_TABLES:
                try:
                    db.execute(f"DELETE FROM {_q(table)} WHERE world_id = ?", (world_id,))
                except sqlite3.OperationalError as e:
                    if "no such table" not in str(e).lower():
                        raise
            db.execute("DELETE FROM worlds WHERE id = ?", (world_id,))
    except sqlite3.OperationalError as e:
        if "locked" in str(e).lower():
            raise RuntimeError("Base verrouillée : ferme le jeu puis réessaie") from e
        raise RuntimeError(f"Suppression impossible ({e})") from e
    finally:
        db.close()


def list_log_files() -> list:
    if not LOGS_DIR.is_dir():
        return []
    return sorted((p for p in LOGS_DIR.glob("*.log*") if p.is_file()),
                  key=lambda p: p.stat().st_mtime, reverse=True)


def tail_file(path: Path, max_bytes: int = 60000) -> str:
    try:
        with open(path, "rb") as f:
            f.seek(0, os.SEEK_END)
            size = f.tell()
            f.seek(max(0, size - max_bytes))
            return f.read().decode("utf-8", errors="replace")
    except OSError as e:
        return f"Lecture impossible : {e}"


def list_worlds() -> list:
    if not WORLDS_DB.is_file():
        return []
    db = _ro(WORLDS_DB)
    try:
        try:
            rows = db.execute("""
                SELECT w.id, w.name, w.seed, w.last_played_at, s.generation_version
                FROM worlds w LEFT JOIN world_state s ON s.world_id = w.id
                ORDER BY w.last_played_at DESC, w.id DESC""").fetchall()
        except sqlite3.OperationalError:
            rows = [r + (None,) for r in db.execute(
                "SELECT id, name, seed, last_played_at FROM worlds "
                "ORDER BY last_played_at DESC, id DESC").fetchall()]
    except sqlite3.OperationalError:
        return []  # base vide ou pas encore initialisée par le jeu
    finally:
        db.close()
    return [dict(id=r[0], name=r[1], seed=r[2], last_played=r[3], generation=r[4]) for r in rows]


def export_world(world_id: int, out_path: Path) -> None:
    src = _ro(WORLDS_DB)
    tmp = out_path.with_name(out_path.name + ".part")
    tmp.unlink(missing_ok=True)
    dst = sqlite3.connect(tmp)
    try:
        if src.execute("SELECT 1 FROM worlds WHERE id = ?", (world_id,)).fetchone() is None:
            raise RuntimeError("Monde introuvable")
        for table in ("worlds",) + WORLD_TABLES:
            row = src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                              (table,)).fetchone()
            if not row or not row[0]:
                continue
            dst.execute(row[0])
            cols = _columns(src, table)
            col_sql = ", ".join(_q(c) for c in cols)
            where = "id" if table == "worlds" else "world_id"
            data = src.execute(f"SELECT {col_sql} FROM {_q(table)} WHERE {where} = ?", (world_id,)).fetchall()
            if data:
                marks = ", ".join("?" * len(cols))
                dst.executemany(f"INSERT INTO {_q(table)} ({col_sql}) VALUES ({marks})", data)
        dst.execute("CREATE TABLE plaine_export (format INTEGER, exported_at TEXT)")
        dst.execute("INSERT INTO plaine_export VALUES (1, ?)", (datetime.now().isoformat(timespec="seconds"),))
        dst.commit()
    except BaseException:
        dst.close()
        src.close()
        tmp.unlink(missing_ok=True)
        raise
    dst.close()
    src.close()
    os.replace(tmp, out_path)


def import_world(file_path: Path) -> str:
    """Importe un monde exporté. Retourne son nom. Atomique : tout ou rien."""
    try:
        src = _ro(file_path)
        src_tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    except sqlite3.DatabaseError as e:
        raise RuntimeError("Fichier de monde invalide") from e
    dst = None
    try:
        if "worlds" not in src_tables or "plaine_export" not in src_tables:
            raise RuntimeError("Fichier de monde invalide")
        src_worlds_cols = _columns(src, "worlds")
        rows = src.execute("SELECT * FROM worlds").fetchall()
        if len(rows) != 1:
            raise RuntimeError("Le fichier doit contenir exactement un monde")
        world = dict(zip(src_worlds_cols, rows[0]))
        old_id = world["id"]

        SAVES_DIR.mkdir(parents=True, exist_ok=True)
        dst = sqlite3.connect(WORLDS_DB, timeout=5)
        dst.execute("PRAGMA foreign_keys = ON")
        for table in ("worlds",) + WORLD_TABLES:  # base vierge : on reprend le schéma du jeu
            row = src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
                              (table,)).fetchone()
            if row and row[0]:
                dst.execute(row[0].replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS", 1))
        dst.commit()

        with dst:  # transaction unique
            tcols = _columns(dst, "worlds")
            cols = [c for c in src_worlds_cols if c != "id" and c in tcols]
            cur = dst.execute(
                f"INSERT INTO worlds ({', '.join(_q(c) for c in cols)}) VALUES ({', '.join('?' * len(cols))})",
                [world[c] for c in cols])
            new_id = cur.lastrowid
            for table in WORLD_TABLES:
                if table not in src_tables:
                    continue
                scols, tcols = _columns(src, table), _columns(dst, table)
                common = [c for c in scols if c != "world_id" and c in tcols]
                if not common:
                    continue
                col_sql = ", ".join(_q(c) for c in common)
                data = src.execute(f"SELECT {col_sql} FROM {_q(table)} WHERE world_id = ?", (old_id,))
                dst.executemany(
                    f"INSERT INTO {_q(table)} (world_id, {col_sql}) VALUES (?, {', '.join('?' * len(common))})",
                    ((new_id, *r) for r in data))
        return str(world.get("name", ""))
    except sqlite3.OperationalError as e:
        if "locked" in str(e).lower():
            raise RuntimeError("Base verrouillée : ferme le jeu puis réessaie") from e
        raise RuntimeError(f"Import impossible ({e})") from e
    except sqlite3.DatabaseError as e:
        raise RuntimeError(f"Import impossible ({e})") from e
    finally:
        src.close()
        if dst is not None:
            dst.close()


# --------------------------------------------------------------------------- #
# Lancement du jeu
# --------------------------------------------------------------------------- #

def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class EmbeddedGameProcess:
    """Façade compatible avec Popen, mais le jeu tourne dans un thread du launcher."""
    def __init__(self, target, args, name="LaPlaineGame"):
        self._server = None
        self._returncode = None
        self._error = None
        self._ready = threading.Event()
        self._stop_requested = threading.Event()
        self._thread = threading.Thread(target=self._bootstrap, args=(target, args),
                                        name=name, daemon=True)
        self._thread.start()

    def _bootstrap(self, target, args):
        try:
            self._returncode = target(*args)
        except BaseException as exc:
            self._error = exc
            log.exception("Erreur pendant l'exécution de app.py")
            self._returncode = 1
        finally:
            self._ready.set()

    def poll(self):
        return None if self._thread.is_alive() else (self._returncode or 0)

    def wait(self, timeout=None):
        self._thread.join(timeout)
        if self._thread.is_alive():
            raise TimeoutError("Le jeu fonctionne toujours")
        return self._returncode or 0

    def terminate(self):
        self._stop_requested.set()
        server = self._server
        if server is not None and self._thread.is_alive():
            threading.Thread(target=server.shutdown, daemon=True).start()

    def kill(self):
        # Pas de terminaison forcée d'un thread Python : arrêt propre du serveur Flask.
        self.terminate()


def start_game(game_dir: Path, key: str, port: int) -> EmbeddedGameProcess:
    """Exécute app.py dans l'interpréteur embarqué du launcher, sans sous-processus."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOGS_DIR / f"game-{key}.log"

    def target():
        with open(log_path, "a", encoding="utf-8", buffering=1) as logf:
            logf.write(f"\\n--- {datetime.now().isoformat(timespec='seconds')} port {port} ---\\n")
            with contextlib.redirect_stdout(logf), contextlib.redirect_stderr(logf):
                return run_game([str(game_dir), str(port), str(WORLDS_DB), str(BASE)], process=holder)

    holder = EmbeddedGameProcess.__new__(EmbeddedGameProcess)
    holder._server = None
    holder._returncode = None
    holder._error = None
    holder._ready = threading.Event()
    holder._stop_requested = threading.Event()
    holder._thread = threading.Thread(target=lambda: _embedded_bootstrap(holder, target),
                                      name=f"LaPlaine-{key}", daemon=True)
    holder._thread.start()
    return holder


def _embedded_bootstrap(process, target):
    try:
        process._returncode = target()
    except BaseException as exc:
        process._error = exc
        log.exception("Erreur pendant le lancement du jeu")
        process._returncode = 1
    finally:
        process._ready.set()


def wait_ready(port: int, proc: EmbeddedGameProcess, timeout: float = 40.0,
               cancel: Optional[threading.Event] = None) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if cancel is not None and cancel.is_set():
            raise Cancelled()
        code = proc.poll()
        if code is not None:
            detail = f" : {proc._error}" if proc._error else ""
            raise RuntimeError(f"Le jeu s'est arrêté au démarrage (code {code}){detail}. Voir logs/")
        try:
            _open(f"http://127.0.0.1:{port}/", 1)
            return
        except urllib.error.HTTPError:
            return
        except (urllib.error.URLError, OSError):
            time.sleep(0.2)
    raise RuntimeError("Le jeu ne répond pas (délai dépassé). Voir logs/")


def stop_game(proc: Optional[EmbeddedGameProcess]) -> None:
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(5)
    except TimeoutError:
        log.warning("Le serveur ne s'est pas arrêté dans le délai demandé")


def run_game(argv: list, process=None, output=None) -> int:
    """Charge et exécute le app.py d'une version dans l'interpréteur du launcher.

    Le serveur Flask est piloté par Werkzeug afin que le launcher puisse
    l'arrêter proprement sans démarrer un second processus Python.
    """
    import importlib.util
    from werkzeug.serving import make_server

    game_dir, port, db_path, shared = Path(argv[0]).resolve(), int(argv[1]), argv[2], Path(argv[3]).resolve()
    previous_cwd = Path.cwd()
    real_connect = sqlite3.connect
    inserted_path = str(game_dir)
    module = None

    def connect(database, *a, **kw):
        if isinstance(database, (str, os.PathLike)) and os.path.basename(str(database)) == "worlds.db":
            database = db_path
        return real_connect(database, *a, **kw)

    try:
        os.chdir(game_dir)
        sys.path.insert(0, inserted_path)
        sqlite3.connect = connect

        spec = importlib.util.spec_from_file_location("plaine_game", game_dir / "app.py")
        if spec is None or spec.loader is None:
            raise RuntimeError("Impossible de charger app.py")
        module = importlib.util.module_from_spec(spec)
        sys.modules["plaine_game"] = module
        spec.loader.exec_module(module)

        for attr, sub in (("TEXTURE_PACK_DIRS", "texture_packs"),
                          ("MOD_DIRS", "mods"), ("SHADER_DIRS", "shaders")):
            dirs = getattr(module, attr, None)
            if isinstance(dirs, list) and dirs:
                dirs[0] = str(shared / sub)

        if not hasattr(module, "app"):
            raise RuntimeError("app.py ne contient pas d'application Flask nommée 'app'")

        # En mode embarqué, Flask peut déterminer un root_path incorrect selon
        # la manière dont app.py est chargé. On fixe donc les chemins du jeu
        # explicitement, sans dépendre du répertoire courant du launcher.
        flask_app = module.app
        flask_app.root_path = str(game_dir)
        templates_dir = game_dir / "templates"
        static_dir = game_dir / "static"

        if templates_dir.is_dir():
            from jinja2 import FileSystemLoader
            flask_app.template_folder = "templates"
            # Remplace le chargeur de l'environnement Jinja déjà associé à Flask.
            flask_app.jinja_env.loader = FileSystemLoader(str(templates_dir))
        else:
            raise RuntimeError(
                f"Dossier templates introuvable pour cette version : {templates_dir}"
            )

        if static_dir.is_dir():
            flask_app.static_folder = str(static_dir)

        server = make_server("127.0.0.1", port, flask_app, threaded=True)
        if process is not None:
            process._server = server
        try:
            if process is None or not process._stop_requested.is_set():
                server.serve_forever()
        finally:
            server.server_close()
        return 0
    finally:
        sqlite3.connect = real_connect
        try:
            sys.path.remove(inserted_path)
        except ValueError:
            pass
        sys.modules.pop("plaine_game", None)
        os.chdir(previous_cwd)
