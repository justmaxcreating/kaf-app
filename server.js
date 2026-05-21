const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const crypto = require('crypto');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);

// ─── Web Push (VAPID) ────────────────────────────────────
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BJ1RBITYGxTcUuQXuWpSw4p0Vdh8T3VVlrPwDkqpAP50Uh0lI4Rkb5zDt7QkDDKxR0WQOcSWrIeOkiv0PKcduto';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'R8_c9DMsMg-lLB1kMaT_ks1aH339q0osw3t8tZoVJa4';
const VAPID_CONTACT = process.env.VAPID_CONTACT || 'mailto:kaf@festival.local';

webpush.setVapidDetails(VAPID_CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);

// Push subscriptions keyed by endpoint URL (stable per browser/device).
// Survives socket disconnect — so push arrives even when phone is locked
// and Socket.IO connection has dropped.
const pushSubscriptions = new Map(); // endpoint -> subscription

function sendPushToAll(title, body) {
  let pruned = false;
  pushSubscriptions.forEach((sub, endpoint) => {
    webpush.sendNotification(sub, JSON.stringify({ title, body })).catch(err => {
      console.log(`[KAF] Push fehlgeschlagen (${err.statusCode}):`, endpoint.slice(-20));
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions.delete(endpoint);
        pruned = true;
      }
    });
  });
  if (pruned) saveStore();
}

const app = next({ dev });
const handle = app.getRequestHandler();

// ─── Default Drinks ───────────────────────────────────────
const defaultDrinks = [
  // Bier
  { id: 'kesselring-pils', name: 'Kesselring Pils', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  { id: 'kesselring-naturradler', name: 'Kesselring Naturradler', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  { id: 'kesselring-landbier', name: 'Kesselring Landbier Hell', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  { id: 'kesselring-alkfrei', name: 'Kesselring Pils alkoholfrei', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  // Schnaps (Hochprozentiges)
  { id: 'jaegermeister', name: 'Jägermeister', category: 'schnaps', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'berliner-luft', name: 'Berliner Luft', category: 'schnaps', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'ficken', name: 'Ficken', category: 'schnaps', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'aperol', name: 'Aperol', category: 'schnaps', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'vodka', name: 'Vodka', category: 'schnaps', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'gin', name: 'Gin', category: 'schnaps', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  // Sonstiges
  { id: 'havana-cola', name: 'Havana Cola', category: 'sonstiges', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'tonic', name: 'Tonic', category: 'sonstiges', units: ['flasche', 'kiste'], bottlesPerCrate: 24, inventory: 0, minStock: 12 },
  { id: 'sekt', name: 'Sekt', category: 'sonstiges', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'sekt-alkfrei', name: 'Sekt alkoholfrei', category: 'sonstiges', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'wasser-spritzig', name: 'Wasser (Spritzig)', category: 'sonstiges', units: ['flasche', 'kiste'], bottlesPerCrate: 12, inventory: 0, minStock: 12 },
  { id: 'wasser-still', name: 'Wasser (Still)', category: 'sonstiges', units: ['flasche', 'kiste'], bottlesPerCrate: 12, inventory: 0, minStock: 12 },
  { id: 'cola', name: 'Cola', category: 'sonstiges', units: ['flasche', 'kiste'], bottlesPerCrate: 24, inventory: 0, minStock: 12 },
  { id: 'mate', name: 'Mate', category: 'sonstiges', units: ['flasche', 'kiste'], bottlesPerCrate: 24, inventory: 0, minStock: 12 },
  { id: 'red-bull', name: 'Red Bull', category: 'sonstiges', units: ['flasche', 'kiste'], bottlesPerCrate: 24, inventory: 0, minStock: 12 },
];

// Drinks we explicitly removed — filtered out of loaded store so they
// disappear even if they exist in the persisted Railway volume.
const REMOVED_DRINK_IDS = new Set([
  'jaeger-bull',
  'vodka-bull',
  'vodka-mate',
  'gin-tonic',
  'sekt-mate',
  'aperol-spritz',
]);

// Map legacy categories → new categories (for already-persisted data on Railway volume)
const CATEGORY_MIGRATION = {
  longdrinks: 'sonstiges',
  alkoholfreies: 'sonstiges',
  spritziges: 'sonstiges',
  shots: 'schnaps',
};
function migrateCategory(c) {
  return CATEGORY_MIGRATION[c] || c;
}

// ─── Persistence ──────────────────────────────────────────
// Railway: mount a volume at /data and set DATA_DIR=/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const data = JSON.parse(raw);

      // Migrate legacy categories + drop removed drinks + ensure default drinks exist
      let drinks = Array.isArray(data.drinks) && data.drinks.length
        ? data.drinks
            .filter(d => !REMOVED_DRINK_IDS.has(d.id))
            .map(d => ({ ...d, category: migrateCategory(d.category) }))
        : JSON.parse(JSON.stringify(defaultDrinks));

      const existingIds = new Set(drinks.map(d => d.id));
      for (const def of defaultDrinks) {
        if (!existingIds.has(def.id)) drinks.push({ ...def });
      }

      const orders = Array.isArray(data.orders)
        ? data.orders.map(o => ({ ...o, category: migrateCategory(o.category) }))
        : [];

      const pushSubs = Array.isArray(data.pushSubs) ? data.pushSubs : [];

      console.log(`[KAF] Store geladen: ${drinks.length} Getränke, ${orders.length} Bestellungen, ${pushSubs.length} Push-Subs`);
      return { drinks, orders, pushSubs };
    }
  } catch (err) {
    console.error('[KAF] Store laden fehlgeschlagen, nutze Defaults:', err.message);
  }
  return {
    drinks: JSON.parse(JSON.stringify(defaultDrinks)),
    orders: [],
    pushSubs: [],
  };
}

let saveTimer = null;
function saveStore() {
  if (saveTimer) return; // debounce: max 1 write per 500ms
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = STORE_FILE + '.tmp';
      const payload = {
        drinks: store.drinks,
        orders: store.orders,
        pushSubs: Array.from(pushSubscriptions.values()),
      };
      fs.writeFileSync(tmp, JSON.stringify(payload, null, 2));
      fs.renameSync(tmp, STORE_FILE);
    } catch (err) {
      console.error('[KAF] Store speichern fehlgeschlagen:', err.message);
    }
  }, 500);
}

