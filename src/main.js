import './index.css';
import { renderSplash } from './views/Splash.js';
import { renderHome } from './views/Home.js';
import { renderGame } from './views/Game.js';
import { renderLogin } from './views/LoginView.js';
import { renderSettingsView } from './views/SettingsView.js';
import { renderAchievements } from './views/Achievements.js';
import { renderShopView } from './views/ShopView.js';
import { createAppShell } from './components/AppShell.js';
import { store } from './state/store.js';

const app = document.getElementById('app');
let current = null;

/* ---------- Aplicación de preferencias de accesibilidad ---------- */
function applySettings(state) {
  const { settings } = state;
  document.body.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
  document.body.classList.toggle('colorblind-mode', Boolean(settings.colorblind));
  document.documentElement.style.fontSize = `${Math.round((settings.fontScale ?? 1) * 100)}%`;
}

/* ---------- Router basado en hash ---------- */
/* Vistas a pantalla completa (sin sidebar) */
const FULL_ROUTES = {
  '': renderSplash,
  '/': renderSplash,
  '/login': renderLogin,
  '/game': renderGame,
};

/* Vistas dentro del AppShell (sidebar + navbar + bottom nav) */
const SHELL_ROUTES = {
  '/home': { factory: renderHome, key: 'home' },
  '/achievements': { factory: renderAchievements, key: 'achievements' },
  '/shop': { factory: renderShopView, key: 'shop' },
  '/settings': { factory: renderSettingsView, key: 'settings' },
};

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { path: path || '/', params };
}

function mount(view) {
  if (current?.destroy) current.destroy();
  if (current instanceof Node && current.parentNode) current.parentNode.removeChild(current);
  current = view;
  const el = view?.el ?? view;
  app.innerHTML = '';
  app.appendChild(el);
  window.scrollTo(0, 0);
}

function navigate(route, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null)
  ).toString();
  const next = `#/${route.replace(/^\/+/, '')}${query ? `?${query}` : ''}`;
  if (window.location.hash === next) render();
  else window.location.hash = next;
}

function render() {
  const { path, params } = parseHash();
  applySettings(store.get());

  const shellRoute = SHELL_ROUTES[path];
  if (shellRoute) {
    /* Guard: el onboarding debe completarse antes de entrar a la app */
    if (!store.get().profile.completed) {
      navigate('login');
      return;
    }
    const view = shellRoute.factory({ onNavigate: navigate, params });
    mount(createAppShell({ current: shellRoute.key, onNavigate: navigate, children: view }));
    return;
  }

  const factory = FULL_ROUTES[path];
  if (!factory) {
    navigate('home'); /* rutas desconocidas → home (con guard a login si aplica) */
    return;
  }
  mount(factory({ onNavigate: navigate, params }));
}

window.addEventListener('hashchange', render);
store.subscribe(applySettings);

render();
