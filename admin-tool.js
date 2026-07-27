const db = require('./database');
const mode = process.argv[2];

if (mode === 'expire') {
  db.run("UPDATE tenants SET expire_date = '2020-01-01'");
  console.log('🛑 [สถานะ: หมดอายุ] ปรับวันที่เป็นอดีต (2020-01-01) เรียบร้อย!');
} else if (mode === 'warn') {
  let d = new Date(); d.setDate(d.getDate() + 3);
  db.run(`UPDATE tenants SET expire_date = '${d.toISOString().split('T')[0]}'`);
  console.log('⚠️ [สถานะ: แจ้งเตือน] ปรับวันหมดอายุให้เหลือแค่ 3 วัน เรียบร้อย!');
} else {
  let d = new Date(); d.setDate(d.getDate() + 30);
  db.run(`UPDATE tenants SET expire_date = '${d.toISOString().split('T')[0]}'`);
  console.log('✅ [สถานะ: ปกติ] รีเซ็ตให้กลับมาใช้งานได้ฟรีอีก 30 วัน เรียบร้อย!');
}
