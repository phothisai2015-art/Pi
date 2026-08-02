// ==========================================
// 🌐 ไฟล์พจนานุกรมแปลภาษาศูนย์กลาง (lang.js)
// ==========================================
var i18n = {
  th: {
    login_title: "SaaS POS System",
    login_subtitle: "เข้าสู่ระบบจัดการร้านค้าของคุณ",
    email_phone_placeholder: "อีเมล หรือ เบอร์โทรศัพท์",
    password_placeholder: "รหัสผ่าน",
    btn_login: "เข้าสู่ระบบ",
    link_forgot_pass: "ลืมรหัส",
    link_renew: "ต่ออายุ",
    link_register: "สมัครฟรี",
    link_contact_admin: "ติดต่อแอดมิน / แจ้งปัญหา",
    footer_text: "© 2026 POS Management System",
    reg_title: "เปิดร้านใหม่",
    reg_free_badge: "ฟรี 30 วัน",
    reg_shop_name: "ชื่อร้านค้า",
    reg_email: "อีเมล (Gmail)",
    reg_pass: "ตั้งรหัสผ่าน (ENG/เลข)",
    reg_phone: "เบอร์โทรศัพท์",
    btn_register: "สมัครเปิดร้านค้า",
    btn_back_login: "ย้อนกลับไปหน้าเข้าสู่ระบบ",
    reg_success_title: "สำเร็จ!",
    reg_success_desc: "ระบบได้สร้างฐานข้อมูลร้านค้าให้คุณเรียบร้อยแล้ว",
    reg_login_with: "เข้าสู่ระบบด้วย:",
    reg_admin_pin: "รหัสพนักงาน (Admin):",
    reg_admin_pin_desc: "ตั้งค่าด้วยตัวเองเมื่อเข้าระบบครั้งแรก",
    reg_free_until: "ใช้ฟรีถึง:",
    btn_enter_shop: "เข้าสู่ระบบร้านค้า",
    renew_title: "ต่ออายุ / เติมแพ็กเกจ",
    renew_input_label: "อีเมล หรือ เบอร์โทรศัพท์ ที่ลงทะเบียน",
    renew_select_pkg: "เลือกแพ็กเกจที่ต้องการ",
    renew_1m: "1 เดือน",
    renew_3m: "3 เดือน",
    renew_6m: "6 เดือน",
    renew_12m: "1 ปีเต็ม",
    renew_best_value: "คุ้มสุด!",
    renew_feature_1: "ใช้งาน POS ได้เต็มรูปแบบ",
    renew_feature_2: "ไม่จำกัดจำนวนบิล/สินค้า",
    renew_feature_3: "มีสรุป Dashboard",
    btn_search_pay: "ค้นหาร้านค้าและชำระเงิน",
    renew_transfer_desc: "โอนเงินเข้าพร้อมเพย์เพื่อต่ออายุระบบ",
    renew_attach_slip: "แนบสลิปโอนเงิน",
    btn_notify_payment: "แจ้งชำระเงิน",
    btn_back: "ย้อนกลับ",
    renew_success_title: "ส่งข้อมูลสำเร็จ!",
    renew_success_desc: "ระบบได้บันทึกการแจ้งชำระเงินแล้ว<br>กรุณารอระบบอนุมัติสักครู่ครับ",
    reset_title: "ตั้งรหัสผ่านใหม่",
    reset_desc: "กรอกข้อมูลให้ตรงกับที่ลงทะเบียนไว้เพื่อเปลี่ยนรหัส",
    reset_phone_label: "เบอร์โทรศัพท์",
    reset_new_pass: "ตั้งรหัสผ่านใหม่ (ENG/เลข)",
    btn_save_new_pass: "บันทึกรหัสผ่านใหม่",
    reset_success_desc: "ระบบได้เปลี่ยนรหัสผ่านให้ร้านของคุณเรียบร้อยแล้ว",
    alert_loading: "กำลังโหลดข้อมูล...",
	renew_per_day_5: "ตกวันละ 5.00 บ.",
    renew_per_day_4_44: "ตกวันละ 4.44 บ.",
    renew_per_day_4_16: "ตกวันละ 4.16 บ.",
    renew_per_day_3_28: "ตกวันละ 3.28 บ.",
	swal_error_title: "ผิดพลาด",
    swal_fill_all: "กรอกข้อมูลให้ครบถ้วน",
    swal_creating_shop: "กำลังสร้างร้านค้า...",
    swal_req_email_phone: "กรุณากรอกอีเมล หรือ เบอร์โทรศัพท์",
    swal_searching: "กำลังค้นหาข้อมูล...",
    swal_req_reset_info: "กรุณากรอกข้อมูลและตั้งรหัสผ่านใหม่ให้ครบถ้วน",
    swal_checking: "กำลังตรวจสอบข้อมูล...",
	// --------------------------------
    // 🖥️ ส่วน HTML: หน้าเมนูหลัก และ Numpad (shop_menu.html)
    // --------------------------------
    btn_logout_shop: "ออกจากสาขา",
    numpad_title: "กรุณาใส่รหัสพนักงาน",
    numpad_desc: "ระบบถูกล็อกเพื่อความปลอดภัย",
    setup_title: "ยินดีต้อนรับสู่ระบบ",
    setup_desc: "กรุณาตั้งชื่อและรหัสพนักงาน (PIN) สำหรับผู้ดูแลระบบ<br>(คุณคือผู้ดูแลระบบคนแรกและมีสิทธิ์สูงสุด)",
    setup_name_label: "ชื่อผู้ดูแลระบบ (Admin)",
    setup_name_placeholder: "ระบุชื่อพนักงาน",
    setup_pin_label: "ตั้งรหัส PIN 4 หลัก (สำหรับเข้าใช้งาน)",
    btn_save_start: "บันทึกและเริ่มต้นใช้งาน",
    menu_title: "ระบบจัดการร้านค้า",
    menu_staff: "พนักงาน:",
    menu_loading: "กำลังโหลด...",
    menu_pos_title: "ขายสินค้า (POS)",
    menu_pos_desc: "เปิดหน้าร้านและรับชำระเงิน",
    menu_stock_title: "คลังสินค้า",
    menu_stock_desc: "จัดการสต็อกและรายการสินค้า",
    menu_dash_title: "สถิติยอดขาย",
    menu_dash_desc: "ดูสรุปรายได้และบิลย้อนหลัง",
    menu_admin_title: "ตั้งค่าระบบ",
    menu_admin_desc: "จัดการร้านค้าและพนักงาน",
    btn_lock_screen: "ล็อกหน้าจอ",

    // --------------------------------
    // 🚨 ส่วน JS: แจ้งเตือน SweetAlert (shop_menu.html)
    // --------------------------------
    swal_expired_title: "หมดอายุ",
    swal_expired_desc: "ระบบของคุณหมดอายุแล้ว",
    swal_warn_expire_title: "⚠️ แจ้งเตือนวันหมดอายุ",
    swal_warn_expire_today: "ระบบของคุณจะหมดอายุในวันนี้! กรุณาต่ออายุการใช้งานทันที",
    swal_warn_expire_days1: "ระบบของคุณเหลือเวลาใช้งานอีก ",
    swal_warn_expire_days2: " วัน กรุณาต่ออายุการใช้งานครับ",
    swal_btn_ack: "รับทราบ",
    swal_invalid_info_title: "ข้อมูลไม่ถูกต้อง",
    swal_req_pin_4: "กรุณาระบุชื่อ และตั้งรหัส PIN ให้ครบ 4 หลัก",
    swal_saving: "กำลังบันทึก...",
    swal_error_occurred: "เกิดข้อผิดพลาด",
    swal_pin_used: "รหัสนี้มีการใช้งานแล้ว",
    swal_setup_success: "ตั้งค่าสำเร็จ",
    swal_redirecting: "กำลังพาท่านเข้าสู่ระบบ...",
    swal_welcome: "ยินดีต้อนรับ, ",
    swal_wrong_pin_title: "รหัสไม่ถูกต้อง",
    swal_try_again: "กรุณาลองใหม่อีกครั้ง",
    swal_locked_title: "หน้าจอถูกล็อก",
    swal_locked_desc: "ระบบล็อกอัตโนมัติเนื่องจากไม่มีการใช้งาน",
    swal_logout_title: "ออกจากระบบร้านค้า?",
    swal_logout_desc: "ระบบจะล้างข้อมูลการเชื่อมต่อ",
    swal_btn_logout: "ออกจากระบบ",
    swal_btn_cancel: "ยกเลิก"
  },
  en: {
    login_title: "SaaS POS System",
    login_subtitle: "Login to manage your store",
    email_phone_placeholder: "Email or Phone Number",
    password_placeholder: "Password",
    btn_login: "Login",
    link_forgot_pass: "Forgot Password",
    link_renew: "Renew",
    link_register: "Register Free",
    link_contact_admin: "Contact Admin / Support",
    footer_text: "© 2026 POS Management System",
    reg_title: "Open New Store",
    reg_free_badge: "Free 30 Days",
    reg_shop_name: "Store Name",
    reg_email: "Email (Gmail)",
    reg_pass: "Set Password (ENG/Num)",
    reg_phone: "Phone Number",
    btn_register: "Register Store",
    btn_back_login: "Back to Login",
    reg_success_title: "Success!",
    reg_success_desc: "Your store database has been successfully created.",
    reg_login_with: "Login with:",
    reg_admin_pin: "Admin PIN:",
    reg_admin_pin_desc: "Set it yourself on first login",
    reg_free_until: "Free until:",
    btn_enter_shop: "Enter Store",
    renew_title: "Renew / Upgrade Package",
    renew_input_label: "Registered Email or Phone Number",
    renew_select_pkg: "Select Package",
    renew_1m: "1 Month",
    renew_3m: "3 Months",
    renew_6m: "6 Months",
    renew_12m: "1 Year",
    renew_best_value: "Best Value!",
    renew_feature_1: "Full POS access",
    renew_feature_2: "Unlimited bills/items",
    renew_feature_3: "Dashboard summary included",
    btn_search_pay: "Find Store and Pay",
    renew_transfer_desc: "Transfer via PromptPay to renew your system",
    renew_attach_slip: "Attach Transfer Slip",
    btn_notify_payment: "Submit Payment",
    btn_back: "Back",
    renew_success_title: "Submission Successful!",
    renew_success_desc: "Your payment notification has been recorded.<br>Please wait for admin approval.",
    reset_title: "Reset Password",
    reset_desc: "Enter your registered information to change your password",
    reset_phone_label: "Registered Phone Number",
    reset_new_pass: "New Password (ENG/Num)",
    btn_save_new_pass: "Save New Password",
    reset_success_desc: "Your store's password has been reset successfully.",
    alert_loading: "Loading data...",
	renew_per_day_5: "Only 5.00 ฿/day",
    renew_per_day_4_44: "Only 4.44 ฿/day",
    renew_per_day_4_16: "Only 4.16 ฿/day",
    renew_per_day_3_28: "Only 3.28 ฿/day",
	swal_error_title: "Error",
    swal_fill_all: "Please fill in all fields completely",
    swal_creating_shop: "Creating store...",
    swal_req_email_phone: "Please enter Email or Phone Number",
    swal_searching: "Searching for data...",
    swal_req_reset_info: "Please fill in data and set a new password",
    swal_checking: "Verifying data...",
	// --------------------------------
    // 🖥️ HTML Section: Main Menu & Numpad (shop_menu.html)
    // --------------------------------
    btn_logout_shop: "Logout from Branch",
    numpad_title: "Please enter PIN",
    numpad_desc: "System is locked for security",
    setup_title: "Welcome to POS",
    setup_desc: "Please set up your Admin Name and PIN<br>(You are the first admin with full access)",
    setup_name_label: "Admin Name",
    setup_name_placeholder: "Enter staff name",
    setup_pin_label: "Set 4-Digit PIN (For Login)",
    btn_save_start: "Save & Start",
    menu_title: "Store Management",
    menu_staff: "Staff:",
    menu_loading: "Loading...",
    menu_pos_title: "Point of Sale (POS)",
    menu_pos_desc: "Open storefront and receive payments",
    menu_stock_title: "Inventory",
    menu_stock_desc: "Manage stock and products",
    menu_dash_title: "Sales Statistics",
    menu_dash_desc: "View revenue and receipt history",
    menu_admin_title: "System Settings",
    menu_admin_desc: "Manage store and staff",
    btn_lock_screen: "Lock Screen",

    // --------------------------------
    // 🚨 JS Section: SweetAlerts (shop_menu.html)
    // --------------------------------
    swal_expired_title: "Expired",
    swal_expired_desc: "Your system access has expired",
    swal_warn_expire_title: "⚠️ Expiration Warning",
    swal_warn_expire_today: "Your system expires TODAY! Please renew immediately.",
    swal_warn_expire_days1: "You have ",
    swal_warn_expire_days2: " days left. Please renew your subscription.",
    swal_btn_ack: "Acknowledge",
    swal_invalid_info_title: "Invalid Information",
    swal_req_pin_4: "Please enter a name and a 4-digit PIN",
    swal_saving: "Saving...",
    swal_error_occurred: "Error Occurred",
    swal_pin_used: "This PIN is already in use",
    swal_setup_success: "Setup Successful",
    swal_redirecting: "Redirecting to system...",
    swal_welcome: "Welcome, ",
    swal_wrong_pin_title: "Incorrect PIN",
    swal_try_again: "Please try again",
    swal_locked_title: "Screen Locked",
    swal_locked_desc: "System auto-locked due to inactivity",
    swal_logout_title: "Logout from Store?",
    swal_logout_desc: "Your connection data will be cleared",
    swal_btn_logout: "Logout",
    swal_btn_cancel: "Cancel"
  }
};

var currentLang = sessionStorage.getItem('pos_lang') || 'th';

function changeLanguage(lang) {
  currentLang = lang;
  sessionStorage.setItem('pos_lang', lang);
  
  const langSelector = document.getElementById('lang-selector');
  if (langSelector) langSelector.value = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18n[lang] && i18n[lang][key]) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = i18n[lang][key];
      } else {
        const icon = el.querySelector('i');
        if (icon) {
          el.innerHTML = icon.outerHTML + " " + i18n[lang][key];
        } else {
          el.innerHTML = i18n[lang][key];
        }
      }
    }
  });
}

function toggleLanguage() {
  const newLang = currentLang === 'th' ? 'en' : 'th';
  changeLanguage(newLang);
}