import type { Analytics, MasterData, Session, Trip, TripWithItems } from './types';
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

export function verifyToken(token: string): Promise<MasterData> {
  if (DEMO_MODE) {
    if (token !== DEMO_PASSCODE) return Promise.reject(new Error('Invalid passcode'));
    return mock.getMasterData();
  }
  return rawCall<MasterData>(token, 'getMasterData');
}

export function getMasterData(): Promise<MasterData> {
  return DEMO_MODE ? mock.getMasterData() : call('getMasterData');
}

export function saveProduct(payload: {
  productId?: string;
  name: string;
  unit: string;
  price: number;
  active: boolean;
}): Promise<{ productId: string }> {
  return DEMO_MODE ? mock.saveProduct(payload) : call('saveProduct', payload);
}

export function saveRoute(payload: {
  routeId?: string;
  name: string;
  villages: string;
  defaultVehicle: string;
  defaultDriver: string;
  active: boolean;
}): Promise<{ routeId: string }> {
  return DEMO_MODE ? mock.saveRoute(payload) : call('saveRoute', payload);
}

export function getTrip(routeId: string, date: string, session: Session): Promise<TripWithItems | null> {
  return DEMO_MODE ? mock.getTrip(routeId, date, session) : call('getTrip', { routeId, date, session });
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

export function getAnalytics(payload: { dateFrom?: string; dateTo?: string } = {}): Promise<Analytics> {
  return DEMO_MODE ? mock.getAnalytics(payload) : call('getAnalytics', payload);
}
