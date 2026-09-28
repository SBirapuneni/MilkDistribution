import type {
  Analytics,
  AnalyticsByDate,
  AnalyticsByDriver,
  AnalyticsByProduct,
  AnalyticsByRoute,
  AnalyticsBySession,
  MasterData,
  Product,
  Route,
  Session,
  Trip,
  TripItem,
  TripWithItems,
} from './types';

const products: Product[] = [
  { ProductId: 'P1', Name: 'Whole Milk', Unit: 'litre', Price: 60, Active: true },
  { ProductId: 'P2', Name: 'Toned Milk', Unit: 'litre', Price: 52, Active: true },
  { ProductId: 'P3', Name: 'Curd', Unit: 'packet (500g)', Price: 40, Active: true },
];

const routes: Route[] = [
  { RouteId: 'R1', Name: 'Route 1', Villages: 'Ashokapuram, Rampur', DefaultVehicle: 'KA-01-AB-1234', DefaultDriver: 'Ramesh', Active: true },
  { RouteId: 'R2', Name: 'Route 2', Villages: 'Gopalpur, Krishnanagar', DefaultVehicle: 'KA-01-AB-2345', DefaultDriver: 'Suresh', Active: true },
  { RouteId: 'R3', Name: 'Route 3', Villages: 'Lakshmipuram', DefaultVehicle: 'KA-01-AB-3456', DefaultDriver: 'Manoj', Active: true },
  { RouteId: 'R4', Name: 'Route 4', Villages: 'Devipuram, Shivapur', DefaultVehicle: 'KA-01-AB-4567', DefaultDriver: 'Vijay', Active: true },
  { RouteId: 'R5', Name: 'Route 5', Villages: 'Anandpur', DefaultVehicle: 'KA-01-AB-5678', DefaultDriver: 'Ganesh', Active: true },
];

export const DEMO_ADMIN_PASSCODE = 'admin';

const trips: Trip[] = [];
const tripItems: TripItem[] = [];