// ─── In-Memory Store ──────────────────────────────────────
const loaded = loadStore();
const store = {
  drinks: loaded.drinks,
  orders: loaded.orders,
  connectedUsers: new Map(), // socketId -> { name, role } (not persisted)
};

// Rehydrate push subscriptions from disk, keyed by endpoint (stable per device)
for (const sub of loaded.pushSubs) {
  if (sub && sub.endpoint) pushSubscriptions.set(sub.endpoint, sub);
}

function uid() {
  return crypto.randomUUID();
}

function getBottleCount(drink, quantity, unit) {
  if (unit === 'kiste') return quantity * (drink.bottlesPerCrate || 1);
  return quantity;
}

// ─── Server Setup ─────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    console.log(`[KAF] Client verbunden: ${socket.id}`);

    // ── User Registration ──
    socket.on('user:join', ({ name, role }, cb) => {
      store.connectedUsers.set(socket.id, { name, role });
      io.emit('users:updated', getUsers());
      if (cb) cb({ ok: true });
    });

    // ── Push Subscription ──
    socket.on('push:subscribe', (subscription, cb) => {
      if (!subscription || !subscription.endpoint) {
        if (cb) cb({ error: 'Ungültige Subscription' });
        return;
      }
      const isNew = !pushSubscriptions.has(subscription.endpoint);
      pushSubscriptions.set(subscription.endpoint, subscription);
      if (isNew) {
        console.log(`[KAF] Push-Subscription registriert (${pushSubscriptions.size} total)`);
        saveStore();
      }
      if (cb) cb({ ok: true });
    });

    socket.on('push:unsubscribe', ({ endpoint }, cb) => {
      if (endpoint && pushSubscriptions.delete(endpoint)) saveStore();
      if (cb) cb({ ok: true });
    });

    socket.on('disconnect', () => {
      store.connectedUsers.delete(socket.id);
      // NOTE: do NOT remove push subscription here — it must survive disconnect
      // so the device receives pushes while the app is backgrounded / phone is locked.
      io.emit('users:updated', getUsers());
      console.log(`[KAF] Client getrennt: ${socket.id}`);
    });

    // ── Data Fetching ──
    socket.on('drinks:list', (cb) => {
      if (cb) cb(store.drinks);
    });

    socket.on('orders:list', (cb) => {
      if (cb) cb(store.orders);
    });

    socket.on('users:list', (cb) => {
      if (cb) cb(getUsers());
    });

    // ── Orders ──
    socket.on('order:create', (data, cb) => {
      const drink = store.drinks.find(d => d.id === data.drinkId);
      if (!drink) { if (cb) cb({ error: 'Getränk nicht gefunden' }); return; }

      const bottles = getBottleCount(drink, data.quantity, data.unit);

      if (drink.inventory < bottles) {
        if (cb) cb({ error: 'Nicht genug auf Lager' });
        return;
      }

      const order = {
        id: uid(),
        drinkId: data.drinkId,
        drinkName: drink.name,
        category: drink.category,
        quantity: data.quantity,
        unit: data.unit,
        bottleCount: bottles,
        status: 'pending',
        createdBy: data.createdBy,
        note: data.note || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Don't deduct inventory yet — only on delivery
      store.orders.unshift(order);
      saveStore();

      io.emit('order:new', order);
      sendPushToAll('Neue Bestellung! 📦', `${data.quantity}× ${drink.name} von ${data.createdBy}`);
      if (cb) cb({ ok: true, order });
    });

    // ── Batch Orders ──
    socket.on('order:create-batch', (data, cb) => {
      const { items, createdBy, batchNote } = data;
      if (!items || !items.length) { if (cb) cb({ error: 'Keine Artikel im Warenkorb' }); return; }

      const batchId = uid();
      const createdOrders = [];
      const errors = [];

      // Validate all items first
      for (const item of items) {
        const drink = store.drinks.find(d => d.id === item.drinkId);
        if (!drink) { errors.push(`${item.drinkName}: nicht gefunden`); continue; }
        const bottles = getBottleCount(drink, item.quantity, item.unit);
        if (drink.inventory < bottles) { errors.push(`${item.drinkName}: nicht genug auf Lager`); }
      }

      if (errors.length > 0) {
        if (cb) cb({ error: errors.join(', ') });
        return;
      }

      // Create all orders (don't deduct inventory yet — only on delivery)
      for (const item of items) {
        const drink = store.drinks.find(d => d.id === item.drinkId);
        const bottles = getBottleCount(drink, item.quantity, item.unit);

        const order = {
          id: uid(),
          drinkId: item.drinkId,
          drinkName: drink.name,
          category: drink.category,
          quantity: item.quantity,
          unit: item.unit,
          bottleCount: bottles,
          status: 'pending',
          createdBy,
          note: item.note || '',
          batchId,
          batchNote: batchNote || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        store.orders.unshift(order);
        createdOrders.push(order);
      }

      saveStore();

      // Emit each order individually so lager gets them
      for (const order of createdOrders) {
        io.emit('order:new', order);
      }
      // Send one push for the whole batch
      const summary = createdOrders.map(o => `${o.quantity}× ${o.drinkName}`).join(', ');
      sendPushToAll('Neue Sammelbestellung! 📦', `${summary} von ${createdBy}`);
      if (cb) cb({ ok: true, orders: createdOrders, batchId });
    });

    socket.on('order:cancel', ({ orderId, cancelledBy }, cb) => {
      const order = store.orders.find(o => o.id === orderId);
      if (!order || order.status === 'cancelled' || order.status === 'delivered') {
        if (cb) cb({ error: 'Bestellung kann nicht storniert werden' });
        return;
      }

      // No inventory to restore — it wasn't deducted yet
      order.status = 'cancelled';
      order.cancelledBy = cancelledBy;
      order.updatedAt = new Date().toISOString();
      saveStore();

      io.emit('order:updated', order);
      if (cb) cb({ ok: true, order });
    });

    // Single-step: pending → delivered (deduct inventory now)
    socket.on('order:deliver', ({ orderId }, cb) => {
      const order = store.orders.find(o => o.id === orderId);
      if (!order || order.status !== 'pending') {
        if (cb) cb({ error: 'Bestellung kann nicht als erledigt markiert werden' });
        return;
      }

      // Deduct inventory on delivery
      const drink = store.drinks.find(d => d.id === order.drinkId);
      if (drink) {
        drink.inventory = Math.max(0, drink.inventory - order.bottleCount);
      }

      order.status = 'delivered';
      order.updatedAt = new Date().toISOString();
      saveStore();
      io.emit('order:updated', order);
      io.emit('drinks:updated', store.drinks);
      if (cb) cb({ ok: true, order });
    });

    // ── Inventory ──
    socket.on('inventory:set', ({ drinkId, quantity }, cb) => {
      const drink = store.drinks.find(d => d.id === drinkId);
      if (!drink) { if (cb) cb({ error: 'Getränk nicht gefunden' }); return; }
      drink.inventory = quantity;
      saveStore();
      io.emit('drinks:updated', store.drinks);
      if (cb) cb({ ok: true });
    });

    socket.on('inventory:adjust', ({ drinkId, delta }, cb) => {
      const drink = store.drinks.find(d => d.id === drinkId);
      if (!drink) { if (cb) cb({ error: 'Getränk nicht gefunden' }); return; }
      drink.inventory = Math.max(0, drink.inventory + delta);
      saveStore();
      io.emit('drinks:updated', store.drinks);
      if (cb) cb({ ok: true });
    });

    // ── Drink Management ──
    socket.on('drink:add', (data, cb) => {
      const drink = {
        id: uid(),
        name: data.name,
        category: data.category,
        units: data.units || ['flasche'],
        bottlesPerCrate: data.bottlesPerCrate || 1,
        inventory: data.inventory || 0,
        minStock: data.minStock || 5,
      };
      store.drinks.push(drink);
      saveStore();
      io.emit('drinks:updated', store.drinks);
      if (cb) cb({ ok: true, drink });
    });

    socket.on('drink:remove', ({ drinkId }, cb) => {
      store.drinks = store.drinks.filter(d => d.id !== drinkId);
      saveStore();
      io.emit('drinks:updated', store.drinks);
      if (cb) cb({ ok: true });
    });

    // ── Admin ──
    socket.on('orders:clear-delivered', (cb) => {
      store.orders = store.orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
      saveStore();
      io.emit('orders:cleared', store.orders);
      if (cb) cb({ ok: true });
    });

    socket.on('stats:get', (cb) => {
      const delivered = store.orders.filter(o => o.status === 'delivered');
      const stats = {
        totalOrders: store.orders.length,
        deliveredOrders: delivered.length,
        pendingOrders: store.orders.filter(o => o.status === 'pending').length,
        cancelledOrders: store.orders.filter(o => o.status === 'cancelled').length,
        byDrink: {},
      };
      delivered.forEach(o => {
        if (!stats.byDrink[o.drinkName]) stats.byDrink[o.drinkName] = { count: 0, bottles: 0 };
        stats.byDrink[o.drinkName].count += o.quantity;
        stats.byDrink[o.drinkName].bottles += o.bottleCount;
      });
      if (cb) cb(stats);
    });
  });

  function getUsers() {
    const users = [];
    store.connectedUsers.forEach((v, k) => users.push({ id: k, ...v }));
    return users;
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`\n  🍺 KAF App läuft auf http://localhost:${port}\n`);
    // Show local network IP for other devices
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`  📱 Im Netzwerk: http://${net.address}:${port}\n`);
        }
      }
    }
  });
});
