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
  RouteDay,
  Session,
  Trip,
  TripItem,
  TripWithItems,
} from './types';
import type { DashboardData, Indent, Shop, ShopHome, ShopSlot } from './types';
import { addDays, localDateStr } from './util';

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

// Demo shops. In demo mode PINs are kept in plain text; the real backend
// stores only a salted hash.
export const DEMO_SHOPS = [
  { phone: '9000000001', pin: '111111' },
  { phone: '9000000002', pin: '222222' },
  { phone: '9000000003', pin: '333333' },
];
const shops: (Shop & { pin: string })[] = [
  { ShopId: 'S1', Name: 'Lakshmi Stores', OwnerName: 'Ravi', Phone: '9000000001', RouteId: 'R1', Active: true, HasPin: true, pin: '111111' },
  { ShopId: 'S2', Name: 'Sri Sai Traders', OwnerName: 'Padma', Phone: '9000000002', RouteId: 'R1', Active: true, HasPin: true, pin: '222222' },
  { ShopId: 'S3', Name: 'Balaji Kirana', OwnerName: 'Suresh', Phone: '9000000003', RouteId: 'R2', Active: true, HasPin: true, pin: '333333' },
];
const indents: Indent[] = [];

function publicShop({ pin: _pin, ...shop }: Shop & { pin: string }): Shop {
  void _pin;
  return { ...shop };
}

