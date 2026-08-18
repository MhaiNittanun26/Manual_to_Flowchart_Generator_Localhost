import type { Workflow } from "./types";

export const sampleWorkflow: Workflow = {
  id: "W1",
  name: "การต้อนรับอาคันตุกะต่างชาติ",
  sourceFile: "ตัวอย่างระบบ",
  sourceText:
    "สถาบันต่างประเทศแจ้งความประสงค์\nเจ้าหน้าที่บริหารงานทั่วไปรับเรื่องและตรวจสอบข้อมูล\nเสนอหัวหน้าศูนย์วิเทศสัมพันธ์พิจารณา\nหากเห็นชอบให้เสนอคณบดีอนุมัติ\nฝ่ายวิเทศสัมพันธ์เตรียมข้อมูลและสถานที่\nดำเนินกิจกรรมและจัดเก็บเอกสาร\nสิ้นสุดกระบวนงาน",
  lanes: ["หน่วยงานภายนอกคณะ", "ฝ่ายวิเทศสัมพันธ์", "ผู้บริหารที่เกี่ยวข้อง"],
  nodes: [
    { id: "W1-N01", text: "แจ้งความประสงค์", originalText: "สถาบันต่างประเทศแจ้งความประสงค์", lane: "หน่วยงานภายนอกคณะ", type: "start", documents: "หนังสือ/อีเมลแจ้งความประสงค์", sourceRef: "ตัวอย่าง", confidence: "high", order: 1 },
    { id: "W1-N02", text: "รับเรื่องและตรวจสอบข้อมูล", originalText: "เจ้าหน้าที่บริหารงานทั่วไปรับเรื่องและตรวจสอบข้อมูล", lane: "ฝ่ายวิเทศสัมพันธ์", type: "process", documents: "ข้อมูลการเยือน", sourceRef: "ตัวอย่าง", confidence: "high", order: 2 },
    { id: "W1-N03", text: "หัวหน้าศูนย์วิเทศสัมพันธ์พิจารณา", originalText: "เสนอหัวหน้าศูนย์วิเทศสัมพันธ์พิจารณา", lane: "ผู้บริหารที่เกี่ยวข้อง", type: "decision", documents: "เรื่องเสนอพิจารณา", sourceRef: "ตัวอย่าง", confidence: "high", order: 3 },
    { id: "W1-N04", text: "คณบดีอนุมัติ", originalText: "หากเห็นชอบให้เสนอคณบดีอนุมัติ", lane: "ผู้บริหารที่เกี่ยวข้อง", type: "decision", documents: "เรื่องเสนออนุมัติ", sourceRef: "ตัวอย่าง", confidence: "high", order: 4 },
    { id: "W1-N05", text: "เตรียมข้อมูลและสถานที่", originalText: "ฝ่ายวิเทศสัมพันธ์เตรียมข้อมูลและสถานที่", lane: "ฝ่ายวิเทศสัมพันธ์", type: "process", documents: "กำหนดการ/ข้อมูลประกอบ", sourceRef: "ตัวอย่าง", confidence: "high", order: 5 },
    { id: "W1-N06", text: "ดำเนินกิจกรรมและจัดเก็บเอกสาร", originalText: "ดำเนินกิจกรรมและจัดเก็บเอกสาร", lane: "ฝ่ายวิเทศสัมพันธ์", type: "document", documents: "หลักฐานการดำเนินงาน", sourceRef: "ตัวอย่าง", confidence: "medium", order: 6 },
    { id: "W1-N07", text: "สิ้นสุดกระบวนงาน", originalText: "สิ้นสุดกระบวนงาน", lane: "ฝ่ายวิเทศสัมพันธ์", type: "end", documents: "", sourceRef: "ตัวอย่าง", confidence: "high", order: 7 },
  ],
  edges: [
    { id: "W1-E01", source: "W1-N01", target: "W1-N02", label: "", color: "#165B40", style: "solid", sourceSide: "bottom", targetSide: "top" },
    { id: "W1-E02", source: "W1-N02", target: "W1-N03", label: "เสนอพิจารณา", color: "#165B40", style: "solid", sourceSide: "bottom", targetSide: "top" },
    { id: "W1-E03", source: "W1-N03", target: "W1-N04", label: "เห็นชอบ", color: "#165B40", style: "solid", sourceSide: "bottom", targetSide: "top" },
    { id: "W1-E04", source: "W1-N04", target: "W1-N05", label: "อนุมัติ", color: "#165B40", style: "solid", sourceSide: "bottom", targetSide: "top" },
    { id: "W1-E05", source: "W1-N05", target: "W1-N06", label: "", color: "#165B40", style: "solid", sourceSide: "bottom", targetSide: "top" },
    { id: "W1-E06", source: "W1-N06", target: "W1-N07", label: "", color: "#165B40", style: "solid", sourceSide: "bottom", targetSide: "top" },
  ],
  createdAt: new Date().toISOString(),
  analysisMode: "sample",
};
