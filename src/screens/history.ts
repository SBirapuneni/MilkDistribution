import { navHtml, wireNav } from '../components/nav';
import { getMasterData, listTrips } from '../api';

export async function renderHistory(container: HTMLElement) {
  container.innerHTML =
    navHtml('history') +
    `
    <main class="page">
      <h1>History</h1>
      <div class="field-row">
        <label>Route
          <select id="route-filter"><option value="">All routes</option></select>
        </label>
        <label>From <input type="date" id="date-from" /></label>
        <label>To <input type="date" id="date-to" /></label>
      </div>
      <div id="history-content">Loading...</div>
    </main>
  `;
  wireNav(container);

  const content = container.querySelector<HTMLDivElement>('#history-content')!;
  const routeFilter = container.querySelector<HTMLSelectElement>('#route-filter')!;
  const dateFrom = container.querySelector<HTMLInputElement>('#date-from')!;
  const dateTo = container.querySelector<HTMLInputElement>('#date-to')!;

  try {
    const { routes } = await getMasterData();
    routeFilter.insertAdjacentHTML(
      'beforeend',
      routes.map((r) => `<option value="${r.RouteId}">${r.Name}</option>`).join(''),
    );
  } catch (err) {
    content.innerHTML = `<p class="error">Failed to load routes: ${(err as Error).message}</p>`;
    return;
  }

  async function load() {
    content.innerHTML = 'Loading...';
    try {
      const trips = await listTrips({
        routeId: routeFilter.value || undefined,
        dateFrom: dateFrom.value || undefined,
        dateTo: dateTo.value || undefined,
      });
      content.innerHTML = trips.length
        ? `
        <table class="line-items">
          <thead>
            <tr><th>Date</th><th>Session</th><th>Route</th><th>Status</th><th>Dispatched</th><th>Returned</th><th>Amount due</th><th>Cash</th><th>Discrepancy</th></tr>
          </thead>
          <tbody>
            ${trips
              .map(
                (t) => `
              <tr>
                <td>${t.Date}</td>
                <td>${t.Session}</td>
                <td>${t.RouteName}</td>
                <td>${t.Status}</td>
                <td>₹${t.DispatchedTotal}</td>
                <td>₹${t.ReturnedTotal}</td>
                <td>₹${t.AmountDue}</td>
                <td>₹${t.CashHandedOver}</td>
                <td>₹${t.Discrepancy}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      `
        : '<p>No trips found.</p>';
    } catch (err) {
      content.innerHTML = `<p class="error">Failed to load: ${(err as Error).message}</p>`;
    }
  }

  [routeFilter, dateFrom, dateTo].forEach((el) => el.addEventListener('change', load));
  await load();
}
