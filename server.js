const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const axios = require('axios');
const nodemailer = require('nodemailer'); 
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

db.run(`ALTER TABLE tenants ADD COLUMN renew_status TEXT DEFAULT 'NONE'`, () => {});
db.run(`ALTER TABLE tenants ADD COLUMN renew_notified INTEGER DEFAULT 1`, () => {});

const TELEGRAM_BOT_TOKEN = "8383540467:AAHP2VfSU0U7riTyhrfq-dQHOQgiTmd8t0Y";
const TELEGRAM_CHAT_ID = "5519991585";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'my.server.pos.online@gmail.com',
    pass: 'blfllltvbernypps'
  }
});

const otpStore = {};

// 🌟 ระบบแปลภาษาฝั่ง Backend (Dictionary)
const tMsg = {
  th: {
    login_err: "อีเมล/เบอร์โทร หรือรหัสผ่านไม่ถูกต้อง!",
    inactive: "⚠️ สถานะร้านค้าไม่พร้อมใช้งาน",
    expired: "❌ ระบบของคุณหมดอายุการใช้งานแล้ว",
    dup: "Email หรือ เบอร์โทรศัพท์ นี้มีในระบบแล้ว",
    not_found: "ไม่พบ อีเมล หรือ เบอร์โทร นี้ในระบบ",
    not_found_contact: "❌ อีเมล หรือ เบอร์โทรศัพท์ ไม่ถูกต้อง",
    reset_err: "เกิดข้อผิดพลาดในการเปลี่ยนรหัส",
    reg_sub: "รหัส OTP สำหรับยืนยันการสมัครเปิดร้าน POS",
    reg_body: "สวัสดีครับ,\n\nรหัส OTP สำหรับยืนยันอีเมลของคุณคือ: {otp}\n\nรหัสนี้มีอายุ 10 นาทีครับ",
    res_sub: "รหัส OTP สำหรับรีเซ็ตรหัสผ่าน",
    res_body: "รหัส OTP ของคุณคือ: {otp}\nหากคุณไม่ได้ทำรายการนี้ โปรดเพิกเฉยต่ออีเมลนี้"
  },
  en: {
    login_err: "Invalid email/phone or password!",
    inactive: "⚠️ Shop is currently inactive",
    expired: "❌ Your system has expired",
    dup: "This Email or Phone already exists",
    not_found: "Email or Phone not found",
    not_found_contact: "❌ Invalid Email or Phone",
    reset_err: "Error occurred while changing password",
    reg_sub: "OTP for POS Registration",
    reg_body: "Hello,\n\nYour OTP for registration is: {otp}\n\nThis code is valid for 10 minutes.",
    res_sub: "OTP for Password Reset",
    res_body: "Your OTP is: {otp}\nIf you didn't request this, please ignore this email."
  }
};

// ฟังก์ชันผู้ช่วยดึงคำแปล
const t = (key, lang = 'th', params = {}) => {
  let str = (tMsg[lang] || tMsg['th'])[key] || key;
  for (let k in params) str = str.replace(`{${k}}`, params[k]);
  return str;
};

function deleteLocalImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  const fileName = imageUrl.replace('/uploads/', '');
  const filePath = path.join(__dirname, 'public', 'uploads', fileName);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') console.error("❌ ลบรูปเก่าล้มเหลว:", err.message);
  });
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function sendAdminAlert(message) {
  try { 
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }); 
  } catch (e) { console.error('🛑 [Telegram Error]:', e.response?.data || e.message); }
}

app.get('/api/app-info', (req, res) => res.json({ version: "1.0.0" }));

