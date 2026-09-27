import { navHtml, wireNav } from '../components/nav';
import { getAnalytics } from '../api';
import {
  assignColors,
  attachTooltips,
  escapeHtml,
  renderDonutChart,
  renderGroupedBars,
  renderLineChart,
  renderSplitBar,
} from '../charts';
import type { Analytics, AnalyticsByProduct, AnalyticsByRoute } from '../types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function money(n: number): string {
  return `₹${n.toFixed(2)}`;
}

function count(n: number): string {
  return String(Math.round(n));
}

export async function renderAnalytics(container: HTMLElement) {
  container.innerHTML =
    navHtml('analytics') +
    `
    <main class="page">
      <h1>Analytics</h1>
      <div class="field-row">
        <label>From <input type="date" id="date-from" value="${daysAgoStr(30)}" /></label>
        <label>To <input type="date" id="date-to" value="${todayStr()}" /></label>
      </div>
      <div id="analytics-content">Loading...</div>
    </main>
  `;
  wireNav(container);

  const content = container.querySelector<HTMLDivElement>('#analytics-content')!;
  const dateFrom = container.querySelector<HTMLInputElement>('#date-from')!;
  const dateTo = container.querySelector<HTMLInputElement>('#date-to')!;

  async function load() {
    content.innerHTML = 'Loading...';
    try {
      const data = await getAnalytics({ dateFrom: dateFrom.value || undefined, dateTo: dateTo.value || undefined });
      content.innerHTML = renderContent(data);
      attachTooltips(content);
    } catch (err) {
      content.innerHTML = `<p class="error">Failed to load: ${(err as Error).message}</p>`;
    }
  }

  [dateFrom, dateTo].forEach((el) => el.addEventListener('change', load));
  await load();
}

function renderContent(data: Analytics): string {
  if (data.summary.tripCount === 0) {
    return '<p>No settled trips in this date range yet. Numbers fill in once a Morning/Evening trip is settled.</p>';
  }

  return `
    ${renderSummary(data)}

    <h2>Revenue trend</h2>
    ${renderLineChart(
      data.byDate.map((d) => ({ x: d.date, y: d.revenue, extra: `${d.tripCount} trip${d.tripCount === 1 ? '' : 's'}` })),
      'var(--series-1)',
      money,
    )}

    <h2>Trips per day</h2>
    ${renderLineChart(
      data.byDate.map((d) => ({ x: d.date, y: d.tripCount })),
      'var(--series-6)',
      count,
    )}

    <h2>Revenue by route</h2>
    ${renderRouteSection(data.byRoute)}

    <h2>Revenue by product</h2>
    ${renderProductRevenueSection(data.byProduct)}

    <h2>Dispatched vs returned by product</h2>
    ${renderGroupedBars(
      data.byProduct.map((p) => ({ label: p.productName, a: p.qtyDispatched, b: p.qtyReturned })),
      { aLabel: 'Dispatched', bLabel: 'Returned', aColor: 'var(--series-1)', bColor: 'var(--series-2)', formatValue: count },
    )}
    ${renderProductTable(data.byProduct)}

    <h2>Morning vs Evening</h2>
    ${renderSessionSection(data)}
  `;
}

function renderSummary(data: Analytics): string {
  const { summary } = data;
  const discClass = summary.totalDiscrepancy === 0 ? 'ok' : 'warn';
  const avgPerTrip = summary.tripCount > 0 ? summary.totalRevenue / summary.tripCount : 0;
  return `
    <div class="stat-grid">
      <div class="stat-card">
        <p class="stat-label">Total revenue</p>
        <p class="stat-value">${money(summary.totalRevenue)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Cash collected</p>
        <p class="stat-value">${money(summary.totalCash)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Discrepancy</p>
        <p class="stat-value ${discClass}">${money(summary.totalDiscrepancy)}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Trips settled</p>
        <p class="stat-value">${summary.tripCount}</p>
      </div>
      <div class="stat-card">
        <p class="stat-label">Avg revenue / trip</p>
        <p class="stat-value">${money(avgPerTrip)}</p>
      </div>
    </div>
  `;
}

