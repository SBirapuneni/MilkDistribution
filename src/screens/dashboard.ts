import { navHtml, wireNav } from '../components/nav';
import { getMasterData, getTodayStatus } from '../api';
import type { Route, Session, Trip } from '../types';
import { escapeHtml, localDateStr, money, moneyRound } from '../util';

export async function renderDashboard(container: HTMLElement) {
  container.innerHTML =
    navHtml('dashboard') +
    '<main class="page"><h1>Today\'s Routes</h1><div id="day-summary"></div><div id="route-cards">Loading...</div></main>';
  wireNav(container);

  const cardsEl = container.querySelector<HTMLDivElement>('#route-cards')!;
  const summaryEl = container.querySelector<HTMLDivElement>('#day-summary')!;

  try {
    const [{ routes }, todayTrips] = await Promise.all([getMasterData(), getTodayStatus(localDateStr())]);
    const activeRoutes = routes.filter((r) => r.Active !== false && String(r.Active).toUpperCase() !== 'FALSE');

    const tripByKey = new Map<string, Trip>();
    todayTrips.forEach((t) => tripByKey.set(`${t.RouteId}|${t.Session}`, t));

    summaryEl.innerHTML = renderDaySummary(todayTrips);
    cardsEl.innerHTML = activeRoutes.length
      ? activeRoutes
          .map((route) =>
            renderCard(
              route,
              tripByKey.get(`${route.RouteId}|Morning`) ?? null,
              tripByKey.get(`${route.RouteId}|Evening`) ?? null,
            ),
          )
          .join('')
      : '<p>No active routes yet. Add one on the Routes page.</p>';
  } catch (err) {
    cardsEl.innerHTML = `<p class="error">Failed to load: ${escapeHtml((err as Error).message)}</p>`;
  }
}

function renderDaySummary(trips: Trip[]): string {
  const dispatched = trips.reduce((s, t) => s + (Number(t.DispatchedTotal) || 0), 0);
  const settled = trips.filter((t) => t.Status === 'Settled');
  const cash = settled.reduce((s, t) => s + (Number(t.CashHandedOver) || 0), 0);
  const awaiting = trips.length - settled.length;
  const short = settled.reduce((s, t) => s + Math.max(0, -(Number(t.Discrepancy) || 0)), 0);
  return `
    <div class="stat-grid compact">
      <div class="stat-card"><p class="stat-label">Sent out today</p><p class="stat-value">${moneyRound(dispatched)}</p></div>
      <div class="stat-card"><p class="stat-label">Cash collected</p><p class="stat-value">${moneyRound(cash)}</p></div>
      <div class="stat-card"><p class="stat-label">Awaiting return</p><p class="stat-value ${awaiting > 0 ? 'pending' : ''}">${awaiting} trip${awaiting === 1 ? '' : 's'}</p></div>
      <div class="stat-card"><p class="stat-label">Cash short</p><p class="stat-value ${short > 0 ? 'warn' : ''}">${money(short)}</p></div>
    </div>
  `;
}

function sessionBadge(route: Route, session: Session, trip: Trip | null): string {
  let label = 'Not started';
  let cls = 'status-pending';

  if (trip) {
    if (trip.Status === 'Dispatched') {
      label = `Awaiting return · ${money(trip.DispatchedTotal)}`;
      cls = 'status-dispatched';
    } else {
      const disc = Number(trip.Discrepancy) || 0;
      const discText =
        disc < 0 ? ` · <span class="warn">short ${money(-disc)}</span>` : disc > 0 ? ` · excess ${money(disc)}` : '';
      label = `Settled · Due ${money(trip.AmountDue)} · Cash ${money(trip.CashHandedOver)}${discText}`;
      cls = disc < 0 ? 'status-short' : 'status-settled';
    }
  }

  const href = `#/route/${encodeURIComponent(route.RouteId)}/${session}`;
  return `<a class="session-badge ${cls}" href="${href}"><strong>${session}:</strong> <span>${label}</span></a>`;
}

function renderCard(route: Route, morning: Trip | null, evening: Trip | null): string {
  return `
    <div class="route-card">
      <h2><a href="#/route/${encodeURIComponent(route.RouteId)}">${escapeHtml(route.Name)}</a></h2>
      <p class="villages">${escapeHtml(route.Villages)}</p>
      <div class="session-status">
        ${sessionBadge(route, 'Morning', morning)}
        ${sessionBadge(route, 'Evening', evening)}
      </div>
    </div>
  `;
}
