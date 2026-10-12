@echo off
title Compilation La Plaine - PyInstaller

:: Chemin vers les Scripts Python
set PYINSTALLER_EXE="C:\Users\Parent\AppData\Local\Python\pythoncore-3.14-64\Scripts\pyinstaller.exe"

echo =========================================
echo    Debut de la compilation du projet
echo =========================================

:: Nettoyage des anciens fichiers de build
:: Sauvegarder la base du jeu avant de supprimer l'ancien dossier dist.
:: worlds.db contient les mondes : ne jamais l'effacer pendant une recompilation.
if exist "dist\La_Plaine\worlds.db" (
    echo Sauvegarde de worlds.db avant recompilation...
    copy /Y "dist\La_Plaine\worlds.db" "worlds.db" >nul
)

echo Nettoyage des anciens builds...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist *.spec del /f /q *.spec

:: Verification si PyInstaller.exe existe bien dans le dossier Scripts
if not exist %PYINSTALLER_EXE% (
    echo PyInstaller.exe introuvable dans Scripts, tentative avec la commande globale...
    set PYINSTALLER_EXE=pyinstaller
)

:: Compilation avec PyInstaller
echo Compilation en cours...
%PYINSTALLER_EXE% --noconfirm ^
    --onedir ^
    --console ^
    --add-data "templates;templates" ^
    --add-data "static;static" ^
    --name "La_Plaine" ^
    app.py

:: Restaurer la base sauvegardee a cote du nouvel executable.
if exist "worlds.db" (
    if exist "dist\La_Plaine" copy /Y "worlds.db" "dist\La_Plaine\worlds.db" >nul
)

echo =========================================
echo    Compilation terminee !
echo    L'executable se trouve dans : dist\La_Plaine\La_Plaine.exe
echo =========================================
pause
