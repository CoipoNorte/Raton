@echo off
REM =====================================================
REM   RATON - Despliegue automatico a GitHub Pages
REM   Hace:  npm install  -^>  npm run build  -^>  gh-pages
REM   Requisitos: Node.js y Git instalados, y que esta
REM   carpeta sea un repo git con remoto "origin".
REM =====================================================
cd /d %~dp0

echo.
echo  =====================================
echo   RATON - el juego del queso
echo   Despliegue a GitHub Pages
echo  =====================================
echo.

echo [1/3] Instalando dependencias (npm install)...
call npm install
if errorlevel 1 goto error

echo.
echo [2/3] Construyendo el juego (npm run build)...
call npm run build
if errorlevel 1 goto error

echo.
echo [3/3] Publicando en GitHub Pages (rama gh-pages)...
call npx gh-pages -d dist -m "Deploy RATON"
if errorlevel 1 goto error

echo.
echo  =====================================
echo   LISTO! En 1-2 minutos tu juego estara en:
echo   https://TU-USUARIO.github.io/Raton/
echo   (Activa Pages en Settings -^> Pages -^> gh-pages)
echo  =====================================
echo.
goto end

:error
echo.
echo  *** Algo salio mal. Revisa los mensajes de arriba. ***
echo  - Tienes Node.js y Git instalados?
echo  - Hiciste git init, commit y remote add origin ... ?
echo.

:end
pause
