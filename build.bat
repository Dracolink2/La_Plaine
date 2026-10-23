@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Compilation de La Plaine en EXE (Mode Dossier)

REM Place ce fichier a la racine du projet, a cote de app.py, templates\ et static\.
cd /d "%~dp0"

echo.
echo ==========================================
echo       LA PLAINE - COMPILATION EN EXE
echo ==========================================
echo.

if not exist "app.py" (
  echo [ERREUR] app.py est introuvable.
  echo Place Compiler_La_Plaine.bat a la racine du projet La Plaine.
  pause
  exit /b 1
)
if not exist "templates\" (
  echo [ERREUR] Le dossier templates est introuvable.
  pause
  exit /b 1
)
if not exist "static\" (
  echo [ERREUR] Le dossier static est introuvable.
  pause
  exit /b 1
)

echo [1/4] Verification de Python...
python --version
if errorlevel 1 (
  echo.
  echo [ERREUR] Python est introuvable. Installe Python depuis https://www.python.org/downloads/windows/
  echo Pendant l'installation, coche bien ^"Add Python to PATH^".
  pause
  exit /b 1
)

echo.
echo [2/4] Installation / mise a jour des outils de compilation...
python -m pip install --upgrade pip
if errorlevel 1 goto :error
python -m pip install --upgrade flask pyinstaller
if errorlevel 1 goto :error

echo.
echo [3/4] Creation du lanceur (desactive le reloader Flask pour eviter les doubles lancements)...
> "_launcher_build.py" echo from app import app
>> "_launcher_build.py" echo if __name__ == "__main__":
>> "_launcher_build.py" echo     app.run(debug=False, use_reloader=False)
if errorlevel 1 goto :error

echo.
echo [4/4] Compilation PyInstaller en cours (Mode Dossier)...
echo La console reste visible pour afficher les messages et erreurs.
echo.
python -m PyInstaller --noconfirm --clean --onedir --console --name "La_Plaine" --add-data "templates;templates" --add-data "static;static" "_launcher_build.py"
set "BUILD_RESULT=%ERRORLEVEL%"

del /q "_launcher_build.py" >nul 2>&1
if not "%BUILD_RESULT%"=="0" goto :error

echo.
echo ==========================================
echo COMPILATION TERMINEE !
echo Repertoire de sortie : dist\La_Plaine\
echo Executable principal  : dist\La_Plaine\La_Plaine.exe
echo ==========================================
echo.
echo Garde l'executable dans son dossier d'origine avec ses dependances.
echo Les mondes et donnees seront crees dans ce meme dossier.
pause
exit /b 0

:error
echo.
echo [ERREUR] La compilation a echoue. Lis les messages ci-dessus.
del /q "_launcher_build.py" >nul 2>&1
pause
exit /b 1