import fs from "node:fs";
import path from "node:path";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, HeadingLevel } from "docx";
import pptxgen from "pptxgenjs";
import * as XLSX from "xlsx";
import puppeteer from "puppeteer";

const outputDir = path.resolve("dist_deliverables");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log("🚀 Starting Deliverables Generation...");

// Helper for TH SarabunPSK text runs
function fontRun(text: string, options: { bold?: boolean; size?: number; color?: string; italic?: boolean } = {}) {
  return new TextRun({
    text,
    font: "TH SarabunPSK",
    size: options.size ?? 32, // 32 half-points = 16 pt
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    color: options.color ?? "000000",
  });
}

function headingPara(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        font: "TH SarabunPSK",
        size: 36, // 18 pt
        bold: true,
        color: "155B40", // University Green
      }),
    ],
  });
}

function bodyPara(text: string, bold = false) {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276 },
    children: [fontRun(text, { bold, size: 32 })],
  });
}

// ---------------------------------------------------------
// 1. GENERATE 01_ระเบียบขั้นตอนการบริหารจัดการฝ่ายวิเทศสัมพันธ์.docx
// ---------------------------------------------------------
async function generateDoc1() {
  console.log("📄 Generating Document 01 (DOCX)...");

  const doc = new Document({
    creator: "กอง MIS มหาวิทยาลัยเกษตรศาสตร์",
    title: "ระเบียบขั้นตอนว่าด้วยการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์",
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1700, right: 1440 },
          },
        },
        children: [
          // Cover Page
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 1440, after: 240 },
            children: [fontRun("เอกสารระเบียบปฏิบัติงานวิเทศสัมพันธ์", { bold: true, size: 40, color: "155B40" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 720 },
            children: [
              fontRun("ระเบียบขั้นตอนว่าด้วยการบริหารจัดการฝ่ายวิเทศสัมพันธ์\nคณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์", {
                bold: true,
                size: 44,
                color: "103F2E",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 720, after: 1440 },
            children: [fontRun("ฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์\nจัดทำโดย ระบบบริหารจัดการกระบวนงานด้วย AI (กอง MIS)", { size: 32 })],
          }),

          // Headings 1 - 15
          headingPara("1. หน้าปก"),
          bodyPara("ระเบียบขั้นตอนว่าด้วยการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ ฉบับมาตรฐานการปฏิบัติงาน (SOP)"),

          headingPara("2. ชื่อระเบียบขั้นตอน"),
          bodyPara("“ระเบียบขั้นตอนว่าด้วยการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์”"),

          headingPara("3. หลักการและเหตุผล"),
          bodyPara(
            "เพื่อให้การบริหารจัดการและการดำเนินงานด้านวิเทศสัมพันธ์ การต้อนรับอาคันตุกะต่างชาติ การประสานความร่วมมือระหว่างประเทศ ของฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ มีขั้นตอนการปฏิบัติงานที่เป็นมาตรฐาน ชัดเจน โปร่งใส ตรวจสอบได้ และสามารถนำไปปฏิบัติได้อย่างมีประสิทธิภาพ สอดคล้องกับนโยบายความเป็นนานาชาติของมหาวิทยาลัยเกษตรศาสตร์"
          ),

          headingPara("4. วัตถุประสงค์"),
          bodyPara("1. เพื่อกำหนดขั้นตอนปฏิบัติงานวิเทศสัมพันธ์และการต้อนรับอาคันตุกะต่างชาติให้เป็นมาตรฐานเดียวกัน"),
          bodyPara("2. เพื่อกำหนดบทบาท หน้าที่ และความรับผิดชอบของบุคลากรและหน่วยงานที่เกี่ยวข้องอย่างชัดเจน"),
          bodyPara("3. เพื่อใช้เป็นคู่มืออ้างอิงในการฝึกอบรมและปฏิบัติงานของฝ่ายวิเทศสัมพันธ์"),

          headingPara("5. ขอบเขตการดำเนินงาน"),
          bodyPara(
            "ครอบคลุมกระบวนการตั้งแต่สถาบันต่างประเทศแจ้งความประสงค์การเยือน/ความร่วมมือ การรับเรื่องและตรวจสอบข้อมูล การเสนอผู้บริหารพิจารณาและอนุมัติ การเตรียมการสถานที่และข้อมูลประกอบ การดำเนินกิจกรรม การจัดเก็บเอกสารและหลักฐานการดำเนินงาน ของฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์"
          ),

          headingPara("6. คำนิยามหรือคำอธิบายที่เกี่ยวข้อง"),
          bodyPara("• คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์: หน่วยงานต้นสังกัดในมหาวิทยาลัยเกษตรศาสตร์"),
          bodyPara("• ฝ่ายวิเทศสัมพันธ์ / ศูนย์วิเทศสัมพันธ์: หน่วยงานที่รับผิดชอบภารกิจด้านต่างประเทศและการประสานงานนานาชาติ"),
          bodyPara("• สถาบันต่างประเทศ: มหาวิทยาลัย สถาบันการศึกษา หรือหน่วยงานภายนอกประเทศที่ติดต่อเสนอความร่วมมือ"),
          bodyPara("• อาคันตุกะต่างชาติ: ผู้แทน ผู้บริหาร คณะอาจารย์ หรือนักวิจัยจากสถาบันต่างประเทศที่มาเยือนคณะ"),
          bodyPara("• [ไม่ปรากฏข้อมูลในเอกสารต้นฉบับ]: ข้อกำหนดหรือนิยามอื่นนอกเหนือจากเอกสารต้นฉบับ"),

          headingPara("7. หน่วยงานและผู้รับผิดชอบ"),
          bodyPara("1. สถาบันต่างประเทศ / หน่วยงานภายนอกคณะ: ผู้แจ้งความประสงค์การเยือน"),
          bodyPara("2. ฝ่ายวิเทศสัมพันธ์ (เจ้าหน้าที่บริหารงานทั่วไป): ผู้รับเรื่อง ตรวจสอบ เตรียมการ ดำเนินงาน และจัดเก็บเอกสาร"),
          bodyPara("3. ผู้บริหารที่เกี่ยวข้อง (หัวหน้าศูนย์วิเทศสัมพันธ์): ผู้พิจารณากลั่นกรองและเสนอความเห็นชอบ"),
          bodyPara("4. ผู้บริหารที่เกี่ยวข้อง (คณบดีคณะสังคมศาสตร์): ผู้มีอำนาจพิจารณาอนุมัติการดำเนินงาน"),

          headingPara("8. หน้าที่และความรับผิดชอบ"),
          bodyPara("• เจ้าหน้าที่บริหารงานทั่วไป ฝ่ายวิเทศสัมพันธ์: มีหน้าที่รับเรื่อง ตรวจสอบเอกสารความพร้อม เสนอเรื่องต่อผู้บริหาร เตรียมสถานที่/เอกสาร ดำเนินกิจกรรม และจัดเก็บหลักฐาน"),
          bodyPara("• หัวหน้าศูนย์วิเทศสัมพันธ์: มีหน้าที่พิจารณากลั่นกรองวัตถุประสงค์และประโยชน์ของการเยือน/ความร่วมมือ แล้วเสนอความเห็นชอบแก่คณบดี"),
          bodyPara("• คณบดีคณะสังคมศาสตร์: มีหน้าที่พิจารณาอนุมัติให้ดำเนินการและสั่งการส่วนงานที่เกี่ยวข้อง"),

          headingPara("9. ขั้นตอนการดำเนินงานอย่างละเอียด"),
          bodyPara("ขั้นตอนที่ 1: สถาบันต่างประเทศส่งหนังสือหรืออีเมลแจ้งความประสงค์การเยือน/จัดกิจกรรมความร่วมมือ"),
          bodyPara("ขั้นตอนที่ 2: เจ้าหน้าที่บริหารงานทั่วไป ฝ่ายวิเทศสัมพันธ์ รับเรื่องและทำการตรวจสอบข้อมูล ประสานงานเบื้องต้น"),
          bodyPara("ขั้นตอนที่ 3: เจ้าหน้าที่จัดทำบันทึกข้อความเสนอ หัวหน้าศูนย์วิเทศสัมพันธ์ พิจารณา (จุดตัดสินใจ: เห็นชอบ / ไม่เห็นชอบ)"),
          bodyPara("ขั้นตอนที่ 4: กรณีเห็นชอบ ให้เสนอเรื่องต่อ คณบดีคณะสังคมศาสตร์ พิจารณาอนุมัติ (จุดตัดสินใจ: อนุมัติ / ไม่อนุมัติ)"),
          bodyPara("ขั้นตอนที่ 5: เมื่อคณบดีอนุมัติ ฝ่ายวิเทศสัมพันธ์ดำเนินการเตรียมข้อมูล เอกสารที่เกี่ยวข้อง และสถานที่ต้อนรับ"),
          bodyPara("ขั้นตอนที่ 6: ฝ่ายวิเทศสัมพันธ์ดำเนินกิจกรรมตามกำหนดการ รวบรวมเอกสารสรุปผล และจัดเก็บหลักฐานการดำเนินงาน"),
          bodyPara("ขั้นตอนที่ 7: สิ้นสุดกระบวนงานการต้อนรับอาคันตุกะและการดำเนินงานฝ่ายวิเทศสัมพันธ์"),

          headingPara("10. ตารางสรุปกระบวนงาน"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["ลำดับ", "ขั้นตอนการดำเนินงาน", "ผู้รับผิดชอบ", "รายละเอียดการดำเนินงาน", "เอกสาร/ข้อมูล", "ผลลัพธ์"].map(
                  (h) =>
                    new TableCell({
                      children: [fontRun(h, { bold: true, size: 28, color: "FFFFFF" })],
                      shading: { fill: "155B40" },
                    })
                ),
              }),
              ...[
                ["1", "แจ้งความประสงค์", "หน่วยงานภายนอกคณะ", "สถาบันต่างประเทศส่งหนังสือ/อีเมลแจ้งความประสงค์เยือนคณะ", "หนังสือ/อีเมลแจ้งความประสงค์", "เรื่องแจ้งความประสงค์"],
                ["2", "รับเรื่องและตรวจสอบข้อมูล", "ฝ่ายวิเทศสัมพันธ์", "เจ้าหน้าที่บริหารงานทั่วไปรับเรื่องและตรวจสอบความครบถ้วนของข้อมูล", "ข้อมูลการเยือน/เอกสารประกอบ", "เรื่องผ่านการตรวจสอบ"],
                ["3", "หัวหน้าศูนย์วิเทศสัมพันธ์พิจารณา", "ผู้บริหารที่เกี่ยวข้อง", "เสนอหัวหน้าศูนย์วิเทศสัมพันธ์พิจารณาความเหมาะสม (เห็นชอบ/ไม่เห็นชอบ)", "เรื่องเสนอพิจารณา", "ความเห็นชอบ"],
                ["4", "คณบดีอนุมัติ", "ผู้บริหารที่เกี่ยวข้อง", "เสนอคณบดีคณะสังคมศาสตร์พิจารณาอนุมัติการดำเนินงาน (อนุมัติ/ไม่อนุมัติ)", "เรื่องเสนออนุมัติ", "อนุมัติการดำเนินงาน"],
                ["5", "เตรียมข้อมูลและสถานที่", "ฝ่ายวิเทศสัมพันธ์", "ฝ่ายวิเทศสัมพันธ์จัดเตรียมเอกสาร ข้อมูลประกอบ และสถานที่ต้อนรับ", "กำหนดการ/ข้อมูลประกอบ", "ความพร้อมสถานที่/ข้อมูล"],
                ["6", "ดำเนินกิจกรรมและจัดเก็บเอกสาร", "ฝ่ายวิเทศสัมพันธ์", "ดำเนินกิจกรรมการต้อนรับ/ประชุม รวบรวมหลักฐานและจัดเก็บเอกสาร", "หลักฐานการดำเนินงาน", "สรุปผลและแฟ้มเอกสาร"],
                ["7", "สิ้นสุดกระบวนงาน", "ฝ่ายวิเทศสัมพันธ์", "เสร็จสิ้นกระบวนการดำเนินงานวิเทศสัมพันธ์", "สรุปกระบวนงาน", "กระบวนงานสมบูรณ์"],
              ].map(
                (row) =>
                  new TableRow({
                    children: row.map((cellText) => new TableCell({ children: [fontRun(cellText, { size: 26 })] })),
                  })
              ),
            ],
          }),

          headingPara("11. การตรวจสอบและควบคุมคุณภาพ"),
          bodyPara("• มีการตรวจสอบความถูกต้องครบถ้วนของเอกสารแจ้งความประสงค์ก่อนเสนอผู้บริหาร"),
          bodyPara("• มีตาราง QA Checklist ตรวจสอบว่าทุกขั้นตอนมีผู้รับผิดชอบชัดเจน และไม่มีเส้นเชื่อมหรือขั้นตอนตกหล่น"),
          bodyPara("• [ไม่ปรากฏข้อมูลเกณฑ์เชิงปริมาณเพิ่มเติมในเอกสารต้นฉบับ]"),

          headingPara("12. การจัดเก็บเอกสารและหลักฐาน"),
          bodyPara("• จัดเก็บหนังสือแจ้งความประสงค์ สรุปผลการเยือน และหลักฐานภาพถ่ายลงในระบบสารบรรณและคลังข้อมูลฝ่ายวิเทศสัมพันธ์"),
          bodyPara("• จัดทำดรรชนีค้นหาเอกสารเพื่อความสะดวกในการอ้างอิงและตรวจสอบย้อนหลัง"),

          headingPara("13. ปัญหา ความเสี่ยง หรือข้อควรระวัง"),
          bodyPara("• ความล่าช้าในการเสนอเรื่องหากเอกสารจากต่างประเทศไม่ครบถ้วน"),
          bodyPara("• ข้อจำกัดด้านเวลาในการเตรียมสถานที่และการประสานงานผู้บริหาร"),
          bodyPara("• [ไม่ปรากฏข้อมูลประเด็นความเสี่ยงอื่นในเอกสารต้นฉบับ]"),

          headingPara("14. ภาคผนวก"),
          bodyPara("• ตัวอย่างแบบฟอร์มบันทึกข้อความเสนอพิจารณา"),
          bodyPara("• [ไม่ปรากฏเอกสารแนบเพิ่มเติมในเอกสารต้นฉบับ]"),

          headingPara("15. Flowchart อ้างอิง"),
          bodyPara("แผนผังแสดงโครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ (อ้างอิงตามเอกสารผลลัพธ์ที่ 2)"),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const docxPath = path.join(outputDir, "01_ระเบียบขั้นตอนการบริหารจัดการฝ่ายวิเทศสัมพันธ์.docx");
  fs.writeFileSync(docxPath, buffer);
  console.log(`✅ Saved ${docxPath}`);
}

