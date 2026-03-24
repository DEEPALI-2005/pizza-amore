// =====================================================
//  THE PIZZA AMORE — Backend Server
//  Node.js + Express + PostgreSQL
// =====================================================
require('dotenv').config();
const express = require('express');
const { Pool }  = require('pg');
const cors      = require('cors');
const path      = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── DATABASE ─────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

db.connect()
  .then(client => {
    console.log('✅  PostgreSQL connected!');
    client.release();
  })
  .catch(e => {
    console.error('❌  DB connection failed:', e.message);
  });

// Neon free tier mein connection drop hoti hai — error handle karo
db.on('error', (err) => {
  console.error('DB pool error (ignored):', err.message);
});

// ── MIDDLEWARE ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── HELPER ────────────────────────────────────────────
const newOrderId = () => 'PA' + Math.floor(100000 + Math.random() * 900000);

// ── ADMIN AUTH MIDDLEWARE ─────────────────────────────
function adminOnly(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const expected = Buffer.from((process.env.ADMIN_PASSWORD || 'admin123') + ':pizza').toString('base64');
  if (token === expected) return next();
  res.status(401).json({ ok: false, msg: 'Unauthorized' });
}

// ══════════════════════════════════════════════════════
//  PUBLIC API (customer use karega)
// ══════════════════════════════════════════════════════

// POST /api/orders
app.post('/api/orders', async (req, res) => {
  const {
    customerName, customerPhone, deliveryAddress,
    landmark, instructions, latitude, longitude,
    paymentMethod, transactionId,
    items, subtotal, deliveryCharge, totalAmount
  } = req.body;

  if (!customerName || !customerPhone || !deliveryAddress || !paymentMethod || !items || !totalAmount)
    return res.status(400).json({ ok: false, msg: 'Zaroori fields missing hain' });
  if (paymentMethod === 'online' && !transactionId)
    return res.status(400).json({ ok: false, msg: 'Online payment ke liye Transaction ID zaroori hai' });

  const orderId = newOrderId();
  try {
    const r = await db.query(
      `INSERT INTO orders
        (order_id,customer_name,customer_phone,delivery_address,landmark,
         instructions,latitude,longitude,payment_method,transaction_id,
         items,subtotal,delivery_charge,total_amount,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
       RETURNING order_id, customer_name, total_amount, status, created_at`,
      [orderId, customerName, customerPhone, deliveryAddress,
       landmark||null, instructions||null, latitude||null, longitude||null,
       paymentMethod, transactionId||null,
       JSON.stringify(items), subtotal, deliveryCharge||30, totalAmount]
    );
    const o = r.rows[0];
    console.log(`🍕  NEW ORDER  ${o.order_id}  |  ${o.customer_name}  |  ₹${o.total_amount}`);
    res.status(201).json({ ok: true, msg: 'Order place ho gaya!', order: o });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, msg: 'Server error, dobara try karo' });
  }
});

// ══════════════════════════════════════════════════════
//  ADMIN API
// ══════════════════════════════════════════════════════

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const correct = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== correct)
    return res.status(401).json({ ok: false, msg: 'Galat password' });
  const token = Buffer.from(correct + ':pizza').toString('base64');
  res.json({ ok: true, token });
});

// GET /api/orders
app.get('/api/orders', adminOnly, async (req, res) => {
  const { status, date, phone, limit = 25, offset = 0 } = req.query;
  const conds = [], vals = [];
  if (status) { conds.push(`status=$${vals.length+1}`);                vals.push(status); }
  if (date)   { conds.push(`DATE(created_at)=$${vals.length+1}`);      vals.push(date);   }
  if (phone)  { conds.push(`customer_phone ILIKE $${vals.length+1}`);  vals.push(`%${phone}%`); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  vals.push(limit, offset);

  try {
    const [rows, cnt] = await Promise.all([
      db.query(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`, vals),
      db.query(`SELECT COUNT(*) FROM orders ${where}`, vals.slice(0,-2))
    ]);
    res.json({ ok: true, total: +cnt.rows[0].count, orders: rows.rows });
  } catch (e) { res.status(500).json({ ok: false, msg: 'DB error' }); }
});

// PATCH /api/orders/:id/status
app.patch('/api/orders/:id/status', adminOnly, async (req, res) => {
  const valid = ['pending','confirmed','preparing','out_for_delivery','delivered','cancelled'];
  const { status } = req.body;
  if (!valid.includes(status)) return res.status(400).json({ ok: false, msg: 'Invalid status' });
  try {
    const r = await db.query(
      'UPDATE orders SET status=$1 WHERE order_id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, msg: 'Order nahi mila' });
    console.log(`📦  ${req.params.id}  →  ${status}`);
    res.json({ ok: true, order: r.rows[0] });
  } catch (e) { res.status(500).json({ ok: false, msg: 'DB error' }); }
});

// GET /api/stats
app.get('/api/stats', adminOnly, async (req, res) => {
  try {
    const [today, totals, statuses, topItems] = await Promise.all([
      db.query(`SELECT COUNT(*) orders, COALESCE(SUM(total_amount),0) revenue FROM orders WHERE DATE(created_at)=CURRENT_DATE`),
      db.query(`SELECT COUNT(*) orders, COALESCE(SUM(total_amount),0) revenue FROM orders WHERE status!='cancelled'`),
      db.query(`SELECT status, COUNT(*) cnt FROM orders GROUP BY status ORDER BY cnt DESC`),
      db.query(`SELECT item->>'name' name, SUM((item->>'qty')::int) qty FROM orders, jsonb_array_elements(items) item WHERE status!='cancelled' GROUP BY item->>'name' ORDER BY qty DESC LIMIT 5`)
    ]);
    res.json({
      ok: true,
      todayOrders:   +today.rows[0].orders,
      todayRevenue:  +today.rows[0].revenue,
      totalOrders:   +totals.rows[0].orders,
      totalRevenue:  +totals.rows[0].revenue,
      statuses:      statuses.rows,
      topItems:      topItems.rows
    });
  } catch (e) { res.status(500).json({ ok: false, msg: 'Stats error' }); }
});

// ── PUBLIC TRACK API ─────────────────────────────────
app.get('/api/track/:orderId', async (req, res) => {
  try {
    const r = await db.query(
      'SELECT order_id,customer_name,customer_phone,delivery_address,payment_method,items,total_amount,status,created_at FROM orders WHERE order_id=$1',
      [req.params.orderId.toUpperCase()]
    );
    if (!r.rows.length) return res.status(404).json({ ok: false, msg: 'Order nahi mila! ID check karo.' });
    res.json({ ok: true, order: r.rows[0] });
  } catch (e) { res.status(500).json({ ok: false, msg: 'Server error' }); }
});

// ── SERVE HTML FILES ──────────────────────────────────
app.get('/',      (_,res) => res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/admin', (_,res) => res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('/track', (_,res) => res.sendFile(path.join(__dirname,'public','track.html')));

app.listen(PORT, () => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🍕  The Pizza Amore — Server Ready');
  console.log(`    Website : http://localhost:${PORT}`);
  console.log(`    Admin   : http://localhost:${PORT}/admin`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});