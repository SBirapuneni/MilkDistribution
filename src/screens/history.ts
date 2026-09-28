import { navHtml, wireNav } from '../components/nav';
import { getMasterData, listTrips } from '../api';
import type { Trip } from '../types';
import { daysAgoStr, escapeHtml, localDateStr, money, shortDate } from '../util';

export async function renderHistory(container: HTMLElement) {
  container.innerHTML =
    navHtml('history') +
    `
    <main class="page wide">
      <h1>History</h1>
      <div class="field-row">
        <label>Route
          <select id="route-filter"><option value="">All routes</option></select>
        </label>
        <label>From <input type="date" id="date-from" value="${daysAgoStr(29)}" /></label>
        <label>To <input type="date" id="date-to" value="${localDateStr()}" /></label>
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
      routes.map((r) => `<option value="${escapeHtml(r.RouteId)}">${escapeHtml(r.Name)}</option>`).join(''),
    );
  } catch (err) {
    content.innerHTML = `<p class="error">Failed to load routes: ${escapeHtml((err as Error).message)}</p>`;
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
      content.innerHTML = trips.length ? renderTable(trips) : '<p>No trips found.</p>';
    } catch (err) {
      content.innerHTML = `<p class="error">Failed to load: ${escapeHtml((err as Error).message)}</p>`;
    }
  }

  [routeFilter, dateFrom, dateTo].forEach((el) => el.addEventListener('change', load));
  await load();
}

function discrepancyCell(value: Trip['Discrepancy']): string {
  if (value === '') return '<td class="num muted">—</td>';
  const v = Number(value) || 0;
  if (v < 0) return `<td class="num warn">${money(-v)} short</td>`;
  if (v > 0) return `<td class="num">${money(v)} excess</td>`;
  return '<td class="num">₹0</td>';
}

function renderTable(trips: Trip[]): string {
  const settled = trips.filter((t) => t.Status === 'Settled');
  const sum = (key: keyof Trip) => settled.reduce((s, t) => s + (Number(t[key]) || 0), 0);
  const short = settled.reduce((s, t) => s + Math.max(0, -(Number(t.Discrepancy) || 0)), 0);
  const excess = settled.reduce((s, t) => s + Math.max(0, Number(t.Discrepancy) || 0), 0);
  const open = trips.length - settled.length;

  return `
    <div class="table-scroll">
    <table class="line-items history">
      <thead>
        <tr><th>Date</th><th>Session</th><th>Route</th><th>Status</th><th class="num">Dispatched</th><th class="num">Returned</th><th class="num">Amount due</th><th class="num">Cash</th><th class="num">Discrepancy</th><th>Dispatched by</th><th>Settled by</th></tr>
      </thead>
      <tbody>
        ${trips
          .map(
            (t) => `
          <tr>
            <td class="nowrap">${escapeHtml(shortDate(t.Date, true))}</td>
            <td>${escapeHtml(t.Session)}</td>
            <td class="nowrap">${escapeHtml(t.RouteName)}</td>
            <td class="nowrap">${t.Status === 'Settled' ? 'Settled' : '<span class="pending">Awaiting return</span>'}${t.ReopenedBy ? ` <span class="muted">(reopened by ${escapeHtml(t.ReopenedBy)})</span>` : ''}</td>
            <td class="num">${money(t.DispatchedTotal)}</td>
            <td class="num">${money(t.ReturnedTotal)}</td>
            <td class="num">${money(t.AmountDue)}</td>
            <td class="num">${money(t.CashHandedOver)}</td>
            ${discrepancyCell(t.Discrepancy)}
            <td>${escapeHtml(t.DispatchedBy)}</td>
            <td>${escapeHtml(t.SettledBy)}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="4">Total · ${settled.length} settled${open ? `, ${open} awaiting return (not in totals)` : ''}</td>
          <td class="num">${money(sum('DispatchedTotal'))}</td>
          <td class="num">${money(sum('ReturnedTotal'))}</td>
          <td class="num">${money(sum('AmountDue'))}</td>
          <td class="num">${money(sum('CashHandedOver'))}</td>
          <td class="num">${short > 0 ? `<span class="warn">${money(short)} short</span>` : ''}${short > 0 && excess > 0 ? '<br />' : ''}${excess > 0 ? `${money(excess)} excess` : ''}${short === 0 && excess === 0 ? '₹0' : ''}</td>
          <td colspan="2"></td>
        </tr>
      </tfoot>
    </table>
    </div>
  `;
}
