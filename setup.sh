#!/bin/bash
set -e

echo "Numu App - Configuración e Instalación"

if ! command -v node &> /dev/null; then
    echo "Error: Node.js no está instalado. Por favor instálalo desde https://nodejs.org/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "Error: npm no está instalado. Por favor instálalo junto con Node.js."
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

echo "Instalando dependencias..."
npm install

echo ""
echo "Instalación completada con éxito!"
echo ""
echo "Para iniciar el servidor de desarrollo, ejecuta:"
echo "  npm run dev"
echo ""
echo "Luego abre la URL que se muestra en la terminal (usualmente http://localhost:5173)"
