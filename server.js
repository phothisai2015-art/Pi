const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer'); // 🌟 เรียกใช้ Nodemailer
const db = require('./database');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

db.run(`ALTER TABLE tenants ADD COLUMN renew_status TEXT DEFAULT 'NONE'`, () => {});
db.run(`ALTER TABLE tenants ADD COLUMN renew_notified INTEGER DEFAULT 1`, () => {});
// 🌟 ตารางตั้งค่า Super Admin
db.run(`CREATE TABLE IF NOT EXISTS superadmin_settings (key TEXT PRIMARY KEY, value TEXT)`, () => {
  // ค่าเริ่มต้นตามที่กำหนด (superadmin / 1234 และอีเมลว่างเปล่า)
  const defaults = { username: 'superadmin', password: '1234', email: '' };
  const stmt = db.prepare(`INSERT OR IGNORE INTO superadmin_settings (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(defaults)) stmt.run(k, v);
  stmt.finalize();
});

// 🌟 ตั้งค่า Telegram Bot
const TELEGRAM_BOT_TOKEN = "8383540467:AAHP2VfSU0U7riTyhrfq-dQHOQgiTmd8t0Y";
const TELEGRAM_CHAT_ID = "5519991585";

// 🌟 ตั้งค่าบัญชีอีเมลสำหรับส่ง OTP (ระบบ SMTP ของ Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'my.server.pos.online@gmail.com', // ✏️ เปลี่ยนเป็นอีเมล Gmail ของคุณ
    pass: 'blfllltvbernypps'     // ✏️ เปลี่ยนเป็นรหัสผ่านแอป 16 หลัก ที่ได้จาก Google
  }
});

const otpStore = {};

// 🌟 [ฟังก์ชัน] ลบรูปภาพเก่าออกจาก Local Storage อัตโนมัติ
function deleteLocalImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  // แปลง URL ให้ตรงกับ Path จริงในเครื่องแบบเป๊ะๆ รองรับโฟลเดอร์ย่อย
  const filePath = path.join(__dirname, 'public', imageUrl);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') console.error("❌ ลบรูปเก่าล้มเหลว:", err.message);
  });
}

// 🌟 ฟังก์ชันช่วยแปลงอักขระพิเศษเพื่อป้องกัน Telegram API พัง
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 🌟 อัปเดตฟังก์ชันแจ้งเตือนให้พิมพ์ Error แจ้งให้เราทราบ
async function sendAdminAlert(message) {
  try { 
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { 
      chat_id: TELEGRAM_CHAT_ID, 
      text: message, 
      parse_mode: 'HTML' 
    }); 
  } catch (e) { 
    console.error('🛑 [Telegram Error]:', e.response?.data || e.message); 
  }
}

app.get('/api/app-info', (req, res) => res.json({ version: "1.0.0" }));

  
app.post('/api/login-shop', (req, res) => {
  const { contact, password } = req.body;

  // 👑 ระบบดักจับ Super Admin
  db.all(`SELECT key, value FROM superadmin_settings`, [], (err, rows) => {
    const sa = {};
    if (rows) rows.forEach(r => sa[r.key] = r.value);
    
    // ตรวจสอบ Username และ Password
    if (contact === (sa.username || 'superadmin') && password === (sa.password || '1234')) {
      
      // 🌟 ส่งอีเมลแจ้งเตือนเมื่อมีการล็อกอิน (ถ้ามีการผูกอีเมลไว้)
      if (sa.email && sa.email.trim() !== '') {
        const mailOptions = {
          from: transporter.options.auth.user,
          to: sa.email,
          subject: "🚨 แจ้งเตือนการเข้าสู่ระบบ Super Admin",
          text: `ระบบ POS ของคุณมีการเข้าสู่ระบบผ่านบัญชี Super Admin\nเวลา: ${new Date().toLocaleString('th-TH')}\n\nหากคุณไม่ได้เป็นผู้ทำรายการ กรุณาตรวจสอบทันที!`
        };
        transporter.sendMail(mailOptions).catch(e => console.error("SA Mail Error:", e));
      }
      return res.json({ status: "superadmin" });
    }

    // เช็คการล็อกอินของร้านค้าปกติ
    db.get(`SELECT * FROM tenants WHERE (LOWER(email) = LOWER(?) OR phone = ?) AND password = ?`, [contact, contact, password], (err, row) => {
      if (err || !row) return res.json({ status: "error", message: "อีเมล/เบอร์โทร หรือรหัสผ่านไม่ถูกต้อง!" });
      if (row.status !== "ACTIVE") return res.json({ status: "error", message: "⚠️ สถานะร้านค้าไม่พร้อมใช้งาน" });
      const today = new Date(); today.setHours(0,0,0,0);
      const exp = new Date(row.expire_date); exp.setHours(0,0,0,0);
      if (exp < today) return res.json({ status: "error", message: "❌ ระบบของคุณหมดอายุการใช้งานแล้ว" });
      const daysRemaining = Math.ceil((exp - today) / (1000 * 3600 * 24));
      res.json({ status: "success", sheetId: row.sheet_id, shopName: row.shop_name, daysRemaining });
    }); 
  }); 
}); // 🌟 จุดนี้ครับที่วงเล็บหายไป

app.get('/api/settings/:tenantId', (req, res) => {
  db.all(`SELECT key, value FROM settings WHERE tenant_id = ?`, [req.params.tenantId], (err, rows) => {
    const settings = {}; if (rows) rows.forEach(r => settings[r.key] = r.value); res.json(settings);
  });
});

app.post('/api/settings/update', (req, res) => {
  const { tenantId, newSettings } = req.body;
  if (newSettings.shop_logo !== undefined) {
    db.get(`SELECT value FROM settings WHERE tenant_id = ? AND key = 'shop_logo'`, [tenantId], (err, row) => {
      if (row && row.value && row.value !== newSettings.shop_logo) deleteLocalImage(row.value);
    });
  }
  const stmt = db.prepare(`INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?) ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value`);
  for (const [key, value] of Object.entries(newSettings)) stmt.run(tenantId, key, String(value));
  stmt.finalize(); res.json("success");
});

app.get('/api/users/:tenantId', (req, res) => { db.all(`SELECT pin, name, permissions FROM users WHERE tenant_id = ?`, [req.params.tenantId], (err, rows) => res.json(rows || [])); });
app.post('/api/users/save', (req, res) => {
  const { tenantId, user } = req.body; let pin = user.pin.toString().trim(); while (pin.length < 4) pin = "0" + pin;
  db.get(`SELECT pin FROM users WHERE tenant_id = ? AND pin = ?`, [tenantId, pin], (err, row) => {
    if (row) return res.json("duplicate");
    db.run(`INSERT INTO users (tenant_id, pin, name, permissions) VALUES (?, ?, ?, ?)`, [tenantId, pin, user.name, user.permissions], (err) => res.json(err ? "error" : "added"));
  });
});
app.post('/api/users/delete', (req, res) => { db.run(`DELETE FROM users WHERE tenant_id = ? AND pin = ?`, [req.body.tenantId, req.body.pin], function(err) { res.json(this.changes > 0 ? "deleted" : "not_found"); }); });

app.get('/api/products/:tenantId', (req, res) => { db.all(`SELECT id, name, price, image, category, stock, min_stock as minStock, unit FROM products WHERE tenant_id = ?`, [req.params.tenantId], (err, rows) => res.json(rows || [])); });
app.post('/api/products/add', (req, res) => {
  const { tenantId, product } = req.body;
  db.get(`SELECT id FROM products WHERE tenant_id = ? AND id = ?`, [tenantId, product.id], (err, row) => {
    if (row) return res.json("duplicate");
    db.run(`INSERT INTO products (tenant_id, id, name, price, image, category, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, product.id, product.name, product.price, product.image, product.category, product.stock, product.minStock, product.unit], () => res.json("success"));
  });
});
app.post('/api/products/update', (req, res) => {
  const { tenantId, product } = req.body;
  db.get(`SELECT image FROM products WHERE tenant_id = ? AND id = ?`, [tenantId, product.oldId], (err, row) => {
    if (row && row.image && row.image !== product.image) deleteLocalImage(row.image);
    db.run(`UPDATE products SET id=?, name=?, price=?, image=?, category=?, stock=?, min_stock=?, unit=? WHERE tenant_id=? AND id=?`,
      [product.id, product.name, product.price, product.image, product.category, product.stock, product.minStock, product.unit, tenantId, product.oldId], function() { res.json(this.changes > 0 ? "success" : "not_found"); });
  });
});
app.post('/api/products/delete', (req, res) => { 
  const { tenantId, id } = req.body;
  db.get(`SELECT image FROM products WHERE tenant_id = ? AND id = ?`, [tenantId, id], (err, row) => {
    if (row && row.image) deleteLocalImage(row.image);
    db.run(`DELETE FROM products WHERE tenant_id = ? AND id = ?`, [tenantId, id], function() { res.json(this.changes > 0 ? "success" : "not_found"); }); 
  });
});
app.post('/api/update-bulk-stock', (req, res) => {
  const { tenantId, payload } = req.body; JSON.parse(payload).forEach(item => {
    db.get(`SELECT stock FROM products WHERE tenant_id = ? AND id = ?`, [tenantId, item.id], (err, row) => {
      if (row && row.stock !== "ไม่จำกัด") {
        const newStock = (parseInt(row.stock) || 0) + parseInt(item.addQty);
        db.run(`UPDATE products SET stock = ? WHERE tenant_id = ? AND id = ?`, [String(newStock), tenantId, item.id]);
      }
    });
  }); res.json("success");
});