app.post('/api/login-shop', (req, res) => {
  const { contact, password, lang = 'th' } = req.body; // รับค่า lang จากหน้าเว็บ

  if (contact === 'superadmin' && password === '12345678') { return res.json({ status: "superadmin" }); }

  db.get(`SELECT * FROM tenants WHERE (LOWER(email) = LOWER(?) OR phone = ?) AND password = ?`, [contact, contact, password], (err, row) => {
    if (err || !row) return res.json({ status: "error", message: t('login_err', lang) });
    if (row.status !== "ACTIVE") return res.json({ status: "error", message: t('inactive', lang) });
    
    const today = new Date(); today.setHours(0,0,0,0);
    const exp = new Date(row.expire_date); exp.setHours(0,0,0,0);
    if (exp < today) return res.json({ status: "error", message: t('expired', lang) });
    
    const daysRemaining = Math.ceil((exp - today) / (1000 * 3600 * 24));
    res.json({ status: "success", sheetId: row.sheet_id, shopName: row.shop_name, daysRemaining });
  });
});

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
    const { base64Data } = req.body; if (!base64Data || !base64Data.includes(',')) return res.json(base64Data);
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/); const ext = matches ? (matches[1].split('/')[1] || 'png') : 'png';
    const buffer = Buffer.from(matches ? matches[2] : base64Data, 'base64'); const safeName = `img_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
    fs.writeFileSync(path.join(__dirname, 'public', 'uploads', safeName), buffer); res.json(`/uploads/${safeName}`);
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

function padStr(n) { return String(n).padStart(2, '0'); }
app.get('/api/tenant-info/:sheetId', (req, res) => {
  db.get(`SELECT email, shop_name as shopName, expire_date, renew_status, renew_notified FROM tenants WHERE sheet_id = ?`, [req.params.sheetId], (err, row) => {
    if (!row) return res.json(null);
    const today = new Date(); today.setHours(0,0,0,0); const exp = new Date(row.expire_date); exp.setHours(0,0,0,0);
    const daysRemaining = Math.ceil((exp - today) / (1000 * 3600 * 24));
    res.json({ email: row.email, shopName: row.shopName, expireDate: `${padStr(exp.getDate())}/${padStr(exp.getMonth()+1)}/${exp.getFullYear()}`, daysRemaining, renewStatus: row.renew_status || 'NONE', renewNotified: row.renew_notified !== undefined ? row.renew_notified : 1 });
  });
});

app.post('/api/clear-renew-notify', (req, res) => {
  const { sheetId } = req.body;
  db.run(`UPDATE tenants SET renew_notified = 1 WHERE sheet_id = ?`, [sheetId], () => { res.json({ status: "success" }); });
});

app.post('/api/request-register-otp', (req, res) => {
  const { email, phone, lang = 'th' } = req.body;
  db.get(`SELECT id FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, phone], (err, row) => {
    if (row) return res.json({ status: "error", message: t('dup', lang) });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore["REG_" + email] = otp;

    const mailOptions = {
      from: transporter.options.auth.user,
      to: email,
      subject: t('reg_sub', lang),
      text: t('reg_body', lang, {otp: otp})
    };
    transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err));
    console.log(`🔑 [OTP สมัครร้าน] Email: ${email} -> รหัสคือ: ${otp}`);
    res.json({ status: "success" });
  });
});

app.post('/api/verify-and-create-shop', (req, res) => {
  const { password, shopName, email, phone, lang = 'th' } = req.body; 
  db.get(`SELECT id FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, phone], (err, row) => {
    if (row) return res.json({ status: "error", message: t('dup', lang) });
    
    const sheetId = "SHOP_" + Date.now();
    const expDate = new Date(); expDate.setDate(expDate.getDate() + 30);
    const expStr = expDate.toISOString().split('T')[0];

    db.run(`INSERT INTO tenants (user, password, shop_name, email, phone, sheet_id, status, expire_date) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [email, password, shopName, email, phone, sheetId, expStr], (err) => {
        if (err) return res.json({ status: "error", message: err.message });
        sendAdminAlert(`🎉 <b>มีร้านค้าสมัครใหม่!</b>\nอีเมล: ${escapeHtml(email)}\nร้าน: ${escapeHtml(shopName)}\nเบอร์: ${escapeHtml(phone)}`);
        res.json({ status: "success", expireDate: `${padStr(expDate.getDate())}/${padStr(expDate.getMonth()+1)}/${expDate.getFullYear()}` });
      });
  });
});

