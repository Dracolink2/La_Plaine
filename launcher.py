"""La Plaine Launcher - interface Tkinter (bibliothèque incluse avec Python)."""
import sys

# Runner du jeu : ne charge pas l'interface graphique.
if "--run-game" in sys.argv:
    import launcher_core as _core
    sys.exit(_core.run_game(sys.argv[sys.argv.index("--run-game") + 1:]))

import os
import queue
import re
import threading
import time
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

import launcher_core as core

APP_VERSION = "1.2"
BG = "#10141b"
PANEL = "#191f29"
PANEL_DARK = "#0c1016"
FG = "#e6eaf0"
MUTED = "#929dad"
GREEN = "#35c477"
VERSION_GROUPS = ("base", "tests", "named_tests")
VERSION_GROUP_LABELS = {
    "base": "Version principale",
    "tests": "Tests 1 à 5",
    "named_tests": "Versions testN",
}
TEST_SUFFIX = re.compile(r"^(.+?)[-_. ]?test(\d*)$", re.IGNORECASE)
STATE_COLORS = {
    "Prêt": "#5cc27a", "Local": "#7fb2ff", "En ligne": "#c9a84f",
    "Corrompu": "#e06c6c", "Incomplet": "#e06c6c",
}


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


def version_group(version):
    """Classe les versions de test automatiquement selon leur nom."""
    value = str(version).strip()
    if re.fullmatch(r"test\d+", value, re.IGNORECASE):
        return "named_tests"
    match = TEST_SUFFIX.fullmatch(value)
    if match and re.search(r"\d", match.group(1)):
        return "tests"
    return "base"


def open_folder(path):
    path.mkdir(parents=True, exist_ok=True)
    try:
        os.startfile(str(path))
    except AttributeError:
        webbrowser.open(path.resolve().as_uri())


