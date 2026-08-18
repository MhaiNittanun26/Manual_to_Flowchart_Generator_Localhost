import { writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { buildEditablePptx, buildWorkbook, workflowJsonBlob } from "../app/lib/exporters";
import { sampleWorkflow } from "../app/lib/sample";
import type { Workflow } from "../app/lib/types";

async function verifyPowerPoint(workflow: Workflow, output: string) {
  const result = await buildEditablePptx(workflow);
  if (result.boundCount !== result.expectedSegments) throw new Error(`Connector binding failed: ${result.boundCount}/${result.expectedSegments}`);
  const buffer = Buffer.from(await result.blob.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  let startConnections = 0;
  let endConnections = 0;
  let connectorShapes = 0;
  for (const path of Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
    const xml = await zip.file(path)!.async("string");
    startConnections += (xml.match(/<a:stCxn\b/g) ?? []).length;
    endConnections += (xml.match(/<a:endCxn\b/g) ?? []).length;
    connectorShapes += (xml.match(/<p:cxnSp>/g) ?? []).length;
  }
  if (startConnections !== result.expectedSegments || endConnections !== result.expectedSegments || connectorShapes !== result.expectedSegments) {
    throw new Error(`OOXML connector check failed: shapes=${connectorShapes}, start=${startConnections}, end=${endConnections}, expected=${result.expectedSegments}`);
  }
  await writeFile(output, buffer);
  return { slides: result.pageCount, connectorShapes, startConnections, endConnections, pptxBytes: buffer.byteLength };
}

const singlePage = await verifyPowerPoint(sampleWorkflow, "/tmp/manual-flow-connector-test.pptx");
const longWorkflow: Workflow = {
  ...sampleWorkflow,
  id: "WT",
  name: "ทดสอบ Connector ข้ามหน้า",
  nodes: Array.from({ length: 12 }, (_, index) => ({ ...sampleWorkflow.nodes[index % sampleWorkflow.nodes.length], id: `WT-N${String(index + 1).padStart(2, "0")}`, order: index + 1, type: index === 0 ? "start" : index === 11 ? "end" : "process" })),
  edges: Array.from({ length: 11 }, (_, index) => ({ ...sampleWorkflow.edges[index % sampleWorkflow.edges.length], id: `WT-E${String(index + 1).padStart(2, "0")}`, source: `WT-N${String(index + 1).padStart(2, "0")}`, target: `WT-N${String(index + 2).padStart(2, "0")}` })),
};
const multiPage = await verifyPowerPoint(longWorkflow, "/tmp/manual-flow-connector-multipage-test.pptx");
if (multiPage.slides !== 2) throw new Error(`Expected 2 slides, received ${multiPage.slides}`);
if ((await buildWorkbook(sampleWorkflow).arrayBuffer()).byteLength < 1000) throw new Error("Workbook export too small");
if ((await workflowJsonBlob(sampleWorkflow).arrayBuffer()).byteLength < 1000) throw new Error("JSON export too small");
console.log(JSON.stringify({
  pass: true,
  singlePage,
  multiPage,
}, null, 2));