function newId(prefix: string): string {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

export async function getMasterData(): Promise<MasterData> {
  return { products: [...products], routes: [...routes] };
}

export async function saveProduct(payload: {
  productId?: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
}): Promise<{ productId: string }> {
  if (!payload.name) throw new Error('Product name is required');
  if (payload.productId) {
    const existing = products.find((p) => p.ProductId === payload.productId);
    if (!existing) throw new Error('Product not found');
    existing.Name = payload.name;
    existing.Unit = payload.unit;
    existing.Price = payload.price;
    existing.Active = payload.active;
    return { productId: existing.ProductId };
  }
  const id = newId('P');
  products.push({ ProductId: id, Name: payload.name, Unit: payload.unit, Price: payload.price, Active: payload.active });
  return { productId: id };
}

export async function saveRoute(payload: {
  routeId?: string;
  name: string;
  villages: string;
  defaultVehicle: string;
  defaultDriver: string;
  active: boolean;
}): Promise<{ routeId: string }> {
  if (!payload.name) throw new Error('Route name is required');
  if (payload.routeId) {
    const existing = routes.find((r) => r.RouteId === payload.routeId);
    if (!existing) throw new Error('Route not found');
    existing.Name = payload.name;
    existing.Villages = payload.villages;
    existing.DefaultVehicle = payload.defaultVehicle;
    existing.DefaultDriver = payload.defaultDriver;
    existing.Active = payload.active;
    return { routeId: existing.RouteId };
  }
  const id = newId('R');
  routes.push({
    RouteId: id,
    Name: payload.name,
    Villages: payload.villages,
    DefaultVehicle: payload.defaultVehicle,
    DefaultDriver: payload.defaultDriver,
    Active: payload.active,
  });
  return { routeId: id };
}

export async function getTrip(routeId: string, date: string, session: Session): Promise<TripWithItems | null> {
  const trip = trips.find((t) => t.RouteId === routeId && t.Date === date && t.Session === session);
  if (!trip) return null;
  const items = tripItems.filter((i) => i.TripId === trip.TripId);
  return { trip: { ...trip }, items: items.map((i) => ({ ...i })) };
}

export async function getLastTrip(routeId: string, session: Session, beforeDate: string): Promise<TripWithItems | null> {
  const last = trips
    .filter((t) => t.RouteId === routeId && t.Session === session && t.Date < beforeDate)
    .sort((a, b) => b.Date.localeCompare(a.Date))[0];
  return last ? getTrip(last.RouteId, last.Date, last.Session) : null;
}

export async function dispatchTrip(payload: {
  routeId: string;
  date: string;
  session: Session;
  driver: string;
  vehicle: string;
  items: { productId: string; qty: number }[];
}, user: string): Promise<TripWithItems> {
  const existing = await getTrip(payload.routeId, payload.date, payload.session);
  if (existing) throw new Error('This route already has a ' + payload.session + ' trip for ' + payload.date);

  const tripId = newId('T');
  let dispatchedTotal = 0;
  const newItems: TripItem[] = [];

  payload.items.forEach((item) => {
    if (item.qty <= 0) return;
    const product = products.find((p) => p.ProductId === item.productId);
    if (!product) throw new Error('Unknown product: ' + item.productId);
    const value = item.qty * product.Price;
    dispatchedTotal += value;
    newItems.push({
      TripItemId: newId('TI'),
      TripId: tripId,
      ProductId: item.productId,
      Price: product.Price,
      QtyDispatched: item.qty,
      QtyReturned: 0,
      DispatchedValue: value,
      ReturnedValue: 0,
    });
  });

  if (newItems.length === 0) throw new Error('At least one product with quantity is required');

  trips.push({
    TripId: tripId,
    Date: payload.date,
    Session: payload.session,
    RouteId: payload.routeId,
    Driver: payload.driver,
    Vehicle: payload.vehicle,
    Status: 'Dispatched',
    DispatchedTotal: dispatchedTotal,
    ReturnedTotal: '',
    AmountDue: '',
    CashHandedOver: '',
    Discrepancy: '',
    CreatedAt: new Date().toISOString(),
    SettledAt: '',
    DispatchedBy: user,
  });
  tripItems.push(...newItems);

  return (await getTrip(payload.routeId, payload.date, payload.session))!;
}

function applyReturns(
  trip: Trip,
  payload: { tripId: string; items: { productId: string; qtyReturned: number }[]; cashHandedOver: number },
  finalize: boolean,
  user: string,
) {
  const items = tripItems.filter((i) => i.TripId === payload.tripId);
  const returnMap = new Map(payload.items.map((i) => [i.productId, i.qtyReturned]));

  items.forEach((item) => {
    const qtyReturned = returnMap.get(item.ProductId) || 0;
    if (qtyReturned < 0) throw new Error('Returned qty cannot be negative for product ' + item.ProductId);
    if (qtyReturned > item.QtyDispatched) {
      throw new Error('Returned qty exceeds dispatched qty for product ' + item.ProductId);
    }
  });

  let returnedTotal = 0;
  items.forEach((item) => {
    const qtyReturned = returnMap.get(item.ProductId) || 0;
    item.QtyReturned = qtyReturned;
    item.ReturnedValue = qtyReturned * item.Price;
    returnedTotal += item.ReturnedValue;
  });

  const dispatchedTotal = Number(trip.DispatchedTotal);
  const amountDue = dispatchedTotal - returnedTotal;
  const cashHandedOver = Number(payload.cashHandedOver) || 0;

  trip.Status = finalize ? 'Settled' : 'Dispatched';
  trip.ReturnedTotal = returnedTotal;
  trip.AmountDue = amountDue;
  trip.CashHandedOver = cashHandedOver;
  trip.Discrepancy = cashHandedOver - amountDue;
  trip.SettledAt = finalize ? new Date().toISOString() : '';
  trip.SettledBy = finalize ? user : '';
}

export async function saveTripProgress(payload: {
  tripId: string;
  items: { productId: string; qtyReturned: number }[];
  cashHandedOver: number;
}): Promise<TripWithItems> {
  const trip = trips.find((t) => t.TripId === payload.tripId);
  if (!trip) throw new Error('Trip not found');
  if (trip.Status === 'Settled') throw new Error('Trip already settled');
  applyReturns(trip, payload, false, '');
  return (await getTrip(trip.RouteId, trip.Date, trip.Session))!;
}

export async function settleTrip(payload: {
  tripId: string;
  items: { productId: string; qtyReturned: number }[];
  cashHandedOver: number;
}, user: string): Promise<TripWithItems> {
  const trip = trips.find((t) => t.TripId === payload.tripId);
  if (!trip) throw new Error('Trip not found');
  if (trip.Status === 'Settled') throw new Error('Trip already settled');
  applyReturns(trip, payload, true, user);

  return (await getTrip(trip.RouteId, trip.Date, trip.Session))!;
}

export async function reopenTrip(payload: { tripId: string; adminToken: string }, user: string): Promise<TripWithItems> {
  if (payload.adminToken !== DEMO_ADMIN_PASSCODE) throw new Error('Incorrect admin passcode');
  const trip = trips.find((t) => t.TripId === payload.tripId);
  if (!trip) throw new Error('Trip not found');
  if (trip.Status !== 'Settled') throw new Error('Trip is not settled');
  trip.Status = 'Dispatched';
  trip.SettledAt = '';
  trip.SettledBy = '';
  trip.ReopenedBy = user;
  trip.ReopenedAt = new Date().toISOString();
  return (await getTrip(trip.RouteId, trip.Date, trip.Session))!;
}

export async function listTrips(
  payload: { routeId?: string; dateFrom?: string; dateTo?: string } = {},
): Promise<Trip[]> {
  const routeMap = new Map(routes.map((r) => [r.RouteId, r.Name]));
  return trips
    .filter((t) => {
      if (payload.routeId && t.RouteId !== payload.routeId) return false;
      if (payload.dateFrom && t.Date < payload.dateFrom) return false;
      if (payload.dateTo && t.Date > payload.dateTo) return false;
      return true;
    })
    .sort((a, b) => b.Date.localeCompare(a.Date))
    .map((t) => ({ ...t, RouteName: routeMap.get(t.RouteId) || t.RouteId }));
}

export async function getTodayStatus(date: string): Promise<Trip[]> {
  return trips.filter((t) => t.Date === date).map((t) => ({ ...t }));
}

export async function getAnalytics(payload: { dateFrom?: string; dateTo?: string } = {}): Promise<Analytics> {
  const settled = trips.filter((t) => {
    if (t.Status !== 'Settled') return false;
    if (payload.dateFrom && t.Date < payload.dateFrom) return false;
    if (payload.dateTo && t.Date > payload.dateTo) return false;
    return true;
  });

  const routeMap = new Map(routes.map((r) => [r.RouteId, r.Name]));
  const productMap = new Map(products.map((p) => [p.ProductId, p.Name]));
  const tripIdSet = new Set(settled.map((t) => t.TripId));
  const items = tripItems.filter((i) => tripIdSet.has(i.TripId));

  let totalDispatched = 0;
  let totalReturned = 0;
  let totalCash = 0;
  let totalDiscrepancy = 0;
  let totalShortage = 0;
  let totalExcess = 0;

  const byDateMap = new Map<string, AnalyticsByDate>();
  const byRouteMap = new Map<string, AnalyticsByRoute>();
  const byDriverMap = new Map<string, AnalyticsByDriver>();
  const bySessionMap = new Map<Session, AnalyticsBySession>([
    ['Morning', { session: 'Morning', dispatched: 0, returned: 0, tripCount: 0, revenue: 0 }],
    ['Evening', { session: 'Evening', dispatched: 0, returned: 0, tripCount: 0, revenue: 0 }],
  ]);

  settled.forEach((t) => {
    const dispatched = Number(t.DispatchedTotal) || 0;
    const returned = Number(t.ReturnedTotal) || 0;
    const discrepancy = Number(t.Discrepancy) || 0;
    const cash = Number(t.CashHandedOver) || 0;
    const shortage = discrepancy < 0 ? -discrepancy : 0;
    const excess = discrepancy > 0 ? discrepancy : 0;

    totalDispatched += dispatched;
    totalReturned += returned;
    totalCash += cash;
    totalDiscrepancy += discrepancy;
    totalShortage += shortage;
    totalExcess += excess;

    if (!byDateMap.has(t.Date)) {
      byDateMap.set(t.Date, { date: t.Date, dispatched: 0, returned: 0, cash: 0, discrepancy: 0, shortage: 0, tripCount: 0, revenue: 0 });
    }
    const byDate = byDateMap.get(t.Date)!;
    byDate.dispatched += dispatched;
    byDate.returned += returned;
    byDate.discrepancy += discrepancy;
    byDate.shortage += shortage;
    byDate.cash += cash;
    byDate.tripCount += 1;
    byDate.revenue = byDate.dispatched - byDate.returned;

    if (!byRouteMap.has(t.RouteId)) {
      byRouteMap.set(t.RouteId, {
        routeId: t.RouteId,
        routeName: routeMap.get(t.RouteId) || t.RouteId,
        dispatched: 0,
        returned: 0,
        discrepancy: 0,
        shortage: 0,
        excess: 0,
        tripCount: 0,
        revenue: 0,
      });
    }
    const byRoute = byRouteMap.get(t.RouteId)!;
    byRoute.dispatched += dispatched;
    byRoute.returned += returned;
    byRoute.discrepancy += discrepancy;
    byRoute.shortage += shortage;
    byRoute.excess += excess;
    byRoute.tripCount += 1;
    byRoute.revenue = byRoute.dispatched - byRoute.returned;

    const driver = t.Driver.trim() || '(no driver)';
    if (!byDriverMap.has(driver)) {
      byDriverMap.set(driver, { driver, tripCount: 0, shortTrips: 0, shortage: 0, excess: 0, discrepancy: 0 });
    }
    const byDriver = byDriverMap.get(driver)!;
    byDriver.tripCount += 1;
    if (shortage > 0) byDriver.shortTrips += 1;
    byDriver.shortage += shortage;
    byDriver.excess += excess;
    byDriver.discrepancy += discrepancy;

    const bySession = bySessionMap.get(t.Session);
    if (bySession) {
      bySession.dispatched += dispatched;
      bySession.returned += returned;
      bySession.tripCount += 1;
      bySession.revenue = bySession.dispatched - bySession.returned;
    }
  });

  const byProductMap = new Map<string, AnalyticsByProduct>();
  items.forEach((i) => {
    if (!byProductMap.has(i.ProductId)) {
      byProductMap.set(i.ProductId, {
        productId: i.ProductId,
        productName: productMap.get(i.ProductId) || i.ProductId,
        qtyDispatched: 0,
        qtyReturned: 0,
        dispatchedValue: 0,
        returnedValue: 0,
        revenue: 0,
        returnRate: 0,
      });
    }
    const p = byProductMap.get(i.ProductId)!;
    p.qtyDispatched += i.QtyDispatched;
    p.qtyReturned += i.QtyReturned;
    p.dispatchedValue += i.DispatchedValue;
    p.returnedValue += i.ReturnedValue;
    p.revenue = p.dispatchedValue - p.returnedValue;
    p.returnRate = p.qtyDispatched > 0 ? p.qtyReturned / p.qtyDispatched : 0;
  });

  return {
    summary: {
      totalDispatched,
      totalReturned,
      totalRevenue: totalDispatched - totalReturned,
      totalCash,
      totalDiscrepancy,
      totalShortage,
      totalExcess,
      tripCount: settled.length,
    },
    byDate: Array.from(byDateMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    byRoute: Array.from(byRouteMap.values()).sort((a, b) => b.revenue - a.revenue),
    byDriver: Array.from(byDriverMap.values()).sort((a, b) => b.shortage - a.shortage || b.excess - a.excess),
    bySession: Array.from(bySessionMap.values()),
    byProduct: Array.from(byProductMap.values()).sort((a, b) => b.revenue - a.revenue),
  };
}