class MainWindow(tk.Tk):
    """Interface légère. Les tâches réseau et fichiers tournent en arrière-plan."""

    def __init__(self):
        super().__init__()
        self.title("La Plaine")
        self.geometry("1020x660")
        self.minsize(820, 540)
        self.configure(bg=BG)
        self.settings = core.load_settings()
        self.catalog = []
        self.visible_catalog = []
        self.remote_entries = core.load_remote_cache()
        self.remote_error = ""
        self._fetch_t0 = 0.0
        self.home_info = None
        self.worker = None
        self.fetcher = None
        self._on_done = None
        self._worlds = []
        self._backups = []
        self.proc = None
        self.proc_key = ""
        self.proc_port = 0
        self.events = queue.Queue()
        self._build_styles()
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self.close)
        self.after(60, self._drain_events)
        self.after(1000, self._poll_game)
        self.refresh_catalog()
        if self.settings["auto_fetch"] and self.settings["versions_url"]:
            self.fetch_remote()

    @property
    def game_running(self):
        return self.proc is not None and self.proc.poll() is None

    @property
    def busy(self):
        return self.worker is not None

    def _build_styles(self):
        style = ttk.Style(self)
        style.theme_use("clam")
        style.configure("TFrame", background=BG)
        style.configure("Panel.TFrame", background=PANEL)
        style.configure("Side.TFrame", background=PANEL_DARK)
        style.configure("TLabel", background=BG, foreground=FG, font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=BG, foreground=MUTED)
        style.configure("Title.TLabel", background=BG, foreground="#ffffff", font=("Segoe UI", 22, "bold"))
        style.configure("Hero.TLabel", background=BG, foreground="#ffffff", font=("Segoe UI", 32, "bold"))
        style.configure("Card.TFrame", background=PANEL, relief="flat")
        style.configure("CardTitle.TLabel", background=PANEL, foreground="#ffffff", font=("Segoe UI", 10, "bold"))
        style.configure("CardValue.TLabel", background=PANEL, foreground="#ffffff", font=("Segoe UI", 18, "bold"))
        style.configure("Accent.TLabel", background=BG, foreground=GREEN, font=("Segoe UI", 9, "bold"))
        style.configure("Brand.TLabel", background=PANEL_DARK, foreground="#ffffff", font=("Segoe UI", 14, "bold"))
        style.configure("Section.TLabel", background=BG, foreground=MUTED, font=("Segoe UI", 9, "bold"))
        style.configure("TButton", background="#232a35", foreground=FG, padding=(12, 8), borderwidth=0)
        style.map("TButton", background=[("active", "#303a49"), ("disabled", PANEL)])
        style.configure("Primary.TButton", background="#238b55", foreground="white", padding=(14, 9), font=("Segoe UI", 10, "bold"))
        style.map("Primary.TButton", background=[("active", "#2ba566"), ("disabled", "#25382a")])
        style.configure("Nav.TButton", background=PANEL_DARK, foreground=MUTED, anchor="w", padding=(18, 12), borderwidth=0)
        style.map("Nav.TButton", background=[("active", "#1b2430")], foreground=[("active", "white")])
        style.configure("SelectedNav.TButton", background="#1b2c25", foreground="#70e0a2", anchor="w",
                        padding=(18, 12), borderwidth=0, font=("Segoe UI", 10, "bold"))
        style.configure("Group.TButton", background=PANEL, foreground=MUTED, padding=(13, 8), borderwidth=0)
        style.map("Group.TButton", background=[("active", "#222c38")], foreground=[("active", "white")])
        style.configure("GroupSelected.TButton", background="#1b3a2b", foreground="#8bf0b6",
                        padding=(13, 8), borderwidth=0, font=("Segoe UI", 9, "bold"))
        style.configure("Treeview", background=PANEL, fieldbackground=PANEL, foreground=FG,
                        rowheight=34, borderwidth=0, font=("Segoe UI", 10))
        style.configure("Treeview.Heading", background="#202734", foreground=MUTED,
                        padding=10, font=("Segoe UI", 9, "bold"), relief="flat")
        style.map("Treeview", background=[("selected", "#1e4833")], foreground=[("selected", "white")])
        style.configure("TEntry", fieldbackground=PANEL, foreground=FG, padding=9)
        style.configure("TCombobox", fieldbackground=PANEL, foreground=FG, padding=6)
        style.configure("Horizontal.TProgressbar", troughcolor=PANEL, background=GREEN)
        style.configure("TCheckbutton", background=BG, foreground=FG)

    def _build_ui(self):
        outer = ttk.Frame(self)
        outer.pack(fill="both", expand=True)
        side = ttk.Frame(outer, style="Side.TFrame", width=200)
        side.pack(side="left", fill="y")
        side.pack_propagate(False)
        ttk.Label(side, text="LA PLAINE", style="Brand.TLabel", padding=(18, 22, 8, 2)).pack(anchor="w")
        ttk.Label(side, text="Launcher", background=PANEL_DARK, foreground="#5d636d",
                  padding=(18, 0, 8, 20)).pack(anchor="w")
        self.nav_buttons = []
        self.pages_host = ttk.Frame(outer)
        self.pages_host.pack(side="left", fill="both", expand=True)
        for index, label in enumerate(("Accueil", "Versions", "Mondes", "Journal", "Paramètres")):
            b = ttk.Button(side, text=label, style="Nav.TButton", command=lambda i=index: self._on_nav(i))
            b.pack(fill="x")
            self.nav_buttons.append(b)
        ttk.Label(side, text=f"v{APP_VERSION}", background=PANEL_DARK,
                  foreground="#4a4f58", padding=(18, 12)).pack(side="bottom", anchor="w")

        self.gamebar = ttk.Frame(self.pages_host, padding=(20, 8))
        self.game_label = ttk.Label(self.gamebar, text="")
        self.game_label.pack(side="left", expand=True, anchor="w")
        ttk.Button(self.gamebar, text="Ouvrir", command=self.open_game).pack(side="right", padx=4)
        ttk.Button(self.gamebar, text="Arrêter", command=self.stop_game).pack(side="right", padx=4)
        self.gamebar.pack_forget()

        self.pages = [ttk.Frame(self.pages_host, padding=(28, 24, 28, 12)) for _ in range(5)]
        for p in self.pages:
            p.place(relx=0, rely=0, relwidth=1, relheight=1)
        self._build_home(self.pages[0])
        self._build_versions(self.pages[1])
        self._build_worlds(self.pages[2])
        self._build_logs(self.pages[3])
        self._build_settings(self.pages[4])
        self._on_nav(0)

        statusbar = ttk.Frame(self.pages_host, padding=(28, 4, 28, 10))
        statusbar.place(relx=0, rely=1, anchor="sw", relwidth=1)
        self.status = ttk.Label(statusbar, text="", style="Muted.TLabel")
        self.status.pack(side="left", fill="x", expand=True)
        self.progress = ttk.Progressbar(statusbar, mode="determinate", length=180, maximum=100)
        self.btn_cancel = ttk.Button(statusbar, text="Annuler", command=self.cancel_task)
        self.btn_cancel.pack_forget()
        self.progress.pack_forget()

    def _page_heading(self, parent, title, subtitle=""):
        ttk.Label(parent, text=title, style="Title.TLabel").pack(anchor="w", pady=(0, 4))
        if subtitle:
            ttk.Label(parent, text=subtitle, style="Muted.TLabel").pack(anchor="w", pady=(0, 14))

    def _build_home(self, page):
        content = ttk.Frame(page)
        content.pack(fill="both", expand=True, pady=70)
        ttk.Label(content, text="LA PLAINE", style="Hero.TLabel").pack(pady=(20, 8))
        self.home_version = ttk.Label(content, text="", foreground="#5cc27a", background=BG,
                                      font=("Segoe UI", 15, "bold"))
        self.home_version.pack(pady=4)
        self.home_sub = ttk.Label(content, text="", style="Muted.TLabel")
        self.home_sub.pack(pady=4)
        self.btn_home_play = ttk.Button(content, text="Jouer", style="Primary.TButton", command=self.play_home)
        self.btn_home_play.pack(pady=20, ipadx=45, ipady=8)
        self.home_stats = ttk.Label(content, text="", style="Muted.TLabel")
        self.home_stats.pack(pady=8)

    def _build_versions(self, page):
        self._page_heading(page, "Versions", "La version principale et les builds de test sont classés automatiquement.")
        self.group_bar = ttk.Frame(page)
        self.group_bar.pack(fill="x", pady=(0, 12))
        self.group_buttons = {}
        self.version_group_var = "base"
        for group in VERSION_GROUPS:
            button = ttk.Button(self.group_bar, text=VERSION_GROUP_LABELS[group], style="Group.TButton",
                                command=lambda g=group: self.set_version_group(g))
            button.pack(side="left", padx=(0, 8))
            self.group_buttons[group] = button

        current = ttk.Frame(page, style="Card.TFrame", padding=(16, 11))
        current.pack(fill="x", pady=(0, 12))
        current_text = ttk.Frame(current, style="Card.TFrame")
        current_text.pack(side="left", fill="x", expand=True)
        ttk.Label(current_text, text="VERSION PRINCIPALE", style="Accent.TLabel").pack(anchor="w")
        self.current_version_label = ttk.Label(current_text, text="Chargement…", style="CardValue.TLabel")
        self.current_version_label.pack(anchor="w", pady=(3, 0))
        self.current_version_sub = ttk.Label(current_text, text="Dernière version stable disponible", style="CardTitle.TLabel")
        self.current_version_sub.pack(anchor="w", pady=(1, 0))
        self.btn_current_play = ttk.Button(current, text="Jouer", style="Primary.TButton", command=self.play_current)
        self.btn_current_play.pack(side="right", padx=(12, 0))

        top = ttk.Frame(page)
        top.pack(fill="x", pady=(0, 12))
        self.filter_var = tk.StringVar()
        self.filter_var.trace_add("write", lambda *_: self.apply_filter())
        ttk.Entry(top, textvariable=self.filter_var).pack(side="left", fill="x", expand=True, padx=(0, 8))
        ttk.Button(top, text="Importer ZIP", command=self.add_zip).pack(side="left", padx=3)
        ttk.Button(top, text="Actualiser", command=self.on_refresh).pack(side="left", padx=3)
        ttk.Button(top, text="Dossier", command=lambda: open_folder(core.VERSIONS_DIR)).pack(side="left", padx=3)

        body = ttk.Frame(page)
        body.pack(fill="both", expand=True)
        self.table = self._tree(body, ("version", "size", "local", "cache", "online", "state"),
                                ("Version", "Taille", "Local", "Cache", "En ligne", "État"),
                                (180, 85, 75, 75, 85, 100))
        self.table.container.pack(side="left", fill="both", expand=True)
        self.table.bind("<<TreeviewSelect>>", lambda _e: self.on_selection())
        self.table.bind("<Double-1>", lambda _e: self.play())
        detail_frame = ttk.Frame(body, style="Panel.TFrame", padding=14, width=235)
        detail_frame.pack(side="right", fill="y", padx=(12, 0))
        detail_frame.pack_propagate(False)
        ttk.Label(detail_frame, text="DÉTAILS", background=PANEL, foreground=MUTED).pack(anchor="w")
        self.detail = tk.Text(detail_frame, wrap="word", bg=PANEL, fg=FG, relief="flat",
                              state="disabled", font=("Segoe UI", 10), padx=3, pady=10)
        self.detail.pack(fill="both", expand=True)

        row = ttk.Frame(page)
        row.pack(fill="x", pady=(12, 0))
        self.btn_play = ttk.Button(row, text="Jouer", style="Primary.TButton", command=self.play)
        self.btn_dl = ttk.Button(row, text="Télécharger", command=lambda: self.download(False))
        self.btn_redl = ttk.Button(row, text="Retélécharger", command=lambda: self.download(True))
        self.btn_del = ttk.Button(row, text="Supprimer", command=self.delete_version)
        for b in (self.btn_play, self.btn_dl, self.btn_redl, self.btn_del):
            b.pack(side="left", padx=(0, 6))
        self.btn_clear = ttk.Button(row, text="Vider le cache", command=self.clear_cache)
        self.btn_clear.pack(side="right")

    def _build_worlds(self, page):
        self._page_heading(page, "Mondes", "Partagés entre les versions. Une sauvegarde est faite avant les actions sensibles.")
        self.wtable = self._tree(page, ("name", "seed", "played", "generation"),
                                 ("Nom", "Seed", "Dernière partie", "Génération"), (240, 150, 190, 110))
        self.wtable.container.pack(fill="both", expand=True)
        self.wtable.bind("<<TreeviewSelect>>", lambda _e: self.update_buttons())
        row = ttk.Frame(page)
        row.pack(fill="x", pady=8)
        self.btn_export = ttk.Button(row, text="Exporter", command=self.export_selected_world)
        self.btn_import = ttk.Button(row, text="Importer", command=self.import_world)
        self.btn_wdelete = ttk.Button(row, text="Supprimer", command=self.delete_selected_world)
        for b in (self.btn_export, self.btn_import, self.btn_wdelete):
            b.pack(side="left", padx=(0, 6))
        ttk.Button(row, text="Actualiser", command=self.refresh_worlds).pack(side="right", padx=3)
        ttk.Button(row, text="Dossier saves", command=lambda: open_folder(core.SAVES_DIR)).pack(side="right", padx=3)
        ttk.Label(page, text="SAUVEGARDES", style="Section.TLabel").pack(anchor="w", pady=(4, 6))
        self.btable = self._tree(page, ("date", "size"), ("Date", "Taille"), (230, 100))
        self.btable.container.pack(fill="both", expand=True)
        self.btable.bind("<<TreeviewSelect>>", lambda _e: self.update_buttons())
        row = ttk.Frame(page)
        row.pack(fill="x", pady=(8, 0))
        self.btn_backup = ttk.Button(row, text="Sauvegarder maintenant", command=self.backup_now)
        self.btn_backup.pack(side="left", padx=(0, 6))
        self.btn_restore = ttk.Button(row, text="Restaurer", command=self.restore_selected_backup)
        self.btn_restore.pack(side="left")

    def _build_logs(self, page):
        self._page_heading(page, "Journal")
        row = ttk.Frame(page)
        row.pack(fill="x", pady=(0, 10))
        self.log_var = tk.StringVar()
        self.log_combo = ttk.Combobox(row, textvariable=self.log_var, state="readonly")
        self.log_combo.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self.log_combo.bind("<<ComboboxSelected>>", lambda _e: self.show_log())
        ttk.Button(row, text="Actualiser", command=self.refresh_logs).pack(side="left", padx=3)
        ttk.Button(row, text="Dossier logs", command=lambda: open_folder(core.LOGS_DIR)).pack(side="left", padx=3)
        self.log_view = tk.Text(page, wrap="none", bg=PANEL_DARK, fg="#b4b9c2", relief="flat",
                                font=("Consolas", 9), state="disabled")
        self.log_view.pack(fill="both", expand=True)

    def _build_settings(self, page):
        self._page_heading(page, "Paramètres")
        form = ttk.Frame(page)
        form.pack(fill="x", pady=12)
        ttk.Label(form, text="Adresse de versions.txt").grid(row=0, column=0, sticky="w", pady=8)
        self.in_url = tk.StringVar(value=self.settings["versions_url"])
        ttk.Entry(form, textvariable=self.in_url).grid(row=0, column=1, sticky="ew", padx=12, pady=8)
        self.in_auto = tk.BooleanVar(value=self.settings["auto_fetch"])
        ttk.Checkbutton(form, text="Charger la liste en ligne au démarrage", variable=self.in_auto).grid(
            row=1, column=1, sticky="w", padx=12, pady=8)
        self.in_browser = tk.BooleanVar(value=self.settings["open_browser"])
        ttk.Checkbutton(form, text="Ouvrir le navigateur au lancement", variable=self.in_browser).grid(
            row=2, column=1, sticky="w", padx=12, pady=8)
        ttk.Label(form, text="Sauvegardes conservées").grid(row=3, column=0, sticky="w", pady=8)
        self.in_keep = tk.IntVar(value=self.settings["keep_backups"])
        ttk.Spinbox(form, from_=1, to=200, textvariable=self.in_keep, width=8).grid(
            row=3, column=1, sticky="w", padx=12, pady=8)
        form.columnconfigure(1, weight=1)
        row = ttk.Frame(page)
        row.pack(anchor="w", pady=10)
        ttk.Button(row, text="Enregistrer", style="Primary.TButton", command=self.save_settings).pack(side="left", padx=(0, 6))
        ttk.Button(row, text="Valeurs par défaut", command=self.reset_settings).pack(side="left")

    @staticmethod
    def _tree(parent, keys, headings, widths):
        frame = ttk.Frame(parent)
        tree = ttk.Treeview(frame, columns=keys, show="headings", selectmode="browse")
        for key, heading, width in zip(keys, headings, widths):
            tree.heading(key, text=heading)
            tree.column(key, width=width, minwidth=55, anchor="w", stretch=True)
        sy = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=sy.set)
        tree.pack(side="left", fill="both", expand=True)
        sy.pack(side="right", fill="y")
        tree.container = frame
        return tree

    def _on_nav(self, index):
        for i, button in enumerate(self.nav_buttons):
            button.configure(style="SelectedNav.TButton" if i == index else "Nav.TButton")
        self.pages[index].lift()
        if index == 0:
            self.update_home()
        elif index == 2:
            self.refresh_worlds()
        elif index == 3:
            self.refresh_logs()
        self.update_buttons()

    def say(self, text):
        self.status.configure(text=text)

    def _selected_index(self, tree, items):
        sel = tree.selection()
        if not sel:
            return None
        try:
            idx = int(sel[0])
            return items[idx] if 0 <= idx < len(items) else None
        except (ValueError, IndexError):
            return None

    def selected_info(self):
        return self._selected_index(self.table, self.visible_catalog)

    def selected_world(self):
        return self._selected_index(self.wtable, self._worlds)

    def on_selection(self):
        self.update_detail()
        self.update_buttons()

    def update_buttons(self):
        if not hasattr(self, "btn_play"):
            return
        info = self.selected_info()
        free = not self.busy
        idle = free and not self.game_running
        current = next((i for i in self.catalog if version_group(i.version) == "base"), None)
        self._enable(self.btn_current_play, bool(current and idle and is_playable(current)))
        self._enable(self.btn_play, bool(info and idle and is_playable(info)))
        self._enable(self.btn_dl, bool(info and free and info.url and not info.has_local))
        self._enable(self.btn_redl, bool(info and free and info.url and info.has_local))
        self._enable(self.btn_del, bool(info and idle and (info.has_local or info.cached)))
        self._enable(self.btn_clear, idle)
        self._enable(self.btn_home_play, bool(self.home_info and idle))
        has_world = bool(self.wtable.selection())
        has_backup = bool(self.btable.selection())
        self._enable(self.btn_export, free and has_world)
        self._enable(self.btn_wdelete, idle and has_world)
        self._enable(self.btn_import, idle)
        self._enable(self.btn_backup, free)
        self._enable(self.btn_restore, idle and has_backup)

    @staticmethod
    def _enable(widget, enabled):
        widget.configure(state="normal" if enabled else "disabled")

    def update_detail(self):
        info = self.selected_info()
        self.detail.configure(state="normal")
        self.detail.delete("1.0", "end")
        if info:
            state = version_state(info)
            text = [info.version, state, ""]
            text.append(f"ZIP local : {info.zip_path.name}" if info.has_local else "ZIP local : aucun")
            if info.error:
                text.append(info.error)
            text.extend((f"Cache : {'oui' if info.cached else 'non'}",
                         f"En ligne : {'disponible' if info.url else 'non listée'}"))
            if self.settings["last_version"] == info.version:
                text.append("Dernière version jouée")
            self.detail.insert("end", "\n\n".join(text))
        self.detail.configure(state="disabled")

    def _render_catalog(self):
        selected = self.selected_info()
        selected_key = selected.key if selected else None
        query = self.filter_var.get().strip().casefold()
        self.visible_catalog = [i for i in self.catalog
                                if version_group(i.version) == self.version_group_var
                                and query in i.version.casefold()]
        if self.version_group_var == "tests":
            self.visible_catalog.sort(key=lambda i: (
                int(TEST_SUFFIX.fullmatch(i.version).group(2) or "0"),
                core.version_sort_key(i.version)))
        elif self.version_group_var == "named_tests":
            self.visible_catalog.sort(key=lambda i: int(re.search(r"\d+", i.version).group(0)))
        self._refresh_group_buttons()
        self.table.delete(*self.table.get_children())
        for idx, item in enumerate(self.visible_catalog):
            size = "—"
            if item.has_local:
                try:
                    size = core.format_size(item.zip_path.stat().st_size)
                except OSError:
                    pass
            local = ("Oui" if item.zip_ok else "Invalide") if item.has_local else "—"
            state = version_state(item)
            self.table.insert("", "end", iid=str(idx), values=(item.version, size, local,
                              "Oui" if item.cached else "—", "Oui" if item.url else "—", state),
                              tags=(state,))
        for state, color in STATE_COLORS.items():
            self.table.tag_configure(state, foreground=color)
        if self.visible_catalog:
            idx = next((n for n, i in enumerate(self.visible_catalog) if i.key == selected_key), 0)
            self.table.selection_set(str(idx))
            self.table.focus(str(idx))
        self.update_detail()
        self.update_buttons()

    def _refresh_group_buttons(self):
        counts = {group: sum(version_group(i.version) == group for i in self.catalog)
                  for group in VERSION_GROUPS}
        for group, button in self.group_buttons.items():
            button.configure(text=f"{VERSION_GROUP_LABELS[group]}  ·  {counts[group]}",
                             style="GroupSelected.TButton" if group == self.version_group_var else "Group.TButton")

    def set_version_group(self, group):
        if group not in VERSION_GROUPS:
            return
        self.version_group_var = group
        self._render_catalog()

    def play_current(self):
        current = next((i for i in self.catalog if version_group(i.version) == "base"), None)
        if current is None:
            return
        self.filter_var.set("")
        self.version_group_var = "base"
        self._render_catalog()
        for idx, item in enumerate(self.visible_catalog):
            if item.key == current.key:
                self.table.selection_set(str(idx))
                self.table.focus(str(idx))
                break
        self.play()

    def apply_filter(self):
        if hasattr(self, "table"):
            self._render_catalog()

    def refresh_catalog(self):
        selected = self.selected_info()
        selected_key = selected.key if selected else None
        self.catalog = core.build_catalog(self.remote_entries)
        self._render_catalog()
        if selected_key:
            for n, item in enumerate(self.visible_catalog):
                if item.key == selected_key:
                    self.table.selection_set(str(n))
                    break
        self.update_home()

    def update_home(self):
        if not hasattr(self, "home_version"):
            return
        current = next((i for i in self.catalog if version_group(i.version) == "base"), None)
        self.current_version_label.configure(text=current.version if current else "Aucune version disponible")
        self.current_version_sub.configure(
            text="Dernière version principale" if current else "Ajoute un ZIP ou actualise la liste en ligne")
        playable = [i for i in self.catalog if is_playable(i)]
        info = next((i for i in playable if i.version == self.settings["last_version"]), None)
        label = "Dernière version jouée"
        if info is None and playable:
            info, label = playable[0], "Version la plus récente"
        self.home_info = info
        self.home_version.configure(text=info.version if info else "Aucune version")
        self.home_sub.configure(text=label if info else "Ajoute un ZIP ou charge la liste en ligne")
        self.btn_home_play.configure(text=f"Jouer {info.version}" if info else "Jouer")
        local = sum(1 for i in self.catalog if i.zip_ok)
        online = sum(1 for i in self.catalog if i.url)
        try:
            worlds = len(core.list_worlds())
        except Exception:
            worlds = 0
        self.home_stats.configure(text=f"{local} locale(s)  ·  {online} en ligne  ·  {worlds} monde(s)")
        self._enable(self.btn_current_play, bool(current and is_playable(current)
                                                   and not self.busy and not self.game_running))
        self.update_buttons()

    def refresh_worlds(self):
        try:
            self._worlds = core.list_worlds()
        except Exception as e:
            core.log.exception("Lecture des mondes")
            self._worlds = []
            self.say(f"Lecture des mondes impossible : {e}")
        self.wtable.delete(*self.wtable.get_children())
        for idx, w in enumerate(self._worlds):
            self.wtable.insert("", "end", iid=str(idx), values=(w["name"], w["seed"],
                              str(w["last_played"]).replace("T", " ")[:19],
                              "—" if w["generation"] is None else w["generation"]))
        self._backups = core.list_backups()
        self.btable.delete(*self.btable.get_children())
        for idx, b in enumerate(self._backups):
            m = re.match(r"worlds-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})", b.name)
            date = f"{m[1]}-{m[2]}-{m[3]} {m[4]}:{m[5]}:{m[6]}" if m else b.name
            try:
                size = core.format_size(b.stat().st_size)
            except OSError:
                size = "—"
            self.btable.insert("", "end", iid=str(idx), values=(date, size))
        self.update_buttons()

    def refresh_logs(self):
        files = core.list_log_files()
        names = [f.name for f in files]
        self._log_paths = {f.name: f for f in files}
        self.log_combo.configure(values=names)
        if self.log_var.get() not in names:
            self.log_var.set(names[0] if names else "")
        self.show_log()

    def show_log(self):
        path = getattr(self, "_log_paths", {}).get(self.log_var.get())
        text = core.tail_file(Path(path)) if path else "Aucun journal"
        self.log_view.configure(state="normal")
        self.log_view.delete("1.0", "end")
        self.log_view.insert("end", text)
        self.log_view.see("end")
        self.log_view.configure(state="disabled")

    def add_zip(self):
        paths = filedialog.askopenfilenames(title="Ajouter une ou plusieurs versions",
                    initialdir=str(core.VERSIONS_DIR), filetypes=(("Archives ZIP", "*.zip"),))
        added, errors = 0, []
        for filename in paths:
            try:
                core.install_zip(Path(filename))
                added += 1
            except Exception as e:
                errors.append(str(e))
        if added:
            self.say(f"{added} version(s) ajoutée(s)")
            self.refresh_catalog()
        if errors:
            messagebox.showwarning("La Plaine", "\n".join(errors), parent=self)

    def _drain_events(self):
        try:
            while True:
                kind, payload = self.events.get_nowait()
                if kind == "progress":
                    pct, msg = payload
                    self.progress.configure(mode="determinate", maximum=100, value=pct)
                    self.say(msg)
                elif kind == "done":
                    callback = self._on_done
                    self._task_end()
                    if callback:
                        callback(payload)
                elif kind == "failed":
                    self._task_end(payload)
                elif kind == "remote_done":
                    self._fetch_ui_end()
                    self.remote_entries = payload
                    self.remote_error = ""
                    self.say(f"{len(payload)} version(s) en ligne ({time.monotonic() - self._fetch_t0:.1f} s)")
                    self.refresh_catalog()
                elif kind == "remote_failed":
                    self._fetch_ui_end()
                    self.remote_error = payload
                    self.say(f"Liste en ligne indisponible : {payload}")
        except queue.Empty:
            pass
        if self.winfo_exists():
            self.after(60, self._drain_events)

    def run_task(self, fn, on_done, label):
        if self.busy:
            return
        cancel = threading.Event()
        self.worker = cancel
        self._on_done = on_done
        self.progress.configure(mode="determinate", value=0)
        self.progress.pack(side="right", padx=8)
        self.btn_cancel.pack(side="right")
        self.say(label)
        self.update_buttons()
        def runner():
            try:
                result = fn(lambda pct, msg: self.events.put(("progress", (pct, msg))), cancel)
                self.events.put(("done", result))
            except core.Cancelled:
                self.events.put(("failed", "Annulé"))
            except Exception as e:
                core.log.exception("Tâche en échec")
                self.events.put(("failed", str(e) or e.__class__.__name__))
        threading.Thread(target=runner, name="LaPlaine-Task", daemon=True).start()

    def _task_end(self, error=None):
        self.worker = None
        self._on_done = None
        self.progress.pack_forget()
        self.btn_cancel.pack_forget()
        if error is not None:
            self.say(error)
            if error != "Annulé":
                messagebox.showwarning("La Plaine", error, parent=self)
        self.refresh_catalog()

    def cancel_task(self):
        if self.worker:
            self.worker.set()
            self.say("Annulation…")

    def on_refresh(self):
        self.refresh_catalog()
        if self.settings["versions_url"]:
            self.fetch_remote()

    def fetch_remote(self):
        if self.fetcher is not None:
            return
        url = self.settings["versions_url"]
        self.fetcher = True
        self.say("Chargement de la liste en ligne…")
        self._fetch_t0 = time.monotonic()
        if not self.busy:
            self.progress.configure(mode="indeterminate")
            self.progress.pack(side="right", padx=8)
            self.progress.start(12)
        def runner():
            try:
                self.events.put(("remote_done", core.fetch_remote_entries(url)))
            except Exception as e:
                self.events.put(("remote_failed", str(e)))
        threading.Thread(target=runner, name="LaPlaine-Fetch", daemon=True).start()

    def _fetch_ui_end(self):
        self.fetcher = None
        self.progress.stop()
        self.progress.pack_forget()
        if self.busy:
            self.progress.configure(mode="determinate")
            self.progress.pack(side="right", padx=8)

    def play_home(self):
        if not self.home_info:
            return
        self.filter_var.set("")
        for idx, info in enumerate(self.visible_catalog):
            if info.key == self.home_info.key:
                self.table.selection_set(str(idx))
                self.table.focus(str(idx))
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
            except Exception as exc:
                core.log.exception("Sauvegarde automatique échouée")
                raise RuntimeError("Sauvegarde automatique des mondes échouée. Voir le journal.") from exc
            progress(0, "Démarrage")
            port = core.free_port()
            proc = core.start_game(game_dir, info.key, port)
            try:
                core.wait_ready(port, proc, cancel=cancel)
            except BaseException:
                core.stop_game(proc)
                raise
            return proc, port
        def done(result):
            self.proc, self.proc_port = result
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
        if redo and not messagebox.askyesno("La Plaine", f"Retélécharger {info.version} ?\nLe ZIP et le cache seront remplacés.", parent=self):
            return
        self.run_task(lambda p, c: core.download_local(info, p, c),
                      lambda _r: self.say(f"{info.version} téléchargée"), f"Téléchargement {info.version}")

    def delete_version(self):
        info = self.selected_info()
        if not info or self.busy or self.game_running:
            return
        if not messagebox.askyesno("La Plaine", f"Supprimer la copie locale de {info.version} ?\nLes mondes ne sont pas touchés.", parent=self):
            return
        try:
            core.delete_local(info)
            self.say(f"{info.version} supprimée")
        except Exception as e:
            core.log.exception("Suppression")
            messagebox.showwarning("La Plaine", str(e), parent=self)
        self.refresh_catalog()

    def clear_cache(self):
        if self.busy or self.game_running:
            return
        try:
            core.clear_cache()
            self.say("Cache vidé")
        except Exception as e:
            core.log.exception("Vidage du cache")
            messagebox.showwarning("La Plaine", str(e), parent=self)
        self.refresh_catalog()

    def _poll_game(self):
        shown = bool(self.gamebar.winfo_manager())
        if self.game_running:
            self.game_label.configure(text=f"En cours : {self.proc_key}   ·   http://127.0.0.1:{self.proc_port}")
            if not shown:
                self.gamebar.pack(fill="x")
                self.gamebar.lift()
        else:
            if self.proc is not None:
                code = self.proc.poll()
                self.say(f"Jeu arrêté (code {code})" if code else "Jeu arrêté")
            self.proc = None
            if shown:
                self.gamebar.pack_forget()
        self.update_buttons()
        if self.winfo_exists():
            self.after(1000, self._poll_game)

    def open_game(self):
        if self.game_running:
            webbrowser.open(f"http://127.0.0.1:{self.proc_port}/")

    def stop_game(self):
        core.stop_game(self.proc)
        self._poll_game()

    def export_selected_world(self):
        world = self.selected_world()
        if not world or self.busy:
            return
        safe = re.sub(r'[\\/:*?"<>|]+', "_", str(world["name"])).strip() or "monde"
        core.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        path = filedialog.asksaveasfilename(title="Exporter le monde", initialdir=str(core.EXPORTS_DIR),
                    initialfile=f"{safe}.plaine", defaultextension=".plaine",
                    filetypes=(("Monde La Plaine", "*.plaine"),), parent=self)
        if not path:
            return
        try:
            core.export_world(world["id"], Path(path))
            self.say(f"Monde exporté : {Path(path).name}")
        except Exception as e:
            core.log.exception("Export")
            messagebox.showwarning("La Plaine", f"Export impossible : {e}", parent=self)

    def import_world(self):
        if self.busy or self.game_running:
            return
        path = filedialog.askopenfilename(title="Importer un monde", initialdir=str(core.EXPORTS_DIR),
                    filetypes=(("Monde La Plaine", "*.plaine"),), parent=self)
        if not path:
            return
        try:
            core.backup_db(self.settings["keep_backups"])
            name = core.import_world(Path(path))
            self.say(f"Monde importé : {name}")
        except Exception as e:
            core.log.exception("Import")
            messagebox.showwarning("La Plaine", str(e), parent=self)
        self.refresh_worlds()

    def delete_selected_world(self):
        world = self.selected_world()
        if not world or self.busy or self.game_running:
            return
        if not messagebox.askyesno("La Plaine", f"Supprimer le monde « {world['name']} » ?\nUne sauvegarde est faite avant.", parent=self):
            return
        try:
            core.backup_db(self.settings["keep_backups"])
            core.delete_world(world["id"])
            self.say(f"Monde supprimé : {world['name']}")
        except Exception as e:
            core.log.exception("Suppression du monde")
            messagebox.showwarning("La Plaine", str(e), parent=self)
        self.refresh_worlds()
        self.update_home()

    def backup_now(self):
        try:
            out = core.backup_db(self.settings["keep_backups"])
            self.say(f"Sauvegarde : {out.name}" if out else "Aucun monde à sauvegarder")
        except Exception as e:
            core.log.exception("Sauvegarde")
            messagebox.showwarning("La Plaine", f"Sauvegarde impossible : {e}", parent=self)
        self.refresh_worlds()

    def restore_selected_backup(self):
        path = self._selected_index(self.btable, self._backups)
        if path is None or self.busy or self.game_running:
            return
        if not messagebox.askyesno("La Plaine", "Restaurer cette sauvegarde ?\nLes mondes actuels seront remplacés après sauvegarde.", parent=self):
            return
        try:
            core.restore_backup(path, self.settings["keep_backups"])
            self.say("Sauvegarde restaurée")
        except Exception as e:
            core.log.exception("Restauration")
            messagebox.showwarning("La Plaine", str(e), parent=self)
        self.refresh_worlds()
        self.update_home()

    def save_settings(self):
        new = dict(self.settings)
        new.update(versions_url=self.in_url.get().strip(), auto_fetch=self.in_auto.get(),
                   open_browser=self.in_browser.get(), keep_backups=max(1, min(200, self.in_keep.get())))
        try:
            core.save_settings(new)
        except OSError as e:
            messagebox.showwarning("La Plaine", f"Enregistrement impossible : {e}", parent=self)
            return
        self.settings = new
        self.say("Paramètres enregistrés")
        self.fetch_remote()

    def reset_settings(self):
        d = core.DEFAULT_SETTINGS
        self.in_url.set(d["versions_url"])
        self.in_auto.set(d["auto_fetch"])
        self.in_browser.set(d["open_browser"])
        self.in_keep.set(d["keep_backups"])

    def close(self):
        if self.worker:
            self.worker.set()
        core.stop_game(self.proc)
        self.destroy()


def main():
    core.ensure_dirs()
    core.setup_logging()
    app = MainWindow()
    app.mainloop()


if __name__ == "__main__":
    main()
