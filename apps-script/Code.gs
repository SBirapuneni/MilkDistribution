/**
 * Milk Distribution — Apps Script backend.
 * Bind this script to the Google Sheet that stores the app's data
 * (Extensions > Apps Script from within the Sheet), paste this file in,
 * then run setup() once and deploy as a Web App.
 */

const SHEET_NAMES = {
  PRODUCTS: 'Products',
  ROUTES: 'Routes',
  TRIPS: 'Trips',
  TRIP_ITEMS: 'TripItems',
};

// ---- One-time setup -------------------------------------------------

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createSheetIfMissing_(ss, SHEET_NAMES.PRODUCTS, ['ProductId', 'Name', 'Unit', 'Price', 'Active']);
  createSheetIfMissing_(ss, SHEET_NAMES.ROUTES, ['RouteId', 'Name', 'Villages', 'DefaultVehicle', 'DefaultDriver', 'Active']);
  createSheetIfMissing_(ss, SHEET_NAMES.TRIPS, [
    'TripId', 'Date', 'Session', 'RouteId', 'Driver', 'Vehicle', 'Status',
    'DispatchedTotal', 'ReturnedTotal', 'AmountDue', 'CashHandedOver', 'Discrepancy',
    'CreatedAt', 'SettledAt',
  ]);
  createSheetIfMissing_(ss, SHEET_NAMES.TRIP_ITEMS, [
    'TripItemId', 'TripId', 'ProductId', 'Price', 'QtyDispatched', 'QtyReturned', 'DispatchedValue', 'ReturnedValue',
  ]);
}

function createSheetIfMissing_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

// Edit the token below, then run this function once (Run menu) to store
// your shared passcode. It never needs to be committed to source control.
function setAppToken() {
  const token = 'REPLACE_WITH_YOUR_PASSCODE';
  PropertiesService.getScriptProperties().setProperty('APP_TOKEN', token);
}

// ---- HTTP entry points -----------------------------------------------

function doGet() {
  return ContentService.createTextOutput('Milk Distribution API is running.');
}

function doPost(e) {
  let response;
  try {
    const body = JSON.parse(e.postData.contents);
    const token = body.token;
    const action = body.action;
    const payload = body.payload || {};

    const expectedToken = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
    if (!expectedToken || token !== expectedToken) {
      throw new Error('Unauthorized');
    }

    const handlers = {
      getMasterData: getMasterData,
      saveProduct: saveProduct,
      saveRoute: saveRoute,
      getTrip: getTrip,
      dispatchTrip: dispatchTrip,
      saveTripProgress: saveTripProgress,
      settleTrip: settleTrip,
      listTrips: listTrips,
      getAnalytics: getAnalytics,
    };

    if (!handlers[action]) {
      throw new Error('Unknown action: ' + action);
    }

    response = { ok: true, data: handlers[action](payload) };
  } catch (err) {
    response = { ok: false, error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- Sheet helpers -----------------------------------------------------

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function readAll_(sheetName) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.join('') === '') continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj.__row = i + 1;
    rows.push(obj);
  }
  return rows;
}

function appendObject_(sheetName, obj) {
  const sheet = getSheet_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
}

