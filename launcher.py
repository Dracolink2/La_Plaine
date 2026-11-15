"""La Plaine Launcher - interface PySide6.

Lancer :  python launcher.py
Dépendances : PySide6, Flask (pour le jeu)
"""
import sys

# Mode runner : lance le jeu d'une version, sans charger Qt.
if "--run-game" in sys.argv:
    import launcher_core as _core
    sys.exit(_core.run_game(sys.argv[sys.argv.index("--run-game") + 1:]))

import html
import re
import threading
import time
import webbrowser
from pathlib import Path

from PySide6.QtCore import Qt, QThread, QTimer, QUrl, Signal
from PySide6.QtGui import QBrush, QColor, QDesktopServices, QFontDatabase
from PySide6.QtWidgets import (
    QAbstractItemView, QApplication, QCheckBox, QComboBox, QFileDialog, QFormLayout, QFrame,
    QHBoxLayout, QHeaderView, QLabel, QLineEdit, QListWidget, QMainWindow, QMessageBox,
    QPlainTextEdit, QProgressBar, QPushButton, QSpinBox, QStackedWidget, QTableWidget,
    QTableWidgetItem, QVBoxLayout, QWidget,
)

import launcher_core as core

APP_VERSION = "1.1"

STATE_COLORS = {
    "Prêt": "#5cc27a",
    "Local": "#7fb2ff",
    "En ligne": "#c9a84f",
    "Corrompu": "#e06c6c",
    "Incomplet": "#e06c6c",
}

STYLE = """
* { font-family: "Segoe UI", "Inter", "Helvetica Neue", sans-serif; font-size: 13px; }
QMainWindow, QWidget#page { background: #14161a; }
QWidget { color: #d9dce1; }
QWidget#side { background: #101215; border-right: 1px solid #1c1f25; }
QLabel#brand { font-size: 15px; font-weight: 700; letter-spacing: 4px; color: #ffffff; padding: 22px 20px 6px 20px; }
QLabel#brandsub { color: #5d636d; padding: 0 20px 14px 20px; font-size: 11px; }
QListWidget#nav { background: transparent; border: none; outline: 0; }
QListWidget#nav::item { padding: 12px 20px; color: #8b919b; border-left: 3px solid transparent; }
QListWidget#nav::item:hover { color: #d9dce1; background: #15181c; }
QListWidget#nav::item:selected { color: #ffffff; background: #1a1d22; border-left: 3px solid #4f9d5d; }
QLabel#sidefoot { color: #4a4f58; padding: 12px 20px; font-size: 11px; }
QLabel#title { font-size: 22px; font-weight: 600; color: #ffffff; }
QLabel#muted { color: #8b919b; }
QLabel#section { color: #8b919b; font-size: 11px; font-weight: 600; letter-spacing: 1px; }
QLabel#hero { font-size: 38px; font-weight: 700; color: #ffffff; letter-spacing: 3px; }
QLabel#herover { font-size: 16px; color: #5cc27a; font-weight: 600; }
QFrame#card { background: #181b20; border: 1px solid #23272e; border-radius: 8px; }
QLabel#detail { color: #b4b9c2; padding: 2px; }
QTableWidget { background: #181b20; border: 1px solid #23272e; border-radius: 6px; gridline-color: #23272e;
               selection-background-color: #213a28; selection-color: #ffffff; outline: 0; }
QTableWidget::item { padding: 7px 10px; border-bottom: 1px solid #1d2025; }
QHeaderView::section { background: #1a1d22; color: #8b919b; border: none; border-bottom: 1px solid #23272e;
                       padding: 8px 10px; font-size: 11px; font-weight: 600; }
QPushButton { background: #22262d; border: 1px solid #2d323a; border-radius: 6px; padding: 8px 16px; }
QPushButton:hover:!disabled { background: #2a2f37; border-color: #3a404a; }
QPushButton:pressed { background: #1c1f25; }
QPushButton:disabled { color: #555b65; background: #1a1d22; border-color: #23272e; }
QPushButton#primary { background: #3d8a4c; border-color: #3d8a4c; color: #ffffff; font-weight: 600; }
QPushButton#primary:hover:!disabled { background: #479a58; border-color: #479a58; }
QPushButton#primary:disabled { background: #25382a; border-color: #25382a; color: #6b7a6f; }
QPushButton#big { background: #3d8a4c; border-color: #3d8a4c; color: #ffffff; font-size: 16px; font-weight: 700; padding: 16px 44px; border-radius: 8px; }
QPushButton#big:hover:!disabled { background: #479a58; }
QPushButton#big:disabled { background: #25382a; border-color: #25382a; color: #6b7a6f; }
QPushButton#danger:hover:!disabled { background: #5a2626; border-color: #7a3333; }
QLineEdit, QSpinBox, QComboBox { background: #181b20; border: 1px solid #2d323a; border-radius: 6px; padding: 7px 10px; }
QLineEdit:focus, QSpinBox:focus, QComboBox:focus { border-color: #4f9d5d; }
QComboBox QAbstractItemView { background: #181b20; selection-background-color: #213a28; border: 1px solid #2d323a; }
QPlainTextEdit { background: #101215; border: 1px solid #23272e; border-radius: 6px; color: #b4b9c2; padding: 6px; }
QCheckBox::indicator { width: 16px; height: 16px; border: 1px solid #3a404a; border-radius: 4px; background: #181b20; }
QCheckBox::indicator:checked { background: #4f9d5d; border-color: #4f9d5d; }
QProgressBar { background: #181b20; border: none; border-radius: 3px; max-height: 6px; min-height: 6px; text-align: center; color: transparent; }
QProgressBar::chunk { background: #4f9d5d; border-radius: 3px; }
QWidget#gamebar { background: #1b2a20; border-bottom: 1px solid #2c4a35; }
QScrollBar:vertical { background: transparent; width: 10px; }
QScrollBar::handle:vertical { background: #2d323a; border-radius: 5px; min-height: 30px; }
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical { height: 0; }
"""


