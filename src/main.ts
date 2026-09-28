import './style.css';
import { getToken, getUserName, warmUp } from './api';
import { renderPasscode } from './screens/passcode';
import { renderDashboard } from './screens/dashboard';
import { renderRouteScreen } from './screens/route';
import { renderProducts } from './screens/products';
import { renderRoutesAdmin } from './screens/routes-admin';
import { renderHistory } from './screens/history';
import { renderAnalytics } from './screens/analytics';
import { renderShopPortal } from './screens/shop-order';
import { renderShopsAdmin } from './screens/shops-admin';

const app = document.querySelector<HTMLDivElement>('#app')!;

function render() {
  // The shop owners' order page has its own phone + PIN login and never
  // needs (or reveals) the staff passcode.
  if (window.location.hash.startsWith('#/order')) {
    renderShopPortal(app);
    return;
  }

  if (!getToken() || !getUserName()) {
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
    const session = parts[3] === 'Morning' || parts[3] === 'Evening' ? parts[3] : undefined;
    renderRouteScreen(app, decodeURIComponent(param), session);
  } else if (path === 'products') {
    renderProducts(app);
  } else if (path === 'routes') {
    renderRoutesAdmin(app);
  } else if (path === 'shops') {
    renderShopsAdmin(app);
  } else if (path === 'history') {
    renderHistory(app);
  } else if (path === 'analytics') {
    renderAnalytics(app);
  } else {
    app.innerHTML = '<p class="page">Not found.</p>';
  }
}

warmUp();
window.addEventListener('hashchange', render);
render();