app.post('/api/request-reset-otp', (req, res) => {
  const { email, lang = 'th' } = req.body;
  db.get(`SELECT email FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, email], (err, row) => {
    if (err || !row) return res.json({ status: "error", message: t('not_found', lang) });
    
    const targetEmail = row.email;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore["RES_" + targetEmail] = otp;

    const mailOptions = {
      from: transporter.options.auth.user,
      to: targetEmail,
      subject: t('res_sub', lang),
      text: t('res_body', lang, {otp: otp})
    };
    transporter.sendMail(mailOptions).catch(err => console.error("Mail Error:", err));
    console.log(`🔑 [OTP รีเซ็ตรหัส] Target Email: ${targetEmail} -> รหัสคือ: ${otp}`);
    res.json({ status: "success", realEmail: targetEmail });
  });
});

app.post('/api/reset-password-direct', (req, res) => {
  const { email, phone, newPassword, lang = 'th' } = req.body; 
  db.get(`SELECT email, shop_name FROM tenants WHERE LOWER(email)=LOWER(?) AND phone=?`, [email, phone], (err, row) => {
    if (err || !row) return res.json({ status: "error", message: t('not_found_contact', lang) });
    db.run(`UPDATE tenants SET password = ? WHERE LOWER(email)=LOWER(?) AND phone=?`, [newPassword, email, phone], (err) => {
      if (err) return res.json({ status: "error", message: t('reset_err', lang) });
      res.json({ status: "success", shopName: row.shop_name });
    });
  });
});

app.post('/api/check-renew-email', (req, res) => {
  const { email, lang = 'th' } = req.body;
  db.get(`SELECT email, shop_name FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, email], (err, row) => {
    if (err || !row) return res.json({ status: "error", message: t('not_found', lang) });
    res.json({ status: "success", shopName: row.shop_name, realEmail: row.email });
  });
});

app.post(['/api/upload-slip-notify', '/api/upload-quick-renew-slip'], async (req, res) => {
  try {
    const { email, shopName, pkgName, price, base64Data } = req.body; 
    db.run(`UPDATE tenants SET renew_status = 'PENDING' WHERE LOWER(email) = LOWER(?)`, [email]);
    let fileUrl = "";

    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    if (base64Data && base64Data.includes(',')) {
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/); 
      const ext = matches ? (matches[1].split('/')[1] || 'jpg') : 'jpg';
      const buffer = Buffer.from(matches ? matches[2] : base64Data, 'base64'); 
      const safeName = `slip_${Date.now()}_${Math.floor(Math.random()*1000)}.${ext}`;
      fs.writeFileSync(path.join(uploadsDir, safeName), buffer); 
      fileUrl = `/uploads/${safeName}`;
    }

    const cleanShop = String(shopName || '-').replace(/[&<>]/g, '');
    const cleanEmail = String(email || '-').trim();
    const cleanPkg = String(pkgName || '1M').split('|')[0].trim(); 
    const cleanPrice = String(price || '0').split('|')[0].trim();

    const fullSlipUrl = `http://${req.get('host')}${fileUrl}`;
    const safeUrl = encodeURI(fullSlipUrl);

    // แจ้งเตือนแอดมินทาง Telegram เป็นภาษาไทย
    const message = `💳 <b>แจ้งโอนเงินต่ออายุ</b>\n\n🏢 ร้าน: ${escapeHtml(shopName)}\n📧 อีเมล: ${escapeHtml(email)}\n📦 แพ็กเกจ: ${escapeHtml(pkgName)}\n💰 ยอดเงิน: ${escapeHtml(price)} บาท\n\n📄 <a href="${safeUrl}">คลิกดูสลิปโอนเงิน</a>`;
    
    const approveData = `APPROVE_${cleanPkg}_${cleanEmail}`.substring(0, 64);
    const rejectData = `REJECT_${cleanEmail}`.substring(0, 64);
    const keyboard = { inline_keyboard: [ [ { text: `✅ อนุมัติ ${cleanPkg}`, callback_data: approveData } ], [ { text: "❌ ไม่อนุมัติ", callback_data: rejectData } ] ] };

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: "HTML", reply_markup: keyboard }, { timeout: 30000 });
    res.json({ status: "success" });
  } catch(e) { 
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
                  
                  // 🌟 ส่งอีเมลแจ้งเตือนลูกค้าเป็นระบบ 2 ภาษา (Bilingual) ในเมลเดียว
                  const mailOptions = {
                    from: transporter.options.auth.user,
                    to: email,
                    subject: `🎉 ยืนยันการต่ออายุสำเร็จ / Renewal Confirmed - ${row.shop_name}`,
                    text: `สวัสดีครับ / Hello (ร้าน ${row.shop_name})\n\nระบบได้รับการยืนยันการชำระเงิน และดำเนินการต่ออายุการใช้งานระบบ POS ของคุณเรียบร้อยแล้วครับ\nYour payment has been confirmed and your POS system has been renewed successfully.\n\n⏰ วันหมดอายุใหม่ / New expiration date: ${padStr(baseDate.getDate())}/${padStr(baseDate.getMonth()+1)}/${baseDate.getFullYear()}\n\nขอบคุณที่ใช้บริการครับ / Thank you for using our service!`
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
  } catch (e) {}
  setTimeout(pollTelegram, 2000);
}
pollTelegram();

