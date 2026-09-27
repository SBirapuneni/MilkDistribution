import type { Analytics, MasterData, Session, Trip, TripWithItems } from './types';
import * as mock from './mock';

const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'milk_app_token';

// With no Apps Script URL configured, fall back to an in-memory demo backend
// so the UI can be tried out before the Google Sheet is set up. Demo data
// resets on page reload.
export const DEMO_MODE = !API_URL;
export const DEMO_PASSCODE = 'demo';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function rawCall<T>(token: string | null, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API_URL) throw new Error('VITE_API_URL is not configured');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token, action, payload }),
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

export function dispatchTrip(payload: {
  routeId: string;
  date: string;
  session: Session;
  driver: string;
  vehicle: string;
  items: { productId: string; qty: number }[];
}): Promise<TripWithItems> {
  return DEMO_MODE ? mock.dispatchTrip(payload) : call('dispatchTrip', payload);
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
  return DEMO_MODE ? mock.settleTrip(payload) : call('settleTrip', payload);
}

export function listTrips(
  payload: { routeId?: string; dateFrom?: string; dateTo?: string } = {},
): Promise<Trip[]> {
  return DEMO_MODE ? mock.listTrips(payload) : call('listTrips', payload);
}

export function getAnalytics(payload: { dateFrom?: string; dateTo?: string } = {}): Promise<Analytics> {
  return DEMO_MODE ? mock.getAnalytics(payload) : call('getAnalytics', payload);
}
