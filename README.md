# ระบบจัดการทรัพย์สิน (Asset Management System)

ระบบสำหรับจัดการ ตรวจนับ และติดตามสถานะทรัพย์สินภายในองค์กร พัฒนาด้วย React, TypeScript และ Supabase

## ฟีเจอร์หลัก (Features)

- **Dashboard**: ดูภาพรวมมูลค่าทรัพย์สิน, จำนวนทั้งหมด, และสถานะต่างๆ (ถูกยืม, ส่งซ่อม)
- **จัดการสินค้า (Products)**: เพิ่ม/ลบ/แก้ไข ข้อมูลทรัพย์สิน พร้อมระบบสร้าง SKU อัตโนมัติ
- **ติดตามรายการ (Serials)**: จัดการสถานะรายชิ้น (พร้อมใช้, ถูกยืม, เสีย) และระบุตำแหน่งจัดเก็บ
- **ระบบเบิก-คืน (Transactions)**: บันทึกประวัติการยืม-คืนอุปกรณ์ของพนักงาน
- **จัดการพนักงาน (Employees)**: เก็บข้อมูลพนักงานและประวัติการครองครองทรัพย์สิน
- **รายงาน (Reports)**: (กำลังพัฒนา)

## เทคโนโลยีที่ใช้ (Tech Stack)

- **Frontend**: React, TypeScript, Vite
- **UI Framework**: Tailwind CSS, shadcn/ui
- **State Management**: TanStack Query
- **Backend & Database**: Supabase
- **Routing**: React Router