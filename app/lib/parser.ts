import type { ExtractionPattern, FlowEdge, FlowNode, NodeType, QaItem, Workflow } from "./types";

export const defaultPattern: ExtractionPattern = {
  actorKeywords: [
    "สถาบันต่างประเทศ", "หน่วยงานภายนอก", "มหาวิทยาลัย", "ภาควิชา", "โครงการ",
    "นิสิต", "คณาจารย์", "เจ้าหน้าที่บริหารงานทั่วไป", "ฝ่ายวิเทศสัมพันธ์",
    "ศูนย์วิเทศสัมพันธ์", "ศูนย์นวัตกรรม", "หัวหน้าศูนย์", "รองคณบดี", "คณบดี",
    "งานคลังและพัสดุ", "เจ้าหน้าที่การเงิน", "หน่วยงานภายในคณะ",
  ],
  decisionKeywords: ["หาก", "กรณี", "พิจารณา", "อนุมัติ", "เห็นชอบ", "ไม่อนุมัติ", "ไม่เห็นชอบ", "ตรวจสอบ"],
  documentKeywords: ["เอกสาร", "หนังสือ", "บันทึก", "แบบฟอร์ม", "ใบสมัคร", "สัญญา", "MoU", "MoA", "หลักฐาน"],
  endKeywords: ["สิ้นสุด", "เสร็จสิ้น", "ยุติ", "จบกระบวนงาน", "จัดเก็บเอกสาร"],
};

const thaiDigits = "๐๑๒๓๔๕๖๗๘๙";

function cleanLine(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(new RegExp(`^(?:ข้อ\\s*)?[0-9${thaiDigits}]+(?:[.)]|\\s)+`), "")
    .replace(/^[-•▪◦]+\s*/, "")
    .trim();
}

function detectActor(line: string, pattern: ExtractionPattern) {
  const actor = pattern.actorKeywords.find((keyword) => line.includes(keyword));
  if (!actor) return "ผู้รับผิดชอบตามคู่มือ";
  if (["คณบดี", "รองคณบดี", "หัวหน้าศูนย์"].some((keyword) => actor.includes(keyword))) return "ผู้บริหารที่เกี่ยวข้อง";
  if (["สถาบันต่างประเทศ", "หน่วยงานภายนอก", "มหาวิทยาลัย", "นิสิต", "คณาจารย์"].includes(actor)) return "หน่วยงานภายนอกคณะ";
  if (["ภาควิชา", "โครงการ", "หน่วยงานภายในคณะ"].includes(actor)) return "หน่วยงานภายในคณะ";
  return "ฝ่ายวิเทศสัมพันธ์";
}

function detectType(line: string, index: number, total: number, pattern: ExtractionPattern): NodeType {
  if (index === 0 || /รับแจ้ง|แจ้งความประสงค์|เริ่ม/.test(line)) return "start";
  if (index === total - 1 || pattern.endKeywords.some((keyword) => line.includes(keyword))) return "end";
  if (pattern.decisionKeywords.some((keyword) => line.includes(keyword))) return "decision";
  if (pattern.documentKeywords.some((keyword) => line.includes(keyword))) return "document";
  if (/หมายเหตุ|ข้อควรระวัง/.test(line)) return "note";
  return "process";
}

function detectDocuments(line: string, pattern: ExtractionPattern) {
  const matches = pattern.documentKeywords.filter((keyword) => line.includes(keyword));
  return matches.join(", ");
}