app.post('/api/upload-image', (req, res) => {
  try {
    const { tenantId, base64Data } = req.body; // รับรหัสร้านค้า (tenantId) มาด้วย
    if (!base64Data || !base64Data.includes(',')) return res.json(base64Data);
    
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/); 
    const ext = matches ? (matches[1].split('/')[1] || 'png') : 'png';
    const buffer = Buffer.from(matches ? matches[2] : base64Data, 'base64'); 
    const safeName = `img_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
    
    // สร้างโฟลเดอร์ตามรหัสร้าน (ถ้ายังไม่มี)
    const shopDir = path.join(__dirname, 'public', 'uploads', tenantId || 'general');
    if (!fs.existsSync(shopDir)) {
      fs.mkdirSync(shopDir, { recursive: true });
    }

    fs.writeFileSync(path.join(shopDir, safeName), buffer); 
    // คืนค่า Path รูปภาพที่อยู่ตามรหัสโฟลเดอร์ร้าน
    res.json(`/uploads/${tenantId || 'general'}/${safeName}`);
  } catch(e) { res.json("error: " + e.message); }
});

app.post('/api/save-order', (req, res) => {
  const { tenantId, payload } = req.body; const orderData = JSON.parse(payload); const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  const recId = "REC" + d.getFullYear().toString().substr(-2) + pad(d.getMonth()+1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const timestamp = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  db.run(`INSERT INTO sales_log (tenant_id, timestamp, receipt_id, customer_name, items_str, total, payment_method, phone, seller) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, timestamp, recId, orderData.customerName || "-", orderData.itemsStr, orderData.total, orderData.paymentMethod, orderData.phone || "-", orderData.seller || "Admin"], function(err) {
      if (err) return res.json({ status: "error", message: err.message });
      if (orderData.cartItems) {
        orderData.cartItems.forEach(item => {
          db.get(`SELECT stock FROM products WHERE tenant_id = ? AND id = ?`, [tenantId, item.id], (e, row) => {
            if (row && row.stock !== "ไม่จำกัด") {
              const newStock = Math.max(0, parseInt(row.stock) - parseInt(item.qty));
              db.run(`UPDATE products SET stock = ? WHERE tenant_id = ? AND id = ?`, [String(newStock), tenantId, item.id]);
            }
          });
        });
      }
      res.json({ status: "success", receiptId: recId });
    });
});
app.post('/api/void-order', (req, res) => {
  const { tenantId, receiptId } = req.body;
  db.get(`SELECT items_str, receipt_id FROM sales_log WHERE tenant_id = ? AND receipt_id = ?`, [tenantId, receiptId], (err, row) => {
    if (!row) return res.json("not_found");
    if (row.receipt_id.includes("(ยกเลิก)")) return res.json("already_voided");
    const itemsArr = row.items_str.split(' | '); const itemsToRestore = [];
    itemsArr.forEach(str => {
      if (str.startsWith('[หักส่วนลด') || str.startsWith('[คืนแล้ว]')) return;
      const match = str.match(/^(.*?)\s*\(x(\d+)/); if (match) itemsToRestore.push({ name: match[1].trim(), qty: parseInt(match[2], 10) });
    });
    db.run(`UPDATE sales_log SET receipt_id = '(ยกเลิก) ' || receipt_id WHERE tenant_id = ? AND receipt_id = ?`, [tenantId, receiptId], function(err) {
      if (err) return res.json("error");
      itemsToRestore.forEach(item => {
        db.get(`SELECT id, stock FROM products WHERE tenant_id = ? AND name = ?`, [tenantId, item.name], (err, prod) => {
          if (prod && prod.stock !== "ไม่จำกัด") {
            const newStock = (parseInt(prod.stock) || 0) + item.qty;
            db.run(`UPDATE products SET stock = ? WHERE tenant_id = ? AND id = ?`, [String(newStock), tenantId, prod.id]);
          }
        });
      });
      res.json("success");
    });
  });
});
app.post('/api/void-partial-item', (req, res) => {
  const { tenantId, receiptId, itemIndex, returnQty } = req.body;
  db.get(`SELECT items_str, total, receipt_id FROM sales_log WHERE tenant_id = ? AND receipt_id = ?`, [tenantId, receiptId], (err, row) => {
    if (!row) return res.json("not_found");
    if (row.receipt_id.includes("(ยกเลิก)")) return res.json("already_voided");
    let itemsArr = row.items_str.split(' | ');
    if (itemIndex < 0 || itemIndex >= itemsArr.length) return res.json("invalid_item");
    let targetItemStr = itemsArr[itemIndex];
    if (targetItemStr.startsWith('[หักส่วนลด') || targetItemStr.startsWith('[คืนแล้ว]')) return res.json("cannot_refund");
    const match = targetItemStr.match(/^(.*?)\s*\(x(\d+)(?:\s+(.*?))?\)\s*=\s*([\d\.,]+)\s*บ\./);
    if (!match) return res.json("parse_error");
    const name = match[1].trim(); const currentQty = parseInt(match[2], 10);
    const unit = match[3] ? match[3].trim() : ''; const currentLineTotal = parseFloat(match[4].replace(/,/g, ''));
    const pricePerUnit = currentLineTotal / currentQty; const retQty = parseInt(returnQty, 10);
    if (retQty <= 0 || retQty > currentQty) return res.json("invalid_qty");
    const newQty = currentQty - retQty; const newTotal = pricePerUnit * newQty; const refundAmount = pricePerUnit * retQty;
    if (newQty === 0) itemsArr[itemIndex] = `[คืนแล้ว] ${name} (x0${unit ? ' ' + unit : ''}) = 0 บ.`;
    else itemsArr[itemIndex] = `${name} (x${newQty}${unit ? ' ' + unit : ''}) = ${newTotal} บ.`;
    const newItemsStr = itemsArr.join(' | ');
    let newBillTotal = parseFloat(row.total) - refundAmount; if (newBillTotal < 0) newBillTotal = 0;
    db.run(`UPDATE sales_log SET items_str = ?, total = ? WHERE tenant_id = ? AND receipt_id = ?`, [newItemsStr, newBillTotal, tenantId, receiptId], function(err) {
      if (err) return res.json("error");
      db.get(`SELECT id, stock FROM products WHERE tenant_id = ? AND name = ?`, [tenantId, name], (err, prod) => {
        if (prod && prod.stock !== "ไม่จำกัด") {
          const newStock = (parseInt(prod.stock) || 0) + retQty;
          db.run(`UPDATE products SET stock = ? WHERE tenant_id = ? AND id = ?`, [String(newStock), tenantId, prod.id]);
        }
      });
      res.json("success");
    });
  });
});
app.post('/api/delete-test-bills', (req, res) => {
  const { tenantId, receiptIdsArray } = req.body; let count = 0;
  receiptIdsArray.forEach(id => {
    db.run(`DELETE FROM sales_log WHERE tenant_id = ? AND (receipt_id = ? OR receipt_id LIKE ?)`, [tenantId, id, `%${id}%`], function() { count += this.changes; });
  }); setTimeout(() => res.json({ status: 'success', count }), 500);
});

app.get('/api/dashboard/:tenantId', (req, res) => { db.all(`SELECT timestamp as dateStr, receipt_id as receiptId, items_str as items, total, payment_method as method FROM sales_log WHERE tenant_id = ? ORDER BY id DESC`, [req.params.tenantId], (err, rows) => res.json(rows || [])); });
app.post('/api/log-action', (req, res) => {
  const { tenantId, staffName, action, detail } = req.body; const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  db.run(`INSERT INTO activity_log (tenant_id, timestamp, staff_name, action, detail) VALUES (?, ?, ?, ?, ?)`, [tenantId, timestamp, staffName, action, detail], () => res.json({ status: "success" }));
});
app.get('/api/activity-logs/:tenantId', (req, res) => { db.all(`SELECT timestamp, staff_name as staff, action, detail FROM activity_log WHERE tenant_id = ? ORDER BY id DESC LIMIT 300`, [req.params.tenantId], (err, rows) => res.json(rows || [])); });

// 9. SaaS Master APIs
function padStr(n) { return String(n).padStart(2, '0'); }
app.get('/api/tenant-info/:sheetId', (req, res) => {
  db.get(`SELECT email, shop_name as shopName, expire_date, renew_status, renew_notified FROM tenants WHERE sheet_id = ?`, [req.params.sheetId], (err, row) => {
    if (!row) return res.json(null);
    const today = new Date(); today.setHours(0,0,0,0); const exp = new Date(row.expire_date); exp.setHours(0,0,0,0);
    const daysRemaining = Math.ceil((exp - today) / (1000 * 3600 * 24));
    res.json({ 
      email: row.email, 
      shopName: row.shopName, 
      expireDate: `${padStr(exp.getDate())}/${padStr(exp.getMonth()+1)}/${exp.getFullYear()}`, 
      daysRemaining,
      renewStatus: row.renew_status || 'NONE',
      renewNotified: row.renew_notified !== undefined ? row.renew_notified : 1
    });
  });
});

// 🌟 API สำหรับล้างสถานะ Pop-up เมื่อลูกค้าสลัดปิดแจ้งเตือนแล้ว
app.post('/api/clear-renew-notify', (req, res) => {
  const { sheetId } = req.body;
  db.run(`UPDATE tenants SET renew_notified = 1 WHERE sheet_id = ?`, [sheetId], () => {
    res.json({ status: "success" });
  });
});

// 🌟 ปลดล็อก: เปิดใช้งานระบบส่ง OTP สมัครร้านผ่าน Email
app.post('/api/request-register-otp', (req, res) => {
  const { email, phone } = req.body;
  db.get(`SELECT id FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, phone], (err, row) => {
    if (row) return res.json({ status: "error", message: "Email หรือ เบอร์โทรศัพท์ นี้มีในระบบแล้ว" });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore["REG_" + email] = otp;

    const mailOptions = {
      from: transporter.options.auth.user,
      to: email,
      subject: "รหัส OTP สำหรับยืนยันการสมัครเปิดร้าน POS",
      text: `สวัสดีครับ,\n\nรหัส OTP สำหรับยืนยันอีเมลของคุณคือ: ${otp}\n\nรหัสนี้มีอายุ 10 นาทีครับ`
    };
    transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err));
    console.log(`🔑 [OTP สมัครร้าน] Email: ${email} -> รหัสคือ: ${otp}`);
    res.json({ status: "success" });
  });
});

// 🌟 ปลดล็อก: ตรวจสอบ OTP และสร้างร้าน
// 🌟 ปลดล็อก: สร้างร้านทันทีโดยไม่ต้องใช้ OTP
app.post('/api/verify-and-create-shop', (req, res) => {
  const { password, shopName, email, phone } = req.body; // ลบ otp ออกจากการรับค่า
  
  // เช็คอีเมลหรือเบอร์โทรซ้ำก่อนสร้างร้าน
  db.get(`SELECT id FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, phone], (err, row) => {
    if (row) return res.json({ status: "error", message: "Email หรือ เบอร์โทรศัพท์ นี้มีในระบบแล้ว" });
    
    const sheetId = "SHOP_" + Date.now();
    const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
    const expStr = expDate.toISOString().split('T')[0];

    db.run(`INSERT INTO tenants (user, password, shop_name, email, phone, sheet_id, status, expire_date) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [email, password, shopName, email, phone, sheetId, expStr], (err) => {
        if (err) return res.json({ status: "error", message: err.message });
        
        // ส่งแจ้งเตือนเข้า Telegram เหมือนเดิม
        sendAdminAlert(`🎉 <b>มีร้านค้าสมัครใหม่!</b>\nอีเมล: ${escapeHtml(email)}\nร้าน: ${escapeHtml(shopName)}\nเบอร์: ${escapeHtml(phone)}`);
        
        res.json({ status: "success", expireDate: `${padStr(expDate.getDate())}/${padStr(expDate.getMonth()+1)}/${expDate.getFullYear()}` });
      });
  });
});

// 🌟 ปลดล็อก: เปิดใช้งานระบบส่ง OTP ลืมรหัสผ่าน
app.post('/api/request-reset-otp', (req, res) => {
  const { email } = req.body;
  db.get(`SELECT email FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, email], (err, row) => {
    if (err || !row) return res.json({ status: "error", message: "ไม่พบ อีเมล หรือ เบอร์โทร นี้ในระบบ" });
    
    const targetEmail = row.email; // ใช้อีเมลจริงที่เจอในระบบสำหรับส่ง OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore["RES_" + targetEmail] = otp;

    const mailOptions = {
      from: transporter.options.auth.user,
      to: targetEmail,
      subject: "รหัส OTP สำหรับรีเซ็ตรหัสผ่าน",
      text: `รหัส OTP ของคุณคือ: ${otp}\nหากคุณไม่ได้ทำรายการนี้ โปรดเพิกเฉยต่ออีเมลนี้`
    };
    transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err));
    console.log(`🔑 [OTP รีเซ็ตรหัส] Target Email: ${targetEmail} -> รหัสคือ: ${otp}`);
    res.json({ status: "success", realEmail: targetEmail });
  });
});

