# Manual-to-Flowchart Generator

เว็บแอป Local-first สำหรับเปลี่ยนคู่มือหรือระเบียบที่อยู่ในไฟล์ PDF, DOCX, TXT หรือ Markdown ให้เป็นโครงสร้างกระบวนงานที่ตรวจแก้และนำกลับมาใช้ซ้ำได้

## ผลลัพธ์ที่ระบบส่งออก

- `JSON` — แหล่งข้อมูลกลาง (Workflow / Nodes / Edges / Swimlanes)
- `XLSX` — ตารางสำหรับตรวจสอบและวิเคราะห์ต่อ
- `PPTX` — Flowchart ที่ทุกกล่องเป็น PowerPoint Shape และทุกเส้นเป็น Connector ที่ผูกกับ Source/Target Shape จริง
- `PNG` และ `SVG` — ภาพสำหรับตรวจทาน
- `ZIP` — รวมผลลัพธ์ทั้งหมดพร้อม QA report และ Pattern library

## วิธีรันบน localhost

ต้องมี Node.js 22.13 ขึ้นไป

```bash
npm install
npm run dev
```

จากนั้นเปิด URL ที่แสดงใน Terminal (โดยทั่วไปคือ `http://localhost:3000` หรือ `http://localhost:5173`)

### Windows

ดับเบิลคลิก `start-local.bat` หรือเปิด Command Prompt ในโฟลเดอร์นี้แล้วรัน:

```bat
start-local.bat
```

### macOS / Linux

```bash
chmod +x start-local.sh
./start-local.sh
```

## วิธีใช้งาน

1. อัปโหลดคู่มือ หรือวางข้อความในช่องด้านซ้าย
2. กด **วิเคราะห์และสร้าง Draft**
3. ตรวจแก้กล่อง ประเภทสัญลักษณ์ Swimlane เอกสาร และเส้นเชื่อม
4. เปิดแท็บ **ตรวจคุณภาพ** และแก้รายการ Fail ก่อนส่งออก
5. ดาวน์โหลด **ชุดส่งมอบ ZIP** หรือไฟล์รายประเภท

## ข้อควรรู้

- ระบบอ่านข้อความจาก PDF โดยตรง จึงควรตรวจซ้ำเมื่อ PDF เป็นภาพสแกนหรือมีการจัดวางซับซ้อน
- Pattern engine ทำงานในเบราว์เซอร์และไม่ส่งเอกสารออกไปภายนอก
- การวิเคราะห์เป็น Draft เพื่อช่วยลดงานมนุษย์ แต่ยังควรมีผู้รับผิดชอบกระบวนงานรับรองสาระสำคัญ
- กรณี Workflow ยาว ระบบจะแบ่ง PowerPoint หลายหน้าและสร้าง Connector ข้ามหน้าเป็นคู่

## โครงสร้างสำคัญ

- `app/lib/parser.ts` — Pattern extraction และ QA rules
- `app/lib/types.ts` — Canonical data model
- `app/lib/exporters.ts` — JSON/XLSX/PPTX/ZIP export และการผูก PowerPoint Connector
- `app/lib/sample.ts` — ชุดข้อมูลตัวอย่าง

