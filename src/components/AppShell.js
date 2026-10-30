import { createSidebar } from './Sidebar.js';
import { createNavbar, createBottomNav } from './Navbar.js';

/**
 * Estructura global de la app: sidebar fija (≥ lg), barra superior con estadísticas,
 * contenido central y navegación inferior (móvil).
 * @param {Object} options
 * @param {string} options.current - Ruta activa (home | achievements | shop | settings).
 * @param {Function} options.onNavigate
 * @param {Node} options.children - Contenido de la vista.
 * @returns {HTMLElement}
 */
export function createAppShell({ current = 'home', onNavigate, children } = {}) {
  const shell = document.createElement('div');
  shell.className = 'min-h-dvh bg-soft-lavender';

  const sidebar = createSidebar({ current, onNavigate });
  shell.appendChild(sidebar);

  const column = document.createElement('div');
  column.className = 'lg:pl-64 flex flex-col min-h-dvh';

  const navbar = createNavbar({ onNavigate });
  column.appendChild(navbar);

  const main = document.createElement('main');
  main.className = 'flex-1 w-full max-w-5xl mx-auto px-4 py-6 lg:py-8 pb-8 lg:pb-12';
  if (children) main.appendChild(children);
  column.appendChild(main);

  const bottomNav = createBottomNav({ current, onNavigate });
  column.appendChild(bottomNav);

  shell.appendChild(column);

  shell.destroy = () => {
    navbar.destroy?.();
    sidebar.destroy?.();
    if (children?.destroy) children.destroy();
  };

  return shell;
}