// 🌟 ปลดล็อก: ระบบรีเซ็ตรหัสผ่านแบบเช็ค อีเมล + เบอร์โทร (ตั้งรหัสเอง)
app.post('/api/reset-password-direct', (req, res) => {
  const { email, phone, newPassword } = req.body; // รับค่า newPassword มาด้วย
  
  // เช็คว่าอีเมลและเบอร์โทรตรงกับในฐานข้อมูลหรือไม่
  db.get(`SELECT email, shop_name FROM tenants WHERE LOWER(email)=LOWER(?) AND phone=?`, [email, phone], (err, row) => {
    if (err || !row) return res.json({ status: "error", message: "❌ อีเมล หรือ เบอร์โทรศัพท์ ไม่ถูกต้อง" });
    
    // อัปเดตรหัสผ่านใหม่ที่ลูกค้าตั้งเองลงฐานข้อมูล
    db.run(`UPDATE tenants SET password = ? WHERE LOWER(email)=LOWER(?) AND phone=?`, [newPassword, email, phone], (err) => {
      if (err) return res.json({ status: "error", message: "เกิดข้อผิดพลาดในการเปลี่ยนรหัส" });
      
      // ส่งแค่สถานะสำเร็จและชื่อร้านกลับไป
      res.json({ status: "success", shopName: row.shop_name });
    });
  });
});