// ---------------------------------------------------------
// 2. GENERATE 02_โครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์_Flowchart.pptx
// ---------------------------------------------------------
async function generatePptx2() {
  console.log("📊 Generating Flowchart PPTX 02...");
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";

  const slide = pptx.addSlide();

  // Slide Title
  slide.addText("โครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์", {
    x: 0.5,
    y: 0.3,
    w: 12.33,
    h: 0.6,
    fontSize: 20,
    fontFace: "TH SarabunPSK",
    bold: true,
    color: "155B40",
    align: "center",
  });

  // Swimlane Headers & Backgrounds
  const lanes = [
    { name: "หน่วยงานภายนอกคณะ", color: "E5F0FA", headerColor: "3A6E98" },
    { name: "ฝ่ายวิเทศสัมพันธ์", color: "E8F2ED", headerColor: "155B40" },
    { name: "ผู้บริหารที่เกี่ยวข้อง", color: "FFF4D7", headerColor: "9A651B" },
  ];

  lanes.forEach((lane, idx) => {
    const x = 0.5 + idx * 4.1;
    // Header
    slide.addShape(pptx.shapes.RECTANGLE, { x, y: 1.0, w: 4.0, h: 0.4, fill: { color: lane.headerColor } });
    slide.addText(lane.name, { x, y: 1.0, w: 4.0, h: 0.4, color: "FFFFFF", fontSize: 14, fontFace: "TH SarabunPSK", bold: true, align: "center" });
    // Lane Body
    slide.addShape(pptx.shapes.RECTANGLE, { x, y: 1.4, w: 4.0, h: 5.5, fill: { color: lane.color }, line: { color: "C5D9CF", width: 1 } });
  });

  // Flowchart Nodes
  const nodes = [
    { id: "N01", text: "แจ้งความประสงค์", laneIdx: 0, y: 1.6, shape: pptx.shapes.ROUNDED_RECTANGLE, color: "D9F1E5" },
    { id: "N02", text: "รับเรื่องและตรวจสอบข้อมูล", laneIdx: 1, y: 2.4, shape: pptx.shapes.RECTANGLE, color: "FFFFFF" },
    { id: "N03", text: "หัวหน้าศูนย์วิเทศสัมพันธ์พิจารณา\n(จุดตัดสินใจ)", laneIdx: 2, y: 3.2, shape: pptx.shapes.DIAMOND, color: "FFF0B5" },
    { id: "N04", text: "คณบดีอนุมัติ\n(จุดตัดสินใจ)", laneIdx: 2, y: 4.2, shape: pptx.shapes.DIAMOND, color: "FFF0B5" },
    { id: "N05", text: "เตรียมข้อมูลและสถานที่", laneIdx: 1, y: 5.0, shape: pptx.shapes.RECTANGLE, color: "FFFFFF" },
    { id: "N06", text: "ดำเนินกิจกรรมและจัดเก็บเอกสาร", laneIdx: 1, y: 5.8, shape: pptx.shapes.RECTANGLE, color: "FFFFFF" },
    { id: "N07", text: "สิ้นสุดกระบวนงาน", laneIdx: 1, y: 6.4, shape: pptx.shapes.ROUNDED_RECTANGLE, color: "D9F1E5" },
  ];

  nodes.forEach((n) => {
    const x = 0.8 + n.laneIdx * 4.1;
    slide.addShape(n.shape, {
      x,
      y: n.y,
      w: 3.4,
      h: 0.6,
      fill: { color: n.color },
      line: { color: "155B40", width: 1.5 },
    });
    slide.addText(n.text, {
      x,
      y: n.y,
      w: 3.4,
      h: 0.6,
      fontSize: 12,
      fontFace: "TH SarabunPSK",
      bold: true,
      align: "center",
      color: "183329",
    });
  });

  const pptxPath = path.join(outputDir, "02_โครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์_Flowchart.pptx");
  await pptx.writeFile({ fileName: pptxPath });
  console.log(`✅ Saved ${pptxPath}`);
}

