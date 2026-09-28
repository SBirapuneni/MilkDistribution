export interface Product {
  ProductId: string;
  Name: string;
  Unit: string;
  Price: number;
  Active: boolean;
}

export interface Route {
  RouteId: string;
  Name: string;
  Villages: string;
  DefaultVehicle: string;
  DefaultDriver: string;
  Active: boolean;
}

export interface TripItem {
  TripItemId: string;
  TripId: string;
  ProductId: string;
  Price: number;
  QtyDispatched: number;
  QtyReturned: number;
  DispatchedValue: number;
  ReturnedValue: number;
}

export type Session = 'Morning' | 'Evening';

export interface Trip {
  TripId: string;
  Date: string;
  Session: Session;
  RouteId: string;
  Driver: string;
  Vehicle: string;
  Status: 'Dispatched' | 'Settled';
  DispatchedTotal: number;
  ReturnedTotal: number | '';
  AmountDue: number | '';
  CashHandedOver: number | '';
  Discrepancy: number | '';
  CreatedAt: string;
  SettledAt: string;
  DispatchedBy?: string;
  SettledBy?: string;
  ReopenedBy?: string;
  ReopenedAt?: string;
  RouteName?: string;
}

export interface TripWithItems {
  trip: Trip;
  items: TripItem[];
}

export interface MasterData {
  products: Product[];
  routes: Route[];
}

export interface AnalyticsSummary {
  totalDispatched: number;
  totalReturned: number;
  totalRevenue: number;
  totalCash: number;
  totalDiscrepancy: number;
  totalShortage: number;
  totalExcess: number;
  tripCount: number;
}

export interface AnalyticsByDate {
  date: string;
  dispatched: number;
  returned: number;
  cash: number;
  discrepancy: number;
  shortage: number;
  tripCount: number;
  revenue: number;
}

export interface AnalyticsByRoute {
  routeId: string;
  routeName: string;
  dispatched: number;
  returned: number;
  discrepancy: number;
  shortage: number;
  excess: number;
  tripCount: number;
  revenue: number;
}

export interface AnalyticsByDriver {
  driver: string;
  tripCount: number;
  shortTrips: number;
  shortage: number;
  excess: number;
  discrepancy: number;
}

export interface AnalyticsBySession {
  session: Session;
  dispatched: number;
  returned: number;
  tripCount: number;
  revenue: number;
}

export interface AnalyticsByProduct {
  productId: string;
  productName: string;
  qtyDispatched: number;
  qtyReturned: number;
  dispatchedValue: number;
  returnedValue: number;
  revenue: number;
  returnRate: number;
}

export interface Analytics {
  summary: AnalyticsSummary;
  byDate: AnalyticsByDate[];
  byRoute: AnalyticsByRoute[];
  byDriver: AnalyticsByDriver[];
  bySession: AnalyticsBySession[];
  byProduct: AnalyticsByProduct[];
}
