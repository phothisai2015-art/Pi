// 🌟 ไฟล์ Dictionary เก็บคำแปลของระบบทั้งหมด
const translations = {
  th: {
    // ---- ส่วนของหน้า Login ----
    "sys_title": "SaaS POS System",
    "sys_desc": "เข้าสู่ระบบจัดการร้านค้าของคุณ",
    "ph_contact": "อีเมล หรือ เบอร์โทรศัพท์",
    "ph_pass": "รหัสผ่าน",
    "btn_login": "เข้าสู่ระบบ <i class='fa-solid fa-arrow-right ms-2'></i>",
    "link_forgot": "<i class='fa-solid fa-key text-warning'></i> ลืมรหัส",
    "link_renew": "<i class='fa-solid fa-bolt-lightning text-success'></i> ต่ออายุ",
    "link_register": "<i class='fa-solid fa-user-plus text-info'></i> สมัครฟรี",
    "link_support": "<i class='fa-brands fa-line fs-5'></i> ติดต่อแอดมิน / แจ้งปัญหา",
    "footer_copy": "© 2026 POS Management System",
    
    // ---- ส่วนของการแจ้งเตือน (SweetAlert) ----
    "swal_loading_info": "กำลังตรวจสอบข้อมูล...",
    "swal_wait_db": "โปรดรอสักครู่ ระบบกำลังเชื่อมต่อฐานข้อมูล",
    "swal_missing_info": "ข้อมูลไม่ครบ",
    "swal_fill_login": "กรุณากรอกอีเมล/เบอร์โทร และรหัสผ่านให้ครบถ้วน",
    "swal_success": "สำเร็จ!",
    "swal_error": "เกิดข้อผิดพลาด"
  },
  en: {
    // ---- Login Section ----
    "sys_title": "SaaS POS System",
    "sys_desc": "Login to manage your shop",
    "ph_contact": "Email or Phone Number",
    "ph_pass": "Password",
    "btn_login": "Login <i class='fa-solid fa-arrow-right ms-2'></i>",
    "link_forgot": "<i class='fa-solid fa-key text-warning'></i> Forgot",
    "link_renew": "<i class='fa-solid fa-bolt-lightning text-success'></i> Renew",
    "link_register": "<i class='fa-solid fa-user-plus text-info'></i> Sign Up",
    "link_support": "<i class='fa-brands fa-line fs-5'></i> Contact Support",
    "footer_copy": "© 2026 POS Management System",

    // ---- Alerts (SweetAlert) ----
    "swal_loading_info": "Checking information...",
    "swal_wait_db": "Please wait, connecting to database",
    "swal_missing_info": "Incomplete Data",
    "swal_fill_login": "Please enter your email/phone and password",
    "swal_success": "Success!",
    "swal_error": "Error"
  }
};

// 🌟 ฟังก์ชัน: บันทึกและเปลี่ยนภาษา (ถูกเรียกเมื่อกดปุ่มสลับภาษา)
function setLanguage(lang) {
  localStorage.setItem('pos_lang', lang); // สั่งเบราว์เซอร์ให้จำค่ายาวๆ
  applyTranslations(); // วิ่งแปลคำทั้งหน้าเว็บใหม่ทันที
}

// 🌟 ฟังก์ชัน: อ่านค่าภาษาที่จำไว้ (ถ้าไม่มีให้ตั้งต้นเป็น ไทย)
function getLanguage() {
  return localStorage.getItem('pos_lang') || 'th';
}

// 🌟 ฟังก์ชันหลัก: ค้นหาและเปลี่ยนคำใน HTML อัตโนมัติ
function applyTranslations() {
  const lang = getLanguage();
  const dict = translations[lang];
  if (!dict) return;

  // วิ่งหาทุกแท็กที่มี attribute 'data-i18n'
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      // ถ้าเป็นกล่องกรอกข้อความ (Input) ให้เปลี่ยนค่า placeholder
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.setAttribute('placeholder', dict[key]);
      } else {
        // ถ้าเป็นข้อความทั่วไป ให้ยัดข้อความทับลงไปเลย
        el.innerHTML = dict[key];
      }
    }
  });

  // อัปเดตไฮไลท์สีปุ่มภาษาให้เด่นขึ้นมาตามที่เลือก
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if(btn.dataset.lang === lang) {
      btn.classList.add('fw-bold', 'text-primary');
      btn.classList.remove('text-muted');
    } else {
      btn.classList.remove('fw-bold', 'text-primary');
      btn.classList.add('text-muted');
    }
  });
}

// 🌟 ฟังก์ชัน: ดึงคำแปลไปใช้กับข้อความที่อยู่ใน JavaScript (เช่น SweetAlert)
function t(key) {
  const lang = getLanguage();
  return translations[lang][key] || translations['th'][key] || key;
}

// เมื่อโหลดหน้าเว็บเสร็จ ให้วิ่งแปลคำอัตโนมัติทันที
document.addEventListener('DOMContentLoaded', applyTranslations);
```eof

---

### ⚙️ ขั้นตอนการแก้ไขเพื่อเสียบระบบในหน้าเว็บ (`public/index.html`)

เพื่อให้หน้าเว็บรู้จักกับตัวพจนานุกรมและเปลี่ยนภาษาได้ คุณต้องแก้ไข `index.html` ตามจุดต่อไปนี้ครับ:

#### **จุดที่ 1:** ฝังสคริปต์ลงในระบบ
หาแท็ก `</head>` ของคุณ แล้ววางโค้ดบรรทัดนี้ไว้ **ก่อน** ท้ายแท็ก:
```html
<script src="/js/i18n.js"></script>