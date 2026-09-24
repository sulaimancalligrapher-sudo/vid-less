import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'th' | 'en';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'rtl' | 'ltr';
}

export const LANGUAGES: Record<Language, LanguageInfo> = {
  ar: { code: 'ar', name: 'العربية', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  th: { code: 'th', name: 'التايلندية', nativeName: 'ไทย', flag: '🇹🇭', dir: 'ltr' },
  en: { code: 'en', name: 'الإنجليزي', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
};

export interface TranslationItem {
  key: string;
  category: 'app' | 'login' | 'lessons' | 'detail' | 'admin';
  description: string;
  ar: string;
  th: string;
  en: string;
}

export const DEFAULT_TRANSLATIONS: TranslationItem[] = [
  // --- APP & HEADER ---
  {
    key: 'app_title_student',
    category: 'app',
    description: 'عنوان التطبيق للطلاب',
    ar: 'ملتقط الوسائط للطلاب',
    th: 'สื่อการเรียนรู้สำหรับนักเรียน',
    en: 'Student Media Capturer',
  },
  {
    key: 'app_title_admin',
    category: 'app',
    description: 'عنوان بوابة الإدارة',
    ar: 'بوابة التحكم الإداري وقاعدة البيانات',
    th: 'พอร์ทัลควบคุมการจัดการและฐานข้อมูล',
    en: 'Admin Control Portal & Database',
  },
  {
    key: 'app_subtitle_student',
    category: 'app',
    description: 'العنوان الفرعي للطلاب',
    ar: 'نظام القراءة والواجبات المطور',
    th: 'ระบบการอ่านและการบ้านขั้นสูง',
    en: 'Advanced Reading & Homework System',
  },
  {
    key: 'app_subtitle_admin',
    category: 'app',
    description: 'العنوان الفرعي للإدارة',
    ar: 'إدارة الشيت، الأسئلة، وإعدادات الربط',
    th: 'จัดการชีท คำถาม และการเชื่อมต่อ',
    en: 'Manage Sheets, Questions & Connection Settings',
  },
  {
    key: 'student_page_btn',
    category: 'app',
    description: 'زر والانتقال لصفحة الطلاب',
    ar: 'صفحة الطلاب 🎓',
    th: 'หน้าสำหรับนักเรียน 🎓',
    en: 'Student Page 🎓',
  },
  {
    key: 'admin_page_btn',
    category: 'app',
    description: 'زر الانتقال لصفحة الإدارة',
    ar: 'صفحة الإدارة 🔐',
    th: 'หน้าการจัดการ 🔐',
    en: 'Admin Page 🔐',
  },
  {
    key: 'lock_admin_btn',
    category: 'app',
    description: 'زر خروج / قفل الإدارة',
    ar: 'قفل الإدارة',
    th: 'ล็อคการจัดการ',
    en: 'Lock Admin',
  },
  {
    key: 'refresh_data',
    category: 'app',
    description: 'تلميح زر تحديث البيانات',
    ar: 'تحديث البيانات',
    th: 'รีเฟรชข้อมูล',
    en: 'Refresh Data',
  },
  {
    key: 'footer_text',
    category: 'app',
    description: 'نص أسفل الصفحة',
    ar: 'تطبيق ويب تفاعلي متقدم لتعليم الأطفال القراءة 📚',
    th: 'แอปพลิเคชันเว็บแบบโต้ตอบเพื่อสอนการอ่านสำหรับเด็ก 📚',
    en: 'Interactive Web App for Teaching Kids Reading 📚',
  },
  {
    key: 'footer_copyright',
    category: 'app',
    description: 'حقوق النشر',
    ar: '© 2026 ملتقط الوسائط وقارئ الدروس',
    th: '© 2026 โปรแกรมอ่านบทเรียนและบันทึกสื่อ',
    en: '© 2026 Media Capturer & Lesson Reader',
  },

  // --- STUDENT LOGIN ---
  {
    key: 'login_title',
    category: 'login',
    description: 'عنوان كارت دخول الطالب',
    ar: 'تسجيل دخول الطالب 👤',
    th: 'เข้าสู่ระบบสำหรับนักเรียน 👤',
    en: 'Student Login 👤',
  },
  {
    key: 'login_subtitle',
    category: 'login',
    description: 'وصف كارت الدخول',
    ar: 'أدخل اسمك ورقم الشيت الخاص بك لمتابعة دروس القراءة والواجبات.',
    th: 'กรอกชื่อและหมายเลขชีทเพื่อเข้าสู่บทเรียนและการบ้าน',
    en: 'Enter your name and sheet number to access reading lessons and homework.',
  },
  {
    key: 'login_username_label',
    category: 'login',
    description: 'تسمية حقل اسم الطالب',
    ar: 'اسم الطالب الثلاثي:',
    th: 'ชื่อ-นามสกุล นักเรียน:',
    en: 'Student Full Name:',
  },
  {
    key: 'login_username_placeholder',
    category: 'login',
    description: 'تلميح حقل اسم الطالب',
    ar: 'أدخل اسم الطالب...',
    th: 'กรอกชื่อนักเรียน...',
    en: 'Enter student name...',
  },
  {
    key: 'login_sheet_label',
    category: 'login',
    description: 'تسمية حقل رقم الشيت',
    ar: 'رقم صف/شيت الطالب:',
    th: 'หมายเลขชั้น/ชีท:',
    en: 'Class/Sheet Number:',
  },
  {
    key: 'login_sheet_placeholder',
    category: 'login',
    description: 'تلميح حقل رقم الشيت',
    ar: 'اختر رقم الشيت...',
    th: 'เลือกหมายเลขชีท...',
    en: 'Select sheet number...',
  },
  {
    key: 'login_btn',
    category: 'login',
    description: 'زر الدخول',
    ar: 'دخول آمن للبوابة 🔐',
    th: 'เข้าสู่ระบบอย่างปลอดภัย 🔐',
    en: 'Secure Login 🔐',
  },
  {
    key: 'login_loading',
    category: 'login',
    description: 'حالة جاري التحقق',
    ar: 'جاري التحقق من الهوية والموقع...',
    th: 'กำลังตรวจสอบสิทธิ์และตำแหน่ง...',
    en: 'Verifying identity & location...',
  },
  {
    key: 'login_error_missing',
    category: 'login',
    description: 'رسالة خطأ عند نقص البيانات',
    ar: 'يرجى كتابة اسم الطالب واختيار رقم الشيت للبدء.',
    th: 'กรุณากรอกชื่อและเลือกหมายเลขชีทเพื่อเริ่มต้น',
    en: 'Please enter student name and select sheet number to start.',
  },
  {
    key: 'login_geo_prompt',
    category: 'login',
    description: 'ملاحظة الموقع الجغرافي',
    ar: 'يتم استخدام الموقع الجغرافي لضمان التواجد داخل المدرسة.',
    th: 'ใช้ตำแหน่งทางภูมิศาสตร์เพื่อยืนยันว่าอยู่ในโรงเรียน',
    en: 'Geolocation is used to verify attendance at school.',
  },

  // --- LESSON LIST ---
  {
    key: 'student_sheet_badge',
    category: 'lessons',
    description: 'نص رقم الشيت بالطالب',
    ar: 'شيت الطالب:',
    th: 'ชีทนักเรียน:',
    en: 'Student Sheet:',
  },
  {
    key: 'logout_btn',
    category: 'lessons',
    description: 'زر تسجيل الخروج',
    ar: 'خروج',
    th: 'ออกจากระบบ',
    en: 'Logout',
  },
  {
    key: 'available_lessons_title',
    category: 'lessons',
    description: 'عنوان قائمة الدروس المتاحة',
    ar: 'دروس القراءة التفاعلية المتاحة',
    th: 'บทเรียนการอ่านแบบโต้ตอบที่พร้อมใช้งาน',
    en: 'Available Interactive Reading Lessons',
  },
  {
    key: 'show_completed',
    category: 'lessons',
    description: 'زر إظهار الدروس المكتملة',
    ar: 'إظهار الدروس المكتملة',
    th: 'แสดงบทเรียนที่เสร็จแล้ว',
    en: 'Show Completed Lessons',
  },
  {
    key: 'hide_completed',
    category: 'lessons',
    description: 'زر إخفاء الدروس المكتملة',
    ar: 'إخفاء الدروس المكتملة',
    th: 'ซ่อนบทเรียนที่เสร็จแล้ว',
    en: 'Hide Completed Lessons',
  },
  {
    key: 'syncing_status',
    category: 'lessons',
    description: 'حالة المزامنة',
    ar: 'جاري المزامنة...',
    th: 'กำลังซิงค์...',
    en: 'Syncing...',
  },
  {
    key: 'no_lessons_msg',
    category: 'lessons',
    description: 'رسالة عدم وجود دروس',
    ar: 'لا توجد دروس مخصصة لك في هذا الشيت حالياً.',
    th: 'ยังไม่มีบทเรียนที่กำหนดให้คุณในชีทนี้',
    en: 'No lessons assigned to you in this sheet currently.',
  },
  {
    key: 'all_completed_title',
    category: 'lessons',
    description: 'عنوان إكمال كل الدروس',
    ar: 'أحسنت! جميع الدروس المتاحة مكتملة',
    th: 'เยี่ยมมาก! ทำบทเรียนทั้งหมดเสร็จแล้ว',
    en: 'Well done! All available lessons completed',
  },
  {
    key: 'all_completed_sub',
    category: 'lessons',
    description: 'تفاصيل إكمال كل الدروس',
    ar: 'تم إخفاء الدروس المكتملة تلقائياً للتسهيل عليك.',
    th: 'ซ่อนบทเรียนที่ทำเสร็จแล้วโดยอัตโนมัติ',
    en: 'Completed lessons were automatically hidden.',
  },
  {
    key: 'all_scheduled_future_title',
    category: 'lessons',
    description: 'عنوان الدروس المجدولة لمواعيد قادمة',
    ar: 'جميع الدروس المتاحة مجدولة في مواعيد قادمة',
    th: 'บทเรียนทั้งหมดที่พร้อมใช้งานถูกกำหนดไว้ในอนาคต',
    en: 'All available lessons are scheduled for upcoming dates',
  },
  {
    key: 'all_scheduled_future_sub',
    category: 'lessons',
    description: 'توضيح استعراض الدروس المجدولة',
    ar: 'يمكنك الضغط أدناه لمعاينة وتصفح كافة الدروس والواجبات.',
    th: 'คุณสามารถคลิกด้านล่างเพื่อดูและเรียกดูบทเรียนและการบ้านทั้งหมด',
    en: 'You can click below to preview and browse all lessons and assignments.',
  },
  {
    key: 'show_all_lessons_btn',
    category: 'lessons',
    description: 'زر عرض كافة الدروس',
    ar: 'عرض كافة الدروس',
    th: 'ดูบทเรียนทั้งหมด',
    en: 'Show All Lessons',
  },
  {
    key: 'table_col_lesson',
    category: 'lessons',
    description: 'عمود الجدول: اسم الدرس',
    ar: 'اسم وموضوع الدرس',
    th: 'ชื่อและหัวข้อบทเรียน',
    en: 'Lesson Name & Topic',
  },
  {
    key: 'table_col_status',
    category: 'lessons',
    description: 'عمود الجدول: الحالة',
    ar: 'حالة الإنجاز',
    th: 'สถานะสำเร็จ',
    en: 'Status',
  },
  {
    key: 'table_col_retry',
    category: 'lessons',
    description: 'عمود الجدول: إعادة المحاولة',
    ar: 'إعادة محاولة',
    th: 'ลองอีกครั้ง',
    en: 'Retry',
  },
  {
    key: 'status_completed',
    category: 'lessons',
    description: 'بادج تم',
    ar: 'تم',
    th: 'เสร็จแล้ว',
    en: 'Completed',
  },
  {
    key: 'status_new',
    category: 'lessons',
    description: 'بادج جديد',
    ar: 'جديد',
    th: 'ใหม่',
    en: 'New',
  },
  {
    key: 'status_locked',
    category: 'lessons',
    description: 'بادج مغلق',
    ar: 'مغلق',
    th: 'ล็อคแล้ว',
    en: 'Locked',
  },
  {
    key: 'target_word',
    category: 'lessons',
    description: 'الكلمة المستهدفة',
    ar: 'الكلمة المستهدفة:',
    th: 'คำเป้าหมาย:',
    en: 'Target Word:',
  },
  {
    key: 'more_details',
    category: 'lessons',
    description: 'زر المزيد من التفاصيل',
    ar: '+ تفاصيل',
    th: '+ รายละเอียด',
    en: '+ Details',
  },
  {
    key: 'retry_button',
    category: 'lessons',
    description: 'زر إعادة المحاولة',
    ar: 'إعادة',
    th: 'ทำซ้ำ',
    en: 'Retry',
  },
  {
    key: 'retry_modal_title',
    category: 'lessons',
    description: 'عنوان نافذة إعادة المحاولة',
    ar: 'إعادة محاولة الدرس',
    th: 'ลองทำบทเรียนอีกครั้ง',
    en: 'Retry Lesson',
  },
  {
    key: 'retry_modal_confirm',
    category: 'lessons',
    description: 'تأكيد إعادة المحاولة',
    ar: 'هل أنت متأكد من رغبتك في إعادة المحاولة لهذا الدرس؟',
    th: 'คุณแน่ใจหรือไม่ว่าต้องการลองบทเรียนนี้อีกครั้ง?',
    en: 'Are you sure you want to retry this lesson?',
  },
  {
    key: 'retry_modal_sub',
    category: 'lessons',
    description: 'ملاحظة استهلاك المحاولات',
    ar: 'سيؤدي ذلك إلى استهلاك محاولة واحدة من محاولاتك المتاحة.',
    th: 'สิ่งนี้จะใช้โควต้าการลองซ้ำของคุณ',
    en: 'This will consume one of your available retries.',
  },
  {
    key: 'cancel_btn',
    category: 'lessons',
    description: 'زر إلغاء',
    ar: 'إلغاء',
    th: 'ยกเลิก',
    en: 'Cancel',
  },
  {
    key: 'confirm_retry_btn',
    category: 'lessons',
    description: 'زر تأكيد الإعادة',
    ar: 'نعم، أعد المحاولة',
    th: 'ใช่ ลองอีกครั้ง',
    en: 'Yes, Retry',
  },
  {
    key: 'loading_lessons_title',
    category: 'lessons',
    description: 'جاري تحميل الدروس',
    ar: 'جاري قراءة وتحديث الدروس...',
    th: 'กำลังโหลดและอัปเดตบทเรียน...',
    en: 'Reading and updating lessons...',
  },

  // --- LESSON DETAIL & MEDIA PLAYERS ---
  {
    key: 'save_and_back',
    category: 'detail',
    description: 'زر حفظ التقدم والرجوع',
    ar: 'حفظ التقدم والرجوع للدروس',
    th: 'บันทึกและกลับสู่รายการบทเรียน',
    en: 'Save Progress & Back to Lessons',
  },
  {
    key: 'active_lesson',
    category: 'detail',
    description: 'عنوان الدرس النشط',
    ar: 'الدرس النشط',
    th: 'บทเรียนปัจจุบัน',
    en: 'Active Lesson',
  },
  {
    key: 'written_word',
    category: 'detail',
    description: 'الكلمة المكتوبة',
    ar: 'الكلمة المكتوبة:',
    th: 'คำที่เขียน:',
    en: 'Target Word:',
  },
  {
    key: 'review_mode_badge',
    category: 'detail',
    description: 'بادج وضع المراجعة',
    ar: 'وضع مراجعة الدرس فقط 👁️',
    th: 'โหมดทบทวนบทเรียนเท่านั้น 👁️',
    en: 'Lesson Review Mode Only 👁️',
  },
  {
    key: 'requirements_not_met',
    category: 'detail',
    description: 'عنوان شروط الانتقال غير مكتملة',
    ar: 'شروط الانتقال غير مكتملة:',
    th: 'เงื่อนไขการผ่านบทเรียนยังไม่ครบ:',
    en: 'Completion requirements not met:',
  },
  {
    key: 'illustration_photo',
    category: 'detail',
    description: 'عنوان صورة توضيحية للدرس',
    ar: 'صورة توضيحية للدرس',
    th: 'ภาพประกอบบทเรียน',
    en: 'Lesson Illustration',
  },
  {
    key: 'interactive_video',
    category: 'detail',
    description: 'عنوان فيديو الدرس التفاعلي',
    ar: 'فيديو الدرس التفاعلي المساعد',
    th: 'วิดีโอช่วยสอนแบบโต้ตอบ',
    en: 'Interactive Helper Video',
  },
  {
    key: 'audio_explanation',
    category: 'detail',
    description: 'عنوان صوت شرح الدرس',
    ar: 'صوت شرح الدرس وقراءة المعلم',
    th: 'เสียงคำอธิบายและอ่านจากครู',
    en: 'Teacher Explanation Audio',
  },
  {
    key: 'guided_audio_listening',
    category: 'detail',
    description: 'عنوان الاستماع الكامل الموجه',
    ar: 'الاستماع الكامل الموجه للدرس',
    th: 'ฟังเสียงบทเรียนแนะนำแบบเต็ม',
    en: 'Guided Full Audio Listening',
  },
  {
    key: 'letters_click_instruction',
    category: 'detail',
    description: 'تعليمات انقر على الحروف',
    ar: 'انقر على الحروف مباشرة داخل الكلمة للاستماع لنطقها الصحيح',
    th: 'คลิกที่ตัวอักษรเพื่อฟังการออกเสียงที่ถูกต้อง',
    en: 'Click letters directly inside the word to hear correct pronunciation',
  },
  {
    key: 'letters_shape_note',
    category: 'detail',
    description: 'ملاحظة تغير شكل الحرف',
    ar: 'هذا يعلمك كيف يتغير شكل الحرف عند اتصاله بباقي الحروف في الكلمة.',
    th: 'เรียนรู้การเปลี่ยนรูปตัวอักษรเมื่อเชื่อมคำ',
    en: 'Learn how letter shapes change when connected.',
  },
  {
    key: 'letters_volume',
    category: 'detail',
    description: 'حجم صوت الحروف',
    ar: 'حجم صوت الحروف:',
    th: 'ระดับเสียงตัวอักษร:',
    en: 'Letters Volume:',
  },
  {
    key: 'student_reading_hw',
    category: 'detail',
    description: 'عنوان الواجب الصوتي',
    ar: 'الواجب الصوتي لقراءة الطالب 🎙️',
    th: 'การบ้านการอ่านของนักเรียน 🎙️',
    en: 'Student Reading Audio Homework 🎙️',
  },
  {
    key: 'audio_locked_success',
    category: 'detail',
    description: 'نجاح إرسال الواجب الصوتي',
    ar: 'تم قفل وإرسال الواجب الصوتي بنجاح! 🔒',
    th: 'ล็อกและส่งเสียงการบ้านเรียบร้อยแล้ว! 🔒',
    en: 'Audio homework locked and sent! 🔒',
  },
  {
    key: 'listen_sent_recording',
    category: 'detail',
    description: 'زر استماع للتسجيل المرسل',
    ar: 'استماع للتسجيل المرسل',
    th: 'ฟังเสียงที่ส่งแล้ว',
    en: 'Listen to sent recording',
  },
  {
    key: 're_record_new',
    category: 'detail',
    description: 'زر إعادة التسجيل / رفع جديد',
    ar: 'إعادة التسجيل / رفع جديد 🔄',
    th: 'บันทึกใหม่ / อัปโหลดใหม่ 🔄',
    en: 'Re-record / Upload New 🔄',
  },
  {
    key: 'mic_ready',
    category: 'detail',
    description: 'حالة الميكروفون جاهز',
    ar: 'الميكروفون جاهز لبدء التسجيل',
    th: 'ไมโครโฟนพร้อมสำหรับการบันทึก',
    en: 'Microphone ready',
  },
  {
    key: 'preview_before_sending',
    category: 'detail',
    description: 'معاينة التسجيل قبل الإرسال',
    ar: 'معاينة التسجيل قبل الإرسال',
    th: 'ฟังตัวอย่างก่อนส่ง',
    en: 'Preview before sending',
  },
  {
    key: 'confirm_send_hw',
    category: 'detail',
    description: 'تأكيد وإرسال الواجب',
    ar: 'تأكيد وإرسال الواجب 🟢',
    th: 'ยืนยันและส่งการบ้าน 🟢',
    en: 'Confirm & Send 🟢',
  },
  {
    key: 'stop_and_preview',
    category: 'detail',
    description: 'إيقاف التسجيل ومعاينة',
    ar: 'إيقاف التسجيل ومعاينة ⏹️',
    th: 'หยุดบันทึกและฟังตัวอย่าง ⏹️',
    en: 'Stop & Preview ⏹️',
  },
  {
    key: 'start_recording_hw',
    category: 'detail',
    description: 'ابدأ تسجيل الواجب الصوتي',
    ar: 'ابدأ تسجيل الواجب الصوتي 🎙️',
    th: 'เริ่มบันทึกเสียงการบ้าน 🎙️',
    en: 'Start Homework Recording 🎙️',
  },
  {
    key: 'select_file',
    category: 'detail',
    description: 'زر اختيار ملف',
    ar: 'اختيار ملف',
    th: 'เลือกไฟล์',
    en: 'Select File',
  },
  {
    key: 'photo_hw_title',
    category: 'detail',
    description: 'عنوان رفع صورة الواجب',
    ar: 'رفع صورة الواجب المساعد 📸',
    th: 'อัปโหลดภาพการบ้าน 📸',
    en: 'Upload Homework Photo 📸',
  },
  {
    key: 'photo_locked_success',
    category: 'detail',
    description: 'نجاح قفل وإرسال الصورة',
    ar: 'تم قفل وإرسال صورة الواجب بنجاح! 🔒',
    th: 'ล็อกและส่งภาพการบ้านเรียบร้อยแล้ว! 🔒',
    en: 'Homework photo locked and sent! 🔒',
  },
  {
    key: 'view_sent_photo',
    category: 'detail',
    description: 'معاينة الصورة المرسلة',
    ar: 'معاينة الصورة المرسلة',
    th: 'ดูภาพที่ส่งแล้ว',
    en: 'Preview sent photo',
  },
  {
    key: 're_capture_new',
    category: 'detail',
    description: 'إعادة التقاط / رفع جديد',
    ar: 'إعادة التقاط / رفع جديد 🔄',
    th: 'ถ่ายภาพใหม่ / อัปโหลดใหม่ 🔄',
    en: 'Re-capture / Upload New 🔄',
  },
  {
    key: 'camera_ready',
    category: 'detail',
    description: 'الكاميرا مستعدة للبدء',
    ar: 'الكاميرا مستعدة للبدء',
    th: 'กล้องพร้อมใช้งาน',
    en: 'Camera ready',
  },
  {
    key: 'camera_live',
    category: 'detail',
    description: 'الكاميرا تلتقط مباشرة',
    ar: 'الكاميرا تلتقط مباشرة...',
    th: 'กล้องกำลังถ่ายทอดสด...',
    en: 'Camera live...',
  },
  {
    key: 'photo_captured',
    category: 'detail',
    description: 'تم التقاط صورة الواجب',
    ar: 'تم التقاط صورة الواجب!',
    th: 'ถ่ายภาพการบ้านเรียบร้อยแล้ว!',
    en: 'Homework photo captured!',
  },
  {
    key: 'capture_crop',
    category: 'detail',
    description: 'قص والتقاط الصورة',
    ar: 'قص والتقاط الصورة 📸',
    th: 'ครอบและถ่ายภาพ 📸',
    en: 'Crop & Capture 📸',
  },
  {
    key: 'confirm_send_photo',
    category: 'detail',
    description: 'تأكيد وإرسال الصورة',
    ar: 'تأكيد وإرسال الصورة 🟢',
    th: 'ยืนยันและส่งภาพ 🟢',
    en: 'Confirm & Send Photo 🟢',
  },
  {
    key: 're_take_photo',
    category: 'detail',
    description: 'إعادة تصوير',
    ar: 'إعادة تصوير 🔄',
    th: 'ถ่ายภาพใหม่ 🔄',
    en: 'Retake Photo 🔄',
  },
  {
    key: 'capture_with_camera',
    category: 'detail',
    description: 'التقاط بالكاميرا',
    ar: 'التقاط بالكاميرا 📷',
    th: 'ถ่ายภาพด้วยกล้อง 📷',
    en: 'Capture with Camera 📷',
  },
  {
    key: 'saving_progress_overlay_title',
    category: 'detail',
    description: 'عنوان نافذة جاري حفظ التقدم',
    ar: 'جاري حفظ التقدم وتحديث السجل',
    th: 'กำลังบันทึกความก้าวหน้า...',
    en: 'Saving progress and updating log',
  },
  {
    key: 'saving_progress_overlay_sub',
    category: 'detail',
    description: 'وصف نافذة جاري حفظ التقدم',
    ar: 'يرجى الانتظار دون إغلاق الصفحة حتى تكتمل العملية بنجاح وتحديث قائمة الدروس...',
    th: 'โปรดรอโดยอย่าปิดหน้าต่างจนกว่ากระบวนการจะเสร็จสมบูรณ์...',
    en: 'Please wait without closing the page until processing completes...',
  },
  {
    key: 'back_to_lessons',
    category: 'detail',
    description: 'زر العودة لقائمة الدروس',
    ar: 'العودة لقائمة الدروس',
    th: 'กลับสู่รายการบทเรียน',
    en: 'Back to Lessons',
  },
  {
    key: 'study_tab',
    category: 'detail',
    description: 'تبويب شرح وقراءة الدرس',
    ar: 'شرح وقراءة الدرس 📖',
    th: 'คำอธิบายและอ่านบทเรียน 📖',
    en: 'Lesson Study & Explanation 📖',
  },
  {
    key: 'assignment_tab',
    category: 'detail',
    description: 'تبويب حل الواجب وإرسال الوسائط',
    ar: 'حل الواجب وإرسال الوسائط 📝',
    th: 'ส่งการบ้านและสื่อ 📝',
    en: 'Homework & Media Submission 📝',
  },
  {
    key: 'study_target_word',
    category: 'detail',
    description: 'عنوان الكلمة المستهدفة',
    ar: 'الكلمة المستهدفة:',
    th: 'คำเป้าหมาย:',
    en: 'Target Word:',
  },
  {
    key: 'study_letters_breakdown',
    category: 'detail',
    description: 'عنوان تفاصيل أحرف الكلمة والأصوات',
    ar: 'تفاصيل أحرف الكلمة والأصوات 🔤',
    th: 'รายละเอียดตัวอักษรและเสียง 🔤',
    en: 'Letter & Sound Breakdown 🔤',
  },
  {
    key: 'study_play_full_audio',
    category: 'detail',
    description: 'زر استماع للدرس كاملاً',
    ar: 'استماع للدرس كاملاً 🔊',
    th: 'ฟังเสียงบทเรียนแบบเต็ม 🔊',
    en: 'Listen to Full Lesson Audio 🔊',
  },
  {
    key: 'study_explanation',
    category: 'detail',
    description: 'شرح وتوضيح الدرس',
    ar: 'شرح وتوضيح الدرس 🎧',
    th: 'คำอธิบายประกอบบทเรียน 🎧',
    en: 'Lesson Explanation 🎧',
  },
  {
    key: 'study_video_explanation',
    category: 'detail',
    description: 'فيديو شرح الدرس',
    ar: 'فيديو شرح الدرس 🎬',
    th: 'วิดีโออธิบายบทเรียน 🎬',
    en: 'Lesson Video Explanation 🎬',
  },
  {
    key: 'lesson_instruction',
    category: 'detail',
    description: 'تعليمات الدرس القراءة',
    ar: 'استمع للمقطع الصوتي ثم سجل قراءتك بصوت واضح:',
    th: 'ฟังเสียงแล้วบันทึกเสียงอ่านของคุณอย่างชัดเจน:',
    en: 'Listen to audio then record your clear reading:',
  },
  {
    key: 'play_full_sound',
    category: 'detail',
    description: 'تشغيل الصوت الكامل',
    ar: 'تشغيل الصوت الكامل 🔊',
    th: 'เล่นเสียงเต็ม 🔊',
    en: 'Play Full Audio 🔊',
  },
  {
    key: 'play_explanation',
    category: 'detail',
    description: 'شرح واستماع',
    ar: 'شرح واستماع 🎧',
    th: 'คำอธิบายและฟัง 🎧',
    en: 'Explanation & Listening 🎧',
  },

  // --- AUDIO HOMEWORK RECORDING ---
  {
    key: 'rec_section_title',
    category: 'detail',
    description: 'عنوان قسم تسجيل الصوت',
    ar: 'تسجيل واجب الصوت 🎙️',
    th: 'บันทึกเสียงการบ้าน 🎙️',
    en: 'Audio Homework Recording 🎙️',
  },
  {
    key: 'rec_btn_start',
    category: 'detail',
    description: 'زر بدء التسجيل',
    ar: 'بدء التسجيل الصوتي 🎙️',
    th: 'เริ่มบันทึกเสียง 🎙️',
    en: 'Start Audio Recording 🎙️',
  },
  {
    key: 'rec_btn_stop',
    category: 'detail',
    description: 'زر إيقاف التسجيل',
    ar: 'إيقاف التسجيل ⏹️',
    th: 'หยุดบันทึก ⏹️',
    en: 'Stop Recording ⏹️',
  },
  {
    key: 'rec_btn_re',
    category: 'detail',
    description: 'زر إعادة التسجيل',
    ar: 'إعادة التسجيل 🔄',
    th: 'บันทึกใหม่ 🔄',
    en: 'Re-record 🔄',
  },
  {
    key: 'rec_btn_play',
    category: 'detail',
    description: 'زر استماع للتسجيل',
    ar: 'استماع للتسجيل 🎧',
    th: 'ฟังเสียงที่บันทึก 🎧',
    en: 'Listen to Recording 🎧',
  },
  {
    key: 'rec_btn_send',
    category: 'detail',
    description: 'زر إرسال واجب الصوت',
    ar: 'رفع وإرسال واجب الصوت 🚀',
    th: 'อัปโหลดและส่งเสียงการบ้าน 🚀',
    en: 'Upload & Send Audio 🚀',
  },
  {
    key: 'rec_uploading',
    category: 'detail',
    description: 'نص جاري رفع الصوت',
    ar: 'جاري رفع وتسجيل الصوت...',
    th: 'กำลังอัปโหลดเสียง...',
    en: 'Uploading audio recording...',
  },
  {
    key: 'rec_success',
    category: 'detail',
    description: 'رسالة نجاح رفع الصوت',
    ar: 'تم إرسال الصوت بنجاح! 👍',
    th: 'ส่งบันทึกเสียงเรียบร้อยแล้ว! 👍',
    en: 'Audio sent successfully! 👍',
  },
  {
    key: 'rec_remaining_retries',
    category: 'detail',
    description: 'المحاولات المتبقية',
    ar: 'المحاولات المتبقية:',
    th: 'จำนวนครั้งที่เหลือ:',
    en: 'Remaining Retries:',
  },
  {
    key: 'rec_error_no_mic',
    category: 'detail',
    description: 'خطأ عدم المايكروفون',
    ar: 'تعذر الوصول للمايكروفون. يرجى السماح بالصوت في المتصفح.',
    th: 'ไม่สามารถเข้าถึงไมโครโฟนได้ โปรดอนุญาตไมโครโฟนในเบราว์เซอร์',
    en: 'Unable to access microphone. Please allow microphone permissions in browser.',
  },

  // --- PHOTO HOMEWORK ---
  {
    key: 'photo_section_title',
    category: 'detail',
    description: 'عنوان صورة الواجب المكتوب',
    ar: 'صورة الواجب المكتوب 📸',
    th: 'ภาพการบ้านที่เขียน 📸',
    en: 'Written Homework Photo 📸',
  },
  {
    key: 'photo_btn_capture',
    category: 'detail',
    description: 'زر التقاط أو رفع الصورة',
    ar: 'التقاط / رفع صورة الواجب 📸',
    th: 'ถ่ายภาพ / อัปโหลดการบ้าน 📸',
    en: 'Capture / Upload Homework Photo 📸',
  },
  {
    key: 'photo_btn_change',
    category: 'detail',
    description: 'زر تغيير الصورة',
    ar: 'تغيير الصورة 🔄',
    th: 'เปลี่ยนรูปภาพ 🔄',
    en: 'Change Photo 🔄',
  },
  {
    key: 'photo_btn_send',
    category: 'detail',
    description: 'زر رفع صورة الواجب',
    ar: 'رفع وإرسال صورة الواجب 🚀',
    th: 'อัปโหลดและส่งภาพการบ้าน 🚀',
    en: 'Upload & Send Homework Photo 🚀',
  },
  {
    key: 'photo_uploading',
    category: 'detail',
    description: 'جاري رفع الصورة',
    ar: 'جاري رفع الصورة...',
    th: 'กำลังอัปโหลดภาพ...',
    en: 'Uploading photo...',
  },
  {
    key: 'photo_success',
    category: 'detail',
    description: 'نجاح رفع الصورة',
    ar: 'تم رفع صورة الواجب بنجاح! 📸',
    th: 'อัปโหลดภาพการบ้านเรียบร้อยแล้ว! 📸',
    en: 'Homework photo uploaded successfully! 📸',
  },

  // --- LESSON COMPLETION ---
  {
    key: 'complete_lesson_btn',
    category: 'detail',
    description: 'زر إنهاء الدرس وإرسال النتيجة',
    ar: 'إنهاء الدرس وإرسال النتيجة 🏆',
    th: 'ทำบทเรียนเสร็จสิ้นและส่งผล 🏆',
    en: 'Complete Lesson & Send Result 🏆',
  },
  {
    key: 'complete_lesson_loading',
    category: 'detail',
    description: 'جاري توثيق الإنجاز',
    ar: 'جاري حفظ التقدم وتوثيق الإنجاز...',
    th: 'กำลังบันทึกความก้าวหน้า...',
    en: 'Saving progress & completing lesson...',
  },
  {
    key: 'lesson_review_mode',
    category: 'detail',
    description: 'وضع المراجعة والقراءة',
    ar: 'وضع المراجعة والقراءة (مكتمل سابقاً)',
    th: 'โหมดทบทวนการอ่าน (ทำเสร็จแล้ว)',
    en: 'Review Mode (Previously Completed)',
  },
  {
    key: 'success_completion',
    category: 'detail',
    description: 'رسالة نجاح الدرس',
    ar: 'تهانينا! لقد أكملت هذا الدرس بنجاح 🎉',
    th: 'ยินดีด้วย! คุณทำบทเรียนนี้เสร็จเรียบร้อยแล้ว 🎉',
    en: 'Congratulations! You have successfully completed this lesson 🎉',
  },

  // --- QUESTIONS & QUIZ MODAL ---
  {
    key: 'question_interactive_title',
    category: 'detail',
    description: 'عنوان السؤال التفاعلي',
    ar: 'سؤال تفاعلي أثناء التشغيل ❓',
    th: 'คำถามโต้ตอบระหว่างเรียน ❓',
    en: 'Interactive Question ❓',
  },
  {
    key: 'question_interactive_sub',
    category: 'detail',
    description: 'وصف السؤال التفاعلي',
    ar: 'يرجى الإجابة بدقة لمتابعة الدرس',
    th: 'กรุณาตอบอย่างถูกต้องเพื่อเรียนต่อ',
    en: 'Please answer accurately to continue lesson',
  },
  {
    key: 'question_placeholder',
    category: 'detail',
    description: 'تلميح حقل الإجابة النصية',
    ar: 'اكتب إجابتك هنا...',
    th: 'พิมพ์คำตอบของคุณที่นี่...',
    en: 'Type your answer here...',
  },
  {
    key: 'question_rewatch_video',
    category: 'detail',
    description: 'زر إعادة مشاهدة الفيديو',
    ar: 'إعادة مشاهدة المقطع السابق 🔄',
    th: 'ดูคลิปส่วนก่อนหน้าอีกครั้ง 🔄',
    en: 'Rewatch Previous Video Segment 🔄',
  },
  {
    key: 'question_rewatch_audio',
    category: 'detail',
    description: 'زر إعادة استماع الصوت',
    ar: 'إعادة استماع المقطع السابق 🔄',
    th: 'ฟังเสียงส่วนก่อนหน้าอีกครั้ง 🔄',
    en: 'Re-listen to Previous Audio Segment 🔄',
  },
  {
    key: 'question_submit_btn',
    category: 'detail',
    description: 'زر إرسال الإجابة وتأكيد',
    ar: 'إرسال الإجابة وتأكيد 🚀',
    th: 'ส่งคำตอบและยืนยัน 🚀',
    en: 'Submit Answer & Confirm 🚀',
  },
  {
    key: 'question_result_correct_title',
    category: 'detail',
    description: 'عنوان الإجابة الصحيحة',
    ar: 'إجابة صحيحة وممتازة! 🎉',
    th: 'คำตอบถูกต้องและยอดเยี่ยม! 🎉',
    en: 'Correct & Excellent Answer! 🎉',
  },
  {
    key: 'question_result_wrong_title',
    category: 'detail',
    description: 'عنوان الإجابة الخاطئة',
    ar: 'إجابة خاطئة ❌',
    th: 'คำตอบไม่ถูกต้อง ❌',
    en: 'Incorrect Answer ❌',
  },
  {
    key: 'question_result_recorded_title',
    category: 'detail',
    description: 'عنوان تسجيل الإجابة',
    ar: 'تم تسجيل الإجابة 👍',
    th: 'บันทึกคำตอบแล้ว 👍',
    en: 'Answer Recorded 👍',
  },
  {
    key: 'question_correct_label',
    category: 'detail',
    description: 'تسمية الإجابة الصحيحة هي',
    ar: 'الإجابة الصحيحة هي:',
    th: 'คำตอบที่ถูกต้องคือ:',
    en: 'The correct answer is:',
  },
  {
    key: 'question_close_continue',
    category: 'detail',
    description: 'زر إغلاق ومتابعة الدرس',
    ar: 'إغلاق ومتابعة الدرس ➡️',
    th: 'ปิดและเรียนต่อ ➡️',
    en: 'Close & Continue Lesson ➡️',
  },

  // --- ADMIN & SETTINGS ---
  {
    key: 'admin_login_portal_title',
    category: 'admin',
    description: 'عنوان بوابة الإدارة',
    ar: 'بوابة دخول قسم الإدارة ⚡',
    th: 'พอร์ทัลเข้าสู่ระบบผู้ดูแลระบบ ⚡',
    en: 'Admin Access Portal ⚡',
  },
  {
    key: 'admin_login_portal_desc',
    category: 'admin',
    description: 'وصف بوابة الإدارة',
    ar: 'يرجى إدخال رمز المرور الإداري للوصول إلى لوحة التحكم والإعدادات.',
    th: 'กรุณากรอกรหัสผ่านผู้ดูแลระบบเพื่อเข้าสู่การตั้งค่า',
    en: 'Please enter admin password to access control panel and settings.',
  },
  {
    key: 'admin_pass_placeholder',
    category: 'admin',
    description: 'تلميح حقل كلمة مرور الإدارة',
    ar: 'أدخل الرمز الإداري الأول (مثل 1122)...',
    th: 'กรอกรหัสผู้ดูแลระบบ (เช่น 1122)...',
    en: 'Enter admin code (e.g. 1122)...',
  },
  {
    key: 'admin_login_btn',
    category: 'admin',
    description: 'زر دخول لوحة التحكم',
    ar: 'دخول لوحة التحكم الإدارية',
    th: 'เข้าสู่แผงควบคุมผู้ดูแลระบบ',
    en: 'Enter Admin Dashboard',
  },
  {
    key: 'translation_editor_title',
    category: 'admin',
    description: 'عنوان محرر الترجمة',
    ar: 'محرر نصوص الواجهة والترجمة 🌐',
    th: 'ตัวแก้ไขข้อความอินเทอร์เฟซและการแปล 🌐',
    en: 'UI Text & Translation Editor 🌐',
  },
  {
    key: 'translation_editor_desc',
    category: 'admin',
    description: 'وصف محرر الترجمة',
    ar: 'تعديل جميع نصوص واجهة التطبيق باللغات الثلاث (العربية، التايلندية، الإنجليزية) بحرية وسهولة.',
    th: 'แก้ไขข้อความทั้งหมดในแอปได้ทั้ง 3 ภาษา (อาหรับ, ไทย, อังกฤษ) อย่างง่ายดาย',
    en: 'Edit all application interface text in 3 languages (Arabic, Thai, English) freely and easily.',
  },
  {
    key: 'save_translations_btn',
    category: 'admin',
    description: 'زر حفظ التغييرات',
    ar: 'حفظ التغييرات',
    th: 'บันทึกการเปลี่ยนแปลง',
    en: 'Save Changes',
  },
  {
    key: 'reset_translations_btn',
    category: 'admin',
    description: 'زر استعادة الافتراضي',
    ar: 'استعادة النصوص الافتراضية',
    th: 'คืนค่าข้อความเริ่มต้น',
    en: 'Reset to Defaults',
  },
  {
    key: 'search_translation_placeholder',
    category: 'admin',
    description: 'بحث في قاموس الترجمة',
    ar: 'ابحث في القاموس عن جملة أو كلمة...',
    th: 'ค้นหาข้อความหรือคำในพจนานุกรม...',
    en: 'Search dictionary for phrase or word...',
  },
  {
    key: 'filter_all_categories',
    category: 'admin',
    description: 'تصفية جميع الأقسام',
    ar: 'جميع الأقسام',
    th: 'ทุกหมวดหมู่',
    en: 'All Categories',
  },
  {
    key: 'saved_success_toast',
    category: 'admin',
    description: 'رسالة توست تم الحفظ',
    ar: 'تم حفظ التعديلات بنجاح! تم تحديث جميع نصوص الواجهة.',
    th: 'บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว!',
    en: 'Changes saved successfully! Interface texts updated.',
  },
  {
    key: 'reset_success_toast',
    category: 'admin',
    description: 'رسالة توست تم التصفير',
    ar: 'تمت استعادة القاموس الافتراضي بنجاح.',
    th: 'รีเซ็ตพจนานุกรมเป็นค่าเริ่มต้นแล้ว',
    en: 'Default dictionary restored successfully.',
  },

  // --- CORRECTION MODAL & FOCUS SCORES ---
  {
    key: 'corr_modal_header',
    category: 'admin',
    description: 'عنوان نافذة التصحيحات والواجبات',
    ar: 'جدول تصحيحات الأستاذ وملاحظات الواجبات',
    th: 'ตารางการตรวจงานและข้อเสนอแนะจากครู',
    en: 'Teacher Corrections & Homework Notes Table',
  },
  {
    key: 'corr_modal_student',
    category: 'admin',
    description: 'تسمية اسم الطالب في التصحيحات',
    ar: 'الطالب:',
    th: 'นักเรียน:',
    en: 'Student:',
  },
  {
    key: 'corr_modal_sheet',
    category: 'admin',
    description: 'تسمية ورقة رقم',
    ar: 'ورقة رقم',
    th: 'ชีทหมายเลข',
    en: 'Sheet #',
  },
  {
    key: 'corr_modal_tab_image',
    category: 'admin',
    description: 'تبويب تصحيح واجب الصورة',
    ar: '1. تصحيح واجب الصورة',
    th: '1. ตรวจการบ้านรูปภาพ',
    en: '1. Image Homework Correction',
  },
  {
    key: 'corr_modal_tab_audio',
    category: 'admin',
    description: 'تبويب تصحيح واجب الصوت',
    ar: '2. تصحيح واجب الصوت',
    th: '2. ตรวจการบ้านเสียง',
    en: '2. Audio Homework Correction',
  },
  {
    key: 'corr_modal_tab_focus',
    category: 'admin',
    description: 'تبويب درجات التركيز في الدرس',
    ar: '3. درجات التركيز في الدرس',
    th: '3. คะแนนความตั้งใจในบทเรียน',
    en: '3. Lesson Focus Scores',
  },
  {
    key: 'corr_modal_search',
    category: 'admin',
    description: 'تصفية بالموضوع/الدرس',
    ar: 'تصفية بالموضوع/الدرس...',
    th: 'กรองตามหัวข้อ/บทเรียน...',
    en: 'Filter by topic/lesson...',
  },
  {
    key: 'corr_modal_loading',
    category: 'admin',
    description: 'جاري جلب جدول التصحيحات',
    ar: 'جاري جلب جدول التصحيحات من شيت الأستاذ...',
    th: 'กำลังดึงตารางการตรวจงานจากชีทของครู...',
    en: 'Fetching correction table from teacher sheet...',
  },
  {
    key: 'corr_modal_no_focus_title',
    category: 'admin',
    description: 'عنوان لا توجد درجات تركيز مطابقة',
    ar: 'لا توجد درجات تركيز مطابقة',
    th: 'ไม่พบคะแนนความตั้งใจที่ตรงกัน',
    en: 'No matching focus scores found',
  },
  {
    key: 'corr_modal_no_records_title',
    category: 'admin',
    description: 'عنوان لا توجد سجلات تصحيح',
    ar: 'لا توجد سجلات تصحيح مطابقة',
    th: 'ไม่พบบันทึกการตรวจงานที่ตรงกัน',
    en: 'No matching correction records found',
  },
  {
    key: 'corr_modal_no_search_results',
    category: 'admin',
    description: 'لم يتم العثور على دروس مطابقة للبحث',
    ar: 'لم يتم العثور على دروس تطابق كلمة البحث.',
    th: 'ไม่พบบทเรียนที่ตรงกับคำค้นหา',
    en: 'No lessons found matching search keyword.',
  },
  {
    key: 'corr_modal_no_focus_recorded',
    category: 'admin',
    description: 'لم يتم رصد نتائج درجات التركيز',
    ar: 'لم يتم رصد نتائج درجات التركيز لهذا الطالب بعد.',
    th: 'ยังไม่มีการบันทึกคะแนนความตั้งใจสำหรับนักเรียนคนนี้',
    en: 'No focus score results recorded for this student yet.',
  },
  {
    key: 'corr_modal_no_corrections_recorded',
    category: 'admin',
    description: 'لم يقم الأستاذ بإضافة تصحيحات',
    ar: 'لم يقم الأستاذ بإضافة تصحيحات مسجلة لهذه الورقة بعد.',
    th: 'ครูยังไม่ได้เพิ่มการตรวจงานสำหรับชีทนี้',
    en: 'Teacher has not added recorded corrections for this sheet yet.',
  },
  {
    key: 'corr_modal_col_topic',
    category: 'admin',
    description: 'عمود الموضوع',
    ar: 'الموضوع',
    th: 'หัวข้อ',
    en: 'Topic',
  },
  {
    key: 'corr_modal_col_video_score',
    category: 'admin',
    description: 'عمود درجات أسئلة الفيديو',
    ar: 'درجات إجابة أسئلة الفيديو',
    th: 'คะแนนคำถามวิดีโอ',
    en: 'Video Questions Score',
  },
  {
    key: 'corr_modal_col_audio_score',
    category: 'admin',
    description: 'عمود درجات أسئلة الصوت',
    ar: 'درجات إجابة أسئلة الصوت',
    th: 'คะแนนคำถามเสียง',
    en: 'Audio Questions Score',
  },
  {
    key: 'corr_modal_col_full_formula',
    category: 'admin',
    description: 'عمود المعادلة الكاملة',
    ar: 'المعادلة الكاملة',
    th: 'สูตรการคำนวณสมบูรณ์',
    en: 'Full Formula',
  },
  {
    key: 'corr_modal_col_final_result',
    category: 'admin',
    description: 'عمود النتيجة النهائية',
    ar: 'النتيجة النهائية',
    th: 'ผลลัพธ์สุดท้าย',
    en: 'Final Result',
  },
  {
    key: 'corr_modal_col_evaluation',
    category: 'admin',
    description: 'عمود التقييم والتشجيع',
    ar: 'التقييم والتشجيع',
    th: 'การประเมินและให้กำลังใจ',
    en: 'Evaluation & Encouragement',
  },
  {
    key: 'corr_modal_col_image_send_count',
    category: 'admin',
    description: 'عمود عدد إرسال الصورة',
    ar: 'عدد إرسال الصورة',
    th: 'จำนวนการส่งรูปภาพ',
    en: 'Image Send Count',
  },
  {
    key: 'corr_modal_col_image_assignment',
    category: 'admin',
    description: 'عمود واجب الصورة',
    ar: 'واجب الصورة',
    th: 'การบ้านรูปภาพ',
    en: 'Image Homework',
  },
  {
    key: 'corr_modal_col_score',
    category: 'admin',
    description: 'عمود الدرجة',
    ar: 'الدرجة',
    th: 'คะแนน',
    en: 'Score',
  },
  {
    key: 'corr_modal_col_correction_image',
    category: 'admin',
    description: 'عمود صورة التصحيح',
    ar: 'صورة التصحيح',
    th: 'รูปภาพการตรวจ',
    en: 'Correction Image',
  },
  {
    key: 'corr_modal_col_additional_images',
    category: 'admin',
    description: 'عمود صور إضافية',
    ar: 'صور إضافية',
    th: 'รูปภาพเพิ่มเติม',
    en: 'Additional Images',
  },
  {
    key: 'corr_modal_col_correction_video',
    category: 'admin',
    description: 'عمود فيديو التصحيح',
    ar: 'فيديو التصحيح',
    th: 'วิดีโอการตรวจ',
    en: 'Correction Video',
  },
  {
    key: 'corr_modal_col_audio_explanation',
    category: 'admin',
    description: 'عمود شرح بالصوت',
    ar: 'شرح بالصوت',
    th: 'คำอธิบายเสียง',
    en: 'Audio Explanation',
  },
  {
    key: 'corr_modal_col_correction_date',
    category: 'admin',
    description: 'عمود تاريخ التصحيح',
    ar: 'تاريخ التصحيح',
    th: 'วันที่ตรวจ',
    en: 'Correction Date',
  },
  {
    key: 'corr_modal_col_send_count',
    category: 'admin',
    description: 'عمود عدد الإرسال',
    ar: 'عدد الإرسال',
    th: 'จำนวนครั้งที่ส่ง',
    en: 'Send Count',
  },
  {
    key: 'corr_modal_col_teacher_notes',
    category: 'admin',
    description: 'عمود ملاحظات الأستاذ',
    ar: 'ملاحظات الأستاذ',
    th: 'ข้อสังเกตจากครู',
    en: 'Teacher Notes',
  },
  {
    key: 'corr_modal_col_audio_send_count',
    category: 'admin',
    description: 'عمود عدد إرسال الصوت',
    ar: 'عدد إرسال الصوت',
    th: 'จำนวนการส่งเสียง',
    en: 'Audio Send Count',
  },
  {
    key: 'corr_modal_col_audio_assignment',
    category: 'admin',
    description: 'عمود واجب الصوت',
    ar: 'واجب الصوت',
    th: 'การบ้านเสียง',
    en: 'Audio Homework',
  },
  {
    key: 'corr_modal_col_audio_notes_image',
    category: 'admin',
    description: 'عمود صورة ملاحظات الصوت',
    ar: 'صورة ملاحظات الصوت',
    th: 'รูปภาพบันทึกเสียง',
    en: 'Audio Notes Image',
  },
  {
    key: 'rating_calculating',
    category: 'admin',
    description: 'تقييم جاري احتساب النتيجة',
    ar: 'جاري احتساب النتيجة النهائية... ⏳',
    th: 'กำลังคำนวณผลลัพธ์สุดท้าย... ⏳',
    en: 'Calculating final result... ⏳',
  },
  {
    key: 'rating_pending',
    category: 'admin',
    description: 'تقييم في انتظار الإكمال',
    ar: 'في انتظار الإكمال والتقييم ⏳',
    th: 'รอการเสร็จสิ้นและการประเมิน ⏳',
    en: 'Awaiting completion & evaluation ⏳',
  },
  {
    key: 'rating_excellent_plus',
    category: 'admin',
    description: 'تقييم ممتاز جداً',
    ar: 'ممتاز جداً! أداء أسطوري ورائع 🌟👏',
    th: 'ดีเยี่ยมมาก! ผลงานระดับตำนาน 🌟👏',
    en: 'Superb! Legendary performance 🌟👏',
  },
  {
    key: 'rating_excellent',
    category: 'admin',
    description: 'تقييم ممتاز',
    ar: 'ممتاز! استمر في هذا التفوق الباهر ⭐👍',
    th: 'ยอดเยี่ยม! รักษาความโดดเด่นนี้ไว้ ⭐👍',
    en: 'Excellent! Keep up this brilliance ⭐👍',
  },
  {
    key: 'rating_very_good',
    category: 'admin',
    description: 'تقييم جيد جداً',
    ar: 'جيد جداً! عمل رائع وبإمكانك التطلع للقمة 💪✨',
    th: 'ดีมาก! ทำได้ยอดเยี่ยมและมุ่งสู่จุดสูงสุด 💪✨',
    en: 'Very Good! Great job, aim for the top 💪✨',
  },
  {
    key: 'rating_good',
    category: 'admin',
    description: 'تقييم جيد',
    ar: 'جيد! واصل التدريب والمراجعة لتحقيق الأفضل 📚🎯',
    th: 'ดี! หมั่นฝึกฝนและทบทวนเพื่อผลลัพธ์ที่ดีขึ้น 📚🎯',
    en: 'Good! Keep practicing to achieve the best 📚🎯',
  },
  {
    key: 'rating_try_again',
    category: 'admin',
    description: 'تقييم حاول مرة أخرى',
    ar: 'حاول مرة أخرى! بالتركيز والممارسة ستصل للأفضل 🚀🌱',
    th: 'ลองอีกครั้ง! ด้วยความตั้งใจคุณทำได้ดีขึ้นแน่นอน 🚀🌱',
    en: 'Try again! With focus and practice you will improve 🚀🌱',
  },
  {
    key: 'view_teacher_correction',
    category: 'lessons',
    description: 'زر عرض تصحيح الأستاذ',
    ar: 'عرض تصحيح الأستاذ',
    th: 'ดูการตรวจงานของครู',
    en: 'View Teacher Correction',
  },
  {
    key: 'corr_modal_col_student_image_homework',
    category: 'admin',
    description: 'عنوان واجب الصورة للطالب',
    ar: 'واجب الصورة للطالب',
    th: 'การบ้านรูปภาพของนักเรียน',
    en: 'Student Image Homework',
  },
  {
    key: 'corr_modal_col_student_audio_homework',
    category: 'admin',
    description: 'عنوان واجب الصوت للطالب',
    ar: 'واجب الصوت للطالب',
    th: 'การบ้านเสียงของนักเรียน',
    en: 'Student Audio Homework',
  },
  {
    key: 'corr_modal_col_additional_images_corr',
    category: 'admin',
    description: 'عنوان صور إضافية للتصحيح',
    ar: 'صور إضافية للتصحيح',
    th: 'รูปภาพเพิ่มเติมสำหรับการตรวจ',
    en: 'Additional Correction Images',
  },
  {
    key: 'corr_modal_col_teacher_audio_explanation',
    category: 'admin',
    description: 'عنوان الشرح الصوتي للأستاذ',
    ar: 'الشرح الصوتي للأستاذ',
    th: 'คำอธิบายเสียงของครู',
    en: 'Teacher Audio Explanation',
  },
  {
    key: 'corr_modal_open_image_window',
    category: 'admin',
    description: 'زر فتح الصورة في نافذة خاصة',
    ar: 'فتح الصورة في نافذة خاصة',
    th: 'เปิดรูปภาพในหน้าต่างใหม่',
    en: 'Open Image in New Window',
  },
  {
    key: 'corr_modal_select_link',
    category: 'admin',
    description: 'تسمية اختر الرابط',
    ar: 'اختر الرابط:',
    th: 'เลือกลิงก์:',
    en: 'Select Link:',
  },
  {
    key: 'corr_modal_link_num',
    category: 'admin',
    description: 'تسمية رقم الرابط',
    ar: 'رابط',
    th: 'ลิงก์',
    en: 'Link',
  },
  {
    key: 'corr_modal_audio_explanation_player_desc',
    category: 'admin',
    description: 'وصف مشغل الشرح الصوتي للواجب',
    ar: 'مشغل الشرح الصوتي الخاص بالواجب',
    th: 'เครื่องเล่นคำอธิบายเสียงการบ้าน',
    en: 'Homework Audio Explanation Player',
  },
  {
    key: 'corr_modal_direct_gdrive_player',
    category: 'admin',
    description: 'تسمية مشغل Google Drive المباشر',
    ar: 'مشغل Google Drive المباشر',
    th: 'เครื่องเล่น Google Drive โดยตรง',
    en: 'Direct Google Drive Player',
  },
  {
    key: 'corr_modal_browser_direct_player',
    category: 'admin',
    description: 'تسمية المشغل المباشر للمتصفح',
    ar: 'المشغل المباشر للمتصفح:',
    th: 'เครื่องเล่นโดยตรงของเบราว์เซอร์:',
    en: 'Browser Direct Player:',
  },
  {
    key: 'corr_modal_audio_player_title',
    category: 'admin',
    description: 'عنوان مشغل الصوت',
    ar: 'مشغل الصوت',
    th: 'เครื่องเล่นเสียง',
    en: 'Audio Player',
  },
  {
    key: 'corr_modal_preview_attachment',
    category: 'admin',
    description: 'عنوان معاينة المرفق',
    ar: 'معاينة المرفق',
    th: 'ดูตัวอย่างไฟล์แนบ',
    en: 'Preview Attachment',
  },
  {
    key: 'corr_modal_preview_image',
    category: 'admin',
    description: 'عنوان معاينة الصورة',
    ar: 'معاينة الصورة',
    th: 'ดูตัวอย่างรูปภาพ',
    en: 'Preview Image',
  },
  {
    key: 'corr_modal_preview_images',
    category: 'admin',
    description: 'عنوان معاينة الصور',
    ar: 'معاينة الصور',
    th: 'ดูตัวอย่างรูปภาพ',
    en: 'Preview Images',
  },
  {
    key: 'corr_modal_video_player',
    category: 'admin',
    description: 'عنوان مشغل الفيديو',
    ar: 'مشغل الفيديو',
    th: 'เครื่องเล่นวิดีโอ',
    en: 'Video Player',
  },
  {
    key: 'corr_modal_audio_recording',
    category: 'admin',
    description: 'عنوان التسجيل الصوتي',
    ar: 'التسجيل الصوتي',
    th: 'บันทึกเสียง',
    en: 'Audio Recording',
  },
  {
    key: 'corr_modal_attachments_count_title',
    category: 'admin',
    description: 'تسمية عدد الملحقات للمعاينة',
    ar: 'يوجد {count} ملحقات - انقر للمعاينة',
    th: 'มีไฟล์แนบ {count} รายการ - คลิกเพื่อดูตัวอย่าง',
    en: 'There are {count} attachments - Click to preview',
  },
  {
    key: 'corr_modal_click_to_preview',
    category: 'admin',
    description: 'تسمية انقر للمعاينة',
    ar: 'انقر للمعاينة',
    th: 'คลิกเพื่อดูตัวอย่าง',
    en: 'Click to preview',
  },
  {
    key: 'corr_modal_of_count',
    category: 'admin',
    description: 'كلمة من في الأرقام',
    ar: 'من',
    th: 'จาก',
    en: 'of',
  },
];

const LOCAL_STORAGE_LANG_KEY = 'app_language';
const LOCAL_STORAGE_TRANSLATIONS_KEY = 'app_custom_translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  translations: Record<string, Record<Language, string>>;
  translationList: TranslationItem[];
  t: (key: string, fallback?: string) => string;
  updateTranslationKey: (key: string, lang: Language, value: string) => void;
  saveAllTranslations: (updatedList: TranslationItem[]) => void;
  resetTranslationsToDefault: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem(LOCAL_STORAGE_LANG_KEY) as Language;
      if (savedLang && LANGUAGES[savedLang]) return savedLang;
    }
    return 'ar';
  });

  const [translationList, setTranslationList] = useState<TranslationItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_STORAGE_TRANSLATIONS_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as TranslationItem[];
          // Merge saved with defaults in case new keys were added
          const savedMap = new Map(parsed.map(item => [item.key, item]));
          return DEFAULT_TRANSLATIONS.map(def => {
            const custom = savedMap.get(def.key);
            if (custom) {
              return {
                ...def,
                ar: custom.ar || def.ar,
                th: custom.th || def.th,
                en: custom.en || def.en,
              };
            }
            return def;
          });
        } catch (e) {
          console.error('Failed to parse custom translations from localStorage', e);
        }
      }
    }
    return DEFAULT_TRANSLATIONS;
  });

  // Fast key-lookup dictionary map
  const translationsMap = React.useMemo(() => {
    const map: Record<string, Record<Language, string>> = {};
    translationList.forEach(item => {
      map[item.key] = {
        ar: item.ar,
        th: item.th,
        en: item.en,
      };
    });
    return map;
  }, [translationList]);

  // Sync document direction (RTL for Arabic, LTR for English/Thai)
  useEffect(() => {
    const info = LANGUAGES[language] || LANGUAGES.ar;
    if (typeof document !== 'undefined') {
      document.documentElement.dir = info.dir;
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = (lang: Language) => {
    if (LANGUAGES[lang]) {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_LANG_KEY, lang);
      }
    }
  };

  const t = (key: string, fallback?: string): string => {
    const keyData = translationsMap[key];
    if (keyData && keyData[language]) {
      return keyData[language];
    }
    // Fallback to Arabic if active language text missing
    if (keyData && keyData.ar) {
      return keyData.ar;
    }
    return fallback || key;
  };

  const updateTranslationKey = (key: string, lang: Language, value: string) => {
    setTranslationList(prev => {
      const newList = prev.map(item => {
        if (item.key === key) {
          return { ...item, [lang]: value };
        }
        return item;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_TRANSLATIONS_KEY, JSON.stringify(newList));
      }
      return newList;
    });
  };

  const saveAllTranslations = (updatedList: TranslationItem[]) => {
    setTranslationList(updatedList);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_TRANSLATIONS_KEY, JSON.stringify(updatedList));
    }
  };

  const resetTranslationsToDefault = () => {
    setTranslationList(DEFAULT_TRANSLATIONS);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_TRANSLATIONS_KEY);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        translations: translationsMap,
        translationList,
        t,
        updateTranslationKey,
        saveAllTranslations,
        resetTranslationsToDefault,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