class Worker(QThread):
    progress = Signal(int, str)
    done = Signal(object)
    failed = Signal(str)

    def __init__(self, fn, parent=None):
        super().__init__(parent)
        self.fn = fn
        self.cancel = threading.Event()

    def run(self):
        try:
            self.done.emit(self.fn(self.progress.emit, self.cancel))
        except core.Cancelled:
            self.failed.emit("Annulé")
        except Exception as e:  # noqa: BLE001 - tout est remonté à l'utilisateur
            core.log.exception("Tâche en échec")
            self.failed.emit(str(e) or e.__class__.__name__)


def make_button(text, name=None):
    b = QPushButton(text)
    if name:
        b.setObjectName(name)
    return b


def make_label(text="", name=None, wrap=False):
    lab = QLabel(text)
    if name:
        lab.setObjectName(name)
    lab.setWordWrap(wrap)
    return lab


def make_table(headers):
    t = QTableWidget(0, len(headers))
    t.setHorizontalHeaderLabels(headers)
    t.verticalHeader().setVisible(False)
    t.verticalHeader().setDefaultSectionSize(38)
    t.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
    t.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
    t.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
    t.setShowGrid(False)
    t.setFocusPolicy(Qt.FocusPolicy.NoFocus)
    t.horizontalHeader().setStretchLastSection(True)
    t.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
    return t


def set_cell(table, row, col, text, tooltip=None, color=None):
    item = QTableWidgetItem(text)
    if tooltip:
        item.setToolTip(tooltip)
    if color:
        item.setForeground(QBrush(QColor(color)))
    table.setItem(row, col, item)


def open_folder(path):
    path.mkdir(parents=True, exist_ok=True)
    QDesktopServices.openUrl(QUrl.fromLocalFile(str(path)))


def version_state(info):
    if info.cached:
        return "Prêt"
    if info.zip_ok:
        return "Local"
    if info.has_local:
        return "Corrompu" if "corrompue" in info.error else "Incomplet"
    return "En ligne"