app.post('/api/check-renew-email', (req, res) => {
  const { email } = req.body; // รับค่ามาซึ่งอาจเป็นได้ทั้ง Email หรือ Phone
  db.get(`SELECT email, shop_name FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, email], (err, row) => {
    if (err || !row) return res.json({ status: "error", message: "ไม่พบข้อมูลร้านค้าจาก อีเมล หรือ เบอร์โทร นี้" });
    // ส่งทั้ง shop_name และ email จริงกลับไป (กรณีลูกค้าพิมพ์เบอร์มา จะได้ใช้อีเมลจริงส่งแจ้งเตือนต่อ)
    res.json({ status: "success", shopName: row.shop_name, realEmail: row.email });
  });
});

const FormData = require('form-data');

// 🌟 ฟังก์ชันแปลงตัวอักษรพิเศษ ป้องกัน Telegram Reject ข้อความ HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

app.post(['/api/upload-slip-notify', '/api/upload-quick-renew-slip'], async (req, res) => {
  console.log("📥 [API แจ้งสลิป] ได้รับข้อมูลจากอีเมล:", req.body.email);
  try {
    const { email, shopName, pkgName, price, base64Data } = req.body; 
	db.run(`UPDATE tenants SET renew_status = 'PENDING' WHERE LOWER(email) = LOWER(?)`, [email]);
    let fileUrl = "";

    // 1. สร้างโฟลเดอร์ public/uploads/slip อัตโนมัติ
    const slipDir = path.join(__dirname, 'public', 'uploads', 'slip');
    if (!fs.existsSync(slipDir)) {
      fs.mkdirSync(slipDir, { recursive: true });
    }

    // 2. แปลงรูป Base64 และบันทึกลงเครื่อง
    if (base64Data && base64Data.includes(',')) {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/); 
      const ext = matches ? (matches[1].split('/')[1] || 'jpg') : 'jpg';
      const buffer = Buffer.from(matches ? matches[2] : base64Data, 'base64'); 
      const safeName = `slip_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
      
      fs.writeFileSync(path.join(slipDir, safeName), buffer); 
      fileUrl = `/uploads/slip/${safeName}`;
    }

    // 🌟 3. กรองตัวอักษรพิเศษ + ตัดชื่อแพ็กเกจให้เหลือเฉพาะรหัส (เช่น 1M, 3M, 6M, 12M)
    const cleanShop = String(shopName || '-').replace(/[&<>]/g, '');
    const cleanEmail = String(email || '-').trim();
    const cleanPkg = String(pkgName || '1M').split('|')[0].trim(); 
    const cleanPrice = String(price || '0').split('|')[0].trim();

    // 1. เข้ารหัส URL ป้องกันช่องว่างหรือภาษาไทยที่ทำให้ลิงก์ใน Telegram พัง
    const fullSlipUrl = `http://${req.get('host')}${fileUrl}`;
    const safeUrl = encodeURI(fullSlipUrl);

    // 2. สร้างข้อความแจ้งเตือน (ใช้ escapeHtml ป้องกันบั๊ก)
    const message = `💳 <b>แจ้งโอนเงินต่ออายุ</b>\n\n🏢 ร้าน: ${escapeHtml(shopName)}\n📧 อีเมล: ${escapeHtml(email)}\n📦 แพ็กเกจ: ${escapeHtml(pkgName)}\n💰 ยอดเงิน: ${escapeHtml(price)} บาท\n\n📄 <a href="${safeUrl}">คลิกดูสลิปโอนเงิน</a>`;
    
    // 3. ย่อ callback_data ให้สั้น ป้องกันเกินโควต้า 64 ตัวอักษรของ Telegram
    const approveData = `APPROVE_${cleanPkg}_${cleanEmail}`.substring(0, 64);
    const rejectData = `REJECT_${cleanEmail}`.substring(0, 64);

    const keyboard = {
      inline_keyboard: [
        [ { text: `✅ อนุมัติ ${cleanPkg}`, callback_data: approveData } ],
        [ { text: "❌ ไม่อนุมัติ", callback_data: rejectData } ]
      ]
    };

    console.log("📤 กำลังส่งแจ้งเตือนเข้า Telegram...");

    // 🌟 6. ยิงส่งเข้า Telegram
    const response = await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { 
      chat_id: TELEGRAM_CHAT_ID, 
      text: message, 
      parse_mode: "HTML", 
      reply_markup: keyboard 
    }, { timeout: 30000 });

    console.log("🚀 [Telegram Success] ส่งเข้าแชทสำเร็จแล้ว!");
    res.json({ status: "success" });

  } catch(e) { 
    console.error("❌ [Telegram Error Detail]:");
    if (e.response && e.response.data) {
      console.error(JSON.stringify(e.response.data, null, 2));
    } else {
      console.error(e.message);
    }
    // ตอบกลับ success หน้าบ้านจะได้ไม่หมุนค้าง
    res.json({ status: "success", note: "telegram_failed" }); 
  }
});

