"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CirclePlus,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  GitBranch,
  GripVertical,
  PackageCheck,
  Play,
  Presentation,
  RotateCcw,
  SearchCheck,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { buildDeliveryZip, buildDocxDocument, buildEditablePptx, buildWorkbook, downloadBlob, workflowFileName, workflowJsonBlob } from "./lib/exporters";
import { readManualFile } from "./lib/file-reader";
import { defaultPattern, extractWorkflow, qaWorkflow } from "./lib/parser";
import { sampleWorkflow } from "./lib/sample";
import type { FlowEdge, FlowNode, NodeType, Workflow } from "./lib/types";

const typeLabels: Record<NodeType, string> = {
  start: "เริ่มต้น",
  process: "ขั้นตอน",
  decision: "ตัดสินใจ",
  document: "เอกสาร",
  end: "สิ้นสุด",
  note: "หมายเหตุ",
};

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow)) as Workflow;
}

function FlowPreview({
  workflow,
  svgRef,
  selectedNodeId,
  selectedEdgeId,
  connectingSourceId,
  onSelectNode,
  onSelectEdge,
  onStartConnection,
  onCompleteConnection,
  onCancelConnection,
  onUpdateNode,
  onDeleteNode,
  onAddNodeAfter,
}: {
  workflow: Workflow;
  svgRef: React.RefObject<SVGSVGElement | null>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  connectingSourceId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  onStartConnection: (sourceId: string) => void;
  onCompleteConnection: (targetId: string) => void;
  onCancelConnection: () => void;
  onUpdateNode: (id: string, patch: Partial<FlowNode>) => void;
  onDeleteNode: (id: string) => void;
  onAddNodeAfter: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const laneCount = Math.max(1, workflow.lanes.length);
  const laneWidth = 860 / laneCount;
  const baseNodeWidth = Math.min(220, laneWidth - 30);

  // Dynamic Height Math
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  let currentY = 124;

  workflow.nodes.forEach((node) => {
    const laneIndex = Math.max(0, workflow.lanes.indexOf(node.lane));
    const textLen = node.text ? node.text.length : 8;
    const isDecision = node.type === "decision";

    const lineCap = isDecision ? 15 : 22;
    const estLines = Math.max(1, Math.ceil(textLen / lineCap));

    const w = isDecision ? Math.min(laneWidth - 16, Math.max(baseNodeWidth + 24, 190)) : baseNodeWidth;
    const h = isDecision ? Math.max(94, 52 + estLines * 22) : Math.max(68, 42 + estLines * 20);

    const x = 70 + laneIndex * laneWidth + (laneWidth - w) / 2;
    const y = currentY;

    positions.set(node.id, { x, y, w, h });
    currentY += h + 52;
  });

  const width = 960;
  const height = Math.max(620, currentY + 60);

  const sourcePos = connectingSourceId ? positions.get(connectingSourceId) : null;

  return (
    <div className="flow-container">
      <div className="canvas-toolbar">
        <div className="canvas-zoom">
          <button onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} title="ย่อ">-</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} title="ขยาย">+</button>
          <button onClick={() => setZoom(1)} title="รีเซ็ต">100%</button>
        </div>
        {connectingSourceId ? (
          <div className="connecting-banner">
            ⚡ <strong>กำลังลากเส้นเชื่อม:</strong> คลิกเลือกกล่องปลายทาง หรือ
            <button className="cancel-conn-btn" onClick={onCancelConnection}>ยกเลิก</button>
          </div>
        ) : (
          <small className="canvas-tip">💡 คลิกที่กล่องเพื่อลากเส้นเชื่อม แก้ไข หรือลบกล่อง</small>
        )}
      </div>

      <div className="flow-scroll-area">
        <svg
          ref={svgRef}
          className={`flow-svg ${connectingSourceId ? "connecting-mode" : ""}`}
          style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}
          viewBox={`0 0 ${width} ${height}`}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={`Flowchart ${workflow.name}`}
          onMouseMove={(e) => {
            if (!connectingSourceId || !svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const scaleX = width / rect.width;
            const scaleY = height / rect.height;
            const x = (e.clientX - rect.left) * scaleX;
            const y = (e.clientY - rect.top) * scaleY;
            setMousePos({ x, y });
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "rect") {
              if (connectingSourceId) {
                onCancelConnection();
              } else {
                onSelectNode(null);
                onSelectEdge(null);
              }
            }
          }}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#1b5e43" />
            </marker>
            <marker id="arrow-connecting" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#2563eb" />
            </marker>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0c2e20" floodOpacity="0.12" />
            </filter>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#276c4f" floodOpacity="0.5" />
            </filter>
            <filter id="glow-edge" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#f0bd52" floodOpacity="0.8" />
            </filter>
          </defs>

          <rect width={width} height={height} fill="#f4f8f5" rx="22" />
          <text x="480" y="36" textAnchor="middle" className="svg-title">{workflow.name}</text>
          <text x="480" y="60" textAnchor="middle" className="svg-subtitle">แหล่งข้อมูล: {workflow.sourceFile}</text>

          {/* Swimlanes */}
          {workflow.lanes.map((lane, index) => {
            const x = 50 + index * laneWidth;
            return (
              <g key={lane}>
                <rect x={x} y="78" width={laneWidth} height={height - 106} fill={index % 2 ? "#eef5f1" : "#ffffff"} stroke="#c4d8ce" strokeWidth="1" />
                <rect x={x} y="78" width={laneWidth} height="42" fill={index % 2 ? "#d6e9df" : "#c8e0d4"} stroke="#96b9a8" />
                <text x={x + laneWidth / 2} y="104" textAnchor="middle" className="svg-lane">{lane}</text>
              </g>
            );
          })}

          {/* Edges */}
          {workflow.edges.map((edge) => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return null;
            const isEdgeSelected = selectedEdgeId === edge.id;

            const sx = source.x + source.w / 2;
            const sy = source.y + source.h;
            const tx = target.x + target.w / 2;
            const ty = target.y;
            const mid = (sy + ty) / 2;

            return (
              <g
                key={edge.id}
                data-edge-id={edge.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEdge(edge.id);
                  onSelectNode(null);
                }}
                style={{ cursor: "pointer" }}
                filter={isEdgeSelected ? "url(#glow-edge)" : undefined}
              >
                {/* Thick hit area for easy clicking */}
                <path
                  d={`M ${sx} ${sy} L ${sx} ${mid} L ${tx} ${mid} L ${tx} ${ty}`}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="12"
                />
                <path
                  d={`M ${sx} ${sy} L ${sx} ${mid} L ${tx} ${mid} L ${tx} ${ty}`}
                  fill="none"
                  stroke={isEdgeSelected ? "#f0bd52" : edge.color || "#1b5e43"}
                  strokeWidth={isEdgeSelected ? "3.5" : "2.2"}
                  strokeDasharray={edge.style === "dash" ? "7 6" : undefined}
                  markerEnd="url(#arrow)"
                />
                {edge.label ? (
                  <g transform={`translate(${(sx + tx) / 2}, ${mid})`}>
                    <rect x="-40" y="-12" width="80" height="20" rx="10" fill={isEdgeSelected ? "#fff7d6" : "#ffffff"} stroke={isEdgeSelected ? "#b57411" : "#8cb5a1"} strokeWidth="1.2" />
                    <text x="0" y="2" textAnchor="middle" className="svg-edge-label">{edge.label}</text>
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* Live Connecting Line Guide */}
          {connectingSourceId && sourcePos && mousePos ? (
            <g className="live-connecting-line">
              <path
                d={`M ${sourcePos.x + sourcePos.w / 2} ${sourcePos.y + sourcePos.h} C ${sourcePos.x + sourcePos.w / 2} ${sourcePos.y + sourcePos.h + 40}, ${mousePos.x} ${mousePos.y - 40}, ${mousePos.x} ${mousePos.y}`}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                markerEnd="url(#arrow-connecting)"
              />
            </g>
          ) : null}

          {/* Nodes */}
          {workflow.nodes.map((node) => {
            const box = positions.get(node.id)!;
            const isSelected = selectedNodeId === node.id;
            const isConnectingSource = connectingSourceId === node.id;
            const isConnectingTargetCandidate = Boolean(connectingSourceId && connectingSourceId !== node.id);

            const fill = node.type === "decision" ? "#fff3c4" : node.type === "document" ? "#e0f2fe" : node.type === "start" || node.type === "end" ? "#d1fae5" : node.type === "note" ? "#fef9c3" : "#ffffff";
            const stroke = isSelected ? "#106e46" : isConnectingSource ? "#2563eb" : isConnectingTargetCandidate ? "#3b82f6" : "#2d6650";
            const strokeWidth = isSelected || isConnectingSource ? 3 : isConnectingTargetCandidate ? 2 : 1.5;

            const centerX = box.x + box.w / 2;
            const centerY = box.y + box.h / 2;

            return (
              <g
                key={node.id}
                data-node-id={node.id}
                filter={isSelected ? "url(#glow)" : "url(#shadow)"}
                className={`svg-node-group ${isConnectingTargetCandidate ? "target-candidate" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectingSourceId) {
                    if (connectingSourceId !== node.id) {
                      onCompleteConnection(node.id);
                    }
                  } else {
                    onSelectNode(node.id);
                    onSelectEdge(null);
                  }
                }}
                style={{ cursor: connectingSourceId ? "crosshair" : "pointer" }}
              >
                {node.type === "decision" ? (
                  <polygon
                    points={`${centerX},${box.y} ${box.x + box.w},${centerY} ${centerX},${box.y + box.h} ${box.x},${centerY}`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isConnectingTargetCandidate ? "5 4" : undefined}
                  />
                ) : (
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={node.type === "start" || node.type === "end" ? 28 : 12}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isConnectingTargetCandidate ? "5 4" : undefined}
                  />
                )}

                {/* Target Candidate Badge */}
                {isConnectingTargetCandidate ? (
                  <g transform={`translate(${centerX}, ${box.y - 12})`}>
                    <rect x="-50" y="-10" width="100" height="18" rx="9" fill="#2563eb" />
                    <text x="0" y="3" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">คลิกเพื่อเชื่อมต่อ</text>
                  </g>
                ) : null}

                {/* Node ID Badge */}
                <text x={centerX} y={box.y + (node.type === "decision" ? 20 : 16)} textAnchor="middle" className="svg-node-id">
                  {node.id} · {typeLabels[node.type]}
                </text>

                {/* Node Text with Dynamic Fit */}
                <foreignObject
                  x={box.x + (node.type === "decision" ? box.w * 0.16 : 10)}
                  y={box.y + (node.type === "decision" ? box.h * 0.22 : 22)}
                  width={node.type === "decision" ? box.w * 0.68 : box.w - 20}
                  height={node.type === "decision" ? box.h * 0.58 : box.h - 28}
                >
                  <div className="svg-node-text-container">
                    <span className="svg-node-text">{node.text}</span>
                  </div>
                </foreignObject>

                {/* On-Canvas Action Buttons when Selected */}
                {isSelected && !connectingSourceId ? (
                  <g className="node-canvas-actions">
                    {/* Delete Icon Button (Top Right) */}
                    <g
                      transform={`translate(${box.x + box.w - 10}, ${box.y - 10})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNode(node.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <circle r="13" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                      <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">✕</text>
                    </g>

                    {/* Draw Connection Handle (Top Left / Port) */}
                    <g
                      transform={`translate(${box.x + 10}, ${box.y - 10})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartConnection(node.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <circle r="13" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">🔗</text>
                    </g>

                    {/* Add Next Step Button (Bottom Center) */}
                    <g
                      transform={`translate(${centerX}, ${box.y + box.h + 16})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddNodeAfter(node.id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <circle r="14" fill="#106e46" stroke="#ffffff" strokeWidth="2" />
                      <text x="0" y="4" textAnchor="middle" fill="#ffffff" fontSize="15" fontWeight="bold">+</text>
                    </g>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

async function svgToPng(svg: SVGSVGElement) {
  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("ไม่สามารถสร้างภาพ PNG ได้"));
    image.src = url;
  });
  const scale = 2;
  const viewBox = svg.viewBox.baseVal;
  const canvas = document.createElement("canvas");
  canvas.width = viewBox.width * scale;
  canvas.height = viewBox.height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ไม่พบ Canvas context");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, viewBox.width, viewBox.height);
  URL.revokeObjectURL(url);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error("ไม่สามารถสร้าง PNG ได้")), "image/png"));
}

export default function Home() {
  const [workflow, setWorkflow] = useState<Workflow>(() => cloneWorkflow(sampleWorkflow));
  const [manualText, setManualText] = useState(sampleWorkflow.sourceText);
  const [fileName, setFileName] = useState("ตัวอย่างระบบ");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("พร้อมทดลองด้วยข้อมูลตัวอย่าง");
  const [activePanel, setActivePanel] = useState<"nodes" | "edges" | "qa">("nodes");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const qa = useMemo(() => qaWorkflow(workflow), [workflow]);
  const failures = qa.filter((item) => item.level === "fail").length;
  const warnings = qa.filter((item) => item.level === "warning").length;

  function clearData() {
    setManualText("");
    setFileName("ยังไม่ได้เลือกไฟล์");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setWorkflow({
      id: "WF-NEW",
      name: "กระบวนงานใหม่",
      sourceFile: "ยังไม่ได้ระบุ",
      sourceText: "",
      createdAt: new Date().toISOString().split("T")[0],
      analysisMode: "pattern",
      lanes: ["ผู้รับผิดชอบ"],
      nodes: [],
      edges: [],
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setConnectingSourceId(null);
    setNotice("ล้างข้อมูลเรียบร้อยแล้ว พร้อมสำหรับนำเข้าหรือวางข้อความคู่มือใหม่");
    setActivePanel("nodes");
  }

  function applyWorkflow(next: Workflow) {
    setWorkflow(next);
    setNotice(`วิเคราะห์แล้ว ${next.nodes.length} กล่อง · ${next.edges.length} เส้น · ${next.lanes.length} Swimlane`);
    setActivePanel("nodes");
  }

  async function acceptFile(file?: File) {
    if (!file) return;
    setBusy("กำลังอ่านไฟล์…");
    try {
      const text = await readManualFile(file);
      setManualText(text);
      setFileName(file.name);
      setNotice(`อ่าน ${file.name} แล้ว (${text.length.toLocaleString()} ตัวอักษร)`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "อ่านไฟล์ไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  function analyze() {
    if (!manualText.trim()) {
      setNotice("กรุณาอัปโหลดไฟล์หรือวางข้อความจากคู่มือก่อน");
      return;
    }
    setBusy("กำลังจับ Pattern…");
    window.setTimeout(() => {
      applyWorkflow(extractWorkflow(manualText, fileName));
      setBusy("");
    }, 250);
  }

  function updateNode(id: string, patch: Partial<FlowNode>) {
    setWorkflow((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) }));
  }

  function deleteNode(id: string) {
    setWorkflow((current) => ({ ...current, nodes: current.nodes.filter((node) => node.id !== id), edges: current.edges.filter((edge) => edge.source !== id && edge.target !== id) }));
  }

  function addNode() {
    setWorkflow((current) => {
      const index = current.nodes.length + 1;
      return { ...current, nodes: [...current.nodes, { id: `${current.id}-N${String(index).padStart(2, "0")}`, text: "ขั้นตอนใหม่", originalText: "", lane: current.lanes[0] ?? "ผู้รับผิดชอบ", type: "process", documents: "", sourceRef: "เพิ่มโดยผู้ใช้", confidence: "review", order: index }] };
    });
  }

  function addNodeAfter(sourceId: string) {
    setWorkflow((current) => {
      const sourceNode = current.nodes.find((n) => n.id === sourceId);
      const index = current.nodes.length + 1;
      const newId = `${current.id}-N${String(index).padStart(2, "0")}`;
      const newNode: FlowNode = {
        id: newId,
        text: "ขั้นตอนใหม่",
        originalText: "",
        lane: sourceNode?.lane ?? current.lanes[0] ?? "ผู้รับผิดชอบ",
        type: "process",
        documents: "",
        sourceRef: "เพิ่มโดยผู้ใช้",
        confidence: "high",
        order: index,
      };
      const newEdge: FlowEdge = {
        id: `${current.id}-E${String(current.edges.length + 1).padStart(2, "0")}`,
        source: sourceId,
        target: newId,
        label: sourceNode?.type === "decision" ? "เห็นชอบ" : "",
        color: "#165B40",
        style: "solid",
        sourceSide: "bottom",
        targetSide: "top",
      };
      return {
        ...current,
        nodes: [...current.nodes, newNode],
        edges: [...current.edges, newEdge],
      };
    });
    setSelectedNodeId(null);
    setNotice("เพิ่มขั้นตอนเชื่อมต่อใหม่เรียบร้อยแล้ว");
  }

  function handleStartConnection(sourceId: string) {
    setConnectingSourceId(sourceId);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setNotice("โหมดลากเส้น: คลิกเลือกกล่องปลายทางที่ต้องการเชื่อมต่อ");
  }

  function handleCompleteConnection(targetId: string) {
    if (!connectingSourceId || connectingSourceId === targetId) return;
    const sourceNode = workflow.nodes.find((n) => n.id === connectingSourceId);
    const targetNode = workflow.nodes.find((n) => n.id === targetId);
    const newEdgeId = `${workflow.id}-E${String(workflow.edges.length + 1).padStart(2, "0")}`;
    const newEdge: FlowEdge = {
      id: newEdgeId,
      source: connectingSourceId,
      target: targetId,
      label: sourceNode?.type === "decision" ? "เห็นชอบ" : "",
      color: "#165B40",
      style: "solid",
      sourceSide: "bottom",
      targetSide: "top",
    };
    setWorkflow((current) => ({ ...current, edges: [...current.edges, newEdge] }));
    setConnectingSourceId(null);
    setSelectedEdgeId(newEdgeId);
    setNotice(`เชื่อมต่อเส้นจาก ${sourceNode?.id} ไปยัง ${targetNode?.id} เรียบร้อยแล้ว`);
  }

  function handleCancelConnection() {
    setConnectingSourceId(null);
    setNotice("ยกเลิกโหมดลากเส้นแล้ว");
  }

  function updateEdge(id: string, patch: Partial<FlowEdge>) {
    setWorkflow((current) => ({ ...current, edges: current.edges.map((edge) => edge.id === id ? { ...edge, ...patch } : edge) }));
  }

  function addEdge() {
    setWorkflow((current) => {
      const index = current.edges.length + 1;
      const source = current.nodes[Math.max(0, current.nodes.length - 2)]?.id ?? "";
      const target = current.nodes.at(-1)?.id ?? "";
      return { ...current, edges: [...current.edges, { id: `${current.id}-E${String(index).padStart(2, "0")}`, source, target, label: "", color: "#165B40", style: "solid", sourceSide: "bottom", targetSide: "top" }] };
    });
  }

  function deleteEdge(id: string) {
    setWorkflow((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== id) }));
  }

  function serializedSvg() {
    return svgRef.current ? new XMLSerializer().serializeToString(svgRef.current) : undefined;
  }

  async function exportDocx() {
    setBusy("กำลังสร้างเอกสาร Word (DOCX)…");
    try {
      const docxBlob = await buildDocxDocument(workflow);
      downloadBlob(docxBlob, workflowFileName(workflow, "docx"));
      setNotice("ดาวน์โหลดเอกสาร Word (DOCX SOP 15 หมวด) สำเร็จแล้ว");
    } catch (error) {
      setNotice(`สร้าง Word ไม่สำเร็จ: ${error instanceof Error ? error.message : "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
    } finally {
      setBusy("");
    }
  }

  async function exportPptx() {
    setBusy("กำลังสร้าง PowerPoint และผูก Connector…");
    try {
      const result = await buildEditablePptx(workflow);
      downloadBlob(result.blob, workflowFileName(workflow, "pptx"));
      setNotice(`PowerPoint พร้อมใช้ · ผูก Connector ${result.boundCount}/${result.expectedSegments} segments`);
    } catch (error) {
      setNotice(`สร้าง PowerPoint ไม่สำเร็จ: ${error instanceof Error ? error.message : "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
    } finally {
      setBusy("");
    }
  }

  async function exportZip() {
    setBusy("กำลังประกอบชุดส่งมอบ…");
    try {
      const png = svgRef.current ? await svgToPng(svgRef.current) : undefined;
      const zip = await buildDeliveryZip(workflow, serializedSvg(), png);
      downloadBlob(zip, `${workflowFileName(workflow, "").replace(/\.$/, "")}_outputs.zip`);
      setNotice("ดาวน์โหลดชุดส่งมอบ ZIP แล้ว");
    } catch (error) {
      setNotice(`สร้าง ZIP ไม่สำเร็จ: ${error instanceof Error ? error.message : "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
    } finally {
      setBusy("");
    }
  }

  const selectedNode = useMemo(() => workflow.nodes.find((n) => n.id === selectedNodeId), [workflow, selectedNodeId]);
  const selectedEdge = useMemo(() => workflow.edges.find((e) => e.id === selectedEdgeId), [workflow, selectedEdgeId]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><GitBranch size={20} /></div>
        <div className="brand-copy"><strong>Manual → Flow</strong><span>Workflow Intelligence Workspace</span></div>
        <div className="topbar-spacer" />
        <span className="local-pill"><Database size={14} /> Local-first</span>
        <button className="icon-button" aria-label="การตั้งค่า Pattern" title="Pattern ที่ระบบใช้"><Settings2 size={18} /></button>
      </header>

      <section className="hero-band">
        <div>
          <div className="eyebrow"><Sparkles size={15} /> เครื่องมือแปลงคู่มือเป็นข้อมูลกระบวนงานที่นำกลับมาใช้ซ้ำได้</div>
          <h1>จากเอกสารยาว<br /><em>สู่ Flowchart ที่แก้ไขต่อได้</em></h1>
          <p>อัปโหลด PDF, DOCX หรือ TXT ให้ระบบจับ Pattern ของขั้นตอน ผู้รับผิดชอบ เอกสาร และเงื่อนไข แล้วตรวจแก้ก่อนส่งออก</p>
        </div>
        <div className="hero-stats">
          <div><strong>{workflow.nodes.length}</strong><span>กล่อง</span></div>
          <div><strong>{workflow.edges.length}</strong><span>เส้นเชื่อม</span></div>
          <div><strong>{workflow.lanes.length}</strong><span>Swimlane</span></div>
        </div>
      </section>

      <nav className="stepper" aria-label="ขั้นตอนการทำงาน">
        {["นำเข้าคู่มือ", "วิเคราะห์ Pattern", "ตรวจแก้ข้อมูล", "ส่งออกงาน"].map((label, index) => (
          <div className={`step ${index <= 2 ? "step-done" : ""}`} key={label}>
            <span>{index < 2 ? <Check size={14} /> : index + 1}</span><b>{label}</b>{index < 3 ? <ChevronRight size={16} /> : null}
          </div>
        ))}
      </nav>

      <section className="workspace-grid">
        <aside className="left-rail">
          <div className="panel upload-panel">
            <div className="panel-heading"><div><small>STEP 01</small><h2>นำเข้าคู่มือ</h2></div><FileText size={20} /></div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md" hidden onChange={(event) => acceptFile(event.target.files?.[0])} />
            <button className={`drop-zone ${dragging ? "dragging" : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}>
              <UploadCloud size={28} /><strong>วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</strong><span>PDF · DOCX · TXT · MD</span>
            </button>
            <div className="file-chip">
              <FileText size={15} />
              <span title={fileName}>{fileName}</span>
              {fileName !== "ยังไม่ได้เลือกไฟล์" ? (
                <button onClick={clearData} title="ล้างข้อมูลเพื่อใส่คู่มือใหม่"><X size={14} /></button>
              ) : null}
            </div>
            <div className="field-header">
              <label className="field-label" htmlFor="manual-text">หรือวางข้อความจากคู่มือ</label>
              {(manualText || fileName !== "ยังไม่ได้เลือกไฟล์") ? (
                <button className="clear-text-btn" onClick={clearData} title="ล้างข้อมูลทั้งหมด"><RotateCcw size={12} /> ล้างข้อมูล</button>
              ) : null}
            </div>
            <textarea id="manual-text" className="manual-text" value={manualText} onChange={(event) => setManualText(event.target.value)} rows={9} placeholder="วางข้อความจากคู่มือหรือระเบียบปฏิบัติที่นี่..." />
            <div className="upload-actions">
              <button className="primary-button" onClick={analyze} disabled={Boolean(busy)}><WandSparkles size={17} />{busy || "วิเคราะห์และสร้าง Draft"}<ArrowRight size={17} /></button>
              <button className="secondary-button clear-btn" onClick={clearData} disabled={Boolean(busy)} title="ล้างข้อมูลทั้งหมดเพื่อใส่คู่มือใหม่"><RotateCcw size={16} /> ล้างข้อมูล</button>
            </div>
          </div>

          <div className="panel pattern-panel">
            <div className="panel-heading compact"><div><small>PATTERN ENGINE</small><h3>คลังคำที่ใช้จับโครงสร้าง</h3></div><SearchCheck size={19} /></div>
            <div className="pattern-row"><span>ผู้รับผิดชอบ</span><b>{defaultPattern.actorKeywords.length} คำ</b></div>
            <div className="pattern-row"><span>เงื่อนไข/ตัดสินใจ</span><b>{defaultPattern.decisionKeywords.length} คำ</b></div>
            <div className="pattern-row"><span>เอกสาร/หลักฐาน</span><b>{defaultPattern.documentKeywords.length} คำ</b></div>
            <p>Pattern ถูกเก็บในไฟล์ JSON และแก้ไขต่อได้โดยไม่ผูกกับคู่มือฉบับใดฉบับหนึ่ง</p>
          </div>
        </aside>

        <section className="main-stage">
          <div className="panel stage-toolbar">
            <div className="workflow-title-block"><span className="workflow-id">{workflow.id}</span><input value={workflow.name} onChange={(event) => setWorkflow((current) => ({ ...current, name: event.target.value }))} aria-label="ชื่อ Workflow" /><small>วิเคราะห์แบบ {workflow.analysisMode === "pattern" ? "Pattern offline" : "ตัวอย่างระบบ"}</small></div>
            <div className="qa-summary"><span className={failures ? "qa-fail" : "qa-pass"}>{failures ? <AlertTriangle size={14} /> : <Check size={14} />}{failures ? `${failures} Fail` : "โครงสร้างผ่าน"}</span><span className="qa-warn">{warnings} จุดควรทบทวน</span></div>
          </div>

          <div className="panel flow-panel">
            <div className="flow-panel-heading">
              <div><small>LIVE PREVIEW (CLICK TO EDIT)</small><h2>โครงสร้าง Flowchart</h2></div>
              <div className="legend"><span><i className="legend-start" />เริ่ม/สิ้นสุด</span><span><i className="legend-process" />ขั้นตอน</span><span><i className="legend-decision" />ตัดสินใจ</span></div>
            </div>
            <div className="flow-scroll">
              <FlowPreview
                workflow={workflow}
                svgRef={svgRef}
                selectedNodeId={selectedNodeId}
                selectedEdgeId={selectedEdgeId}
                connectingSourceId={connectingSourceId}
                onSelectNode={setSelectedNodeId}
                onSelectEdge={setSelectedEdgeId}
                onStartConnection={handleStartConnection}
                onCompleteConnection={handleCompleteConnection}
                onCancelConnection={handleCancelConnection}
                onUpdateNode={updateNode}
                onDeleteNode={deleteNode}
                onAddNodeAfter={addNodeAfter}
              />
            </div>

            {/* Quick Node Editor Toolbar when Selected */}
            {selectedNode ? (
              <div className="selected-node-bar">
                <div className="node-bar-info">
                  <code>{selectedNode.id}</code>
                  <strong>แก้ไขกล่องที่เลือก</strong>
                </div>
                <div className="node-bar-inputs">
                  <input
                    value={selectedNode.text}
                    onChange={(e) => updateNode(selectedNode.id, { text: e.target.value })}
                    placeholder="ข้อความในกล่อง"
                  />
                  <select
                    value={selectedNode.type}
                    onChange={(e) => updateNode(selectedNode.id, { type: e.target.value as NodeType })}
                  >
                    {Object.entries(typeLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={selectedNode.lane}
                    onChange={(e) => updateNode(selectedNode.id, { lane: e.target.value })}
                  >
                    {workflow.lanes.map((lane) => (
                      <option key={lane} value={lane}>{lane}</option>
                    ))}
                  </select>
                  <button className="add-next-btn" onClick={() => handleStartConnection(selectedNode.id)} title="ลากเส้นเชื่อมไปกล่องอื่น">
                    🔗 ลากเส้นเชื่อม
                  </button>
                  <button className="add-next-btn" onClick={() => addNodeAfter(selectedNode.id)}>
                    <CirclePlus size={14} /> เพิ่มขั้นตอนต่อ
                  </button>
                  <button className="del-node-btn" onClick={() => { deleteNode(selectedNode.id); setSelectedNodeId(null); }}>
                    <Trash2 size={14} /> ลบกล่อง
                  </button>
                </div>
              </div>
            ) : null}

            {/* Quick Edge Editor Toolbar when Selected */}
            {selectedEdge ? (
              <div className="selected-node-bar edge-bar">
                <div className="node-bar-info">
                  <code style={{ background: "#f0bd52", color: "#0f3e2d" }}>{selectedEdge.id}</code>
                  <strong>แก้ไขเส้นเชื่อม: {selectedEdge.source} ➔ {selectedEdge.target}</strong>
                </div>
                <div className="node-bar-inputs">
                  <input
                    value={selectedEdge.label}
                    onChange={(e) => updateEdge(selectedEdge.id, { label: e.target.value })}
                    placeholder="ข้อความบนเส้น (เช่น เห็นชอบ / อนุมัติ)"
                  />
                  <select
                    value={selectedEdge.style}
                    onChange={(e) => updateEdge(selectedEdge.id, { style: e.target.value as FlowEdge["style"] })}
                  >
                    <option value="solid">เส้นทึบ</option>
                    <option value="dash">เส้นประ</option>
                  </select>
                  <input
                    type="color"
                    value={selectedEdge.color || "#165B40"}
                    onChange={(e) => updateEdge(selectedEdge.id, { color: e.target.value })}
                    style={{ width: "36px", padding: "2px", height: "30px", cursor: "pointer" }}
                  />
                  <button className="del-node-btn" onClick={() => { deleteEdge(selectedEdge.id); setSelectedEdgeId(null); }}>
                    <Trash2 size={14} /> ลบเส้นเชื่อม
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="panel data-panel">
            <div className="tabs"><button className={activePanel === "nodes" ? "active" : ""} onClick={() => setActivePanel("nodes")}>กล่อง <span>{workflow.nodes.length}</span></button><button className={activePanel === "edges" ? "active" : ""} onClick={() => setActivePanel("edges")}>เส้นเชื่อม <span>{workflow.edges.length}</span></button><button className={activePanel === "qa" ? "active" : ""} onClick={() => setActivePanel("qa")}>ตรวจคุณภาพ <span>{qa.length}</span></button></div>

            {activePanel === "nodes" ? (
              <div className="table-wrap">
                <table><thead><tr><th>ลำดับ</th><th>รหัส/ประเภท</th><th>ข้อความ</th><th>Swimlane</th><th>เอกสาร</th><th>มั่นใจ</th><th /></tr></thead>
                  <tbody>{workflow.nodes.map((node, index) => (
                    <tr key={node.id}>
                      <td className="order-cell"><GripVertical size={15} />{index + 1}</td>
                      <td><code>{node.id}</code><select value={node.type} onChange={(event) => updateNode(node.id, { type: event.target.value as NodeType })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></td>
                      <td><textarea value={node.text} onChange={(event) => updateNode(node.id, { text: event.target.value })} rows={2} /></td>
                      <td><select value={node.lane} onChange={(event) => updateNode(node.id, { lane: event.target.value })}>{workflow.lanes.map((lane) => <option key={lane}>{lane}</option>)}</select></td>
                      <td><input value={node.documents} onChange={(event) => updateNode(node.id, { documents: event.target.value })} placeholder="ถ้ามี" /></td>
                      <td><select value={node.confidence} onChange={(event) => updateNode(node.id, { confidence: event.target.value as FlowNode["confidence"] })}><option value="high">สูง</option><option value="medium">กลาง</option><option value="review">ตรวจซ้ำ</option></select></td>
                      <td><button className="row-delete" onClick={() => deleteNode(node.id)} aria-label={`ลบ ${node.id}`}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}</tbody>
                </table><button className="add-row" onClick={addNode}><CirclePlus size={16} /> เพิ่มกล่อง</button>
              </div>
            ) : null}

            {activePanel === "edges" ? (
              <div className="table-wrap">
                <table><thead><tr><th>รหัสเส้น</th><th>Source</th><th>Target</th><th>ข้อความกำกับ</th><th>รูปแบบ</th><th>สี</th><th /></tr></thead>
                  <tbody>{workflow.edges.map((edge) => (
                    <tr key={edge.id}>
                      <td><code>{edge.id}</code></td><td><select value={edge.source} onChange={(event) => updateEdge(edge.id, { source: event.target.value })}>{workflow.nodes.map((node) => <option key={node.id}>{node.id}</option>)}</select></td><td><select value={edge.target} onChange={(event) => updateEdge(edge.id, { target: event.target.value })}>{workflow.nodes.map((node) => <option key={node.id}>{node.id}</option>)}</select></td><td><input value={edge.label} onChange={(event) => updateEdge(edge.id, { label: event.target.value })} /></td><td><select value={edge.style} onChange={(event) => updateEdge(edge.id, { style: event.target.value as FlowEdge["style"] })}><option value="solid">เส้นทึบ</option><option value="dash">เส้นประ</option></select></td><td><input type="color" value={edge.color} onChange={(event) => updateEdge(edge.id, { color: event.target.value })} /></td><td><button className="row-delete" onClick={() => deleteEdge(edge.id)} aria-label={`ลบ ${edge.id}`}><Trash2 size={15} /></button></td>
                    </tr>
                  ))}</tbody>
                </table><button className="add-row" onClick={addEdge}><CirclePlus size={16} /> เพิ่มเส้นเชื่อม</button>
              </div>
            ) : null}

            {activePanel === "qa" ? <div className="qa-list">{qa.map((item) => <div className={`qa-item ${item.level}`} key={item.text}>{item.level === "pass" ? <Check size={17} /> : <AlertTriangle size={17} />}<span>{item.text}</span><b>{item.level.toUpperCase()}</b></div>)}</div> : null}
          </div>
        </section>

        <aside className="right-rail">
          <div className="panel export-panel">
            <div className="panel-heading"><div><small>STEP 04</small><h2>ส่งออกงาน</h2></div><PackageCheck size={21} /></div>
            <p>ใช้ JSON เป็นแหล่งข้อมูลกลาง แล้วเลือกไฟล์ตามงานปลายทาง</p>
            <button className="export-option featured" onClick={exportZip} disabled={Boolean(busy)}><span className="export-icon"><PackageCheck size={20} /></span><span><b>ชุดส่งมอบ ZIP</b><small>DOCX · PPTX · XLSX · JSON · PNG · QA</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportDocx} disabled={Boolean(busy)}><span className="export-icon blue"><FileText size={20} /></span><span><b>เอกสาร Word (DOCX)</b><small>ระเบียบปฏิบัติงาน SOP 15 หมวด</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportPptx} disabled={Boolean(busy)}><span className="export-icon purple"><Presentation size={20} /></span><span><b>PowerPoint แก้ไขได้</b><small>Shapes + bound Connectors</small></span><Download size={17} /></button>
            <button className="export-option" onClick={() => downloadBlob(buildWorkbook(workflow), workflowFileName(workflow, "xlsx"))}><span className="export-icon green"><FileSpreadsheet size={20} /></span><span><b>Excel Data Model</b><small>Workflow · Nodes · Edges · QA</small></span><Download size={17} /></button>
            <button className="export-option" onClick={() => downloadBlob(workflowJsonBlob(workflow), workflowFileName(workflow, "json"))}><span className="export-icon amber"><FileJson size={20} /></span><span><b>Canonical JSON</b><small>นำเข้าโปรเจกต์อื่นได้</small></span><Download size={17} /></button>
            <button className="export-option" onClick={async () => { if (!svgRef.current) return; downloadBlob(await svgToPng(svgRef.current), workflowFileName(workflow, "png")); }}><span className="export-icon teal"><FileText size={20} /></span><span><b>ภาพตรวจทาน PNG</b><small>ความละเอียด 2×</small></span><Download size={17} /></button>
            <div className="connector-guarantee"><GitBranch size={18} /><div><b>Connector Guarantee</b><span>ระบบแก้ OOXML ให้ปลายเส้นยึด Source/Target Shape จริง เมื่อลากกล่องใน PowerPoint เส้นจะขยับตาม</span></div></div>
          </div>

          <div className="panel status-panel"><small>สถานะล่าสุด</small><p>{busy || notice}</p><div className="status-actions"><button onClick={clearData} title="ล้างข้อมูลทั้งหมด"><RotateCcw size={14} /> ล้างข้อมูล</button><button onClick={() => { setWorkflow(cloneWorkflow(sampleWorkflow)); setManualText(sampleWorkflow.sourceText); setFileName("ตัวอย่างระบบ"); setNotice("คืนค่าตัวอย่างแล้ว"); }} title="โหลดชุดตัวอย่าง"><RotateCcw size={14} /> คืนค่าตัวอย่าง</button><button onClick={analyze} title="วิเคราะห์ใหม่"><Play size={14} /> รันใหม่</button></div></div>
        </aside>
      </section>

      <footer><span>Manual-to-Flowchart Generator</span><span>ข้อมูลประมวลผลในเบราว์เซอร์ · เหมาะสำหรับรันบน localhost</span></footer>
    </main>
  );
}