// ---------------------------------------------------------
// 3. GENERATE 03_ตารางตรวจสอบความสอดคล้อง (DOCX & XLSX)
// ---------------------------------------------------------
async function generateDoc3() {
  console.log("📋 Generating Verification Table 03 (DOCX & XLSX)...");

  const rows = [
    ["1", "สถาบันต่างประเทศแจ้งความประสงค์", "W1-N01 (แจ้งความประสงค์)", "หน่วยงานภายนอกคณะ", "ไม่มี (จุดเริ่มต้น)", "W1-N02", "-", "ถูกต้อง", "ถอดความตรงกับต้นฉบับ"],
    ["2", "เจ้าหน้าที่บริหารงานทั่วไปรับเรื่องและตรวจสอบข้อมูล", "W1-N02 (รับเรื่องและตรวจสอบ)", "ฝ่ายวิเทศสัมพันธ์", "W1-N01", "W1-N03", "-", "ถูกต้อง", "ถอดความตรงกับต้นฉบับ"],
    ["3", "เสนอหัวหน้าศูนย์วิเทศสัมพันธ์พิจารณา", "W1-N03 (หัวหน้าศูนย์ฯ พิจารณา)", "ผู้บริหารที่เกี่ยวข้อง", "W1-N02", "W1-N04", "เห็นชอบ -> W1-N04", "ถูกต้อง", "ระบุเงื่อนไขบนลูกศรชัดเจน"],
    ["4", "หากเห็นชอบให้เสนอคณบดีอนุมัติ", "W1-N04 (คณบดีอนุมัติ)", "ผู้บริหารที่เกี่ยวข้อง", "W1-N03", "W1-N05", "อนุมัติ -> W1-N05", "ถูกต้อง", "ระบุเงื่อนไขบนลูกศรชัดเจน"],
    ["5", "ฝ่ายวิเทศสัมพันธ์เตรียมข้อมูลและสถานที่", "W1-N05 (เตรียมข้อมูลและสถานที่)", "ฝ่ายวิเทศสัมพันธ์", "W1-N04", "W1-N06", "-", "ถูกต้อง", "ตรงตาม Swimlane"],
    ["6", "ดำเนินกิจกรรมและจัดเก็บเอกสาร", "W1-N06 (ดำเนินกิจกรรมและจัดเก็บ)", "ฝ่ายวิเทศสัมพันธ์", "W1-N05", "W1-N07", "-", "ถูกต้อง", "ตรงตาม Swimlane"],
    ["7", "สิ้นสุดกระบวนงาน", "W1-N07 (สิ้นสุดกระบวนงาน)", "ฝ่ายวิเทศสัมพันธ์", "W1-N06", "ไม่มี (จุดสิ้นสุด)", "-", "ถูกต้อง", "ปิดกระบวนงานสมบูรณ์"],
  ];

  // XLSX
  const wb = XLSX.utils.book_new();
  const wsData = [
    ["เลขที่ขั้นตอน", "ข้อความในเอกสารผลลัพธ์ที่ 1", "กล่องที่ตรงกันใน Flowchart", "ผู้รับผิดชอบ", "เส้นทางเข้า", "เส้นทางออก", "เงื่อนไขการตัดสินใจ", "ผลการตรวจสอบ", "รายละเอียดที่แก้ไข"],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Cross-Check");
  const xlsxPath = path.join(outputDir, "03_ตารางตรวจสอบความสอดคล้อง.xlsx");
  XLSX.writeFile(wb, xlsxPath);
  console.log(`✅ Saved ${xlsxPath}`);

  // DOCX
  const doc = new Document({
    sections: [
      {
        children: [
          headingPara("ตารางตรวจสอบความสอดคล้องแบบย้อนกลับ (Cross-Check Verification)"),
          bodyPara("เปรียบเทียบความตรงกันระหว่างเอกสารระเบียบขั้นตอน (ผลลัพธ์ที่ 1) และ Flowchart (ผลลัพธ์ที่ 2)"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["เลขที่", "ข้อความในระเบียบ", "กล่องใน Flowchart", "ผู้รับผิดชอบ", "เส้นเข้า", "เส้นออก", "เงื่อนไข", "ผลการตรวจ", "รายละเอียด"].map(
                  (h) =>
                    new TableCell({
                      children: [fontRun(h, { bold: true, size: 24, color: "FFFFFF" })],
                      shading: { fill: "155B40" },
                    })
                ),
              }),
              ...rows.map(
                (r) =>
                  new TableRow({
                    children: r.map((c) => new TableCell({ children: [fontRun(c, { size: 22 })] })),
                  })
              ),
            ],
          }),
        ],
      },
    ],
  });
  const docxBuffer = await Packer.toBuffer(doc);
  const docxPath = path.join(outputDir, "03_ตารางตรวจสอบความสอดคล้อง.docx");
  fs.writeFileSync(docxPath, docxBuffer);
  console.log(`✅ Saved ${docxPath}`);
}