let lastUpdateId = 0;
async function pollTelegram() {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    if (response.data.ok && response.data.result.length > 0) {
      for (const update of response.data.result) {
        lastUpdateId = update.update_id;
        if (update.callback_query) {
          const callbackData = update.callback_query.data;
          const chatId = update.callback_query.message.chat.id;
          const messageId = update.callback_query.message.message_id;
          const parts = callbackData.split('_');
          
          if (parts[0] === "APPROVE") {
            const pkg = parts[1]; const email = parts[2];
            let addMonths = 0;
            if (pkg === "1M") addMonths = 1; else if (pkg === "3M") addMonths = 3; else if (pkg === "6M") addMonths = 6; else if (pkg === "12M") addMonths = 12;

            db.get(`SELECT expire_date, shop_name FROM tenants WHERE LOWER(email) = LOWER(?)`, [email], (err, row) => {
              if (row) {
                const currentExp = new Date(row.expire_date); const today = new Date();
                let baseDate = (currentExp < today) ? today : currentExp;
                baseDate.setMonth(baseDate.getMonth() + addMonths);
                const newExpStr = baseDate.toISOString().split('T')[0];

                db.run(`UPDATE tenants SET expire_date = ?, renew_status = 'NONE', renew_notified = 0 WHERE LOWER(email) = LOWER(?)`, [newExpStr, email], async () => {
                  
                  // 🌟 ส่งอีเมลแจ้งเตือนลูกค้าว่าแอดมินอนุมัติแล้ว
                  const mailOptions = {
                    from: transporter.options.auth.user,
                    to: email,
                    subject: `🎉 ยืนยันการต่ออายุระบบ POS สำเร็จ - ร้าน ${row.shop_name}`,
                    text: `สวัสดีครับ คุณลูกค้า (ร้าน ${row.shop_name})\n\nระบบได้รับการยืนยันการชำระเงิน และดำเนินการต่ออายุการใช้งานระบบ POS ของคุณเรียบร้อยแล้วครับ\n\n⏰ วันหมดอายุใหม่ของคุณคือ: ${padStr(baseDate.getDate())}/${padStr(baseDate.getMonth()+1)}/${baseDate.getFullYear()}\n\nขอบคุณที่ใช้บริการครับ!`
                  };
                  transporter.sendMail(mailOptions).catch(err => console.error("Send Confirm Mail Error:", err));

                  const newText = `✅ <b>อนุมัติการต่ออายุเรียบร้อยแล้ว</b>\nร้าน: ${row.shop_name}\nอัปเดตวันหมดอายุใหม่เป็น: ${padStr(baseDate.getDate())}/${padStr(baseDate.getMonth()+1)}/${baseDate.getFullYear()}`;
                  await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, { chat_id: chatId, message_id: messageId, text: newText, parse_mode: "HTML" });
                });
              }
            });
          } else if (parts[0] === "REJECT") {
            await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, { chat_id: chatId, message_id: messageId, text: "❌ <b>ปฏิเสธการต่ออายุ</b> (ข้อมูลสลิปไม่ถูกต้อง)", parse_mode: "HTML" });
          }
        }
      }
    }
  } catch (e) { /* Ignore timeout errors */ }
  setTimeout(pollTelegram, 2000);
}
pollTelegram();