function renderBarList(rows: { label: string; value: number; sub?: string; color?: string }[]): string {
  if (rows.length === 0) return '<p class="muted">No data.</p>';
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  return `
    <div class="bar-list">
      ${rows
        .map((r) => {
          const pct = Math.max(2, (Math.abs(r.value) / max) * 100);
          const bg = r.value < 0 ? 'var(--color-danger)' : r.color || 'var(--series-1)';
          return `
            <div class="bar-row">
              <div class="bar-label">${escapeHtml(r.label)}</div>
              <div class="bar-track"><div class="bar-fill" style="width: ${pct}%; background: ${bg}" data-tooltip="${escapeHtml(r.label)}: ${escapeHtml(`₹${r.value.toFixed(2)}`)}${r.sub ? ' · ' + escapeHtml(r.sub) : ''}"></div></div>
              <div class="bar-value">₹${r.value.toFixed(2)}${r.sub ? ` <span class="bar-sub">· ${r.sub}</span>` : ''}</div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

// A donut is only meaningful as a quick part-to-whole read for 3+ segments —
// for fewer, the bar ranking alone is clearer (see dataviz anti-patterns).
function renderRouteSection(routes: AnalyticsByRoute[]): string {
  if (routes.length === 0) return '<p class="muted">No data.</p>';
  const colorMap = assignColors(routes.map((r) => r.routeName));
  const bars = renderBarList(
    routes.map((r) => ({
      label: r.routeName,
      value: r.revenue,
      sub: `${r.tripCount} trip${r.tripCount === 1 ? '' : 's'}` + (r.discrepancy !== 0 ? ` · discrepancy ₹${r.discrepancy.toFixed(2)}` : ''),
      color: colorMap.get(r.routeName),
    })),
  );
  if (routes.length < 3) return bars;

  const donut = renderDonutChart(
    routes.map((r) => ({ label: r.routeName, value: r.revenue, color: colorMap.get(r.routeName)! })),
    money,
  );
  return `<div class="chart-grid">${bars}${donut}</div>`;
}

function renderProductRevenueSection(products: AnalyticsByProduct[]): string {
  if (products.length === 0) return '<p class="muted">No data.</p>';
  const colorMap = assignColors(products.map((p) => p.productName));
  const bars = renderBarList(
    products.map((p) => ({
      label: p.productName,
      value: p.revenue,
      color: colorMap.get(p.productName),
    })),
  );
  if (products.length < 3) return bars;

  const donut = renderDonutChart(
    products.map((p) => ({ label: p.productName, value: p.revenue, color: colorMap.get(p.productName)! })),
    money,
  );
  return `<div class="chart-grid">${bars}${donut}</div>`;
}

function renderSessionSection(data: Analytics): string {
  const bars = renderBarList(
    data.bySession.map((s) => ({
      label: s.session,
      value: s.revenue,
      sub: `${s.tripCount} trip${s.tripCount === 1 ? '' : 's'}`,
      color: s.session === 'Morning' ? 'var(--series-1)' : 'var(--series-2)',
    })),
  );
  const split = renderSplitBar(
    data.bySession.map((s) => ({
      label: s.session,
      value: s.revenue,
      color: s.session === 'Morning' ? 'var(--series-1)' : 'var(--series-2)',
    })),
    money,
  );
  return `${bars}${split}`;
}

function renderProductTable(products: AnalyticsByProduct[]): string {
  if (products.length === 0) return '<p class="muted">No data.</p>';
  return `
    <table class="line-items">
      <thead><tr><th>Product</th><th>Dispatched qty</th><th>Returned qty</th><th>Return rate</th><th>Revenue</th></tr></thead>
      <tbody>
        ${products
          .map(
            (p) => `
          <tr>
            <td>${escapeHtml(p.productName)}</td>
            <td>${p.qtyDispatched}</td>
            <td>${p.qtyReturned}</td>
            <td class="${p.returnRate > 0.2 ? 'warn' : ''}">${(p.returnRate * 100).toFixed(0)}%</td>
            <td>₹${p.revenue.toFixed(2)}</td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `;
}
