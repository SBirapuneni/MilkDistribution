import { navHtml, wireNav } from '../components/nav';
import { getMasterData, getTrip } from '../api';
import type { Route, Session, TripWithItems } from '../types';

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
    const { routes } = await getMasterData();
    const activeRoutes = routes.filter((r) => r.Active !== false && String(r.Active).toUpperCase() !== 'FALSE');
    const today = todayStr();

    const statuses = await Promise.all(
      activeRoutes.map(async (route) => ({
        route,
        morning: await getTrip(route.RouteId, today, 'Morning'),
        evening: await getTrip(route.RouteId, today, 'Evening'),
      })),
    );

    cardsEl.innerHTML = statuses.length
      ? statuses.map(({ route, morning, evening }) => renderCard(route, morning, evening)).join('')
      : '<p>No active routes yet. Add one on the Routes page.</p>';
  } catch (err) {
    cardsEl.innerHTML = `<p class="error">Failed to load: ${(err as Error).message}</p>`;
  }
}

function sessionBadge(session: Session, tripData: TripWithItems | null): string {
  let label = 'Not started';
  let cls = 'status-pending';

  if (tripData) {
    if (tripData.trip.Status === 'Dispatched') {
      label = `Awaiting return · ₹${tripData.trip.DispatchedTotal}`;
      cls = 'status-dispatched';
    } else {
      label = `Settled · Due ₹${tripData.trip.AmountDue} · Cash ₹${tripData.trip.CashHandedOver}`;
      cls = 'status-settled';
    }
  }

  return `<span class="session-badge ${cls}"><strong>${session}:</strong> ${label}</span>`;
}

function renderCard(route: Route, morning: TripWithItems | null, evening: TripWithItems | null): string {
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