// =================================================================
// 📥 API: รับข้อมูลจาก Excel เพื่ออัปเดต (Settings & Products)
// =================================================================
app.post('/api/import-excel', (req, res) => {
  const { tenantId, payload } = req.body;
  if (!tenantId || !payload) return res.json({ status: "error", message: "ข้อมูลไม่ครบถ้วน" });
  
  try {
    const data = JSON.parse(payload);
    const settings = data.settings || {};
    const products = data.products || [];

    // 1. อัปเดตการตั้งค่าร้านค้า
    if (Object.keys(settings).length > 0) {
      const stmt = db.prepare(`INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?) ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value`);
      for (const [key, value] of Object.entries(settings)) {
        stmt.run(tenantId, key, String(value));
      }
      stmt.finalize();
    }

    // 2. อัปเดตหรือเพิ่มสินค้าใหม่
    if (products.length > 0) {
      const pStmt = db.prepare(`INSERT INTO products (tenant_id, id, name, price, image, category, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, id) DO UPDATE SET name=excluded.name, price=excluded.price, image=excluded.image, category=excluded.category, stock=excluded.stock, min_stock=excluded.min_stock, unit=excluded.unit`);
      products.forEach(p => {
        pStmt.run(tenantId, p.id, p.name, p.price, p.image, p.category, p.stock, p.minStock, p.unit);
      });
      pStmt.finalize();
    }
    
    res.json({ status: "success" });
  } catch (e) {
    res.json({ status: "error", message: e.message });
  }
});

