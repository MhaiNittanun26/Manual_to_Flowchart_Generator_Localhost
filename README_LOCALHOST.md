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

จากนั้นเปิด <http://localhost:5173/workflow-intelligence>

แอปตั้ง `basePath` เป็น `/workflow-intelligence` ไว้ ทุก URL จึงต้องมี prefix นี้เสมอ (เปิดที่ `http://localhost:5173` เฉย ๆ จะได้ 404) ถ้าพอร์ต 5173 ไม่ว่าง Vite จะเลื่อนไปพอร์ตถัดไปและพิมพ์ URL เต็มให้ใน Terminal

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
- `server/node-server.mjs` — Production server สำหรับรันหลัง nginx (จัดการ basePath + static asset)


## Deploy บนเซิร์ฟเวอร์ที่ใช้ nginx

แอปตั้ง `basePath: "/workflow-intelligence"` ไว้ใน `next.config.ts` แล้ว ดังนั้น HTML, ไฟล์ asset, RSC payload และ route ทั้งหมดจะมี prefix `/workflow-intelligence` ให้เอง ฝั่ง nginx จึงส่ง path เดิมทั้งก้อนเข้ามาได้เลย

### 1. รันแอปให้ฟังพอร์ตภายในเครื่อง

รันด้วย Docker Compose (คอนเทนเนอร์ build เองแล้ว serve ด้วย `server/node-server.mjs` ออกมาที่พอร์ต 3040 ของ host)

```bash
docker compose up -d --build
```

หรือรันตรงด้วย Node.js

```bash
npm ci
npm run build
PORT=3040 npm start
```

ตรวจว่าแอปตอบแล้ว

```bash
curl -I http://127.0.0.1:3040/workflow-intelligence
```

หมายเหตุ: อย่าใช้ `vinext start` เพราะ production server ของ vinext มองหา static asset จาก path `/assets/` ตรง ๆ พอมี `basePath` คำขอ `/workflow-intelligence/assets/*.js` จะตกไปที่ RSC handler แล้วได้ 404 (หน้าเว็บขึ้นแต่ไม่มี CSS/JS) `npm start` จึงรัน `server/node-server.mjs` ที่ตัด `basePath` ออกก่อนหา static file แล้วส่งงานที่เหลือให้ worker entry ที่ build ไว้

### 2. เพิ่มบล็อกใน nginx

คัดลอกเนื้อหาจาก `deploy/nginx-workflow-intelligence.conf` ไปวางเพิ่มใน `server { ... }` ของไซต์ที่ใช้อยู่

```nginx
location /workflow-intelligence {
    proxy_pass http://127.0.0.1:3040;

    proxy_http_version 1.1;
    proxy_set_header Upgrade           $http_upgrade;
    proxy_set_header Connection        "upgrade";
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_buffer_size       128k;
    proxy_buffers           4 256k;
    proxy_busy_buffers_size 256k;

    proxy_connect_timeout 60s;
    proxy_send_timeout    60s;
    proxy_read_timeout    300s;

    client_max_body_size 50m;
}
```

แล้วโหลด config ใหม่

```bash
sudo nginx -t && sudo systemctl reload nginx
```

ข้อควรระวัง

- ห้ามใส่ `/` ปิดท้าย `proxy_pass` เพราะจะตัด `/workflow-intelligence` ออกก่อนส่งให้แอป แล้วแอปจะตอบ 404
- ถ้าเปลี่ยนพอร์ต ให้แก้ทั้ง `docker-compose.yml` (หรือ `PORT`) และ `proxy_pass` ให้ตรงกัน

### เปลี่ยน sub path หรือกลับไปใช้ root

`basePath` ถูก bake เข้าไปตอน build จึงต้องตั้งค่า `BASE_PATH` ก่อนสั่ง build

```bash
BASE_PATH=/another-path npm run build   # เปลี่ยน sub path
BASE_PATH= npm run build                # เสิร์ฟที่ root ตามเดิม
```

สำหรับ Docker ใช้ build arg ชื่อเดียวกัน เช่น `docker compose build --build-arg BASE_PATH=/another-path`

และต้องตั้ง `BASE_PATH` ตัวเดียวกันตอนรัน `npm start` ด้วย เพราะ `server/node-server.mjs` ใช้ค่านี้ตัด prefix ก่อนหา static file (Dockerfile ตั้ง `ENV BASE_PATH` ให้จาก build arg อยู่แล้ว)
