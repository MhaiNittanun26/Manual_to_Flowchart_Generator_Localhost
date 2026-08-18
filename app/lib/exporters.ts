import {
  AlignmentType,
  Document,
  Header,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import * as XLSX from "xlsx";
import { defaultPattern, qaWorkflow } from "./parser";
import type { FlowEdge, FlowNode, Workflow } from "./types";

export const OUTPUT_BASENAME = "manual_to_flowchart";

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80) || OUTPUT_BASENAME;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function workflowJsonBlob(workflow: Workflow) {
  return new Blob([JSON.stringify({ schemaVersion: "1.0", workflow }, null, 2)], { type: "application/json;charset=utf-8" });
}

export function buildWorkbook(workflow: Workflow) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    source_file: workflow.sourceFile,
    analysis_mode: workflow.analysisMode,
    created_at: workflow.createdAt,
    swimlanes: workflow.lanes.join(" | "),
  }]), "Workflow");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(workflow.nodes.map((node) => ({
    node_id: node.id,
    order: node.order,
    type: node.type,
    swimlane: node.lane,
    original_text: node.originalText,
    normalized_text: node.text,
    responsible: node.lane,
    documents: node.documents,
    source_reference: node.sourceRef,
    confidence: node.confidence,
  }))), "Nodes");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(workflow.edges.map((edge) => ({
    edge_id: edge.id,
    source_node: edge.source,
    source_side: edge.sourceSide,
    target_node: edge.target,
    target_side: edge.targetSide,
    label: edge.label,
    color: edge.color,
    line_style: edge.style,
    connector_bound: "YES - PowerPoint connection points",
  }))), "Edges");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(qaWorkflow(workflow)), "QA");
  return new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

type NodePlacement = { node: FlowNode; slide: number; x: number; y: number; w: number; h: number };
type PptxSegment = { objectName: string; slide: number; sourceName: string; targetName: string };

const sideToIndex = { top: 0, left: 1, bottom: 2, right: 3 } as const;

function xmlAttrEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shapeType(pptx: PptxGenJS, node: FlowNode) {
  if (node.type === "decision") return pptx.ShapeType.flowChartDecision;
  if (node.type === "document") return pptx.ShapeType.flowChartDocument;
  if (node.type === "start" || node.type === "end") return pptx.ShapeType.roundRect;
  if (node.type === "note") return pptx.ShapeType.rect;
  return pptx.ShapeType.flowChartProcess;
}

function shapeFill(node: FlowNode) {
  if (node.type === "decision") return "FFF1B8";
  if (node.type === "document") return "E8F3FF";
  if (node.type === "start" || node.type === "end") return "DDF3E8";
  if (node.type === "note") return "FFF7D6";
  return "FFFFFF";
}

function addLineShape(slide: PptxGenJS.Slide, pptx: PptxGenJS, edge: FlowEdge, objectName: string, from: NodePlacement, to: NodePlacement) {
  const sx = from.x + from.w / 2;
  const sy = from.y + from.h;
  const tx = to.x + to.w / 2;
  const ty = to.y;
  slide.addShape(pptx.ShapeType.line, {
    objectName,
    x: sx,
    y: sy,
    w: tx - sx,
    h: ty - sy,
    line: { color: edge.color.replace("#", ""), width: 1.5, dashType: edge.style === "dash" ? "dash" : "solid", endArrowType: "triangle" },
  });
  if (edge.label) {
    slide.addText(edge.label, { x: Math.min(sx, tx) + 0.03, y: (sy + ty) / 2 - 0.16, w: Math.max(Math.abs(tx - sx), 0.8), h: 0.3, fontFace: "TH SarabunPSK", fontSize: 11, color: "4B5563", fill: { color: "FFFFFF", transparency: 8 }, margin: 0.02, breakLine: false });
  }
}

