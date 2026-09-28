import { navHtml, wireNav } from '../components/nav';
import { getMasterData, saveProduct } from '../api';
import type { Product } from '../types';
import { escapeHtml, money } from '../util';

export async function renderProducts(container: HTMLElement) {
  container.innerHTML = navHtml('products') + '<main class="page"><h1>Products</h1><div id="content">Loading...</div></main>';
  wireNav(container);

  const content = container.querySelector<HTMLDivElement>('#content')!;

  async function load() {
    content.innerHTML = 'Loading...';
    try {
      const { products } = await getMasterData();
      content.innerHTML = renderList(products) + `<div id="form-container">${renderForm()}</div>`;
      wireList(products);
      wireForm();
    } catch (err) {
      content.innerHTML = `<p class="error">Failed to load: ${escapeHtml((err as Error).message)}</p>`;
    }
  }

  function renderList(products: Product[]): string {
    if (products.length === 0) return '<p>No products yet.</p>';
    return `
      <table class="line-items">
        <thead><tr><th>Name</th><th>Unit</th><th>Price</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${products
            .map(
              (p) => `
            <tr>
              <td>${escapeHtml(p.Name)}</td>
              <td>${escapeHtml(p.Unit)}</td>
              <td>${money(p.Price)}</td>
              <td>${isActive(p.Active) ? 'Yes' : 'No'}</td>
              <td><button class="edit-btn" type="button" data-id="${escapeHtml(p.ProductId)}">Edit</button></td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  function renderForm(editing?: Product): string {
    return `
      <h2>${editing ? 'Edit product' : 'Add product'}</h2>
      <form id="product-form">
        <input type="hidden" name="productId" value="${escapeHtml(editing?.ProductId)}" />
        <div class="field-row">
          <label>Name <input type="text" name="name" value="${escapeHtml(editing?.Name)}" required /></label>
          <label>Unit <input type="text" name="unit" placeholder="e.g. litre, packet" value="${escapeHtml(editing?.Unit)}" required /></label>
          <label>Price <input type="number" name="price" min="0" step="0.01" value="${escapeHtml(editing?.Price)}" required /></label>
          <label><input type="checkbox" name="active" ${editing && !isActive(editing.Active) ? '' : 'checked'} /> Active</label>
        </div>
        <button type="submit">Save</button>
        <p id="product-error" class="error"></p>
      </form>
    `;
  }

  function wireList(products: Product[]) {
    content.querySelectorAll<HTMLButtonElement>('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const product = products.find((p) => p.ProductId === btn.dataset.id);
        content.querySelector('#form-container')!.innerHTML = renderForm(product);
        wireForm();
      });
    });
  }

  function wireForm() {
    const form = content.querySelector<HTMLFormElement>('#product-form')!;
    const errorEl = content.querySelector<HTMLParagraphElement>('#product-error')!;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const fd = new FormData(form);
      const productId = String(fd.get('productId') || '') || undefined;
      const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      submitBtn.disabled = true;
      try {
        await saveProduct({
          productId,
          name: String(fd.get('name')),
          unit: String(fd.get('unit')),
          price: Number(fd.get('price')),
          active: fd.get('active') === 'on',
        });
        await load();
      } catch (err) {
        errorEl.textContent = (err as Error).message;
        submitBtn.disabled = false;
      }
    });
  }

  await load();
}

function isActive(value: boolean): boolean {
  return value !== false && String(value).toUpperCase() !== 'FALSE';
}
