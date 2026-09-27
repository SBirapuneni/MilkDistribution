import { navHtml, wireNav } from '../components/nav';
import { dispatchTrip, getMasterData, getTrip, saveTripProgress, settleTrip } from '../api';
import type { Product, Route, Session, TripWithItems } from '../types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultSession(): Session {
  return new Date().getHours() < 15 ? 'Morning' : 'Evening';
}

export async function renderRouteScreen(container: HTMLElement, routeId: string) {
  container.innerHTML = navHtml('dashboard') + '<main class="page"><p>Loading...</p></main>';
  wireNav(container);

  const main = container.querySelector<HTMLElement>('main')!;

  try {
    const { products, routes } = await getMasterData();
    const route = routes.find((r) => r.RouteId === routeId);
    if (!route) {
      main.innerHTML = '<p class="error">Route not found.</p>';
      return;
    }

    const activeProducts = products.filter((p) => p.Active !== false && String(p.Active).toUpperCase() !== 'FALSE');
    const productMap = new Map(products.map((p) => [p.ProductId, p]));

    // Holds a save function for whatever settle form is currently on screen, so
    // navigating away (dashboard, other tabs, switching date/session) can flush
    // unsaved return-quantity/cash entries instead of silently discarding them.
    let pendingSave: (() => Promise<void>) | null = null;

    async function flushPendingSave() {
      if (!pendingSave) return;
      const save = pendingSave;
      pendingSave = null;
      try {
        await save();
      } catch {
        // Best-effort: don't block navigation if the save fails.
      }
    }

    container.addEventListener(
      'click',
      (e) => {
        const link = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
        if (!link || !pendingSave) return;
        e.preventDefault();
        const href = link.getAttribute('href')!;
        flushPendingSave().then(() => {
          window.location.hash = href;
        });
      },
      { capture: true },
    );

    async function load(date: string, session: Session) {
      main.innerHTML = '<p>Loading...</p>';
      const tripData = await getTrip(routeId, date, session);
      renderContent(date, session, tripData);
    }

    function renderContent(date: string, session: Session, tripData: TripWithItems | null) {
      pendingSave = null;

      main.innerHTML = `
        <a href="#/" class="back-link">&larr; Back to dashboard</a>
        <h1>${route!.Name}</h1>
        <p class="villages">${route!.Villages || ''}</p>
        <div class="field-row">
          <label>Date <input type="date" id="date-input" value="${date}" /></label>
        </div>
        <div class="session-tabs">
          <button type="button" class="session-tab ${session === 'Morning' ? 'active' : ''}" data-session="Morning">Morning</button>
          <button type="button" class="session-tab ${session === 'Evening' ? 'active' : ''}" data-session="Evening">Evening</button>
        </div>
        <div id="trip-body"></div>
      `;

      main.querySelector<HTMLInputElement>('#date-input')!.addEventListener('change', async (e) => {
        const newDate = (e.target as HTMLInputElement).value;
        await flushPendingSave();
        load(newDate, session);
      });

      main.querySelectorAll<HTMLButtonElement>('.session-tab').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const newSession = btn.dataset.session as Session;
          await flushPendingSave();
          load(date, newSession);
        });
      });

      const tripBody = main.querySelector<HTMLDivElement>('#trip-body')!;

      if (!tripData) {
        tripBody.innerHTML = renderDispatchForm(route!, activeProducts);
        wireDispatchForm(tripBody, routeId, date, session, () => load(date, session));
      } else if (tripData.trip.Status === 'Dispatched') {
        tripBody.innerHTML = renderSettleForm(tripData, productMap);
        pendingSave = wireSettleForm(tripBody, tripData, () => load(date, session));
      } else {
        tripBody.innerHTML = renderSettled(tripData, productMap);
      }
    }

    await load(todayStr(), defaultSession());
  } catch (err) {
    main.innerHTML = `<p class="error">Failed to load: ${(err as Error).message}</p>`;
  }
}