export function extractWorkflow(text: string, sourceFile: string, pattern = defaultPattern): Workflow {
  const rawLines = text
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length >= 5)
    .filter((line, index, all) => index === 0 || line !== all[index - 1]);

  const headingIndex = rawLines.findIndex((line) => /^(?:workflow|กระบวนงาน|ขั้นตอน|การดำเนินงาน)/i.test(line));
  const workflowName = headingIndex >= 0 ? rawLines[headingIndex].replace(/^(?:workflow|กระบวนงาน|ขั้นตอน)\s*(?:ที่)?\s*[0-9๐-๙.]*\s*/i, "") : sourceFile.replace(/\.[^.]+$/, "");
  let candidateLines = rawLines.filter((_, index) => index !== headingIndex);
  if (candidateLines.length > 80) candidateLines = candidateLines.slice(0, 80);
  if (candidateLines.length < 2) candidateLines = ["รับเรื่องตามคู่มือ", ...candidateLines, "สิ้นสุดกระบวนงาน"];

  const workflowId = "W1";
  const nodes: FlowNode[] = candidateLines.map((line, index, all) => {
    const lane = detectActor(line, pattern);
    return {
      id: `${workflowId}-N${String(index + 1).padStart(2, "0")}`,
      text: line,
      originalText: line,
      lane,
      type: detectType(line, index, all.length, pattern),
      documents: detectDocuments(line, pattern),
      sourceRef: `ข้อความลำดับ ${index + 1}`,
      confidence: lane === "ผู้รับผิดชอบตามคู่มือ" ? "review" : "medium",
      order: index + 1,
    };
  });
  const lanes = [...new Set(nodes.map((node) => node.lane))];
  const edges: FlowEdge[] = nodes.slice(0, -1).map((node, index) => ({
    id: `${workflowId}-E${String(index + 1).padStart(2, "0")}`,
    source: node.id,
    target: nodes[index + 1].id,
    label: node.type === "decision" ? "ดำเนินการต่อ" : "",
    color: "#165B40",
    style: "solid",
    sourceSide: "bottom",
    targetSide: "top",
  }));
  return {
    id: workflowId,
    name: workflowName || "กระบวนงานจากคู่มือ",
    sourceFile,
    sourceText: text,
    lanes,
    nodes,
    edges,
    createdAt: new Date().toISOString(),
    analysisMode: "pattern",
  };
}

export function qaWorkflow(workflow: Workflow): QaItem[] {
  const ids = new Set(workflow.nodes.map((node) => node.id));
  const items: QaItem[] = [];
  const duplicateNodeCount = workflow.nodes.length - ids.size;
  items.push({ level: duplicateNodeCount ? "fail" : "pass", text: duplicateNodeCount ? `พบรหัสกล่องซ้ำ ${duplicateNodeCount} รายการ` : "รหัสกล่องไม่ซ้ำ" });
  const badEdges = workflow.edges.filter((edge) => !ids.has(edge.source) || !ids.has(edge.target));
  items.push({ level: badEdges.length ? "fail" : "pass", text: badEdges.length ? `พบเส้นที่อ้างอิงกล่องไม่ถูกต้อง ${badEdges.length} เส้น` : "Source/Target ของทุกเส้นมีอยู่จริง" });
  const incoming = new Set(workflow.edges.map((edge) => edge.target));
  const outgoing = new Set(workflow.edges.map((edge) => edge.source));
  const orphans = workflow.nodes.filter((node) => node.type !== "start" && node.type !== "end" && (!incoming.has(node.id) || !outgoing.has(node.id)));
  items.push({ level: orphans.length ? "warning" : "pass", text: orphans.length ? `มีกล่องที่ควรตรวจเส้นเข้า/ออก ${orphans.length} กล่อง` : "ทุกกล่องกลางกระบวนงานมีเส้นเข้าและออก" });
  const startCount = workflow.nodes.filter((node) => node.type === "start").length;
  const endCount = workflow.nodes.filter((node) => node.type === "end").length;
  items.push({ level: startCount && endCount ? "pass" : "warning", text: `จุดเริ่มต้น ${startCount} จุด · จุดสิ้นสุด ${endCount} จุด` });
  const reviewCount = workflow.nodes.filter((node) => node.confidence === "review").length;
  items.push({ level: reviewCount ? "warning" : "pass", text: reviewCount ? `ควรตรวจผู้รับผิดชอบ/ข้อความ ${reviewCount} กล่อง` : "ไม่มีรายการความมั่นใจต่ำ" });
  items.push({ level: "pass", text: `PPTX จะผูก Connector กับ Source/Target Shape จริง ${workflow.edges.length} เส้น` });
  return items;
}
