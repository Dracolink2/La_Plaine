@echo off
setlocal
cd /d "%~dp0"
title Compilation - La Plaine Launcher

echo [1/3] Verification de Python...
python --version
if errorlevel 1 (
    echo Python est introuvable dans le PATH.
    goto :error
)

echo.
echo [2/3] Installation des dependances...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
if errorlevel 1 goto :error

set ICON_ARG=
if exist icon.ico set ICON_ARG=--icon icon.ico

echo.
echo [3/3] Compilation...
python -m PyInstaller --noconfirm --clean --onefile --windowed --name LaPlaine %ICON_ARG% ^
 --collect-submodules flask ^
 --collect-submodules werkzeug ^
 --collect-submodules jinja2 ^
 --hidden-import markupsafe ^
 --hidden-import itsdangerous ^
 --hidden-import click ^
 --hidden-import blinker ^
 --hidden-import secrets ^
 --hidden-import math ^
 --hidden-import io ^
 --hidden-import sqlite3 ^
 launcher.py
if errorlevel 1 goto :error

echo.
echo Termine : dist\LaPlaine.exe
echo Un seul fichier : copie-le ou tu veux. versions, saves, cache et logs seront crees a cote.
echo.
pause
exit /b 0

:error
echo.
echo La compilation a echoue.
echo.
pause
exit /b 1