function renderDispatchForm(route: Route, products: Product[]): string {
  if (products.length === 0) {
    return '<p>No active products. Add some on the Products page before dispatching.</p>';
  }

  return `
    <form id="dispatch-form">
      <div class="field-row">
        <label>Driver <input type="text" name="driver" value="${route.DefaultDriver || ''}" required /></label>
        <label>Vehicle <input type="text" name="vehicle" value="${route.DefaultVehicle || ''}" required /></label>
      </div>
      <table class="line-items">
        <thead><tr><th>Product</th><th>Price</th><th>Qty dispatched</th><th>Value</th></tr></thead>
        <tbody>
          ${products
            .map(
              (p) => `
            <tr data-product-id="${p.ProductId}" data-price="${p.Price}">
              <td>${p.Name} <span class="unit">(${p.Unit})</span></td>
              <td>₹${p.Price}</td>
              <td><input type="number" min="0" step="any" class="qty-input" value="0" /></td>
              <td class="line-total">₹0.00</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      <p class="grand-total">Total: ₹<span id="dispatch-total">0.00</span></p>
      <button type="submit">Dispatch</button>
      <p id="dispatch-error" class="error"></p>
    </form>
  `;
}

function wireDispatchForm(
  container: HTMLElement,
  routeId: string,
  date: string,
  session: Session,
  onDone: () => void,
) {
  const form = container.querySelector<HTMLFormElement>('#dispatch-form');
  if (!form) return;

  const rows = Array.from(form.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const totalEl = form.querySelector<HTMLSpanElement>('#dispatch-total')!;
  const errorEl = form.querySelector<HTMLParagraphElement>('#dispatch-error')!;

  function recalc() {
    let total = 0;
    rows.forEach((row) => {
      const price = Number(row.dataset.price);
      const qty = Number(row.querySelector<HTMLInputElement>('.qty-input')!.value) || 0;
      const value = price * qty;
      row.querySelector<HTMLTableCellElement>('.line-total')!.textContent = `₹${value.toFixed(2)}`;
      total += value;
    });
    totalEl.textContent = total.toFixed(2);
  }

  rows.forEach((row) => row.querySelector('.qty-input')!.addEventListener('input', recalc));
  recalc();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const driver = (form.querySelector('[name="driver"]') as HTMLInputElement).value;
    const vehicle = (form.querySelector('[name="vehicle"]') as HTMLInputElement).value;
    const items = rows
      .map((row) => ({
        productId: row.dataset.productId!,
        qty: Number(row.querySelector<HTMLInputElement>('.qty-input')!.value) || 0,
      }))
      .filter((i) => i.qty > 0);

    if (items.length === 0) {
      errorEl.textContent = 'Enter a quantity for at least one product.';
      return;
    }

    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submitBtn.disabled = true;
    try {
      await dispatchTrip({ routeId, date, session, driver, vehicle, items });
      onDone();
    } catch (err) {
      errorEl.textContent = (err as Error).message;
      submitBtn.disabled = false;
    }
  });
}

function renderSettleForm(tripData: TripWithItems, productMap: Map<string, Product>): string {
  const { trip, items } = tripData;
  return `
    <div class="trip-summary">
      <p>Driver: ${trip.Driver} · Vehicle: ${trip.Vehicle}</p>
      <p>Dispatched total: ₹${trip.DispatchedTotal}</p>
    </div>
    <form id="settle-form">
      <table class="line-items">
        <thead><tr><th>Product</th><th>Dispatched</th><th>Returned</th><th>Returned value</th></tr></thead>
        <tbody>
          ${items
            .map(
              (i) => `
            <tr data-product-id="${i.ProductId}" data-price="${i.Price}">
              <td>${productMap.get(i.ProductId)?.Name ?? i.ProductId}</td>
              <td>${i.QtyDispatched}</td>
              <td><input type="number" min="0" max="${i.QtyDispatched}" step="any" class="qty-returned" value="${i.QtyReturned || 0}" /></td>
              <td class="return-value">₹0.00</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      <p>Returned total: ₹<span id="returned-total">0.00</span></p>
      <p>Amount due: ₹<span id="amount-due">${Number(trip.DispatchedTotal).toFixed(2)}</span></p>
      <div class="field-row">
        <label>Cash handed over <input type="number" min="0" step="0.01" id="cash-input" value="${trip.CashHandedOver || 0}" /></label>
      </div>
      <p>Discrepancy: ₹<span id="discrepancy">0.00</span></p>
      <div class="field-row">
        <button type="button" id="save-progress-btn">Save</button>
        <button type="submit">Settle</button>
      </div>
      <p id="settle-status"></p>
    </form>
  `;
}

function wireSettleForm(
  container: HTMLElement,
  tripData: TripWithItems,
  onDone: () => void,
): () => Promise<void> {
  const form = container.querySelector<HTMLFormElement>('#settle-form');
  if (!form) return async () => {};

  const rows = Array.from(form.querySelectorAll<HTMLTableRowElement>('tbody tr'));
  const returnedTotalEl = form.querySelector<HTMLSpanElement>('#returned-total')!;
  const amountDueEl = form.querySelector<HTMLSpanElement>('#amount-due')!;
  const discrepancyEl = form.querySelector<HTMLSpanElement>('#discrepancy')!;
  const cashInput = form.querySelector<HTMLInputElement>('#cash-input')!;
  const statusEl = form.querySelector<HTMLParagraphElement>('#settle-status')!;
  const saveBtn = form.querySelector<HTMLButtonElement>('#save-progress-btn')!;
  const settleBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const dispatchedTotal = Number(tripData.trip.DispatchedTotal);

  function currentInputs() {
    const items = rows.map((row) => ({
      productId: row.dataset.productId!,
      qtyReturned: Number(row.querySelector<HTMLInputElement>('.qty-returned')!.value) || 0,
    }));
    const cashHandedOver = Number(cashInput.value) || 0;
    return { items, cashHandedOver };
  }

  function recalc() {
    let returnedTotal = 0;
    rows.forEach((row) => {
      const price = Number(row.dataset.price);
      const qty = Number(row.querySelector<HTMLInputElement>('.qty-returned')!.value) || 0;
      const value = price * qty;
      row.querySelector<HTMLTableCellElement>('.return-value')!.textContent = `₹${value.toFixed(2)}`;
      returnedTotal += value;
    });
    const amountDue = dispatchedTotal - returnedTotal;
    returnedTotalEl.textContent = returnedTotal.toFixed(2);
    amountDueEl.textContent = amountDue.toFixed(2);
    const cash = Number(cashInput.value) || 0;
    discrepancyEl.textContent = (cash - amountDue).toFixed(2);
  }

  rows.forEach((row) => row.querySelector('.qty-returned')!.addEventListener('input', recalc));
  cashInput.addEventListener('input', recalc);
  recalc();

  async function saveCurrent(): Promise<void> {
    const { items, cashHandedOver } = currentInputs();
    await saveTripProgress({ tripId: tripData.trip.TripId, items, cashHandedOver });
  }

  saveBtn.addEventListener('click', async () => {
    statusEl.textContent = '';
    statusEl.className = '';
    saveBtn.disabled = true;
    settleBtn.disabled = true;
    try {
      await saveCurrent();
      statusEl.textContent = 'Progress saved.';
      statusEl.className = 'ok';
    } catch (err) {
      statusEl.textContent = (err as Error).message;
      statusEl.className = 'error';
    } finally {
      saveBtn.disabled = false;
      settleBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    statusEl.className = '';

    const { items, cashHandedOver } = currentInputs();

    saveBtn.disabled = true;
    settleBtn.disabled = true;
    try {
      await settleTrip({ tripId: tripData.trip.TripId, items, cashHandedOver });
      onDone();
    } catch (err) {
      statusEl.textContent = (err as Error).message;
      statusEl.className = 'error';
      saveBtn.disabled = false;
      settleBtn.disabled = false;
    }
  });

  return saveCurrent;
}

function renderSettled(tripData: TripWithItems, productMap: Map<string, Product>): string {
  const { trip, items } = tripData;
  return `
    <div class="trip-summary settled">
      <p>Driver: ${trip.Driver} · Vehicle: ${trip.Vehicle}</p>
      <table class="line-items">
        <thead><tr><th>Product</th><th>Dispatched</th><th>Returned</th></tr></thead>
        <tbody>
          ${items
            .map(
              (i) => `
            <tr>
              <td>${productMap.get(i.ProductId)?.Name ?? i.ProductId}</td>
              <td>${i.QtyDispatched}</td>
              <td>${i.QtyReturned}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
      <p>Dispatched total: ₹${trip.DispatchedTotal}</p>
      <p>Returned total: ₹${trip.ReturnedTotal}</p>
      <p>Amount due: ₹${trip.AmountDue}</p>
      <p>Cash handed over: ₹${trip.CashHandedOver}</p>
      <p class="${Number(trip.Discrepancy) === 0 ? 'ok' : 'warn'}">Discrepancy: ₹${trip.Discrepancy}</p>
    </div>
  `;
}
