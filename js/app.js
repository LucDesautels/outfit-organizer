/* Bootstraps the app: loads data, wires navigation (with hardware
   back-button support), renders the tab bar, and mounts views. */

import { loadAll } from './store.js';
import { mountView } from './views.js';
import { nav } from './nav.js';
import { hasOverlay, closeTopOverlay } from './ui.js';
import { icon, esc } from './util.js';

let currentRoute = { view: 'wardrobe' };

const TABS = [
  ['wardrobe', 'Wardrobe', 'grid'],
  ['ecosystems', 'Ecosystems', 'layers'],
  ['fits', 'Fits', 'outfit'],
  ['web', 'Web', 'web'],
];

/* which tab should appear active for a given route */
function sectionOf(view) {
  if (view === 'item') return 'wardrobe';
  if (view === 'ecosystem') return 'ecosystems';
  if (view === 'fit' || view === 'fitbuilder') return 'fits';
  return view;
}

function render(route) {
  currentRoute = route;
  mountView(route);
  updateTabs();
}
function updateTabs() {
  const sec = sectionOf(currentRoute.view);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === sec));
}

/* ---- navigation API (consumed by views via nav.js) --------------------- */
nav.go = route => {
  history.pushState({ route }, '');
  render(route);
};
nav.replace = route => {
  history.replaceState({ route }, '');
  render(route);
};
nav.back = () => history.back();
nav.rerender = () => render(currentRoute);
nav.current = () => currentRoute;

window.addEventListener('popstate', e => {
  // Back button: first dismiss any open sheet/cropper, staying on this view.
  if (hasOverlay()) {
    closeTopOverlay();
    history.pushState({ route: currentRoute }, '');
    return;
  }
  const route = (e.state && e.state.route) || { view: 'wardrobe' };
  render(route);
});

/* ---- tab bar ----------------------------------------------------------- */
function buildTabs() {
  const bar = document.getElementById('tabbar');
  bar.innerHTML = '';
  for (const [view, label, ic] of TABS) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.dataset.view = view;
    b.innerHTML = `${icon(ic)}<span>${esc(label)}</span>`;
    b.onclick = () => { if (sectionOf(currentRoute.view) === view && currentRoute.view === view) return; nav.go({ view }); };
    bar.appendChild(b);
  }
}

/* ---- delegated [data-go="view:id"] navigation -------------------------- */
document.getElementById('app').addEventListener('click', e => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  const [view, id] = t.dataset.go.split(':');
  nav.go(id ? { view, id } : { view });
});

/* ---- init -------------------------------------------------------------- */
async function init() {
  buildTabs();
  await loadAll();
  history.replaceState({ route: currentRoute }, '');
  render(currentRoute);
}
init();