function newId(prefix: string): string {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

export async function getMasterData(): Promise<MasterData> {
  return { products: [...products], routes: [...routes], shops: shops.map(publicShop) };
}

export async function saveProduct(payload: {
  productId?: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
}): Promise<{ productId: string } & MasterData> {
  if (!payload.name) throw new Error('Product name is required');
  if (payload.productId) {
    const existing = products.find((p) => p.ProductId === payload.productId);
    if (!existing) throw new Error('Product not found');
    existing.Name = payload.name;
    existing.Unit = payload.unit;
    existing.Price = payload.price;
    existing.Active = payload.active;
    return { productId: existing.ProductId, ...(await getMasterData()) };
  }
  const id = newId('P');
  products.push({ ProductId: id, Name: payload.name, Unit: payload.unit, Price: payload.price, Active: payload.active });
  return { productId: id, ...(await getMasterData()) };
}

export async function saveRoute(payload: {
  routeId?: string;
  name: string;
  villages: string;
  defaultVehicle: string;
  defaultDriver: string;
  active: boolean;
}): Promise<{ routeId: string } & MasterData> {
  if (!payload.name) throw new Error('Route name is required');
  if (payload.routeId) {
    const existing = routes.find((r) => r.RouteId === payload.routeId);
    if (!existing) throw new Error('Route not found');
    existing.Name = payload.name;
    existing.Villages = payload.villages;
    existing.DefaultVehicle = payload.defaultVehicle;
    existing.DefaultDriver = payload.defaultDriver;
    existing.Active = payload.active;
    return { routeId: existing.RouteId, ...(await getMasterData()) };
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
  return { routeId: id, ...(await getMasterData()) };
}

export async function getTrip(routeId: string, date: string, session: Session): Promise<TripWithItems | null> {
  const trip = trips.find((t) => t.RouteId === routeId && t.Date === date && t.Session === session);
  if (!trip) return null;
  const items = tripItems.filter((i) => i.TripId === trip.TripId);
  return { trip: { ...trip }, items: items.map((i) => ({ ...i })) };
}

export async function getRouteDay(payload: {
  routeId: string;
  date: string;
  session?: Session;
  fallbackSession: Session;
}): Promise<RouteDay> {
  const dayTrips = trips.filter((t) => t.RouteId === payload.routeId && t.Date === payload.date);
  const days = (await Promise.all(dayTrips.map((t) => getTrip(t.RouteId, t.Date, t.Session)))).filter(
    (d): d is TripWithItems => d !== null,
  );
  const awaiting = (['Morning', 'Evening'] as Session[]).find((s) =>
    days.some((d) => d.trip.Session === s && d.trip.Status === 'Dispatched'),
  );
  return {
    ...(await getMasterData()),
    session: payload.session ?? awaiting ?? payload.fallbackSession,
    trips: days,
    indents: indents.filter((o) => o.routeId === payload.routeId && o.date === payload.date && o.items.length > 0),
  };
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

export async function getAnalytics(
  payload: { dateFrom?: string; dateTo?: string; previous?: { dateFrom: string; dateTo: string } } = {},
): Promise<Analytics> {
  const result = computeAnalytics(payload);
  if (payload.previous) result.previous = computeAnalytics(payload.previous);
  return result;
}

function computeAnalytics(payload: { dateFrom?: string; dateTo?: string }): Analytics {
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

// ---- Shops & shop orders (mirrors Code.gs) ----

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function newPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function saveShop(payload: {
  shopId?: string;
  name: string;
  ownerName: string;
  phone: string;
  routeId: string;
  active: boolean;
}): Promise<{ shopId: string; pin: string | null } & MasterData> {
  const phone = normalizePhone(payload.phone);
  if (!payload.name.trim()) throw new Error('Shop name is required');
  if (!phone) throw new Error('Enter a 10-digit phone number');
  if (!payload.routeId) throw new Error('Pick the route that serves this shop');
  const clash = shops.find((s) => s.Phone === phone && s.ShopId !== payload.shopId);
  if (clash) throw new Error(`Another shop (${clash.Name}) already uses this phone number`);
  const fields = { Name: payload.name.trim(), OwnerName: payload.ownerName.trim(), Phone: phone, RouteId: payload.routeId, Active: payload.active };
  if (payload.shopId) {
    const existing = shops.find((s) => s.ShopId === payload.shopId);
    if (!existing) throw new Error('Shop not found');
    Object.assign(existing, fields);
    return { shopId: existing.ShopId, pin: null, ...(await getMasterData()) };
  }
  const pin = newPin();
  const shopId = newId('S');
  shops.push({ ShopId: shopId, HasPin: true, pin, ...fields });
  return { shopId, pin, ...(await getMasterData()) };
}

export async function resetShopPin(shopId: string): Promise<{ shopId: string; pin: string }> {
  const shop = shops.find((s) => s.ShopId === shopId);
  if (!shop) throw new Error('Shop not found');
  shop.pin = newPin();
  return { shopId, pin: shop.pin };
}

function nowStamp(): string {
  const d = new Date();
  return `${localDateStr(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function cutoffFor(date: string, session: Session): string {
  return session === 'Morning' ? `${addDays(date, -1)} 21:00` : `${date} 12:00`;
}

function openSlots(): { date: string; session: Session; cutoff: string }[] {
  const now = nowStamp();
  const today = now.slice(0, 10);
  const tomorrow = addDays(today, 1);
  const horizon = `${tomorrow} ${now.slice(11)}`;
  const horizonEnd = horizon < `${tomorrow} 12:00` ? `${tomorrow} 12:00` : horizon;
  const out: { date: string; session: Session; cutoff: string }[] = [];
  [0, 1, 2].forEach((offset) => {
    const date = addDays(today, offset);
    (['Morning', 'Evening'] as Session[]).forEach((session) => {
      const cutoff = cutoffFor(date, session);
      if (cutoff > now && cutoff <= horizonEnd) out.push({ date, session, cutoff });
    });
  });
  return out;
}

function shopHome(shop: Shop): ShopHome {
  const route = routes.find((r) => r.RouteId === shop.RouteId);
  const mine = indents.filter((o) => o.shopId === shop.ShopId);
  const slots: ShopSlot[] = openSlots().map((slot) => ({
    ...slot,
    order: mine.find((o) => o.date === slot.date && o.session === slot.session) ?? null,
  }));
  const firstOpen = slots.length ? `${slots[0].date} ${slots[0].session}` : '9999';
  const lastOrder =
    mine
      .filter((o) => o.items.length && `${o.date} ${o.session}` < firstOpen)
      .sort((a, b) => (b.date + b.session).localeCompare(a.date + a.session))[0] ?? null;
  return {
    shop: { name: shop.Name, ownerName: shop.OwnerName, routeName: route?.Name ?? '' },
    products: products
      .filter((p) => p.Active !== false)
      .map((p) => ({ ProductId: p.ProductId, Name: p.Name, Unit: p.Unit, Price: p.Price })),
    slots,
    lastOrder,
    now: nowStamp(),
  };
}

export async function shopCall(
  creds: { phone: string; pin: string },
  action: string,
  payload: Record<string, unknown>,
): Promise<ShopHome> {
  const shop = shops.find((s) => s.Phone === normalizePhone(creds.phone) && s.Active);
  if (!shop || shop.pin !== creds.pin) throw new Error('Incorrect phone number or PIN.');
  if (action === 'shopLogin') return shopHome(shop);
  if (action !== 'shopSaveOrder') throw new Error('Unauthorized');

  const { date, session } = payload as { date: string; session: Session };
  if (!openSlots().some((s) => s.date === date && s.session === session)) throw new Error('Ordering for this delivery has closed.');
  const items = ((payload.items as { productId: string; qty: number }[]) || []).filter((i) => Number(i.qty) > 0);
  const total = items.reduce((sum, i) => sum + i.qty * (products.find((p) => p.ProductId === i.productId)?.Price ?? 0), 0);
  const existing = indents.find((o) => o.shopId === shop.ShopId && o.date === date && o.session === session);
  const updatedAt = nowStamp();
  if (existing) Object.assign(existing, { items, total, updatedAt });
  else indents.push({ indentId: newId('I'), date, session, shopId: shop.ShopId, routeId: shop.RouteId, items, total, updatedAt });
  return shopHome(shop);
}

export async function getDashboard(date: string): Promise<DashboardData> {
  const orders: DashboardData['orders'] = [];
  shops
    .filter((s) => s.Active)
    .forEach((s) => {
      (['Morning', 'Evening'] as Session[]).forEach((session) => {
        let row = orders.find((o) => o.routeId === s.RouteId && o.session === session);
        if (!row) orders.push((row = { routeId: s.RouteId, session, shops: 0, ordered: 0 }));
        row.shops += 1;
        if (indents.some((o) => o.shopId === s.ShopId && o.date === date && o.session === session && o.items.length)) row.ordered += 1;
      });
    });
  return { trips: await getTodayStatus(date), orders };
}