function bindPptxConnectors(xml: string, segments: PptxSegment[], slideNumber: number) {
  const slideSegments = segments.filter((segment) => segment.slide === slideNumber);
  const ids = new Map<string, string>();
  xml.replace(/<p:cNvPr\s+[^>]*id="(\d+)"[^>]*name="([^"]+)"[^>]*\/?>(?:<\/p:cNvPr>)?/g, (_match, id: string, name: string) => {
    ids.set(name, id);
    return _match;
  });
  let bound = 0;
  xml = xml.replace(/<p:sp>([\s\S]*?)<\/p:sp>/g, (block) => {
    const segment = slideSegments.find((candidate) => block.includes(`name="${xmlAttrEscape(candidate.objectName)}"`));
    if (!segment) return block;
    const sourceId = ids.get(xmlAttrEscape(segment.sourceName)) ?? ids.get(segment.sourceName);
    const targetId = ids.get(xmlAttrEscape(segment.targetName)) ?? ids.get(segment.targetName);
    const cNvPr = block.match(/<p:cNvPr\s+[^>]*\/?>(?:<\/p:cNvPr>)?/)?.[0];
    if (!sourceId || !targetId || !cNvPr) return block;
    const connectionMarkup = `<p:nvCxnSpPr>${cNvPr}<p:cNvCxnSpPr><a:stCxn id="${sourceId}" idx="${sideToIndex.bottom}"/><a:endCxn id="${targetId}" idx="${sideToIndex.top}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>`;
    bound += 1;
    return block
      .replace(/^<p:sp>/, "<p:cxnSp>")
      .replace(/<p:nvSpPr>[\s\S]*?<\/p:nvSpPr>/, connectionMarkup)
      .replace(/<\/p:sp>$/, "</p:cxnSp>");
  });
  return { xml, bound };
}

export async function buildEditablePptx(workflow: Workflow) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "FLOW_PORTRAIT", width: 7.5, height: 13.333 });
  pptx.layout = "FLOW_PORTRAIT";
  pptx.author = "Manual-to-Flowchart Generator";
  pptx.company = "Local workflow extraction tool";
  pptx.subject = "Editable process flowchart with bound connectors";
  pptx.title = workflow.name;
  pptx.theme = { headFontFace: "TH SarabunPSK", bodyFontFace: "TH SarabunPSK" };

  const nodesPerSlide = 9;
  const pageCount = Math.max(1, Math.ceil(workflow.nodes.length / nodesPerSlide));
  const laneCount = Math.max(1, workflow.lanes.length);
  const laneWidth = 7 / laneCount;
  const placements = new Map<string, NodePlacement>();
  const slides: PptxGenJS.Slide[] = [];
  const segments: PptxSegment[] = [];

  for (let page = 0; page < pageCount; page += 1) {
    const slide = pptx.addSlide();
    slides.push(slide);
    slide.background = { color: "F7F9F8" };
    slide.addText(workflow.name, { x: 0.35, y: 0.18, w: 6.8, h: 0.48, fontFace: "TH SarabunPSK", fontSize: 22, bold: true, color: "103E2D", align: "center", margin: 0 });
    slide.addText(`หน้า ${page + 1}/${pageCount} · ${workflow.sourceFile}`, { x: 0.35, y: 0.7, w: 6.8, h: 0.24, fontFace: "TH SarabunPSK", fontSize: 10, color: "617068", align: "center", margin: 0 });
    workflow.lanes.forEach((lane, laneIndex) => {
      const x = 0.25 + laneIndex * laneWidth;
      slide.addShape(pptx.ShapeType.rect, { x, y: 1.05, w: laneWidth, h: 11.8, fill: { color: laneIndex % 2 ? "F3F7F5" : "FFFFFF", transparency: 4 }, line: { color: "B9CEC3", width: 0.7 } });
      slide.addShape(pptx.ShapeType.rect, { x, y: 1.05, w: laneWidth, h: 0.55, fill: { color: laneIndex % 2 ? "DDEBE4" : "CFE4D9" }, line: { color: "8AAE9B", width: 0.7 } });
      slide.addText(lane, { x: x + 0.05, y: 1.16, w: laneWidth - 0.1, h: 0.28, fontFace: "TH SarabunPSK", fontSize: 12, bold: true, color: "174F39", align: "center", margin: 0.02, fit: "shrink" });
    });
    const pageNodes = workflow.nodes.slice(page * nodesPerSlide, (page + 1) * nodesPerSlide);
    pageNodes.forEach((node, localIndex) => {
      const laneIndex = Math.max(0, workflow.lanes.indexOf(node.lane));
      const x = 0.25 + laneIndex * laneWidth + 0.12;
      const y = 1.78 + localIndex * 1.17;
      const w = laneWidth - 0.24;
      const h = node.type === "decision" ? 0.9 : 0.72;
      const placement = { node, slide: page + 1, x, y, w, h };
      placements.set(node.id, placement);
      slide.addShape(shapeType(pptx, node), {
        objectName: node.id,
        x, y, w, h,
        fill: { color: shapeFill(node) },
        line: { color: "477260", width: 1.1 },
      });
      slide.addText(node.text, { x: x + 0.06, y: y + 0.04, w: w - 0.12, h: h - 0.08, fontFace: "TH SarabunPSK", fontSize: 12, bold: node.type === "decision", color: "16352A", align: "center", valign: "middle", margin: 0.02, fit: "shrink", breakLine: false });
    });
    slide.addText(`สร้างด้วย Manual-to-Flowchart Generator · วัตถุทุกชิ้นแก้ไขได้`, { x: 0.3, y: 12.96, w: 6.9, h: 0.18, fontFace: "TH SarabunPSK", fontSize: 9, color: "718078", align: "center", margin: 0 });
  }

  workflow.edges.forEach((edge) => {
    const from = placements.get(edge.source);
    const to = placements.get(edge.target);
    if (!from || !to) return;
    if (from.slide === to.slide) {
      addLineShape(slides[from.slide - 1], pptx, edge, edge.id, from, to);
      segments.push({ objectName: edge.id, slide: from.slide, sourceName: from.node.id, targetName: to.node.id });
      return;
    }
    const outName = `${edge.id}-COUT`;
    const inName = `${edge.id}-CIN`;
    const outPlacement: NodePlacement = { node: from.node, slide: from.slide, x: from.x + from.w / 2 - 0.16, y: 12.35, w: 0.32, h: 0.32 };
    const inPlacement: NodePlacement = { node: to.node, slide: to.slide, x: to.x + to.w / 2 - 0.16, y: 1.62, w: 0.32, h: 0.32 };
    slides[from.slide - 1].addShape(pptx.ShapeType.flowChartConnector, { objectName: outName, x: outPlacement.x, y: outPlacement.y, w: outPlacement.w, h: outPlacement.h, fill: { color: "F4B183" }, line: { color: "A8541B", width: 1 } });
    slides[from.slide - 1].addText(`ไป ${to.slide}`, { x: outPlacement.x - 0.22, y: outPlacement.y + 0.34, w: 0.76, h: 0.2, fontFace: "TH SarabunPSK", fontSize: 9, align: "center", margin: 0 });
    slides[to.slide - 1].addShape(pptx.ShapeType.flowChartConnector, { objectName: inName, x: inPlacement.x, y: inPlacement.y, w: inPlacement.w, h: inPlacement.h, fill: { color: "F4B183" }, line: { color: "A8541B", width: 1 } });
    slides[to.slide - 1].addText(`จาก ${from.slide}`, { x: inPlacement.x - 0.22, y: inPlacement.y - 0.2, w: 0.76, h: 0.2, fontFace: "TH SarabunPSK", fontSize: 9, align: "center", margin: 0 });
    addLineShape(slides[from.slide - 1], pptx, edge, `${edge.id}-A`, from, outPlacement);
    addLineShape(slides[to.slide - 1], pptx, edge, `${edge.id}-B`, inPlacement, to);
    segments.push({ objectName: `${edge.id}-A`, slide: from.slide, sourceName: from.node.id, targetName: outName });
    segments.push({ objectName: `${edge.id}-B`, slide: to.slide, sourceName: inName, targetName: to.node.id });
  });

  const raw = await pptx.write({ outputType: "arraybuffer", compression: true });
  const zip = await JSZip.loadAsync(raw as ArrayBuffer);
  let boundCount = 0;
  for (let slideNumber = 1; slideNumber <= pageCount; slideNumber += 1) {
    const path = `ppt/slides/slide${slideNumber}.xml`;
    const file = zip.file(path);
    if (!file) continue;
    const originalXml = await file.async("string");
    const result = bindPptxConnectors(originalXml, segments, slideNumber);
    boundCount += result.bound;
    zip.file(path, result.xml);
  }
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
  return { blob, boundCount, expectedSegments: segments.length, pageCount };
}