def is_playable(info):
    return info.cached or info.zip_ok or bool(info.url)


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("La Plaine")
        self.resize(1020, 640)
        self.setMinimumSize(820, 520)
        self.setAcceptDrops(True)
        self.settings = core.load_settings()
        self.catalog = []
        self.remote_entries = core.load_remote_cache()
        self._fetch_t0 = 0.0
        self.remote_error = ""
        self.home_info = None
        self.worker = None          # tâche exclusive en cours
        self.fetcher = None         # récupération de versions.txt
        self._on_done = None
        self._worlds = []
        self._backups = []
        self.proc = None
        self.proc_key = ""
        self.proc_port = 0

        root = QWidget()
        lay = QHBoxLayout(root)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        side = QWidget()
        side.setObjectName("side")
        side.setFixedWidth(200)
        sv = QVBoxLayout(side)
        sv.setContentsMargins(0, 0, 0, 0)
        sv.setSpacing(0)
        sv.addWidget(make_label("LA PLAINE", "brand"))
        sv.addWidget(make_label("Launcher", "brandsub"))
        self.nav = QListWidget()
        self.nav.setObjectName("nav")
        self.nav.addItems(["Accueil", "Versions", "Mondes", "Journal", "Paramètres"])
        sv.addWidget(self.nav, 1)
        sv.addWidget(make_label(f"v{APP_VERSION}", "sidefoot"))
        lay.addWidget(side)

        self.stack = QStackedWidget()
        self.stack.addWidget(self._build_home())
        self.stack.addWidget(self._build_versions())
        self.stack.addWidget(self._build_worlds())
        self.stack.addWidget(self._build_logs())
        self.stack.addWidget(self._build_settings())

        right = QVBoxLayout()
        right.setContentsMargins(0, 0, 0, 0)
        right.setSpacing(0)
        right.addWidget(self._build_gamebar())
        right.addWidget(self.stack, 1)
        right.addWidget(self._build_statusbar())
        lay.addLayout(right, 1)
        self.setCentralWidget(root)

        self.nav.currentRowChanged.connect(self._on_nav)
        self.nav.setCurrentRow(0)

        self.timer = QTimer(self)
        self.timer.timeout.connect(self._poll_game)
        self.timer.start(1000)

        self.refresh_catalog()
        if self.settings["auto_fetch"] and self.settings["versions_url"]:
            self.fetch_remote()

    # ------------------------------------------------------------------ UI --
    def _page(self, title, subtitle=""):
        page = QWidget()
        page.setObjectName("page")
        v = QVBoxLayout(page)
        v.setContentsMargins(28, 24, 28, 12)
        v.setSpacing(14)
        v.addWidget(make_label(title, "title"))
        if subtitle:
            v.addWidget(make_label(subtitle, "muted"))
        return page, v

    def _build_gamebar(self):
        self.gamebar = QWidget()
        self.gamebar.setObjectName("gamebar")
        gb = QHBoxLayout(self.gamebar)
        gb.setContentsMargins(28, 8, 28, 8)
        self.game_label = QLabel()
        self.btn_open_game = make_button("Ouvrir")
        self.btn_stop_game = make_button("Arrêter", "danger")
        gb.addWidget(self.game_label, 1)
        gb.addWidget(self.btn_open_game)
        gb.addWidget(self.btn_stop_game)
        self.gamebar.hide()
        self.btn_open_game.clicked.connect(self.open_game)
        self.btn_stop_game.clicked.connect(self.stop_game)
        return self.gamebar

    def _build_home(self):
        page = QWidget()
        page.setObjectName("page")
        v = QVBoxLayout(page)
        v.setContentsMargins(28, 24, 28, 12)
        v.addStretch(2)
        hero = make_label("LA PLAINE", "hero")
        hero.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.home_version = make_label("", "herover")
        self.home_version.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.home_sub = make_label("", "muted")
        self.home_sub.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.btn_home_play = make_button("Jouer", "big")
        self.btn_home_play.setMinimumWidth(260)
        row = QHBoxLayout()
        row.addStretch(1)
        row.addWidget(self.btn_home_play)
        row.addStretch(1)
        self.home_stats = make_label("", "muted")
        self.home_stats.setAlignment(Qt.AlignmentFlag.AlignCenter)
        v.addWidget(hero)
        v.addSpacing(4)
        v.addWidget(self.home_version)
        v.addWidget(self.home_sub)
        v.addSpacing(22)
        v.addLayout(row)
        v.addSpacing(18)
        v.addWidget(self.home_stats)
        v.addStretch(3)
        self.btn_home_play.clicked.connect(self.play_home)
        return page

    def _build_versions(self):
        page, v = self._page("Versions", "Glisse un ZIP de version dans la fenêtre pour l'ajouter.")

        top = QHBoxLayout()
        self.in_filter = QLineEdit()
        self.in_filter.setPlaceholderText("Filtrer les versions")
        self.in_filter.setClearButtonEnabled(True)
        top.addWidget(self.in_filter, 1)
        self.btn_refresh = make_button("Actualiser")
        self.btn_folder = make_button("Dossier versions")
        top.addWidget(self.btn_refresh)
        top.addWidget(self.btn_folder)
        v.addLayout(top)

        body = QHBoxLayout()
        body.setSpacing(14)
        self.table = make_table(["Version", "Taille", "Local", "Cache", "En ligne", "État"])
        for col, w in enumerate((130, 90, 80, 80, 80)):
            self.table.setColumnWidth(col, w)
        body.addWidget(self.table, 1)

        card = QFrame()
        card.setObjectName("card")
        card.setFixedWidth(250)
        cv = QVBoxLayout(card)
        cv.setContentsMargins(16, 14, 16, 14)
        cv.addWidget(make_label("DÉTAILS", "section"))
        self.detail = make_label("", "detail", wrap=True)
        self.detail.setTextFormat(Qt.TextFormat.RichText)
        self.detail.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self.detail.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        cv.addWidget(self.detail, 1)
        body.addWidget(card)
        v.addLayout(body, 1)

        row = QHBoxLayout()
        self.btn_play = make_button("Jouer", "primary")
        self.btn_dl = make_button("Télécharger")
        self.btn_redl = make_button("Retélécharger")
        self.btn_del = make_button("Supprimer", "danger")
        for b in (self.btn_play, self.btn_dl, self.btn_redl, self.btn_del):
            row.addWidget(b)
        row.addStretch(1)
        self.btn_clear = make_button("Vider le cache")
        row.addWidget(self.btn_clear)
        v.addLayout(row)

        self.btn_play.clicked.connect(self.play)
        self.btn_dl.clicked.connect(lambda: self.download(False))
        self.btn_redl.clicked.connect(lambda: self.download(True))
        self.btn_del.clicked.connect(self.delete_version)
        self.btn_refresh.clicked.connect(self.on_refresh)
        self.btn_clear.clicked.connect(self.clear_cache)
        self.btn_folder.clicked.connect(lambda: open_folder(core.VERSIONS_DIR))
        self.in_filter.textChanged.connect(self.apply_filter)
        self.table.itemSelectionChanged.connect(self.on_selection)
        self.table.itemDoubleClicked.connect(lambda _i: self.play())
        return page

    def _build_worlds(self):
        page, v = self._page("Mondes", "Partagés entre toutes les versions. Sauvegarde automatique avant chaque lancement.")
        self.wtable = make_table(["Nom", "Seed", "Dernière partie", "Génération"])
        for col, w in enumerate((230, 150, 190)):
            self.wtable.setColumnWidth(col, w)
        v.addWidget(self.wtable, 3)

        row = QHBoxLayout()
        self.btn_export = make_button("Exporter")
        self.btn_import = make_button("Importer")
        self.btn_wdelete = make_button("Supprimer", "danger")
        for b in (self.btn_export, self.btn_import, self.btn_wdelete):
            row.addWidget(b)
        row.addStretch(1)
        self.btn_wrefresh = make_button("Actualiser")
        self.btn_wfolder = make_button("Dossier saves")
        row.addWidget(self.btn_wrefresh)
        row.addWidget(self.btn_wfolder)
        v.addLayout(row)

        v.addWidget(make_label("SAUVEGARDES", "section"))
        self.btable = make_table(["Date", "Taille"])
        self.btable.setColumnWidth(0, 230)
        v.addWidget(self.btable, 2)
        brow = QHBoxLayout()
        self.btn_backup = make_button("Sauvegarder maintenant")
        self.btn_restore = make_button("Restaurer")
        brow.addWidget(self.btn_backup)
        brow.addWidget(self.btn_restore)
        brow.addStretch(1)
        v.addLayout(brow)

        self.btn_export.clicked.connect(self.export_selected_world)
        self.btn_import.clicked.connect(self.import_world)
        self.btn_wdelete.clicked.connect(self.delete_selected_world)
        self.btn_backup.clicked.connect(self.backup_now)
        self.btn_restore.clicked.connect(self.restore_selected_backup)
        self.btn_wrefresh.clicked.connect(self.refresh_worlds)
        self.btn_wfolder.clicked.connect(lambda: open_folder(core.SAVES_DIR))
        self.wtable.itemSelectionChanged.connect(self.update_buttons)
        self.btable.itemSelectionChanged.connect(self.update_buttons)
        return page

    def _build_logs(self):
        page, v = self._page("Journal")
        row = QHBoxLayout()
        self.log_combo = QComboBox()
        self.btn_log_refresh = make_button("Actualiser")
        self.btn_log_folder = make_button("Dossier logs")
        row.addWidget(self.log_combo, 1)
        row.addWidget(self.btn_log_refresh)
        row.addWidget(self.btn_log_folder)
        v.addLayout(row)
        self.log_view = QPlainTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)
        self.log_view.setFont(QFontDatabase.systemFont(QFontDatabase.SystemFont.FixedFont))
        v.addWidget(self.log_view, 1)
        self.log_combo.currentIndexChanged.connect(self.show_log)
        self.btn_log_refresh.clicked.connect(self.refresh_logs)
        self.btn_log_folder.clicked.connect(lambda: open_folder(core.LOGS_DIR))
        return page

    def _build_settings(self):
        page, v = self._page("Paramètres")
        form = QFormLayout()
        form.setSpacing(14)
        form.setLabelAlignment(Qt.AlignmentFlag.AlignLeft)
        self.in_url = QLineEdit(self.settings["versions_url"])
        self.in_auto = QCheckBox("Charger la liste en ligne au démarrage")
        self.in_auto.setChecked(self.settings["auto_fetch"])
        self.in_browser = QCheckBox("Ouvrir le navigateur au lancement")
        self.in_browser.setChecked(self.settings["open_browser"])
        self.in_keep = QSpinBox()
        self.in_keep.setRange(1, 200)
        self.in_keep.setValue(self.settings["keep_backups"])
        form.addRow("versions.txt", self.in_url)
        form.addRow("", self.in_auto)
        form.addRow("", self.in_browser)
        form.addRow("Sauvegardes conservées", self.in_keep)
        v.addLayout(form)
        row = QHBoxLayout()
        btn_save = make_button("Enregistrer", "primary")
        btn_reset = make_button("Valeurs par défaut")
        row.addWidget(btn_save)
        row.addWidget(btn_reset)
        row.addStretch(1)
        v.addLayout(row)
        v.addStretch(1)
        btn_save.clicked.connect(self.save_settings)
        btn_reset.clicked.connect(self.reset_settings)
        return page

    def _build_statusbar(self):
        bar = QWidget()
        bar.setObjectName("page")
        h = QHBoxLayout(bar)
        h.setContentsMargins(28, 4, 28, 12)
        self.status = make_label("", "muted")
        self.progress = QProgressBar()
        self.progress.setFixedWidth(200)
        self.progress.setRange(0, 100)
        self.progress.hide()
        self.btn_cancel = make_button("Annuler")
        self.btn_cancel.hide()
        self.btn_cancel.clicked.connect(self.cancel_task)
        h.addWidget(self.status, 1)
        h.addWidget(self.progress)
        h.addWidget(self.btn_cancel)
        return bar

    # ------------------------------------------------------------- état ----
    def say(self, text):
        self.status.setText(text)

    def _on_nav(self, row):
        self.stack.setCurrentIndex(max(row, 0))
        if row == 0:
            self.update_home()
        elif row == 2:
            self.refresh_worlds()
        elif row == 3:
            self.refresh_logs()
        self.update_buttons()

    def selected_info(self):
        rows = self.table.selectionModel().selectedRows()
        if not rows or rows[0].row() >= len(self.catalog):
            return None
        return self.catalog[rows[0].row()]

    @property
    def game_running(self):
        return self.proc is not None and self.proc.poll() is None

    @property
    def busy(self):
        return self.worker is not None

    def on_selection(self):
        self.update_detail()
        self.update_buttons()

    def update_buttons(self):
        info = self.selected_info()
        free = not self.busy
        idle = free and not self.game_running
        self.btn_play.setEnabled(bool(info) and idle and is_playable(info))
        self.btn_dl.setEnabled(bool(info) and free and bool(info.url) and not info.has_local)
        self.btn_redl.setEnabled(bool(info) and free and bool(info.url) and info.has_local)
        self.btn_del.setEnabled(bool(info) and idle and (info.has_local or info.cached))
        self.btn_clear.setEnabled(idle)
        self.btn_refresh.setEnabled(free)
        self.btn_home_play.setEnabled(bool(self.home_info) and idle)
        has_world = bool(self.wtable.selectionModel().selectedRows())
        has_backup = bool(self.btable.selectionModel().selectedRows())
        self.btn_export.setEnabled(free and has_world)
        self.btn_wdelete.setEnabled(idle and has_world)
        self.btn_import.setEnabled(idle)
        self.btn_backup.setEnabled(free)
        self.btn_restore.setEnabled(idle and has_backup)

    def update_detail(self):
        info = self.selected_info()
        if not info:
            self.detail.setText("")
            return
        esc = html.escape
        state = version_state(info)
        lines = [
            f"<span style='font-size:18px;font-weight:600;color:#fff'>{esc(info.version)}</span>",
            f"<span style='color:{STATE_COLORS[state]}'>{state}</span>",
            "",
        ]
        if info.has_local:
            lines.append(f"<b>ZIP local</b><br>{esc(info.zip_path.name)}")
            if info.error:
                lines.append(f"<span style='color:#e06c6c'>{esc(info.error)}</span>")
        else:
            lines.append("<b>ZIP local</b><br>aucun")
        lines.append(f"<b>Cache</b><br>{'oui' if info.cached else 'non'}")
        lines.append(f"<b>En ligne</b><br>{'disponible' if info.url else 'non listée'}")
        if self.settings["last_version"] == info.version:
            lines.append("<b>Dernière version jouée</b>")
        self.detail.setText("<br><br>".join(lines))

    def apply_filter(self):
        text = self.in_filter.text().strip().lower()
        for r, info in enumerate(self.catalog):
            self.table.setRowHidden(r, bool(text) and text not in info.version.lower())

    def refresh_catalog(self):
        selected = self.selected_info()
        selected_key = selected.key if selected else None
        self.catalog = core.build_catalog(self.remote_entries)
        self.table.setRowCount(len(self.catalog))
        reselect = -1
        for r, i in enumerate(self.catalog):
            state = version_state(i)
            size = "—"
            if i.has_local:
                try:
                    size = core.format_size(i.zip_path.stat().st_size)
                except OSError:
                    pass
            local = ("Oui" if i.zip_ok else "Invalide") if i.has_local else "—"
            set_cell(self.table, r, 0, i.version)
            set_cell(self.table, r, 1, size)
            set_cell(self.table, r, 2, local, i.error or None, None if i.zip_ok or not i.has_local else "#e06c6c")
            set_cell(self.table, r, 3, "Oui" if i.cached else "—")
            set_cell(self.table, r, 4, "Oui" if i.url else "—")
            set_cell(self.table, r, 5, state, i.error or None, STATE_COLORS[state])
            if i.key == selected_key:
                reselect = r
        if reselect >= 0:
            self.table.selectRow(reselect)
        elif self.catalog and not self.table.selectionModel().selectedRows():
            self.table.selectRow(0)
        self.apply_filter()
        self.update_home()
        self.update_detail()
        self.update_buttons()

    def update_home(self):
        playable = [i for i in self.catalog if is_playable(i)]
        last = self.settings["last_version"]
        info = next((i for i in playable if i.version == last), None)
        label = "Dernière version jouée"
        if info is None and playable:
            info, label = playable[0], "Version la plus récente"
        self.home_info = info
        if info:
            self.home_version.setText(info.version)
            self.home_sub.setText(label)
            self.btn_home_play.setText(f"Jouer {info.version}")
        else:
            self.home_version.setText("Aucune version")
            self.home_sub.setText("Ajoute un ZIP dans versions/ ou charge la liste en ligne")
            self.btn_home_play.setText("Jouer")
        n_local = sum(1 for i in self.catalog if i.zip_ok)
        n_online = sum(1 for i in self.catalog if i.url)
        try:
            n_worlds = len(core.list_worlds())
        except Exception:  # noqa: BLE001
            n_worlds = 0
        self.home_stats.setText(f"{n_local} locale(s)  ·  {n_online} en ligne  ·  {n_worlds} monde(s)")
        self.update_buttons()

    def refresh_worlds(self):
        try:
            worlds = core.list_worlds()
        except Exception as e:  # noqa: BLE001
            core.log.exception("Lecture des mondes")
            worlds = []
            self.say(f"Lecture des mondes impossible : {e}")
        self._worlds = worlds
        self.wtable.setRowCount(len(worlds))
        for r, w in enumerate(worlds):
            set_cell(self.wtable, r, 0, str(w["name"]))
            set_cell(self.wtable, r, 1, str(w["seed"]))
            set_cell(self.wtable, r, 2, str(w["last_played"]).replace("T", " ")[:19])
            set_cell(self.wtable, r, 3, "—" if w["generation"] is None else str(w["generation"]))
        self._backups = core.list_backups()
        self.btable.setRowCount(len(self._backups))
        for r, b in enumerate(self._backups):
            m = re.match(r"worlds-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})", b.name)
            date = f"{m[1]}-{m[2]}-{m[3]} {m[4]}:{m[5]}:{m[6]}" if m else b.name
            try:
                size = core.format_size(b.stat().st_size)
            except OSError:
                size = "—"
            set_cell(self.btable, r, 0, date, b.name)
            set_cell(self.btable, r, 1, size)
        self.update_buttons()

    def refresh_logs(self):
        files = core.list_log_files()
        current = self.log_combo.currentData()
        self.log_combo.blockSignals(True)
        self.log_combo.clear()
        for f in files:
            self.log_combo.addItem(f.name, str(f))
        idx = self.log_combo.findData(current) if current else -1
        self.log_combo.setCurrentIndex(idx if idx >= 0 else (0 if files else -1))
        self.log_combo.blockSignals(False)
        self.show_log()

    def show_log(self):
        path = self.log_combo.currentData()
        if not path:
            self.log_view.setPlainText("Aucun journal")
            return
        self.log_view.setPlainText(core.tail_file(Path(path)))
        bar = self.log_view.verticalScrollBar()
        bar.setValue(bar.maximum())

    # ------------------------------------------------- glisser-déposer ----
    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def dropEvent(self, event):
        paths = [Path(u.toLocalFile()) for u in event.mimeData().urls() if u.isLocalFile()]
        added, errors = 0, []
        for p in paths:
            try:
                core.install_zip(p)
                added += 1
            except Exception as e:  # noqa: BLE001
                core.log.warning("Ajout refusé : %s", e)
                errors.append(str(e))
        event.acceptProposedAction()
        if added:
            self.say(f"{added} version(s) ajoutée(s)")
            self.refresh_catalog()
        if errors:
            QMessageBox.warning(self, "La Plaine", "\n".join(errors))

    # ------------------------------------------------------------ tâches ---
    def run_task(self, fn, on_done, label):
        if self.busy:
            return
        w = Worker(fn, self)
        self.worker = w
        self._on_done = on_done
        self.progress.setRange(0, 100)
        self.progress.setValue(0)
        self.progress.show()
        self.btn_cancel.show()
        self.say(label)
        w.progress.connect(self._on_progress)
        w.done.connect(self._task_done)
        w.failed.connect(self._task_failed)
        w.finished.connect(w.deleteLater)
        self.update_buttons()
        w.start()

    def _on_progress(self, pct, msg):
        self.progress.setValue(pct)
        self.say(msg)

    def _task_done(self, result):
        self._task_end(self._on_done, result, None)

    def _task_failed(self, msg):
        self._task_end(None, None, msg)

    def _task_end(self, callback, result, error):
        self.worker = None
        self.progress.hide()
        self.btn_cancel.hide()
        if error is not None:
            self.say(error)
            if error != "Annulé":
                QMessageBox.warning(self, "La Plaine", error)
        elif callback:
            callback(result)
        self.refresh_catalog()

    def cancel_task(self):
        if self.worker:
            self.worker.cancel.set()
            self.say("Annulation…")

    # --------------------------------------------------------- versions ----
    def on_refresh(self):
        self.refresh_catalog()
        if self.settings["versions_url"]:
            self.fetch_remote()

    def fetch_remote(self):
        if self.fetcher is not None:
            return
        url = self.settings["versions_url"]
        f = Worker(lambda _p, _c: core.fetch_remote_entries(url), self)
        self.fetcher = f
        f.done.connect(self._remote_ok)
        f.failed.connect(self._remote_fail)
        f.finished.connect(f.deleteLater)
        self.say("Chargement de la liste en ligne…")
        self._fetch_t0 = time.monotonic()
        if not self.busy:
            self.progress.setRange(0, 0)  # indéterminé
            self.progress.show()
        f.start()

    def _fetch_ui_end(self):
        self.fetcher = None
        if not self.busy:
            self.progress.hide()
            self.progress.setRange(0, 100)

    def _remote_ok(self, entries):
        self._fetch_ui_end()
        self.remote_entries = entries
        self.remote_error = ""
        self.say(f"{len(entries)} version(s) en ligne ({time.monotonic() - self._fetch_t0:.1f} s)")
        self.refresh_catalog()

    def _remote_fail(self, msg):
        self._fetch_ui_end()
        self.remote_error = msg
        self.say(f"Liste en ligne indisponible : {msg}")

    def play_home(self):
        if not self.home_info:
            return
        for r, i in enumerate(self.catalog):
            if i.key == self.home_info.key:
                self.table.selectRow(r)
                break
        self.play()

    def play(self):
        info = self.selected_info()
        if not info or self.busy or self.game_running:
            return
        keep = self.settings["keep_backups"]
        open_browser = self.settings["open_browser"]

        def job(progress, cancel):
            game_dir = core.prepare_version(info, progress, cancel)
            progress(0, "Sauvegarde des mondes")
            try:
                core.backup_db(keep)
            except Exception:  # noqa: BLE001
                core.log.exception("Sauvegarde automatique échouée")
                raise RuntimeError("Sauvegarde automatique des mondes échouée, lancement annulé. Voir le journal.")
            progress(0, "Démarrage")
            port = core.free_port()
            proc = core.start_game(game_dir, info.key, port)
            try:
                core.wait_ready(port, proc, cancel=cancel)
            except BaseException:
                core.stop_game(proc)
                raise
            return proc, port

        def done(res):
            self.proc, self.proc_port = res
            self.proc_key = info.version
            self.settings["last_version"] = info.version
            try:
                core.save_settings(self.settings)
            except OSError:
                core.log.exception("Enregistrement des paramètres")
            if open_browser:
                webbrowser.open(f"http://127.0.0.1:{self.proc_port}/")
            self._poll_game()

        self.run_task(job, done, f"Préparation {info.version}")

    def download(self, redo):
        info = self.selected_info()
        if not info or self.busy or not info.url:
            return
        if redo and QMessageBox.question(
                self, "La Plaine", f"Retélécharger {info.version} ?\nLe ZIP local et le cache seront remplacés."
        ) != QMessageBox.StandardButton.Yes:
            return
        self.run_task(lambda p, c: core.download_local(info, p, c),
                      lambda _r: self.say(f"{info.version} téléchargée"),
                      f"Téléchargement {info.version}")

    def delete_version(self):
        info = self.selected_info()
        if not info or self.busy or self.game_running:
            return
        if QMessageBox.question(
                self, "La Plaine", f"Supprimer la copie locale de {info.version} ?\nLes mondes ne sont pas touchés."
        ) != QMessageBox.StandardButton.Yes:
            return
        try:
            core.delete_local(info)
            self.say(f"{info.version} supprimée")
        except Exception as e:  # noqa: BLE001
            core.log.exception("Suppression")
            QMessageBox.warning(self, "La Plaine", str(e))
        self.refresh_catalog()

    def clear_cache(self):
        if self.busy or self.game_running:
            return
        try:
            core.clear_cache()
            self.say("Cache vidé")
        except Exception as e:  # noqa: BLE001
            core.log.exception("Vidage du cache")
            QMessageBox.warning(self, "La Plaine", str(e))
        self.refresh_catalog()

    # ----------------------------------------------------------- jeu -------
    def _poll_game(self):
        was_shown = not self.gamebar.isHidden()
        if self.game_running:
            self.game_label.setText(f"En cours : {self.proc_key}   ·   http://127.0.0.1:{self.proc_port}")
            self.gamebar.show()
        else:
            if self.proc is not None:
                code = self.proc.poll()
                self.say(f"Jeu arrêté (code {code})" if code else "Jeu arrêté")
            self.proc = None
            self.gamebar.hide()
        if was_shown != (not self.gamebar.isHidden()):
            self.update_buttons()

    def open_game(self):
        if self.game_running:
            webbrowser.open(f"http://127.0.0.1:{self.proc_port}/")

    def stop_game(self):
        core.stop_game(self.proc)
        self._poll_game()

    # ----------------------------------------------------------- mondes ----
    def selected_world(self):
        rows = self.wtable.selectionModel().selectedRows()
        if not rows or rows[0].row() >= len(self._worlds):
            return None
        return self._worlds[rows[0].row()]

    def export_selected_world(self):
        w = self.selected_world()
        if not w or self.busy:
            return
        safe = re.sub(r'[\\/:*?"<>|]+', "_", str(w["name"])).strip() or "monde"
        core.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        path, _ = QFileDialog.getSaveFileName(
            self, "Exporter le monde", str(core.EXPORTS_DIR / f"{safe}.plaine"), "Monde La Plaine (*.plaine)")
        if not path:
            return
        if not path.lower().endswith(".plaine"):
            path += ".plaine"
        try:
            core.export_world(w["id"], Path(path))
            self.say(f"Monde exporté : {Path(path).name}")
        except Exception as e:  # noqa: BLE001
            core.log.exception("Export")
            QMessageBox.warning(self, "La Plaine", f"Export impossible : {e}")

    def import_world(self):
        if self.busy or self.game_running:
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "Importer un monde", str(core.EXPORTS_DIR), "Monde La Plaine (*.plaine)")
        if not path:
            return
        try:
            core.backup_db(self.settings["keep_backups"])
            name = core.import_world(Path(path))
            self.say(f"Monde importé : {name}")
        except Exception as e:  # noqa: BLE001
            core.log.exception("Import")
            QMessageBox.warning(self, "La Plaine", str(e))
        self.refresh_worlds()

    def delete_selected_world(self):
        w = self.selected_world()
        if not w or self.busy or self.game_running:
            return
        if QMessageBox.question(
                self, "La Plaine",
                f"Supprimer le monde « {w['name']} » ?\nUne sauvegarde est faite juste avant."
        ) != QMessageBox.StandardButton.Yes:
            return
        try:
            core.backup_db(self.settings["keep_backups"])
            core.delete_world(w["id"])
            self.say(f"Monde supprimé : {w['name']}")
        except Exception as e:  # noqa: BLE001
            core.log.exception("Suppression du monde")
            QMessageBox.warning(self, "La Plaine", str(e))
        self.refresh_worlds()
        self.update_home()

    def backup_now(self):
        try:
            out = core.backup_db(self.settings["keep_backups"])
            self.say(f"Sauvegarde : {out.name}" if out else "Aucun monde à sauvegarder")
        except Exception as e:  # noqa: BLE001
            core.log.exception("Sauvegarde")
            QMessageBox.warning(self, "La Plaine", f"Sauvegarde impossible : {e}")
        self.refresh_worlds()

    def restore_selected_backup(self):
        rows = self.btable.selectionModel().selectedRows()
        if not rows or rows[0].row() >= len(self._backups) or self.busy or self.game_running:
            return
        path = self._backups[rows[0].row()]
        if QMessageBox.question(
                self, "La Plaine",
                "Restaurer cette sauvegarde ?\nLes mondes actuels sont remplacés (une sauvegarde est faite juste avant)."
        ) != QMessageBox.StandardButton.Yes:
            return
        try:
            core.restore_backup(path, self.settings["keep_backups"])
            self.say("Sauvegarde restaurée")
        except Exception as e:  # noqa: BLE001
            core.log.exception("Restauration")
            QMessageBox.warning(self, "La Plaine", str(e))
        self.refresh_worlds()
        self.update_home()

    # -------------------------------------------------------- paramètres ---
    def _store_settings(self, settings):
        self.settings = settings
        try:
            core.save_settings(self.settings)
            self.say("Paramètres enregistrés")
        except OSError as e:
            QMessageBox.warning(self, "La Plaine", f"Enregistrement impossible : {e}")
            return False
        return True

    def save_settings(self):
        new = dict(self.settings)
        new.update(
            versions_url=self.in_url.text().strip(),
            auto_fetch=self.in_auto.isChecked(),
            open_browser=self.in_browser.isChecked(),
            keep_backups=self.in_keep.value(),
        )
        if self._store_settings(new):
            self.fetch_remote()

    def reset_settings(self):
        d = core.DEFAULT_SETTINGS
        self.in_url.setText(d["versions_url"])
        self.in_auto.setChecked(d["auto_fetch"])
        self.in_browser.setChecked(d["open_browser"])
        self.in_keep.setValue(d["keep_backups"])

    # ----------------------------------------------------------- fermeture -
    def closeEvent(self, event):
        for w in (self.worker, self.fetcher):
            if w is not None:
                w.cancel.set()
                w.wait(3000)
        core.stop_game(self.proc)
        event.accept()


def main():
    core.ensure_dirs()
    core.setup_logging()
    app = QApplication(sys.argv)
    app.setStyleSheet(STYLE)
    win = MainWindow()
    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
