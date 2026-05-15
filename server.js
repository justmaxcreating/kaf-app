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

// Store push subscriptions
const pushSubscriptions = new Map(); // socketId -> subscription

function sendPushToAll(title, body) {
  pushSubscriptions.forEach((sub, id) => {
    webpush.sendNotification(sub, JSON.stringify({ title, body })).catch(err => {
      console.log(`[KAF] Push fehlgeschlagen für ${id}:`, err.statusCode);
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions.delete(id);
      }
    });
  });
}

const app = next({ dev });
const handle = app.getRequestHandler();

// ─── Default Drinks ───────────────────────────────────────
const defaultDrinks = [
  // Longdrinks
  { id: 'havana-cola', name: 'Havana Cola', category: 'longdrinks', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'jaeger-bull', name: 'Jäger - Bull', category: 'longdrinks', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'vodka-bull', name: 'Vodka - Bull', category: 'longdrinks', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'vodka-mate', name: 'Vodka - Mate', category: 'longdrinks', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'gin-tonic', name: 'Gin Tonic', category: 'longdrinks', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  // Bier
  { id: 'kesselring-pils', name: 'Kesselring Pils', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  { id: 'kesselring-naturradler', name: 'Kesselring Naturradler', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  { id: 'kesselring-landbier', name: 'Kesselring Landbier Hell', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  { id: 'kesselring-alkfrei', name: 'Kesselring Pils alkoholfrei', category: 'bier', units: ['flasche', 'kiste'], bottlesPerCrate: 20, inventory: 0, minStock: 10 },
  // Shots
  { id: 'jaegermeister', name: 'Jägermeister', category: 'shots', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'berliner-luft', name: 'Berliner Luft', category: 'shots', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'ficken', name: 'Ficken', category: 'shots', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  // Alkoholfreies
  { id: 'wasser-spritzig', name: 'Wasser (Spritzig)', category: 'alkoholfreies', units: ['flasche', 'kiste'], bottlesPerCrate: 12, inventory: 0, minStock: 12 },
  { id: 'cola', name: 'Cola', category: 'alkoholfreies', units: ['flasche', 'kiste'], bottlesPerCrate: 24, inventory: 0, minStock: 12 },
  { id: 'mate', name: 'Mate', category: 'alkoholfreies', units: ['flasche', 'kiste'], bottlesPerCrate: 24, inventory: 0, minStock: 12 },
  { id: 'red-bull', name: 'Red Bull', category: 'alkoholfreies', units: ['flasche', 'kiste'], bottlesPerCrate: 24, inventory: 0, minStock: 12 },
  // Spritziges
  { id: 'sekt-mate', name: 'Sekt-Mate', category: 'spritziges', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
  { id: 'aperol-spritz', name: 'Aperol Spritz', category: 'spritziges', units: ['flasche'], bottlesPerCrate: 1, inventory: 0, minStock: 2 },
];

// ─── Persistence ──────────────────────────────────────────
// Railway: mount a volume at /data and set DATA_DIR=/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const data = JSON.parse(raw);
      console.log(`[KAF] Store geladen: ${data.drinks?.length || 0} Getränke, ${data.orders?.length || 0} Bestellungen`);
      return {
        drinks: Array.isArray(data.drinks) && data.drinks.length ? data.drinks : JSON.parse(JSON.stringify(defaultDrinks)),
        orders: Array.isArray(data.orders) ? data.orders : [],
      };
    }
  } catch (err) {
    console.error('[KAF] Store laden fehlgeschlagen, nutze Defaults:', err.message);
  }
  return {
    drinks: JSON.parse(JSON.stringify(defaultDrinks)),
    orders: [],
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
      fs.writeFileSync(tmp, JSON.stringify({ drinks: store.drinks, orders: store.orders }, null, 2));
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
      pushSubscriptions.set(socket.id, subscription);
      console.log(`[KAF] Push-Subscription registriert: ${socket.id}`);
      if (cb) cb({ ok: true });
    });

    socket.on('disconnect', () => {
      store.connectedUsers.delete(socket.id);
      pushSubscriptions.delete(socket.id);
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
