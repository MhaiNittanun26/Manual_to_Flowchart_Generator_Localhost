# Manual-to-Flowchart Generator

เว็บแอป Local-first สำหรับเปลี่ยนคู่มือ PDF, DOCX, TXT หรือ Markdown ให้เป็น Flowchart และโครงสร้างข้อมูลกระบวนงานที่ตรวจแก้และใช้ซ้ำได้

## เริ่มใช้งาน

ต้องมี Node.js 22.13 ขึ้นไป

```bash
npm install
npm run dev
```

เปิด URL ที่แสดงใน Terminal หรือใช้ `start-local.bat` (Windows) / `start-local.sh` (macOS และ Linux)

อ่านรายละเอียดทั้งหมดได้ที่ [README_LOCALHOST.md](README_LOCALHOST.md)

## ความสามารถหลัก

- อ่าน PDF, DOCX, TXT และ Markdown
- จับ Pattern ขั้นตอน ผู้รับผิดชอบ เอกสาร และเงื่อนไขแบบ Local-first
- ตรวจแก้ Nodes, Edges และ Swimlanes ผ่านหน้าเว็บ
- ตรวจ QA เช่น รหัสซ้ำ เส้นอ้างอิงผิด และกล่องที่ไม่มีเส้นเข้า/ออก
- ส่งออก JSON, XLSX, PNG, SVG และ PPTX
- PowerPoint ใช้ Shape ที่แก้ไขได้ และ Connector ผูกกับ Source/Target Shape จริง

## ตรวจโครงการ

```bash
npm run lint
npm run build
npm run verify:exports
```