export async function buildDocxDocument(workflow: Workflow): Promise<Blob> {
  const fontRun = (text: string, options: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({
      text,
      font: "TH SarabunPSK",
      size: options.size ?? 32,
      bold: options.bold,
      italic: options.italic,
      color: options.color ?? "203D31",
    });

  const headingPara = (text: string) =>
    new Paragraph({
      spacing: { before: 280, after: 120 },
      children: [fontRun(text, { bold: true, size: 36, color: "155B40" })],
    });

  const bodyPara = (text: string) =>
    new Paragraph({
      spacing: { before: 60, after: 120 },
      children: [fontRun(text, { size: 32 })],
    });

  const qa = qaWorkflow(workflow);

  const doc = new Document({
    creator: "Manual-to-Flowchart Generator",
    title: workflow.name,
    description: `ระเบียบปฏิบัติงานและขั้นตอนการทำงาน ${workflow.name}`,
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
            spacing: { before: 1200, after: 240 },
            children: [fontRun("เอกสารระเบียบปฏิบัติงานมาตรฐาน (SOP)", { bold: true, size: 38, color: "155B40" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 720 },
            children: [fontRun(workflow.name, { bold: true, size: 44, color: "103F2E" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 720, after: 1440 },
            children: [
              fontRun(`รหัสกระบวนงาน: ${workflow.id}\nแหล่งข้อมูลอ้างอิง: ${workflow.sourceFile}\nวันที่จัดทำ: ${workflow.createdAt}`, {
                size: 28,
                color: "587064",
              }),
            ],
          }),

          // 15 Standard Sections
          headingPara("1. หน้าปกเอกสาร"),
          bodyPara(`เอกสารระเบียบขั้นตอนการปฏิบัติงานเรื่อง "${workflow.name}" ฉบับมาตรฐานการปฏิบัติงาน (Standard Operating Procedure: SOP)`),

          headingPara("2. ชื่อระเบียบขั้นตอน"),
          bodyPara(`“ระเบียบขั้นตอนว่าด้วย ${workflow.name}”`),

          headingPara("3. หลักการและเหตุผล"),
          bodyPara(
            workflow.sourceText
              ? `อ้างอิงจากต้นฉบับ: ${workflow.sourceText.slice(0, 300)}...`
              : "เพื่อให้การดำเนินงานตามกระบวนงานมีความชัดเจน เป็นมาตรฐานเดียวกัน มีความโปร่งใส ตรวจสอบได้ และเกิดประสิทธิภาพสูงสุดในการปฏิบัติงาน"
          ),

          headingPara("4. วัตถุประสงค์"),
          bodyPara(`1. เพื่อกำหนดขั้นตอนการปฏิบัติงานสำหรับ ${workflow.name} ให้เป็นมาตรฐานเดียวกัน`),
          bodyPara("2. เพื่อระบุผู้รับผิดชอบในแต่ละขั้นตอน (Swimlanes) และเอกสาร/หลักฐานอ้างอิงอย่างชัดเจน"),
          bodyPara("3. เพื่อใช้เป็นคู่มืออ้างอิงในการตรวจสอบและฝึกอบรมบุคลากร"),

          headingPara("5. ขอบเขตการดำเนินงาน"),
          bodyPara(`ครอบคลุมขั้นตอนการทำงานตั้งแต่เริ่มต้นจนสิ้นสุดกระบวนงาน โดยเกี่ยวข้องกับหน่วยงาน/ผู้รับผิดชอบ: ${workflow.lanes.join(", ")}`),

          headingPara("6. คำนิยามหรือคำอธิบายที่เกี่ยวข้อง"),
          ...workflow.lanes.map((lane) => bodyPara(`• ${lane}: หน่วยงานหรือผู้รับผิดชอบหลักในกระบวนงาน`)),

          headingPara("7. หน่วยงานและผู้รับผิดชอบ (Swimlanes)"),
          ...workflow.lanes.map((lane, i) => bodyPara(`${i + 1}. ${lane}: ดำเนินการขั้นตอนที่ได้รับมอบหมายตามโครงสร้าง Workflow`)),

          headingPara("8. หน้าที่และความรับผิดชอบ"),
          ...workflow.nodes.map((node) => bodyPara(`• [${node.id}] (${node.lane}): ${node.text}`)),

          headingPara("9. ขั้นตอนการดำเนินงานอย่างละเอียด"),
          ...workflow.nodes.map((node, i) => bodyPara(`ขั้นตอนที่ ${i + 1} [${node.id}]: ${node.text} (ผู้รับผิดชอบ: ${node.lane}${node.documents ? ` · เอกสาร: ${node.documents}` : ""})`)),

          headingPara("10. ตารางสรุปกระบวนงาน (Flowchart Summary Table)"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["ลำดับ", "รหัส", "ขั้นตอนการดำเนินงาน", "ผู้รับผิดชอบ", "เอกสาร/หลักฐาน"].map(
                  (h) =>
                    new TableCell({
                      children: [fontRun(h, { bold: true, size: 28, color: "FFFFFF" })],
                      shading: { fill: "155B40" },
                    })
                ),
              }),
              ...workflow.nodes.map(
                (node, i) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [fontRun(String(i + 1), { size: 28 })] }),
                      new TableCell({ children: [fontRun(node.id, { bold: true, size: 28, color: "155B40" })] }),
                      new TableCell({ children: [fontRun(node.text, { size: 28 })] }),
                      new TableCell({ children: [fontRun(node.lane, { size: 28 })] }),
                      new TableCell({ children: [fontRun(node.documents || "-", { size: 28 })] }),
                    ],
                  })
              ),
            ],
          }),

          headingPara("11. ความเชื่อมโยงและเงื่อนไขเส้นเชื่อม (Edges)"),
          ...workflow.edges.map((edge) => bodyPara(`• เส้นเชื่อม [${edge.id}]: จาก ${edge.source} ➔ ไปยัง ${edge.target}${edge.label ? ` (เงื่อนไข: "${edge.label}")` : ""}`)),

          headingPara("12. ตารางตรวจสอบคุณภาพและความสมบูรณ์ (QA Audit)"),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["รายการตรวจเช็ก", "ระดับ", "สถานะการตรวจสอบ"].map(
                  (h) =>
                    new TableCell({
                      children: [fontRun(h, { bold: true, size: 28, color: "FFFFFF" })],
                      shading: { fill: "2A5340" },
                    })
                ),
              }),
              ...qa.map(
                (item) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [fontRun(item.text, { size: 28 })] }),
                      new TableCell({ children: [fontRun(item.level.toUpperCase(), { bold: true, size: 28, color: item.level === "pass" ? "155B40" : "A13E3E" })] }),
                      new TableCell({ children: [fontRun(item.level === "pass" ? "ผ่านเกณฑ์มาตรฐาน" : "ควรทบทวน/ปรับปรุง", { size: 28 })] }),
                    ],
                  })
              ),
            ],
          }),

          headingPara("13. แบบฟอร์มและเอกสารอ้างอิง"),
          bodyPara("• แบบฟอร์มการปฏิบัติงานฉบับมาตรฐาน"),
          bodyPara("• เอกสารหลักฐานที่เกี่ยวข้องในแต่ละขั้นตอน"),

          headingPara("14. กฎหมาย ระเบียบ และข้อบังคับที่เกี่ยวข้อง"),
          bodyPara("• ระเบียบมหาวิทยาลัยเกี่ยวกับการบริหารงานสารบรรณและการปฏิบัติราชการ"),
          bodyPara("• ข้อบังคับและประกาศที่เกี่ยวข้องกับกระบวนงาน"),

          headingPara("15. ดรรชนีคำสำคัญและประวัติการแก้ไข"),
          bodyPara(`คำสำคัญ: Flowchart, SOP, ${workflow.lanes.join(", ")}, ${workflow.name}`),
          bodyPara(`ประวัติการแก้ไข: ฉบับปรับปรุงล่าสุด ณ วันที่ ${workflow.createdAt} สร้างโดยระบบ Manual-to-Flowchart Generator`),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function buildDeliveryZip(workflow: Workflow, svgText?: string, pngBlob?: Blob) {
  const zip = new JSZip();
  const safeName = sanitizeFileName(workflow.name);
  const pptx = await buildEditablePptx(workflow);
  const docxBlob = await buildDocxDocument(workflow);

  zip.file(`${safeName}.json`, workflowJsonBlob(workflow));
  zip.file(`${safeName}.docx`, docxBlob);
  zip.file(`${safeName}.xlsx`, buildWorkbook(workflow));
  zip.file(`${safeName}.pptx`, pptx.blob);
  if (svgText) zip.file(`${safeName}_preview.svg`, svgText);
  if (pngBlob) zip.file(`${safeName}_preview.png`, pngBlob);
  zip.file("pattern_library.json", JSON.stringify(defaultPattern, null, 2));
  zip.file("qa_report.json", JSON.stringify({
    generatedAt: new Date().toISOString(),
    qa: qaWorkflow(workflow),
    powerpoint: { boundConnectorSegments: pptx.boundCount, expectedConnectorSegments: pptx.expectedSegments, pass: pptx.boundCount === pptx.expectedSegments },
  }, null, 2));
  zip.file("README_OUTPUT.txt", [
    "ชุดผลลัพธ์จาก Manual-to-Flowchart Generator",
    "- DOCX: เอกสารระเบียบปฏิบัติงานมาตรฐาน (SOP 15 หมวด)",
    "- PPTX: Flowchart แก้ไขได้ และ Connector ผูกกับ Connection Point ของ Shape",
    "- XLSX: ตาราง Workflow / Nodes / Edges / QA",
    "- JSON: แหล่งข้อมูลกลาง",
    "- SVG/PNG: ภาพตัวอย่างสำหรับตรวจทาน",
    `- Connector ที่ผูกสำเร็จ: ${pptx.boundCount}/${pptx.expectedSegments} segments`,
  ].join("\n"));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export function workflowFileName(workflow: Workflow, extension: string) {
  return `${sanitizeFileName(workflow.name)}.${extension}`;
}