function updateObjectByRow_(sheetName, rowNumber, obj) {
  const sheet = getSheet_(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
}

function stripRow_(obj) {
  const copy = {};
  for (const k in obj) {
    if (k !== '__row') copy[k] = obj[k];
  }
  return copy;
}

function newId_(prefix) {
  return prefix + new Date().getTime() + Math.floor(Math.random() * 1000);
}

function formatDate_(d) {
  if (Object.prototype.toString.call(d) === '[object Date]') {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(d);
}

function isActive_(value) {
  return value !== false && String(value).toUpperCase() !== 'FALSE';
}

// ---- Master data ---------------------------------------------------------

function getMasterData() {
  return {
    products: readAll_(SHEET_NAMES.PRODUCTS).map(stripRow_),
    routes: readAll_(SHEET_NAMES.ROUTES).map(stripRow_),
  };
}

function saveProduct(payload) {
  const name = payload.name;
  const unit = payload.unit;
  const price = Number(payload.price);
  const active = payload.active !== false;

  if (!name) throw new Error('Product name is required');
  if (isNaN(price) || price < 0) throw new Error('Price must be a positive number');

  if (payload.productId) {
    const products = readAll_(SHEET_NAMES.PRODUCTS);
    const existing = products.filter((p) => p.ProductId === payload.productId)[0];
    if (!existing) throw new Error('Product not found');
    updateObjectByRow_(SHEET_NAMES.PRODUCTS, existing.__row, {
      ProductId: existing.ProductId, Name: name, Unit: unit, Price: price, Active: active,
    });
    return { productId: existing.ProductId };
  }

  const id = newId_('P');
  appendObject_(SHEET_NAMES.PRODUCTS, { ProductId: id, Name: name, Unit: unit, Price: price, Active: active });
  return { productId: id };
}

function saveRoute(payload) {
  const name = payload.name;
  if (!name) throw new Error('Route name is required');

  const fields = {
    Name: name,
    Villages: payload.villages || '',
    DefaultVehicle: payload.defaultVehicle || '',
    DefaultDriver: payload.defaultDriver || '',
    Active: payload.active !== false,
  };

  if (payload.routeId) {
    const routes = readAll_(SHEET_NAMES.ROUTES);
    const existing = routes.filter((r) => r.RouteId === payload.routeId)[0];
    if (!existing) throw new Error('Route not found');
    updateObjectByRow_(SHEET_NAMES.ROUTES, existing.__row, Object.assign({ RouteId: existing.RouteId }, fields));
    return { routeId: existing.RouteId };
  }

  const id = newId_('R');
  appendObject_(SHEET_NAMES.ROUTES, Object.assign({ RouteId: id }, fields));
  return { routeId: id };
}

// ---- Trips -----------------------------------------------------------

function getTrip(payload) {
  const trips = readAll_(SHEET_NAMES.TRIPS);
  const trip = trips.filter(
    (t) => t.RouteId === payload.routeId && formatDate_(t.Date) === payload.date && t.Session === payload.session,
  )[0];
  if (!trip) return null;

  const items = readAll_(SHEET_NAMES.TRIP_ITEMS).filter((i) => i.TripId === trip.TripId);
  const strippedTrip = stripRow_(trip);
  strippedTrip.Date = formatDate_(trip.Date);
  return { trip: strippedTrip, items: items.map(stripRow_) };
}

function dispatchTrip(payload) {
  if (payload.session !== 'Morning' && payload.session !== 'Evening') {
    throw new Error('Session must be Morning or Evening');
  }
  const existing = getTrip({ routeId: payload.routeId, date: payload.date, session: payload.session });
  if (existing) throw new Error('This route already has a ' + payload.session + ' trip for ' + payload.date);

  const products = readAll_(SHEET_NAMES.PRODUCTS);
  const productMap = {};
  products.forEach((p) => { productMap[p.ProductId] = p; });

  const tripId = newId_('T');
  let dispatchedTotal = 0;
  const itemsToWrite = [];

  (payload.items || []).forEach((item) => {
    const qty = Number(item.qty) || 0;
    if (qty <= 0) return;
    const product = productMap[item.productId];
    if (!product) throw new Error('Unknown product: ' + item.productId);
    const price = Number(product.Price) || 0;
    const value = qty * price;
    dispatchedTotal += value;
    itemsToWrite.push({
      TripItemId: newId_('TI'),
      TripId: tripId,
      ProductId: item.productId,
      Price: price,
      QtyDispatched: qty,
      QtyReturned: 0,
      DispatchedValue: value,
      ReturnedValue: 0,
    });
  });

  if (itemsToWrite.length === 0) throw new Error('At least one product with quantity is required');

  appendObject_(SHEET_NAMES.TRIPS, {
    TripId: tripId,
    Date: payload.date,
    Session: payload.session,
    RouteId: payload.routeId,
    Driver: payload.driver || '',
    Vehicle: payload.vehicle || '',
    Status: 'Dispatched',
    DispatchedTotal: dispatchedTotal,
    ReturnedTotal: '',
    AmountDue: '',
    CashHandedOver: '',
    Discrepancy: '',
    CreatedAt: new Date(),
    SettledAt: '',
  });

  itemsToWrite.forEach((item) => appendObject_(SHEET_NAMES.TRIP_ITEMS, item));

  return getTrip({ routeId: payload.routeId, date: payload.date, session: payload.session });
}

function applyReturns_(trip, payload, finalize) {
  const tripItems = readAll_(SHEET_NAMES.TRIP_ITEMS).filter((i) => i.TripId === trip.TripId);
  const returnMap = {};
  (payload.items || []).forEach((i) => { returnMap[i.productId] = Number(i.qtyReturned) || 0; });

  let returnedTotal = 0;
  tripItems.forEach((item) => {
    const qtyReturned = returnMap[item.ProductId] || 0;
    if (qtyReturned > Number(item.QtyDispatched)) {
      throw new Error('Returned qty exceeds dispatched qty for product ' + item.ProductId);
    }
    const returnedValue = qtyReturned * Number(item.Price);
    returnedTotal += returnedValue;
    updateObjectByRow_(SHEET_NAMES.TRIP_ITEMS, item.__row, {
      TripItemId: item.TripItemId,
      TripId: item.TripId,
      ProductId: item.ProductId,
      Price: item.Price,
      QtyDispatched: item.QtyDispatched,
      QtyReturned: qtyReturned,
      DispatchedValue: item.DispatchedValue,
      ReturnedValue: returnedValue,
    });
  });

  const dispatchedTotal = Number(trip.DispatchedTotal);
  const amountDue = dispatchedTotal - returnedTotal;
  const cashHandedOver = Number(payload.cashHandedOver) || 0;
  const discrepancy = cashHandedOver - amountDue;

  updateObjectByRow_(SHEET_NAMES.TRIPS, trip.__row, {
    TripId: trip.TripId,
    Date: trip.Date,
    Session: trip.Session,
    RouteId: trip.RouteId,
    Driver: trip.Driver,
    Vehicle: trip.Vehicle,
    Status: finalize ? 'Settled' : 'Dispatched',
    DispatchedTotal: dispatchedTotal,
    ReturnedTotal: returnedTotal,
    AmountDue: amountDue,
    CashHandedOver: cashHandedOver,
    Discrepancy: discrepancy,
    CreatedAt: trip.CreatedAt,
    SettledAt: finalize ? new Date() : '',
  });

  return getTrip({ routeId: trip.RouteId, date: formatDate_(trip.Date), session: trip.Session });
}

function saveTripProgress(payload) {
  const trips = readAll_(SHEET_NAMES.TRIPS);
  const trip = trips.filter((t) => t.TripId === payload.tripId)[0];
  if (!trip) throw new Error('Trip not found');
  if (trip.Status === 'Settled') throw new Error('Trip already settled');
  return applyReturns_(trip, payload, false);
}

function settleTrip(payload) {
  const trips = readAll_(SHEET_NAMES.TRIPS);
  const trip = trips.filter((t) => t.TripId === payload.tripId)[0];
  if (!trip) throw new Error('Trip not found');
  if (trip.Status === 'Settled') throw new Error('Trip already settled');
  return applyReturns_(trip, payload, true);
}

function listTrips(payload) {
  const trips = readAll_(SHEET_NAMES.TRIPS);
  const routes = readAll_(SHEET_NAMES.ROUTES);
  const routeMap = {};
  routes.forEach((r) => { routeMap[r.RouteId] = r.Name; });

  const filtered = trips.filter((t) => {
    const d = formatDate_(t.Date);
    if (payload.routeId && t.RouteId !== payload.routeId) return false;
    if (payload.dateFrom && d < payload.dateFrom) return false;
    if (payload.dateTo && d > payload.dateTo) return false;
    return true;
  });

  filtered.sort((a, b) => formatDate_(b.Date).localeCompare(formatDate_(a.Date)));

  return filtered.map((t) => {
    const obj = stripRow_(t);
    obj.Date = formatDate_(t.Date);
    obj.RouteName = routeMap[t.RouteId] || t.RouteId;
    return obj;
  });
}

// ---- Analytics -----------------------------------------------------------
// Only settled trips are counted: DispatchedTotal/ReturnedTotal/etc. on a
// still-open trip aren't final, so they'd distort revenue and return-rate
// numbers used for business decisions.

function getAnalytics(payload) {
  const trips = readAll_(SHEET_NAMES.TRIPS).filter((t) => t.Status === 'Settled');
  const filtered = trips.filter((t) => {
    const d = formatDate_(t.Date);
    if (payload.dateFrom && d < payload.dateFrom) return false;
    if (payload.dateTo && d > payload.dateTo) return false;
    return true;
  });

  const routes = readAll_(SHEET_NAMES.ROUTES);
  const routeMap = {};
  routes.forEach((r) => { routeMap[r.RouteId] = r.Name; });

  const products = readAll_(SHEET_NAMES.PRODUCTS);
  const productMap = {};
  products.forEach((p) => { productMap[p.ProductId] = p.Name; });

  const tripIds = {};
  filtered.forEach((t) => { tripIds[t.TripId] = true; });
  const items = readAll_(SHEET_NAMES.TRIP_ITEMS).filter((i) => tripIds[i.TripId]);

  let totalDispatched = 0;
  let totalReturned = 0;
  let totalCash = 0;
  let totalDiscrepancy = 0;

  const byDateMap = {};
  const byRouteMap = {};
  const bySessionMap = {
    Morning: { session: 'Morning', dispatched: 0, returned: 0, tripCount: 0 },
    Evening: { session: 'Evening', dispatched: 0, returned: 0, tripCount: 0 },
  };

  filtered.forEach((t) => {
    const dispatched = Number(t.DispatchedTotal) || 0;
    const returned = Number(t.ReturnedTotal) || 0;
    const discrepancy = Number(t.Discrepancy) || 0;
    const cash = Number(t.CashHandedOver) || 0;

    totalDispatched += dispatched;
    totalReturned += returned;
    totalCash += cash;
    totalDiscrepancy += discrepancy;

    const d = formatDate_(t.Date);
    if (!byDateMap[d]) byDateMap[d] = { date: d, dispatched: 0, returned: 0, discrepancy: 0, tripCount: 0 };
    byDateMap[d].dispatched += dispatched;
    byDateMap[d].returned += returned;
    byDateMap[d].discrepancy += discrepancy;
    byDateMap[d].tripCount += 1;

    if (!byRouteMap[t.RouteId]) {
      byRouteMap[t.RouteId] = {
        routeId: t.RouteId,
        routeName: routeMap[t.RouteId] || t.RouteId,
        dispatched: 0,
        returned: 0,
        discrepancy: 0,
        tripCount: 0,
      };
    }
    byRouteMap[t.RouteId].dispatched += dispatched;
    byRouteMap[t.RouteId].returned += returned;
    byRouteMap[t.RouteId].discrepancy += discrepancy;
    byRouteMap[t.RouteId].tripCount += 1;

    if (bySessionMap[t.Session]) {
      bySessionMap[t.Session].dispatched += dispatched;
      bySessionMap[t.Session].returned += returned;
      bySessionMap[t.Session].tripCount += 1;
    }
  });

  const byProductMap = {};
  items.forEach((i) => {
    if (!byProductMap[i.ProductId]) {
      byProductMap[i.ProductId] = {
        productId: i.ProductId,
        productName: productMap[i.ProductId] || i.ProductId,
        qtyDispatched: 0,
        qtyReturned: 0,
        dispatchedValue: 0,
        returnedValue: 0,
      };
    }
    const p = byProductMap[i.ProductId];
    p.qtyDispatched += Number(i.QtyDispatched) || 0;
    p.qtyReturned += Number(i.QtyReturned) || 0;
    p.dispatchedValue += Number(i.DispatchedValue) || 0;
    p.returnedValue += Number(i.ReturnedValue) || 0;
  });

  const byDate = Object.keys(byDateMap)
    .map((d) => byDateMap[d])
    .map((r) => Object.assign({ revenue: r.dispatched - r.returned }, r))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byRoute = Object.keys(byRouteMap)
    .map((k) => byRouteMap[k])
    .map((r) => Object.assign({ revenue: r.dispatched - r.returned }, r))
    .sort((a, b) => b.revenue - a.revenue);

  const bySession = Object.keys(bySessionMap)
    .map((k) => bySessionMap[k])
    .map((r) => Object.assign({ revenue: r.dispatched - r.returned }, r));

  const byProduct = Object.keys(byProductMap)
    .map((k) => byProductMap[k])
    .map((p) =>
      Object.assign(
        {
          revenue: p.dispatchedValue - p.returnedValue,
          returnRate: p.qtyDispatched > 0 ? p.qtyReturned / p.qtyDispatched : 0,
        },
        p,
      ),
    )
    .sort((a, b) => b.revenue - a.revenue);

  return {
    summary: {
      totalDispatched: totalDispatched,
      totalReturned: totalReturned,
      totalRevenue: totalDispatched - totalReturned,
      totalCash: totalCash,
      totalDiscrepancy: totalDiscrepancy,
      tripCount: filtered.length,
    },
    byDate: byDate,
    byRoute: byRoute,
    bySession: bySession,
    byProduct: byProduct,
  };
}