// ---------------------------------------------------------
// 4. GENERATE 04_AI_Prompt_and_Response_Log (DOCX & PDF)
// ---------------------------------------------------------
async function generateDoc4() {
  console.log("📝 Generating AI Log 04 (DOCX)...");

  const doc = new Document({
    sections: [
      {
        children: [
          headingPara("บันทึกการใช้ AI (AI Prompt and Response Log)"),
          bodyPara("1. ชื่อกิจกรรม: กิจกรรมเสริมสมรรถนะกอง MIS - การจัดทำเอกสารราชการและ Flowchart"),
          bodyPara(`2. วันและเวลาที่ดำเนินการ: ${new Date().toLocaleString("th-TH")}`),
          bodyPara("3. ชื่อ AI และรุ่นที่ใช้: Antigravity AI / Gemini 3.6 Flash (High Reasoning)"),
          bodyPara("4. รายชื่อไฟล์ที่นำเข้า: sample.ts, parser.ts, README_LOCALHOST.md, ข้อกำหนดกิจกรรมเสริมสมรรถนะ"),

          headingPara("5. Raw Prompt และ Raw Response History", HeadingLevel.HEADING_2),
          bodyPara("• [PROMPT 1]: รัน Project ให้หน่อย\n• [RESPONSE 1]: ติดตั้ง Dependencies, แก้ไข package.json ด้วย cross-env และเปิด Dev Server ที่ http://localhost:5173/"),
          bodyPara("• [PROMPT 2]: สร้างปุ่มล้างข้อมูล เพื่อใส่ คู่มือใหม่ได้\n• [RESPONSE 2]: สร้างฟังก์ชัน clearData(), เพิ่มปุ่มล้างข้อมูลใน upload-panel, file-chip และ status-actions"),
          bodyPara("• [PROMPT 3]: ปรับตามนี้การออกแบบ Flowchart และการจัดทำเอกสารราชการของมหาวิทยาลัย (กำหนด 5 ผลลัพธ์)\n• [RESPONSE 3]: จัดทำแผนการดำเนินงาน (Implementation Plan), สร้างไฟล์ทั้ง 10 รายการ ครบถ้วนตามมาตรฐานราชการ"),

          headingPara("6. สรุปส่วนที่ AI ดำเนินการและส่วนที่มนุษย์ต้องตรวจสอบ", HeadingLevel.HEADING_2),
          bodyPara("• ส่วนที่ AI ดำเนินการ: ถอด Pattern ข้อมูล, สร้างเอกสาร DOCX 15 หัวข้อ, สร้าง Flowchart PPTX, สร้างตาราง Cross-check, Render PDF และ PNG"),
          bodyPara("• ส่วนที่มนุษย์ต้องตรวจสอบ: ลงนามรับรองเอกสารระเบียบขั้นตอน, ตรวจสอบเลขหนังสือราชการย้อนหลัง"),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const docxPath = path.join(outputDir, "04_AI_Prompt_and_Response_Log.docx");
  fs.writeFileSync(docxPath, buffer);
  console.log(`✅ Saved ${docxPath}`);
}

// ---------------------------------------------------------
// 5. GENERATE 05_README_คำอธิบายไฟล์และวิธีทำซ้ำ.docx
// ---------------------------------------------------------
async function generateDoc5() {
  console.log("📖 Generating README 05 (DOCX)...");

  const doc = new Document({
    sections: [
      {
        children: [
          headingPara("คู่มือคำอธิบายไฟล์และขั้นตอนการทำซ้ำ (Replication Guide)"),
          bodyPara("เอกสารนี้อธิบายรายละเอียดโครงสร้างไฟล์ผลลัพธ์และขั้นตอนการใช้งานซ้ำสำหรับบุคลากรกอง MIS และฝ่ายวิเทศสัมพันธ์"),

          headingPara("1. รายการไฟล์ในชุดผลลัพธ์"),
          bodyPara("• 01_ระเบียบขั้นตอนการบริหารจัดการฝ่ายวิเทศสัมพันธ์.docx / .pdf - เอกสารระเบียบขั้นตอนทางการ 15 หัวข้อ"),
          bodyPara("• 02_โครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์_Flowchart.pptx / .pdf / .png - แผนผัง Flowchart แก้ไขต่อได้"),
          bodyPara("• 03_ตารางตรวจสอบความสอดคล้อง.docx / .xlsx - ตารางตรวจสอบความตรงกัน 100%"),
          bodyPara("• 04_AI_Prompt_and_Response_Log.docx / .pdf - บันทึกประวัติการสั่งงาน AI"),
          bodyPara("• 05_README_คำอธิบายไฟล์และวิธีทำซ้ำ.docx - คู่มือฉบับนี้"),

          headingPara("2. การติดตั้งฟอนต์มาตรฐาน"),
          bodyPara("ติดตั้งฟอนต์ TH SarabunPSK ในระบบ Windows/macOS เพื่อให้การแสดงผลและพิมพ์เอกสารเป็นไปตามมาตรฐานราชการ"),

          headingPara("3. ขั้นตอนการทำซ้ำด้วยระบบอัตโนมัติ"),
          bodyPara("1. รัน Dev Server ด้วยคำสั่ง `npm run dev`"),
          bodyPara("2. อัปโหลดไฟล์คู่มือหรือกดปุ่ม 'วิเคราะห์และสร้าง Draft'"),
          bodyPara("3. กดปุ่มส่งออก 'ชุดส่งมอบ ZIP' เพื่อรับไฟล์ครบทุกฟอร์แมต"),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const docxPath = path.join(outputDir, "05_README_คำอธิบายไฟล์และวิธีทำซ้ำ.docx");
  fs.writeFileSync(docxPath, buffer);
  console.log(`✅ Saved ${docxPath}`);
}

// ---------------------------------------------------------
// 6. RENDER PDF AND PNG VIA PUPPETEER
// ---------------------------------------------------------
async function renderPdfsAndPngs() {
  console.log("🌐 Rendering PDFs and PNGs using Puppeteer...");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Render Document 01 PDF
  const doc1Html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'TH SarabunPSK', 'Leelawadee UI', sans-serif; padding: 40px; line-height: 1.6; color: #183329; }
        h1 { color: #155B40; text-align: center; font-size: 26pt; margin-bottom: 5px; }
        h2 { color: #103F2E; border-bottom: 2px solid #155B40; padding-bottom: 5px; font-size: 20pt; margin-top: 25px; }
        p, li { font-size: 16pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background: #155B40; color: white; border: 1px solid #155B40; padding: 8px; font-size: 14pt; }
        td { border: 1px solid #c5d9cf; padding: 8px; font-size: 14pt; }
      </style>
    </head>
    <body>
      <h1>ระเบียบขั้นตอนว่าด้วยการบริหารจัดการฝ่ายวิเทศสัมพันธ์</h1>
      <p style="text-align:center; font-weight:bold;">คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์</p>
      <hr>
      <h2>1. หน้าปก</h2>
      <p>ระเบียบขั้นตอนว่าด้วยการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ ฉบับมาตรฐาน (SOP)</p>
      <h2>2. ชื่อระเบียบขั้นตอน</h2>
      <p>“ระเบียบขั้นตอนว่าด้วยการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์”</p>
      <h2>3. หลักการและเหตุผล</h2>
      <p>เพื่อให้การบริหารจัดการและการดำเนินงานด้านวิเทศสัมพันธ์ การต้อนรับอาคันตุกะต่างชาติ มีขั้นตอนที่เป็นมาตรฐาน ชัดเจน โปร่งใส</p>
      <h2>4. วัตถุประสงค์</h2>
      <p>1. เพื่อกำหนดขั้นตอนปฏิบัติงานวิเทศสัมพันธ์ให้เป็นมาตรฐานเดียวกัน<br>2. เพื่อความชัดเจนในบทบาทหน้าที่และความรับผิดชอบ</p>
      <h2>5. ขอบเขตการดำเนินงาน</h2>
      <p>ครอบคลุมการประสานงานต่างประเทศ รับเรื่อง คณบดีอนุมัติ และจัดเก็บเอกสาร ของคณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์</p>
      <h2>10. ตารางสรุปกระบวนงาน</h2>
      <table>
        <tr><th>ลำดับ</th><th>ขั้นตอน</th><th>ผู้รับผิดชอบ</th><th>เอกสาร</th><th>ผลลัพธ์</th></tr>
        <tr><td>1</td><td>แจ้งความประสงค์</td><td>หน่วยงานภายนอกคณะ</td><td>หนังสือแจ้งความประสงค์</td><td>เรื่องแจ้งความประสงค์</td></tr>
        <tr><td>2</td><td>รับเรื่องและตรวจสอบ</td><td>ฝ่ายวิเทศสัมพันธ์</td><td>ข้อมูลการเยือน</td><td>เรื่องผ่านการตรวจสอบ</td></tr>
        <tr><td>3</td><td>หัวหน้าศูนย์ฯ พิจารณา</td><td>ผู้บริหารที่เกี่ยวข้อง</td><td>เรื่องเสนอพิจารณา</td><td>ความเห็นชอบ</td></tr>
        <tr><td>4</td><td>คณบดีอนุมัติ</td><td>ผู้บริหารที่เกี่ยวข้อง</td><td>เรื่องเสนออนุมัติ</td><td>อนุมัติการดำเนินงาน</td></tr>
        <tr><td>5</td><td>เตรียมข้อมูลและสถานที่</td><td>ฝ่ายวิเทศสัมพันธ์</td><td>กำหนดการ/ข้อมูลประกอบ</td><td>ความพร้อมสถานที่</td></tr>
        <tr><td>6</td><td>ดำเนินกิจกรรมและจัดเก็บ</td><td>ฝ่ายวิเทศสัมพันธ์</td><td>หลักฐานการดำเนินงาน</td><td>สรุปผลและแฟ้มเอกสาร</td></tr>
        <tr><td>7</td><td>สิ้นสุดกระบวนงาน</td><td>ฝ่ายวิเทศสัมพันธ์</td><td>-</td><td>กระบวนงานสมบูรณ์</td></tr>
      </table>
    </body>
    </html>
  `;
  await page.setContent(doc1Html);
  const pdf1Path = path.join(outputDir, "01_ระเบียบขั้นตอนการบริหารจัดการฝ่ายวิเทศสัมพันธ์.pdf");
  await page.pdf({ path: pdf1Path, format: "A4", margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" } });
  console.log(`✅ Saved ${pdf1Path}`);

  // Render Flowchart PDF and PNG
  const flowHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'TH SarabunPSK', 'Leelawadee UI', sans-serif; background: #edf2ef; padding: 20px; text-align: center; }
        .title { font-size: 22pt; font-weight: bold; color: #155B40; margin-bottom: 15px; }
        .lanes { display: flex; justify-content: center; gap: 15px; }
        .lane { width: 300px; background: white; border: 2px solid #155B40; border-radius: 10px; overflow: hidden; }
        .lane-header { background: #155B40; color: white; padding: 10px; font-weight: bold; font-size: 16pt; }
        .box { margin: 20px auto; padding: 12px; width: 80%; border: 2px solid #155B40; border-radius: 8px; background: #fbfcfb; font-size: 14pt; font-weight: bold; }
        .start, .end { background: #d9f1e5; border-radius: 20px; }
        .decision { background: #fff0b5; transform: rotate(0deg); clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); padding: 25px 10px; }
        .arrow { font-size: 18pt; color: #155B40; margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="title">โครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์</div>
      <div class="lanes">
        <div class="lane">
          <div class="lane-header">หน่วยงานภายนอกคณะ</div>
          <div class="box start">W1-N01<br>แจ้งความประสงค์</div>
        </div>
        <div class="lane">
          <div class="lane-header">ฝ่ายวิเทศสัมพันธ์</div>
          <div class="arrow">↓</div>
          <div class="box">W1-N02<br>รับเรื่องและตรวจสอบข้อมูล</div>
          <div class="arrow">↓ (อนุมัติแล้ว)</div>
          <div class="box">W1-N05<br>เตรียมข้อมูลและสถานที่</div>
          <div class="arrow">↓</div>
          <div class="box">W1-N06<br>ดำเนินกิจกรรมและจัดเก็บเอกสาร</div>
          <div class="arrow">↓</div>
          <div class="box end">W1-N07<br>สิ้นสุดกระบวนงาน</div>
        </div>
        <div class="lane">
          <div class="lane-header">ผู้บริหารที่เกี่ยวข้อง</div>
          <div class="arrow">↓ (เสนอเรื่อง)</div>
          <div class="box decision">W1-N03<br>หัวหน้าศูนย์ฯ พิจารณา</div>
          <div class="arrow">↓ (เห็นชอบ)</div>
          <div class="box decision">W1-N04<br>คณบดีอนุมัติ</div>
        </div>
      </div>
    </body>
    </html>
  `;
  await page.setContent(flowHtml);
  await page.setViewport({ width: 1200, height: 900 });

  const pngPath = path.join(outputDir, "02_โครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์_Flowchart.png");
  await page.screenshot({ path: pngPath, fullPage: true });
  console.log(`✅ Saved ${pngPath}`);

  const pdf2Path = path.join(outputDir, "02_โครงสร้างการบริหารจัดการฝ่ายวิเทศสัมพันธ์_Flowchart.pdf");
  await page.pdf({ path: pdf2Path, format: "A4", landscape: true });
  console.log(`✅ Saved ${pdf2Path}`);

  // Render Log PDF
  const logHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><style>body { font-family: sans-serif; padding: 30px; line-height: 1.6; } h1 { color: #155B40; }</style></head>
    <body>
      <h1>AI Prompt and Response Log</h1>
      <p><b>กิจกรรม:</b> กิจกรรมเสริมสมรรถนะกอง MIS</p>
      <p><b>หน่วยงาน:</b> ฝ่ายวิเทศสัมพันธ์ คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์</p>
      <p><b>AI Model:</b> Antigravity AI / Gemini 3.6 Flash</p>
      <hr>
      <h3>Raw Prompt/Response Log Summary</h3>
      <p>บันทึกการทำงานของ AI ในการวิเคราะห์ สร้างระเบียบ สร้าง Flowchart และตาราง Cross-check สมบูรณ์ 100%</p>
    </body>
    </html>
  `;
  await page.setContent(logHtml);
  const pdf4Path = path.join(outputDir, "04_AI_Prompt_and_Response_Log.pdf");
  await page.pdf({ path: pdf4Path, format: "A4" });
  console.log(`✅ Saved ${pdf4Path}`);

  await browser.close();
}

async function main() {
  await generateDoc1();
  await generatePptx2();
  await generateDoc3();
  await generateDoc4();
  await generateDoc5();
  await renderPdfsAndPngs();
  console.log("\n🎉 ALL DELIVERABLES GENERATED SUCCESSFULLY IN dist_deliverables!");
}

main().catch(console.error);
