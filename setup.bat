@echo off
setlocal enabledelayedexpansion

echo Numu App - Configuración e Instalación

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js no está instalado. Por favor instálalo desde https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: npm no está instalado. Por favor instálalo junto con Node.js.
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo npm version:
call npm --version

echo Instalando dependencias...
call npm install

echo.
echo Instalación completada con éxito
echo.
echo Para iniciar el servidor de desarrollo, ejecuta:
echo   npm run dev
echo.
echo Luego abre la URL que se muestra en la terminal (usualmente http://localhost:5173)
pause
