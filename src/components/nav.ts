import { clearMasterCache, clearToken } from '../api';

const links = [
  { href: '#/', label: 'Dashboard', key: 'dashboard' },
  { href: '#/products', label: 'Products', key: 'products' },
  { href: '#/routes', label: 'Routes', key: 'routes' },
  { href: '#/shops', label: 'Shops', key: 'shops' },
  { href: '#/history', label: 'History', key: 'history' },
  { href: '#/analytics', label: 'Analytics', key: 'analytics' },
];

export function navHtml(active: string): string {
  return `
    <nav class="nav">
      ${links.map((l) => `<a href="${l.href}" class="${l.key === active ? 'active' : ''}">${l.label}</a>`).join('')}
      <button id="logout-btn" class="link-btn" type="button">Logout</button>
    </nav>
  `;
}

export function wireNav(container: ParentNode) {
  container.querySelector('#logout-btn')?.addEventListener('click', () => {
    clearToken();
    clearMasterCache();
    window.location.hash = '#/';
    window.location.reload();
  });
}
