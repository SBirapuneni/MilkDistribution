import { navHtml, wireNav } from '../components/nav';
import { getMasterData, saveRoute } from '../api';
import type { Route } from '../types';

export async function renderRoutesAdmin(container: HTMLElement) {
  container.innerHTML = navHtml('routes') + '<main class="page"><h1>Routes</h1><div id="content">Loading...</div></main>';
  wireNav(container);

  const content = container.querySelector<HTMLDivElement>('#content')!;

  async function load() {
    content.innerHTML = 'Loading...';
    try {
      const { routes } = await getMasterData();
      content.innerHTML = renderList(routes) + `<div id="form-container">${renderForm()}</div>`;
      wireList(routes);
      wireForm();
    } catch (err) {
      content.innerHTML = `<p class="error">Failed to load: ${(err as Error).message}</p>`;
    }
  }

  function renderList(routes: Route[]): string {
    if (routes.length === 0) return '<p>No routes yet.</p>';
    return `
      <table class="line-items">
        <thead><tr><th>Name</th><th>Villages</th><th>Vehicle</th><th>Driver</th><th>Active</th><th></th></tr></thead>
        <tbody>
          ${routes
            .map(
              (r) => `
            <tr>
              <td>${r.Name}</td>
              <td>${r.Villages}</td>
              <td>${r.DefaultVehicle}</td>
              <td>${r.DefaultDriver}</td>
              <td>${isActive(r.Active) ? 'Yes' : 'No'}</td>
              <td><button class="edit-btn" type="button" data-id="${r.RouteId}">Edit</button></td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  function renderForm(editing?: Route): string {
    return `
      <h2>${editing ? 'Edit route' : 'Add route'}</h2>
      <form id="route-form">
        <input type="hidden" name="routeId" value="${editing?.RouteId ?? ''}" />
        <div class="field-row">
          <label>Name <input type="text" name="name" value="${editing?.Name ?? ''}" required /></label>
          <label>Villages <input type="text" name="villages" placeholder="comma-separated" value="${editing?.Villages ?? ''}" /></label>
          <label>Default vehicle <input type="text" name="defaultVehicle" value="${editing?.DefaultVehicle ?? ''}" /></label>
          <label>Default driver <input type="text" name="defaultDriver" value="${editing?.DefaultDriver ?? ''}" /></label>
          <label><input type="checkbox" name="active" ${editing?.Active === false ? '' : 'checked'} /> Active</label>
        </div>
        <button type="submit">Save</button>
        <p id="route-error" class="error"></p>
      </form>
    `;
  }

  function wireList(routes: Route[]) {
    content.querySelectorAll<HTMLButtonElement>('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const route = routes.find((r) => r.RouteId === btn.dataset.id);
        content.querySelector('#form-container')!.innerHTML = renderForm(route);
        wireForm();
      });
    });
  }

  function wireForm() {
    const form = content.querySelector<HTMLFormElement>('#route-form')!;
    const errorEl = content.querySelector<HTMLParagraphElement>('#route-error')!;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const fd = new FormData(form);
      const routeId = String(fd.get('routeId') || '') || undefined;
      const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
      submitBtn.disabled = true;
      try {
        await saveRoute({
          routeId,
          name: String(fd.get('name')),
          villages: String(fd.get('villages')),
          defaultVehicle: String(fd.get('defaultVehicle')),
          defaultDriver: String(fd.get('defaultDriver')),
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