app.post('/api/import-excel', (req, res) => {
  const { tenantId, payload } = req.body;
  if (!tenantId || !payload) return res.json({ status: "error", message: "ข้อมูลไม่ครบถ้วน" });
  try {
    const data = JSON.parse(payload);
    const settings = data.settings || {}; const products = data.products || [];
    if (Object.keys(settings).length > 0) {
      const stmt = db.prepare(`INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?) ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value`);
      for (const [key, value] of Object.entries(settings)) { stmt.run(tenantId, key, String(value)); }
      stmt.finalize();
    }
    if (products.length > 0) {
      const pStmt = db.prepare(`INSERT INTO products (tenant_id, id, name, price, image, category, stock, min_stock, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tenant_id, id) DO UPDATE SET name=excluded.name, price=excluded.price, image=excluded.image, category=excluded.category, stock=excluded.stock, min_stock=excluded.min_stock, unit=excluded.unit`);
      products.forEach(p => { pStmt.run(tenantId, p.id, p.name, p.price, p.image, p.category, p.stock, p.minStock, p.unit); });
      pStmt.finalize();
    }
    res.json({ status: "success" });
  } catch (e) { res.json({ status: "error", message: e.message }); }
});

app.get('/api/superadmin/tenants', (req, res) => {
  db.all(`SELECT id, shop_name, email, phone, password, expire_date, sheet_id, status FROM tenants ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.json({ status: "error", message: err.message });
    res.json(rows || []);
  });
});
app.post('/api/superadmin/delete-tenant', (req, res) => {
  const { sheetId } = req.body;
  db.serialize(() => {
    db.run(`DELETE FROM tenants WHERE sheet_id = ?`, [sheetId]); db.run(`DELETE FROM users WHERE tenant_id = ?`, [sheetId]);
    db.run(`DELETE FROM products WHERE tenant_id = ?`, [sheetId]); db.run(`DELETE FROM sales_log WHERE tenant_id = ?`, [sheetId]);
    db.run(`DELETE FROM settings WHERE tenant_id = ?`, [sheetId]); db.run(`DELETE FROM activity_log WHERE tenant_id = ?`, [sheetId], function(err) { res.json({ status: "success" }); });
  });
});
app.post('/api/superadmin/edit-tenant', (req, res) => {
  const { sheetId, password, expireDate } = req.body;
  db.run(`UPDATE tenants SET password = ?, expire_date = ? WHERE sheet_id = ?`, [password, expireDate, sheetId], function(err) { res.json({ status: "success" }); });
});
app.post('/api/superadmin/add-tenant', (req, res) => {
  const { shopName, email, phone, password, expireDate } = req.body;
  db.get(`SELECT id FROM tenants WHERE LOWER(email)=LOWER(?) OR phone=?`, [email, phone], (err, row) => {
    if (row) return res.json({ status: "error", message: "Email หรือ เบอร์โทรศัพท์ นี้มีคนใช้งานแล้ว" });
    const sheetId = "SHOP_" + Date.now();
    db.run(`INSERT INTO tenants (user, password, shop_name, email, phone, sheet_id, status, expire_date) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [email, password, shopName, email, phone, sheetId, expireDate], (err) => { res.json({ status: "success" }); });
  });
});

io.on('connection', (socket) => {
  socket.on('join_shop_room', (shopId) => { socket.join(shopId); });
  socket.on('update_cfd', (data) => { const room = data.shopId; if (room) { socket.to(room).emit('cfd_data_sync', data); } });
});

server.listen(3000, () => console.log('🚀 POS Application Server running on http://localhost:3000'));