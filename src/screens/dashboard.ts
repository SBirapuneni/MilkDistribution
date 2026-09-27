import { navHtml, wireNav } from '../components/nav';
import { getMasterData, getTodayStatus } from '../api';
import type { Route, Session, Trip } from '../types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function renderDashboard(container: HTMLElement) {
  container.innerHTML =
    navHtml('dashboard') +
    '<main class="page"><h1>Today\'s Routes</h1><div id="route-cards">Loading...</div></main>';
  wireNav(container);

  const cardsEl = container.querySelector<HTMLDivElement>('#route-cards')!;

  try {
    const [{ routes }, todayTrips] = await Promise.all([getMasterData(), getTodayStatus(todayStr())]);
    const activeRoutes = routes.filter((r) => r.Active !== false && String(r.Active).toUpperCase() !== 'FALSE');

    const tripByKey = new Map<string, Trip>();
    todayTrips.forEach((t) => tripByKey.set(`${t.RouteId}|${t.Session}`, t));

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
    cardsEl.innerHTML = `<p class="error">Failed to load: ${(err as Error).message}</p>`;
  }
}

function sessionBadge(session: Session, trip: Trip | null): string {
  let label = 'Not started';
  let cls = 'status-pending';

  if (trip) {
    if (trip.Status === 'Dispatched') {
      label = `Awaiting return · ₹${trip.DispatchedTotal}`;
      cls = 'status-dispatched';
    } else {
      label = `Settled · Due ₹${trip.AmountDue} · Cash ₹${trip.CashHandedOver}`;
      cls = 'status-settled';
    }
  }

  return `<span class="session-badge ${cls}"><strong>${session}:</strong> ${label}</span>`;
}

function renderCard(route: Route, morning: Trip | null, evening: Trip | null): string {
  return `
    <a class="route-card" href="#/route/${encodeURIComponent(route.RouteId)}">
      <h2>${route.Name}</h2>
      <p class="villages">${route.Villages || ''}</p>
      <div class="session-status">
        ${sessionBadge('Morning', morning)}
        ${sessionBadge('Evening', evening)}
      </div>
    </a>
  `;
}
