# NUMU

Aplicativo web académico enfocado en niños entre 5-12 años con la finalidad de aprendizaje en áreas disciplinares de matemáticas básicass.

## Instalación y configuración

### Linux / macOS

Desde la raíz del proyecto, ejecuta:

```bash
chmod +x setup.sh
./setup.sh
```

### Windows

Desde la raíz del proyecto, ejecuta:

```bat
setup.bat
```

Ambos scripts verifican que Node.js y npm estén instalados, ejecutan `npm install` automáticamente e indican cómo iniciar el servidor de desarrollo.

### Iniciar el servidor de desarrollo

```bash
npm run dev
```

Luego abre la URL que se muestra en la terminal (usualmente `http://localhost:5173`).

### Otros scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo con Vite |
| `npm run build` | Construye la aplicación para producción |
| `npm run preview` | Previsualiza la build de producción localmente |
| `npm run setup` / `npm install` | Instala las dependencias del proyecto |

## Estructura del proyecto

Consulta `AGENTS.md` para conocer la jerarquía de archivos y las directrices de trabajo.