// =================================================================
// 👑 ระบบ Super Admin (จัดการร้านค้า)
// =================================================================
// =================================================================
// 👑 ระบบ Super Admin (จัดการร้านค้า)
// =================================================================
app.get('/api/superadmin/tenants', (req, res) => {
  // 🌟 เพิ่มการดึง password ออกมาแสดง
  db.all(`SELECT id, shop_name, email, phone, password, expire_date, sheet_id, status FROM tenants ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.json({ status: "error", message: err.message });
    res.json(rows || []);
  });
});

app.post('/api/superadmin/delete-tenant', (req, res) => {
  const { sheetId } = req.body;

  // 1. ระเบิดโฟลเดอร์รูปภาพของร้านนี้ทิ้งทั้งโฟลเดอร์ (หายเกลี้ยงแน่นอน)
  const shopDirPath = path.join(__dirname, 'public', 'uploads', sheetId);
  if (fs.existsSync(shopDirPath)) {
    fs.rmSync(shopDirPath, { recursive: true, force: true });
  }

  // 2. กวาดล้างข้อมูลในฐานข้อมูล
  db.serialize(() => {
    db.run(`DELETE FROM tenants WHERE sheet_id = ?`, [sheetId]);
    db.run(`DELETE FROM users WHERE tenant_id = ?`, [sheetId]);
    db.run(`DELETE FROM products WHERE tenant_id = ?`, [sheetId]);
    db.run(`DELETE FROM sales_log WHERE tenant_id = ?`, [sheetId]);
    db.run(`DELETE FROM settings WHERE tenant_id = ?`, [sheetId]);
    db.run(`DELETE FROM activity_log WHERE tenant_id = ?`, [sheetId], function(err) {
      if (err) return res.json({ status: "error", message: err.message });
      res.json({ status: "success" });
    });
  });
});

// 🌟 API สำหรับแก้ไข รหัสผ่าน และ วันหมดอายุ
app.post('/api/superadmin/edit-tenant', (req, res) => {
  const { sheetId, password, expireDate } = req.body;
  db.run(`UPDATE tenants SET password = ?, expire_date = ? WHERE sheet_id = ?`, [password, expireDate, sheetId], function(err) {
    if (err) return res.json({ status: "error", message: err.message });
    res.json({ status: "success" });
  });
});
// =================================================================
// 👑 API สำหรับตั้งค่าบัญชี Super Admin
// =================================================================
app.get('/api/superadmin/settings', (req, res) => {
  db.all(`SELECT key, value FROM superadmin_settings`, [], (err, rows) => {
    const sa = {}; if (rows) rows.forEach(r => sa[r.key] = r.value);
    res.json(sa);
  });
});

app.post('/api/superadmin/request-otp', (req, res) => {
  db.get(`SELECT value FROM superadmin_settings WHERE key = 'email'`, [], (err, row) => {
    const email = row ? row.value : '';
    if (!email || email.trim() === '') return res.json({ status: "no_email_bound" }); 
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore["SA_OTP"] = otp; // บันทึก OTP ในหน่วยความจำ

    const mailOptions = {
      from: transporter.options.auth.user,
      to: email,
      subject: "รหัส OTP สำหรับเปลี่ยนแปลงข้อมูล Super Admin",
      text: `รหัส OTP ของคุณคือ: ${otp}\nใช้สำหรับยืนยันการเปลี่ยนแปลงข้อมูล (อีเมล/Username/Password)`
    };
    transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err));
    res.json({ status: "success", email: email });
  });
});

app.post('/api/superadmin/update-settings', (req, res) => {
  let { otp, newEmail, newUsername, newPassword } = req.body;
  
  db.get(`SELECT value FROM superadmin_settings WHERE key = 'email'`, [], (err, row) => {
    const currentEmail = row ? row.value : '';
    
    // ตรวจสอบ OTP หากมีการผูกอีเมลเดิมเอาไว้
    if (currentEmail && currentEmail.trim() !== '' && otpStore["SA_OTP"] !== otp) {
      return res.json({ status: "error", message: "รหัส OTP ไม่ถูกต้อง" });
    }

    // 🌟 ข้อ 1: ถ้าลบอีเมลออก (ยกเลิกผูก) ให้บังคับค่ากลับเป็นค่าเริ่มต้นเสมอ
    if (!newEmail || newEmail.trim() === '') {
      newUsername = 'superadmin';
      newPassword = '1234';
    }

    // อัปเดตข้อมูลลงฐานข้อมูล
    const stmt = db.prepare(`UPDATE superadmin_settings SET value = ? WHERE key = ?`);
    stmt.run(newEmail, 'email');
    stmt.run(newUsername, 'username');
    stmt.run(newPassword, 'password');
    stmt.finalize();
    
    delete otpStore["SA_OTP"]; // เคลียร์ OTP ทิ้งหลังใช้เสร็จ

    // 🌟 ข้อ 3 และ 4: หากมีการผูกอีเมลไว้ ให้ส่งข้อมูล Username/Password กลับไปที่อีเมลทันทีเพื่อกันลืม
    if (newEmail && newEmail.trim() !== '') {
      const mailOptions = {
        from: transporter.options.auth.user,
        to: newEmail,
        subject: "🔐 ข้อมูลบัญชี Super Admin ของคุณได้รับการอัปเดต",
        text: `ระบบได้รับการบันทึกข้อมูล Super Admin ของคุณเรียบร้อยแล้ว!\n\nโปรดเก็บข้อมูลนี้ไว้เป็นความลับ:\n- Username: ${newUsername}\n- Password: ${newPassword}\n\n*หมายเหตุ: หากคุณต้องการยกเลิกผูกอีเมล รหัสผ่านจะถูกรีเซ็ตกลับเป็นค่าเริ่มต้น (superadmin/1234) ทันที`
      };
      transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err));
    }

    res.json({ status: "success" });
  });
});



// 🌟 API สำหรับเพิ่มร้านค้าใหม่เอง (แอดมินสร้างให้)
app.post('/api/superadmin/add-tenant', (req, res) => {
  const { shopName, email, phone, password, expireDate } = req.body;
  db.get(`SELECT id FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, phone], (err, row) => {
    if (row) return res.json({ status: "error", message: "Email หรือ เบอร์โทรศัพท์ นี้มีคนใช้งานแล้ว" });
    
    const sheetId = "SHOP_" + Date.now();
    db.run(`INSERT INTO tenants (user, password, shop_name, email, phone, sheet_id, status, expire_date) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [email, password, shopName, email, phone, sheetId, expireDate], (err) => {
        if (err) return res.json({ status: "error", message: err.message });
        res.json({ status: "success" });
      });
  });
});

// =================================================================
// 🌟 Socket.io: ระบบจอลูกค้าออนไลน์ (CFD)
// =================================================================
io.on('connection', (socket) => {
  // เมื่อ iPad สแกน QR Code จะส่งรหัสร้านมาขอเข้าห้อง
  socket.on('join_shop_room', (shopId) => {
    socket.join(shopId);
    console.log(`📱 จอลูกค้า (CFD) เชื่อมต่อร้าน: ${shopId}`);
  });

  // เมื่อแคชเชียร์ยิงบาร์โค้ด จะส่งข้อมูลมากระจายให้ iPad ในห้องนั้นๆ
  socket.on('update_cfd', (data) => {
    const room = data.shopId;
    if (room) {
      socket.to(room).emit('cfd_data_sync', data);
    }
  });
});

// =================================================================
// 🤖 API: ระบบ AI Chat Support (Gemini)
// =================================================================
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ⚠️ อย่าลืมเอา API Key ของ Gemini มาใส่ตรงนี้นะครับ (สมัครฟรีที่ Google AI Studio)
const genAI = new GoogleGenerativeAI(""); 

// ใส่ Knowledge Base และ System Prompt ที่เราเตรียมไว้
const aiSystemPrompt = `
คุณคือ "AI ผู้ช่วยดูแลลูกค้า" ประจำระบบ POS Management System หน้าที่คุณคือตอบคำถามลูกค้าตามข้อมูลอ้างอิงที่ให้มาเท่านั้น ห้ามเดาข้อมูลเองเด็ดขาด หากไม่รู้ให้บอกว่าให้ติดต่อแอดมินที่ LINE: @yourline

[ข้อมูลคู่มือระบบ POS]
- หากลืมรหัสผ่าน ให้กด "ลืมรหัส" กรอกอีเมล เบอร์โทร และรหัสผ่านใหม่
- การต่ออายุ ให้กด "ต่ออายุ" กรอกอีเมล เลือกแพ็กเกจ (เช่น 1 เดือน 150 บาท) โอนเงินแล้วแนบสลิป
- หน้าจอ POS มี 2 โหมด คือ โหมดสแกนบาร์โค้ด และ โหมดจิ้มรูป
- การยกเลิกบิลต้องใช้สิทธิ์ ADMIN ทำในเมนูบิลย้อนหลังหน้า POS เท่านั้น สต็อกจะคืนเข้าคลังอัตโนมัติ
- สินค้าที่หมดสต็อกจะกลายเป็นสีเทาและกดขายไม่ได้
`;

app.post('/api/ai-chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ reply: "กรุณาพิมพ์ข้อความ" });

  try {
    // ใช้โมเดล gemini-1.5-flash ซึ่งประมวลผลเร็วและเหมาะกับแชท
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: aiSystemPrompt
    });
    
    const result = await model.generateContent(message);
    const response = await result.response;
    res.json({ reply: response.text() });
  } catch (error) {
    console.error("AI Error:", error);
    res.json({ reply: "ขออภัยครับ ตอนนี้ระบบ AI ขัดข้องชั่วคราว รบกวนติดต่อแอดมินนะครับ 🙏" });
  }
});

// เปลี่ยนจาก app.listen เป็น server.listen
server.listen(3000, () => console.log('🚀 POS Application Server running on http://localhost:3000'));