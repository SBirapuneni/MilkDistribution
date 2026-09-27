import './style.css';
import { getToken } from './api';
import { renderPasscode } from './screens/passcode';
import { renderDashboard } from './screens/dashboard';
import { renderRouteScreen } from './screens/route';
import { renderProducts } from './screens/products';
import { renderRoutesAdmin } from './screens/routes-admin';
import { renderHistory } from './screens/history';
import { renderAnalytics } from './screens/analytics';

const app = document.querySelector<HTMLDivElement>('#app')!;

function render() {
  if (!getToken()) {
    renderPasscode(app, render);
    return;
  }

  const hash = window.location.hash || '#/';
  const parts = hash.split('/');
  const path = parts[1] || '';
  const param = parts[2];

  if (path === '') {
    renderDashboard(app);
  } else if (path === 'route' && param) {
    renderRouteScreen(app, decodeURIComponent(param));
  } else if (path === 'products') {
    renderProducts(app);
  } else if (path === 'routes') {
    renderRoutesAdmin(app);
  } else if (path === 'history') {
    renderHistory(app);
  } else if (path === 'analytics') {
    renderAnalytics(app);
  } else {
    app.innerHTML = '<p class="page">Not found.</p>';
  }
}

window.addEventListener('hashchange', render);
render();
