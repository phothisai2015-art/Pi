const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // 1. ตาราง Master Tenants (ร้านค้าทั้งหมด)[cite: 3]
  db.run(`CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT UNIQUE,
    password TEXT,
    shop_name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    sheet_id TEXT UNIQUE,
    status TEXT DEFAULT 'ACTIVE',
    expire_date TEXT
  )`);

  // 2. ตาราง Users (พนักงานประจำร้าน)
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT,
    pin TEXT,
    name TEXT,
    permissions TEXT
  )`);

  // 3. ตาราง Products (สินค้า)
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT,
    tenant_id TEXT,
    name TEXT,
    price REAL,
    image TEXT,
    category TEXT,
    stock TEXT,
    min_stock TEXT,
    unit TEXT,
    PRIMARY KEY (tenant_id, id)
  )`);

  // 4. ตาราง Sales Log (ประวัติการขาย)[cite: 4]
  db.run(`CREATE TABLE IF NOT EXISTS sales_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT,
    timestamp TEXT,
    receipt_id TEXT,
    customer_name TEXT,
    items_str TEXT,
    total REAL,
    payment_method TEXT,
    phone TEXT,
    seller TEXT
  )`);

  // 5. ตาราง Settings (ตั้งค่าร้าน)[cite: 4]
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    tenant_id TEXT,
    key TEXT,
    value TEXT,
    PRIMARY KEY (tenant_id, key)
  )`);

  // 6. ตาราง Activity Log (ประวัติการใช้งาน)[cite: 4]
  db.run(`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT,
    timestamp TEXT,
    staff_name TEXT,
    action TEXT,
    detail TEXT
  )`);
  // 7. ตารางประวัติสลิป (Slip Logs) - สร้างใหม่เพื่อป้องกันสลิปซ้ำ
  db.run(`CREATE TABLE IF NOT EXISTS slip_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_no TEXT UNIQUE,        -- เลขอ้างอิงสลิป (ตั้งเป็น UNIQUE เพื่อป้องกันการบันทึกเลขซ้ำเด็ดขาด)
    email TEXT,                -- อีเมลของร้านค้าที่อัปโหลดสลิป
    amount REAL,               -- ยอดเงินที่โอน
    package TEXT,              -- แพ็กเกจที่เลือกต่ออายุ
    timestamp TEXT,            -- วันเวลาที่อัปโหลด
    status TEXT DEFAULT 'USED' -- สถานะสลิป (ถูกใช้ไปแล้ว)
  )`);
});

module.exports = db;
