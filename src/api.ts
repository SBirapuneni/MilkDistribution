import type { Analytics, MasterData, RouteDay, Session, Trip, TripWithItems } from './types';
import * as mock from './mock';

const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'milk_app_token';
const USER_KEY = 'milk_app_user';

// With no Apps Script URL configured, fall back to an in-memory demo backend
// so the UI can be tried out before the Google Sheet is set up. Demo data
// resets on page reload.
export const DEMO_MODE = !API_URL;
export const DEMO_PASSCODE = 'demo';
export const DEMO_ADMIN_PASSCODE = mock.DEMO_ADMIN_PASSCODE;

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// Who is using this device. Sent with every request and recorded on the trip
// (DispatchedBy / SettledBy / ReopenedBy), since the passcode is shared.
// Kept in localStorage so staff don't retype it every login.
export function getUserName(): string {
  try {
    return localStorage.getItem(USER_KEY) || '';
  } catch {
    return '';
  }
}

export function setUserName(name: string) {
  try {
    localStorage.setItem(USER_KEY, name);
  } catch {
    // Storage blocked (private mode etc.) — the name just won't be remembered.
  }
  currentUser = name;
}

let currentUser = getUserName();

async function rawCall<T>(token: string | null, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not configured');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, user: currentUser, action, payload }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Request failed');
  return json.data as T;
}

function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return rawCall<T>(getToken(), action, payload);
}

// Apps Script spins down when idle, and the first request after that pays a
// multi-second start-up. Poke it (unauthenticated doGet, response ignored) as
// soon as the app opens, while the user is still reading the screen or
// typing the passcode, so the first real request finds it awake.
export function warmUp() {
  if (!API_URL) return;
  fetch(API_URL, { method: 'GET', mode: 'no-cors' }).catch(() => {});
}

// ---- Master data cache ----------------------------------------------------
// Products and routes change rarely but were fetched on every screen — each
// fetch a full Apps Script round trip (~1 s). Keep them for the session and
// refresh from every response that carries them (login, Route screen, saves),
// with a time limit so edits made on another phone show up.

const MASTER_KEY = 'milk_app_master';
const MASTER_TTL_MS = 5 * 60 * 1000;

function readMasterCache(): MasterData | null {
  try {
    const raw = sessionStorage.getItem(MASTER_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: MasterData };
    return Date.now() - at < MASTER_TTL_MS ? data : null;
  } catch {
    return null;
  }
}

function writeMasterCache(data: MasterData) {
  try {
    sessionStorage.setItem(MASTER_KEY, JSON.stringify({ at: Date.now(), data: { products: data.products, routes: data.routes } }));
  } catch {
    // Storage full/blocked: we just refetch next time.
  }
}

export function clearMasterCache() {
  try {
    sessionStorage.removeItem(MASTER_KEY);
  } catch {
    // ignore
  }
}

export async function verifyToken(token: string): Promise<MasterData> {
  if (DEMO_MODE) {
    if (token !== DEMO_PASSCODE) throw new Error('Invalid passcode');
    return mock.getMasterData();
  }
  const data = await rawCall<MasterData>(token, 'getMasterData');
  writeMasterCache(data);
  return data;
}

export async function getMasterData(): Promise<MasterData> {
  if (DEMO_MODE) return mock.getMasterData();
  const cached = readMasterCache();
  if (cached) return cached;
  const data = await call<MasterData>('getMasterData');
  writeMasterCache(data);
  return data;
}

async function withMaster<T extends MasterData>(p: Promise<T>): Promise<T> {
  const data = await p;
  if (!DEMO_MODE) writeMasterCache(data);
  return data;
}

export function saveProduct(payload: {
  productId?: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
}): Promise<{ productId: string } & MasterData> {
  return withMaster(DEMO_MODE ? mock.saveProduct(payload) : call('saveProduct', payload));
}

export function saveRoute(payload: {
  routeId?: string;
  name: string;
  villages: string;
  defaultVehicle: string;
  defaultDriver: string;
  active: boolean;
}): Promise<{ routeId: string } & MasterData> {
  return withMaster(DEMO_MODE ? mock.saveRoute(payload) : call('saveRoute', payload));
}

export function getRouteDay(payload: {
  routeId: string;
  date: string;
  session?: Session;
  fallbackSession: Session;
}): Promise<RouteDay> {
  return withMaster(DEMO_MODE ? mock.getRouteDay(payload) : call('getRouteDay', payload));
}

export function getLastTrip(routeId: string, session: Session, beforeDate: string): Promise<TripWithItems | null> {
  return DEMO_MODE ? mock.getLastTrip(routeId, session, beforeDate) : call('getLastTrip', { routeId, session, beforeDate });
}

export function dispatchTrip(payload: {
  routeId: string;
  date: string;
  session: Session;
  driver: string;
  vehicle: string;
  items: { productId: string; qty: number }[];
}): Promise<TripWithItems> {
  return DEMO_MODE ? mock.dispatchTrip(payload, currentUser) : call('dispatchTrip', payload);
}

export function saveTripProgress(payload: {
  tripId: string;
  items: { productId: string; qtyReturned: number }[];
  cashHandedOver: number;
}): Promise<TripWithItems> {
  return DEMO_MODE ? mock.saveTripProgress(payload) : call('saveTripProgress', payload);
}

export function settleTrip(payload: {
  tripId: string;
  items: { productId: string; qtyReturned: number }[];
  cashHandedOver: number;
}): Promise<TripWithItems> {
  return DEMO_MODE ? mock.settleTrip(payload, currentUser) : call('settleTrip', payload);
}

export function reopenTrip(payload: { tripId: string; adminToken: string }): Promise<TripWithItems> {
  return DEMO_MODE ? mock.reopenTrip(payload, currentUser) : call('reopenTrip', payload);
}

export function listTrips(
  payload: { routeId?: string; dateFrom?: string; dateTo?: string } = {},
): Promise<Trip[]> {
  return DEMO_MODE ? mock.listTrips(payload) : call('listTrips', payload);
}

export function getTodayStatus(date: string): Promise<Trip[]> {
  return DEMO_MODE ? mock.getTodayStatus(date) : call('getTodayStatus', { date });
}

export function getAnalytics(
  payload: { dateFrom?: string; dateTo?: string; previous?: { dateFrom: string; dateTo: string } } = {},
): Promise<Analytics> {
  return DEMO_MODE ? mock.getAnalytics(payload) : call('getAnalytics', payload);
}
