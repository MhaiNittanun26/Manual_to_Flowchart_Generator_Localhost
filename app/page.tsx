"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  CirclePlus,
  Copy,
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
import { buildDeliveryZip, buildDocxDocument, buildEditablePptx, buildWorkbook, buildTextBlob, buildTextContent, downloadBlob, workflowFileName, workflowJsonBlob } from "./lib/exporters";
import { readManualFile } from "./lib/file-reader";
import { defaultPattern, extractWorkflow, qaWorkflow } from "./lib/parser";
import { sampleWorkflow } from "./lib/sample";
import type { ArrowHeadType, FlowEdge, FlowNode, NodeType, Workflow } from "./lib/types";

const typeLabels: Record<NodeType, string> = {
  process: "ขั้นตอน (สี่เหลี่ยม)",
  decision: "ตัดสินใจ (เพชร/Diamond)",
  document: "เอกสาร (ทรงพับมุม)",
  executive: "ผู้บริหาร (สี่เหลี่ยมคางหมู)",
  start: "เริ่มต้น (Pill)",
  end: "สิ้นสุด (แดง)",
  option: "ทางเลือก (Badge)",
  note: "หมายเหตุ (เส้นประ)",
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
  onUpdateEdge,
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
  onUpdateEdge: (id: string, patch: Partial<FlowEdge>) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Interactive Node Drag & Line Bend States
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [edgeOffsets, setEdgeOffsets] = useState<Record<string, number>>({});
  const [dragState, setDragState] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
    initialOffsetX: number;
    initialOffsetY: number;
  } | null>(null);
  const [edgeDragState, setEdgeDragState] = useState<{
    edgeId: string;
    startY: number;
    initialOffset: number;
  } | null>(null);

  const laneCount = Math.max(1, workflow.lanes.length);
  const laneWidth = 860 / laneCount;
  const baseNodeWidth = Math.min(195, laneWidth - 20);

  // Preset row levels for sample workflow nodes
  const sampleLevels: Record<string, number> = {
    "W1-N01": 1, "W1-N13": 1,
    "W1-N02": 2, "W1-N03": 2, "W1-N04": 2, "W1-N05": 2, "W1-N08": 2, "W1-N12": 2,
    "W1-N06": 3, "W1-N09": 3, "W1-N11": 3,
    "W1-N07": 4, "W1-N10": 4,
    "W1-N14": 5,
    "W1-N15": 6, "W1-N16": 6, "W1-N17": 6, "W1-N23": 6,
    "W1-N18": 7, "W1-N22": 7,
    "W1-N19": 8,
    "W1-N20": 9, "W1-N21": 9,
    "W1-N24": 10, "W1-N25": 10,
    "W1-N26": 11,
    "W1-N27": 12, "W1-N28": 12,
    "W1-N29": 13,
    "W1-N30": 14, "W1-N31": 14,
  };

  const nodeLevels = new Map<string, number>();
  const visited = new Set<string>();

  workflow.nodes.forEach((node, idx) => {
    if (sampleLevels[node.id]) {
      nodeLevels.set(node.id, sampleLevels[node.id]);
    } else {
      const laneNodes = workflow.nodes.filter(n => n.lane === node.lane && visited.has(n.id));
      const lastLevel = laneNodes.length > 0 ? Math.max(...laneNodes.map(n => nodeLevels.get(n.id) || 1)) : 0;
      nodeLevels.set(node.id, Math.max(lastLevel + 1, idx + 1));
    }
    visited.add(node.id);
  });

  const nodeSizes = new Map<string, { w: number; h: number }>();
  workflow.nodes.forEach((node) => {
    const isOption = node.type === "option";
    const isStart = node.type === "start";
    const isEnd = node.type === "end";
    const textLines = node.text ? node.text.split("\n").length : 1;

    let w = baseNodeWidth;
    let h = 58;

    if (isOption) {
      w = Math.min(150, baseNodeWidth - 10);
      h = 36;
    } else if (isStart || isEnd) {
      w = Math.min(180, baseNodeWidth);
      h = 48;
    } else if (textLines > 5) {
      w = baseNodeWidth + 10;
      h = Math.max(160, 42 + textLines * 19);
    } else if (textLines > 1) {
      h = Math.max(78, 38 + textLines * 18);
    } else {
      h = 56;
    }
    nodeSizes.set(node.id, { w, h });
  });

  const levelMaxH = new Map<number, number>();
  workflow.nodes.forEach((node) => {
    const lvl = nodeLevels.get(node.id) || 1;
    const size = nodeSizes.get(node.id)!;
    levelMaxH.set(lvl, Math.max(levelMaxH.get(lvl) || 0, size.h));
  });

  const levelY = new Map<number, number>();
  let runningY = 115;
  const sortedLevels = Array.from(new Set(Array.from(nodeLevels.values()))).sort((a, b) => a - b);
  sortedLevels.forEach((lvl) => {
    levelY.set(lvl, runningY);
    const maxH = levelMaxH.get(lvl) || 58;
    runningY += maxH + 42;
  });

  const basePositions = new Map<string, { x: number; y: number; w: number; h: number }>();
  workflow.nodes.forEach((node) => {
    const laneIndex = Math.max(0, workflow.lanes.indexOf(node.lane));
    const lvl = nodeLevels.get(node.id) || 1;
    const size = nodeSizes.get(node.id)!;
    const x = 50 + laneIndex * laneWidth + (laneWidth - size.w) / 2;
    const y = levelY.get(lvl) || 115;
    basePositions.set(node.id, { x, y, w: size.w, h: size.h });
  });

  // Strict Collision Avoidance Pass
  workflow.lanes.forEach((lane) => {
    const laneNodes = workflow.nodes
      .filter((n) => n.lane === lane)
      .sort((a, b) => (basePositions.get(a.id)?.y || 0) - (basePositions.get(b.id)?.y || 0));

    for (let i = 1; i < laneNodes.length; i++) {
      const prevPos = basePositions.get(laneNodes[i - 1].id)!;
      const currPos = basePositions.get(laneNodes[i].id)!;
      const minRequiredY = prevPos.y + prevPos.h + 28;
      if (currPos.y < minRequiredY) {
        currPos.y = minRequiredY;
      }
    }
  });

  // Combine base positions with user dragging offsets
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
  workflow.nodes.forEach((node) => {
    const basePos = basePositions.get(node.id)!;
    const offset = nodeOffsets[node.id] || { x: 0, y: 0 };
    positions.set(node.id, {
      x: basePos.x + offset.x,
      y: basePos.y + offset.y,
      w: basePos.w,
      h: basePos.h,
    });
  });

  const width = 960;
  const maxY = Math.max(700, ...Array.from(positions.values()).map((p) => p.y + p.h));
  const height = maxY + 90;

  const sourcePos = connectingSourceId ? positions.get(connectingSourceId) : null;

  // Helper for port anchors
  function getPortAnchor(pos: { x: number; y: number; w: number; h: number }, side?: string) {
    if (side === "top") return { x: pos.x + pos.w / 2, y: pos.y };
    if (side === "right") return { x: pos.x + pos.w, y: pos.y + pos.h / 2 };
    if (side === "bottom") return { x: pos.x + pos.w / 2, y: pos.y + pos.h };
    if (side === "left") return { x: pos.x, y: pos.y + pos.h / 2 };
    return { x: pos.x + pos.w / 2, y: pos.y + pos.h };
  }

  // Custom Shape Renderer
  const renderShape = (type: NodeType, box: { x: number; y: number; w: number; h: number }, fill: string, stroke: string, strokeWidth: number) => {
    const centerX = box.x + box.w / 2;
    const centerY = box.y + box.h / 2;

    if (type === "decision") {
      return (
        <polygon
          points={`${centerX},${box.y} ${box.x + box.w},${centerY} ${centerX},${box.y + box.h} ${box.x},${centerY}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (type === "document") {
      const cut = 14;
      return (
        <path
          d={`M ${box.x} ${box.y} L ${box.x + box.w - cut} ${box.y} L ${box.x + box.w} ${box.y + cut} L ${box.x + box.w} ${box.y + box.h} L ${box.x} ${box.y + box.h} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (type === "executive") {
      const slant = 14;
      return (
        <polygon
          points={`${box.x + slant},${box.y} ${box.x + box.w},${box.y} ${box.x + box.w - slant},${box.y + box.h} ${box.x},${box.y + box.h}`}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    }
    if (type === "note") {
      return (
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx="6"
          fill="#FFFBEB"
          stroke="#F59E0B"
          strokeWidth={strokeWidth}
          strokeDasharray="4 3"
        />
      );
    }
    return (
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={type === "start" || type === "end" ? box.h / 2 : type === "option" ? 18 : 10}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  };

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
          <small className="canvas-tip">💡 <strong>ลากกล่อง</strong>เพื่อย้ายตำแหน่ง · <strong>คลิกเส้น</strong>เพื่อปรับทิศทาง/หัวลูกศร</small>
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
            if (!svgRef.current) return;
            const rect = svgRef.current.getBoundingClientRect();
            const scaleX = width / rect.width;
            const scaleY = height / rect.height;

            if (dragState) {
              const dx = (e.clientX - dragState.startX) * scaleX / zoom;
              const dy = (e.clientY - dragState.startY) * scaleY / zoom;
              setNodeOffsets((prev) => ({
                ...prev,
                [dragState.nodeId]: {
                  x: dragState.initialOffsetX + dx,
                  y: dragState.initialOffsetY + dy,
                },
              }));
            } else if (edgeDragState) {
              const dy = (e.clientY - edgeDragState.startY) * scaleY / zoom;
              setEdgeOffsets((prev) => ({
                ...prev,
                [edgeDragState.edgeId]: edgeDragState.initialOffset + dy,
              }));
            } else if (connectingSourceId) {
              const x = (e.clientX - rect.left) * scaleX;
              const y = (e.clientY - rect.top) * scaleY;
              setMousePos({ x, y });
            }
          }}
          onMouseUp={() => {
            setDragState(null);
            setEdgeDragState(null);
          }}
          onClick={(e) => {
            const targetEl = e.target as HTMLElement | SVGElement;
            if (targetEl.closest && targetEl.closest('[data-node-id], [data-edge-id], .node-popover-foreign, .selected-node-bar')) {
              return;
            }
            if (connectingSourceId) {
              onCancelConnection();
            } else {
              onSelectNode(null);
              onSelectEdge(null);
            }
          }}
        >
          <defs>
            {/* Arrowhead Markers for End, Start, Both, and None */}
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#1b5e43" />
            </marker>
            <marker id="arrow-start" markerWidth="8" markerHeight="8" refX="0.5" refY="3.5" orient="auto">
              <polygon points="7 0, 0 3.5, 7 7" fill="#1b5e43" />
            </marker>
            <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#dc2626" />
            </marker>
            <marker id="arrow-connecting" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#2563eb" />
            </marker>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#276c4f" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Diagram Header Title */}
          <rect width={width} height={height} fill="#ffffff" rx="12" stroke="#000000" strokeWidth="2" />
          <text x="480" y="38" textAnchor="middle" className="svg-title" fill="#000000" fontSize="22" fontWeight="800">
            {workflow.name}
          </text>

          {/* Swimlanes */}
          {workflow.lanes.map((lane, index) => {
            const x = 50 + index * laneWidth;
            const headerColors = ["#5B9BD5", "#40C4AA", "#B39DDB", "#FF8A80"];
            const bgTints = ["#FAFDF7", "#F0FBF8", "#F7F4FD", "#FFF5F5"];
            const headerFill = headerColors[index % headerColors.length];
            const bgFill = bgTints[index % bgTints.length];
            return (
              <g key={lane}>
                <rect x={x} y="58" width={laneWidth} height={height - 74} fill={bgFill} stroke="#000000" strokeWidth="1.2" />
                <rect x={x} y="58" width={laneWidth} height="46" fill={headerFill} stroke="#000000" strokeWidth="1.2" />
                <text x={x + laneWidth / 2} y="86" textAnchor="middle" fill="#000000" fontSize="13" fontWeight="bold">
                  {lane}
                </text>
              </g>
            );
          })}

          {/* Edges / Connectors */}
          {workflow.edges.map((edge) => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return null;
            const isEdgeSelected = selectedEdgeId === edge.id;

            const isRejection = edge.label.includes("ปฏิเสธ") || edge.color === "#DC2626";
            const isApproval = edge.label.includes("เห็นชอบ") || edge.label.includes("อนุมัติ");

            // Port Side Anchors
            const sSide = edge.sourceSide || (isRejection && edge.target === "W1-N01" ? "top" : "bottom");
            const tSide = edge.targetSide || (isRejection && edge.target === "W1-N01" ? "top" : "top");

            const sAnchor = getPortAnchor(source, sSide);
            const tAnchor = getPortAnchor(target, tSide);

            const midOffset = edgeOffsets[edge.id] || edge.midOffset || 0;
            let midY = (sAnchor.y + tAnchor.y) / 2 + midOffset;

            let pathD = `M ${sAnchor.x} ${sAnchor.y} L ${sAnchor.x} ${midY} L ${tAnchor.x} ${midY} L ${tAnchor.x} ${tAnchor.y}`;

            if (isRejection && edge.target === "W1-N01" && !edge.sourceSide) {
              const topY = Math.min(source.y, target.y) - 25 + midOffset;
              pathD = `M ${source.x + source.w / 2} ${source.y} L ${source.x + source.w / 2} ${topY} L ${target.x + target.w / 2} ${topY} L ${target.x + target.w / 2} ${target.y}`;
              midY = topY;
            } else if (sSide === "right" && tSide === "left") {
              const midX = (sAnchor.x + tAnchor.x) / 2 + midOffset;
              pathD = `M ${sAnchor.x} ${sAnchor.y} L ${midX} ${sAnchor.y} L ${midX} ${tAnchor.y} L ${tAnchor.x} ${tAnchor.y}`;
            }

            const strokeColor = isEdgeSelected ? "#f59e0b" : isRejection ? "#DC2626" : edge.color || "#000000";
            const arrowHead = edge.arrowHead || "end";

            const markerEnd = arrowHead === "end" || arrowHead === "both" ? (isRejection ? "url(#arrow-red)" : "url(#arrow)") : undefined;
            const markerStart = arrowHead === "start" || arrowHead === "both" ? "url(#arrow-start)" : undefined;

            return (
              <g
                key={edge.id}
                data-edge-id={edge.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectingSourceId) {
                    onCancelConnection();
                  } else {
                    onSelectEdge(edge.id);
                    onSelectNode(null);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <path d={pathD} fill="none" stroke="transparent" strokeWidth="12" />
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isEdgeSelected ? "3.5" : "2"}
                  strokeDasharray={edge.style === "dash" ? "6 5" : undefined}
                  markerEnd={markerEnd}
                  markerStart={markerStart}
                />

                {/* Line Bend Drag Handle when Selected */}
                {isEdgeSelected ? (
                  <circle
                    cx={(sAnchor.x + tAnchor.x) / 2}
                    cy={midY}
                    r="6"
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    style={{ cursor: "ns-resize" }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setEdgeDragState({
                        edgeId: edge.id,
                        startY: e.clientY,
                        initialOffset: midOffset,
                      });
                    }}
                  >
                    <title>ลากเพื่อเลื่อนตำแหน่งเส้น</title>
                  </circle>
                ) : null}

                {edge.label ? (
                  <g transform={`translate(${(sAnchor.x + tAnchor.x) / 2}, ${midY})`}>
                    {isRejection ? (
                      <g transform="translate(-60, -12)">
                        <rect width="120" height="22" rx="11" fill="#FEE2E2" stroke="#EF4444" strokeWidth="1.5" />
                        <text x="60" y="15" textAnchor="middle" fill="#991B1B" fontSize="10.5" fontWeight="bold">
                          ✖ {edge.label}
                        </text>
                      </g>
                    ) : isApproval ? (
                      <g transform="translate(-60, -12)">
                        <rect width="120" height="22" rx="11" fill="#DCFCE7" stroke="#22C55E" strokeWidth="1.5" />
                        <text x="60" y="15" textAnchor="middle" fill="#15803D" fontSize="10.5" fontWeight="bold">
                          ✔ {edge.label}
                        </text>
                      </g>
                    ) : edge.label.toLowerCase().includes("option") ? (
                      <g transform="translate(-45, -11)">
                        <rect width="90" height="20" rx="10" fill={strokeColor} stroke="#ffffff" strokeWidth="1" />
                        <text x="45" y="14" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                          {edge.label}
                        </text>
                      </g>
                    ) : (
                      <g transform="translate(-48, -11)">
                        <rect width="96" height="20" rx="10" fill="#ffffff" stroke={strokeColor} strokeWidth="1.2" />
                        <text x="48" y="14" textAnchor="middle" fill="#000000" fontSize="10" fontWeight="bold">
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* Live Connecting Line */}
          {connectingSourceId && sourcePos && mousePos ? (
            <g className="live-connecting-line">
              <path
                d={`M ${sourcePos.x + sourcePos.w / 2} ${sourcePos.y + sourcePos.h} L ${mousePos.x} ${mousePos.y}`}
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

            const laneIndex = Math.max(0, workflow.lanes.indexOf(node.lane));

            let fill = "#ffffff";
            let stroke = isSelected ? "#2563eb" : "#000000";
            let textColor = "#000000";

            if (node.type === "start") {
              fill = "#2563eb"; textColor = "#ffffff";
            } else if (node.type === "end") {
              fill = "#dc2626"; textColor = "#ffffff";
            } else if (node.type === "option") {
              fill = "#e0f2fe"; stroke = "#0284c7"; textColor = "#0369a1";
            } else if (laneIndex === 0) {
              fill = "#e0f2fe"; stroke = "#3b82f6"; textColor = "#1e3a8a";
            } else if (laneIndex === 1) {
              fill = "#d1f4e0"; stroke = "#10b981"; textColor = "#064e3b";
            } else if (laneIndex === 2) {
              fill = "#e0eafc"; stroke = "#60a5fa"; textColor = "#1e3a8a";
            } else if (laneIndex === 3 || node.type === "executive") {
              fill = "#fce7f3"; stroke = "#ec4899"; textColor = "#831843";
            }

            const strokeWidth = isSelected || isConnectingSource ? 3 : 1.5;
            const lines = node.text ? node.text.split("\n") : [];
            const headerText = lines[0] || "";
            const bulletLines = lines.slice(1);

            return (
              <g
                key={node.id}
                data-node-id={node.id}
                filter={isSelected ? "url(#glow)" : undefined}
                className={`svg-node-group ${isConnectingTargetCandidate ? "target-candidate" : ""}`}
                onMouseDown={(e) => {
                  if (connectingSourceId) return;
                  e.stopPropagation();
                  onSelectNode(node.id);
                  onSelectEdge(null);
                  const currOffset = nodeOffsets[node.id] || { x: 0, y: 0 };
                  setDragState({
                    nodeId: node.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialOffsetX: currOffset.x,
                    initialOffsetY: currOffset.y,
                  });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectingSourceId) {
                    if (connectingSourceId !== node.id) {
                      onCompleteConnection(node.id);
                    } else {
                      onCancelConnection();
                    }
                  } else {
                    onSelectNode(node.id);
                    onSelectEdge(null);
                  }
                }}
                style={{ cursor: connectingSourceId ? "crosshair" : "grab" }}
              >
                {renderShape(node.type, box, fill, stroke, strokeWidth)}

                <foreignObject x={box.x + 4} y={box.y + 4} width={box.w - 8} height={box.h - 8} style={{ pointerEvents: "none" }}>
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: bulletLines.length > 0 ? "flex-start" : "center",
                      padding: "4px 8px",
                      color: textColor,
                      fontSize: "11px",
                      overflow: "hidden",
                      userSelect: "none",
                    }}
                  >
                    {node.type === "start" ? (
                      <div style={{ color: "#fff", fontWeight: "bold", textAlign: "center", width: "100%" }}>
                        <span style={{ background: "#1D4ED8", padding: "2px 8px", borderRadius: "10px", marginRight: "6px", fontSize: "10px" }}>START</span>
                        {node.text}
                      </div>
                    ) : node.type === "end" ? (
                      <div style={{ color: "#fff", fontWeight: "bold", textAlign: "center", width: "100%" }}>
                        <div style={{ fontSize: "15px", letterSpacing: "1px" }}>FINAL</div>
                        <div style={{ fontSize: "10px", fontWeight: "normal" }}>เสร็จสิ้น</div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            fontWeight: "700",
                            fontSize: "11.5px",
                            textAlign: bulletLines.length > 0 ? "left" : "center",
                            width: "100%",
                            marginBottom: bulletLines.length > 0 ? "3px" : "0",
                            lineHeight: "1.3",
                          }}
                        >
                          {headerText}
                        </div>
                        {bulletLines.length > 0 ? (
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: "14px",
                              fontSize: "10px",
                              color: "#334155",
                              textAlign: "left",
                              lineHeight: "1.3",
                            }}
                          >
                            {bulletLines.map((line, i) => (
                              <li key={i}>{line.replace(/^[•\-]\s*/, "")}</li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </div>
                </foreignObject>

                {/* Connection Port Handles on Selected Node */}
                {isSelected ? (
                  <g className="port-handles">
                    {(["top", "right", "bottom", "left"] as const).map((side) => {
                      const port = getPortAnchor(box, side);
                      return (
                        <circle
                          key={side}
                          cx={port.x}
                          cy={port.y}
                          r="5.5"
                          fill="#2563EB"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          style={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartConnection(node.id);
                          }}
                        >
                          <title>{`พอร์ตเชื่อมต่อทิศทาง ${side}`}</title>
                        </circle>
                      );
                    })}
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* Floating Canvas Node Popover when Selected */}
          {(() => {
            const selNode = workflow.nodes.find((n) => n.id === selectedNodeId);
            if (!selNode) return null;
            const selBox = positions.get(selNode.id);
            if (!selBox) return null;

            const popoverWidth = 340;
            const popoverHeight = 135;
            const posX = Math.max(10, Math.min(width - popoverWidth - 10, selBox.x + selBox.w / 2 - popoverWidth / 2));
            const posY = selBox.y - popoverHeight - 12 < 60 ? selBox.y + selBox.h + 12 : selBox.y - popoverHeight - 12;

            const targetEdges = workflow.edges.filter((e) => e.source === selNode.id || e.target === selNode.id);
            const activeArrowHead = targetEdges[0]?.arrowHead || "end";

            return (
              <foreignObject
                x={posX}
                y={posY}
                width={popoverWidth}
                height={popoverHeight}
                className="node-popover-foreign"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="node-floating-popover">
                  <div className="popover-header">
                    <div className="popover-title">
                      <span className="popover-node-id">{selNode.id}</span>
                      <strong>แก้ไขกล่องที่เลือก</strong>
                    </div>
                    <button
                      className="popover-close-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(null);
                      }}
                      title="ปิดหน้าต่างปรับแต่ง"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="popover-body">
                    <div className="popover-row">
                      <div className="popover-field">
                        <label>ประเภทกล่อง:</label>
                        <select
                          value={selNode.type}
                          onChange={(e) => onUpdateNode(selNode.id, { type: e.target.value as NodeType })}
                        >
                          {Object.entries(typeLabels).map(([val, label]) => (
                            <option key={val} value={val}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="popover-field">
                        <label>หัวลูกศรเส้นเชื่อม:</label>
                        <select
                          value={activeArrowHead}
                          onChange={(e) => {
                            const newArrow = e.target.value as ArrowHeadType;
                            if (targetEdges.length > 0) {
                              targetEdges.forEach((edge) => onUpdateEdge(edge.id, { arrowHead: newArrow }));
                            }
                          }}
                        >
                          <option value="end">➔ ปลายทาง</option>
                          <option value="start">← ต้นทาง</option>
                          <option value="both">↔ สองทิศทาง</option>
                          <option value="none">― ไม่มีลูกศร</option>
                        </select>
                      </div>
                    </div>

                    <div className="popover-row">
                      <input
                        className="popover-text-input"
                        value={selNode.text}
                        onChange={(e) => onUpdateNode(selNode.id, { text: e.target.value })}
                        placeholder="ข้อความในกล่อง..."
                      />
                      <button
                        className="popover-act-btn connect"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartConnection(selNode.id);
                        }}
                        title="ลากเส้นเชื่อมไปกล่องอื่น"
                      >
                        🔗 ลากเส้น
                      </button>
                      <button
                        className="popover-act-btn add"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddNodeAfter(selNode.id);
                        }}
                        title="เพิ่มขั้นตอนต่อ"
                      >
                        ➕ เพิ่ม
                      </button>
                      <button
                        className="popover-act-btn del"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(selNode.id);
                          onSelectNode(null);
                        }}
                        title="ลบกล่องนี้"
                      >
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                </div>
              </foreignObject>
            );
          })()}
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
  const [viewMode, setViewMode] = useState<"flow" | "text">("flow");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const qa = useMemo(() => qaWorkflow(workflow), [workflow]);
  const failures = qa.filter((item) => item.level === "fail").length;
  const warnings = qa.filter((item) => item.level === "warning").length;
  const generatedText = useMemo(() => buildTextContent(workflow), [workflow]);

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
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "json") {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.workflow) {
          applyWorkflow(data.workflow);
          setFileName(file.name);
          setNotice(`นำเข้า Workflow จาก ${file.name} เรียบร้อยแล้ว`);
        } else {
          throw new Error("รูปแบบไฟล์ JSON ไม่รองรับ กรุณาใช้ไฟล์ที่ส่งออกจากระบบนี้");
        }
      } else {
        const text = await readManualFile(file);
        setManualText(text);
        setFileName(file.name);
        setNotice(`อ่าน ${file.name} แล้ว (${text.length.toLocaleString()} ตัวอักษร)`);
      }
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

  async function exportText() {
    setBusy("กำลังสร้างข้อความ (TXT)…");
    try {
      const txtBlob = buildTextBlob(workflow);
      downloadBlob(txtBlob, workflowFileName(workflow, "txt"));
      setNotice("ดาวน์โหลดไฟล์ข้อความ (TXT) สำเร็จแล้ว");
    } catch (error) {
      setNotice(`สร้างข้อความไม่สำเร็จ: ${error instanceof Error ? error.message : "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
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

  async function exportXlsx() {
    setBusy("กำลังสร้างไฟล์ Excel…");
    try {
      const blob = buildWorkbook(workflow);
      downloadBlob(blob, workflowFileName(workflow, "xlsx"));
      setNotice("ดาวน์โหลด Excel Data Model สำเร็จแล้ว");
    } catch (error) {
      setNotice(`สร้าง Excel ไม่สำเร็จ: ${error instanceof Error ? error.message : "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
    } finally {
      setBusy("");
    }
  }

  async function exportJson() {
    setBusy("กำลังสร้างไฟล์ JSON…");
    try {
      const blob = workflowJsonBlob(workflow);
      downloadBlob(blob, workflowFileName(workflow, "json"));
      setNotice("ดาวน์โหลด Canonical JSON สำเร็จแล้ว");
    } catch (error) {
      setNotice(`สร้าง JSON ไม่สำเร็จ: ${error instanceof Error ? error.message : "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
    } finally {
      setBusy("");
    }
  }

  async function exportPng() {
    setBusy("กำลังสร้างภาพ PNG…");
    try {
      if (!svgRef.current) throw new Error("ไม่พบโครงสร้าง SVG");
      const pngBlob = await svgToPng(svgRef.current);
      downloadBlob(pngBlob, workflowFileName(workflow, "png"));
      setNotice("ดาวน์โหลดภาพตรวจทาน PNG สำเร็จแล้ว");
    } catch (error) {
      setNotice(`สร้าง PNG ไม่สำเร็จ: ${error instanceof Error ? error.message : "ข้อผิดพลาดไม่ทราบสาเหตุ"}`);
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
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.json" hidden onChange={(event) => acceptFile(event.target.files?.[0])} />
            <button className={`drop-zone ${dragging ? "dragging" : ""}`} onClick={() => fileInputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}>
              <UploadCloud size={28} /><strong>วางไฟล์ที่นี่ หรือคลิกเพื่อเลือก</strong><span>PDF · DOCX · TXT · MD · JSON</span>
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
            <div className="stage-toolbar-top">
              <div className="workflow-title-block"><span className="workflow-id">{workflow.id}</span><div><input value={workflow.name} onChange={(event) => setWorkflow((current) => ({ ...current, name: event.target.value }))} aria-label="ชื่อ Workflow" /><small>วิเคราะห์แบบ {workflow.analysisMode === "pattern" ? "Pattern offline" : "ตัวอย่างระบบ"}</small></div></div>
              <div className="qa-summary"><span className={failures ? "qa-fail" : "qa-pass"}>{failures ? <AlertTriangle size={14} /> : <Check size={14} />}{failures ? `${failures} Fail` : "โครงสร้างผ่าน"}</span><span className="qa-warn">{warnings} จุดควรทบทวน</span></div>
            </div>
            <div className="stage-toolbar-bottom">
              <div className="mode-switcher">
                <button className={`mode-btn ${viewMode === "flow" ? "active" : ""}`} onClick={() => setViewMode("flow")} title="แสดงผลลัพธ์เป็นไดอะแกรม Flowchart"><GitBranch size={15} /> แปลง Text ➔ Flow (Diagram)</button>
                <button className={`mode-btn ${viewMode === "text" ? "active" : ""}`} onClick={() => setViewMode("text")} title="แสดงผลลัพธ์เป็นข้อความระเบียบปฏิบัติงาน SOP"><FileText size={15} /> แปลง Flow ➔ Text (SOP 15 หมวด)</button>
              </div>
            </div>
          </div>

          {viewMode === "flow" ? (
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
                  onUpdateEdge={updateEdge}
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
                      title="เปลี่ยนรูปแบบกล่อง"
                    >
                      {Object.entries(typeLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <select
                      value={
                        workflow.edges.find((e) => e.source === selectedNode.id || e.target === selectedNode.id)?.arrowHead || "end"
                      }
                      onChange={(e) => {
                        const newArrow = e.target.value as ArrowHeadType;
                        const connectedEdges = workflow.edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id);
                        connectedEdges.forEach((edge) => updateEdge(edge.id, { arrowHead: newArrow }));
                      }}
                      title="รูปแบบหัวลูกศรเส้นเชื่อม"
                    >
                      <option value="end">หัวลูกศร: ➔ ปลายทาง</option>
                      <option value="start">หัวลูกศร: ← ต้นทาง</option>
                      <option value="both">หัวลูกศร: ↔ สองทิศทาง</option>
                      <option value="none">หัวลูกศร: ― ไม่มีลูกศร</option>
                    </select>
                    <select
                      value={selectedNode.lane}
                      onChange={(e) => updateNode(selectedNode.id, { lane: e.target.value })}
                      title="ย้าย Swimlane"
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
                      title="รูปแบบเส้น"
                    >
                      <option value="solid">เส้นทึบ</option>
                      <option value="dash">เส้นประ</option>
                    </select>
                    <select
                      value={selectedEdge.arrowHead || "end"}
                      onChange={(e) => updateEdge(selectedEdge.id, { arrowHead: e.target.value as ArrowHeadType })}
                      title="รูปแบบหัวลูกศร"
                    >
                      <option value="end">หัวลูกศรปลายทาง (➔)</option>
                      <option value="start">หัวลูกศรต้นทาง (←)</option>
                      <option value="both">สองทิศทาง (↔)</option>
                      <option value="none">ไม่มีหัวลูกศร (―)</option>
                    </select>
                    <select
                      value={selectedEdge.sourceSide || "bottom"}
                      onChange={(e) => updateEdge(selectedEdge.id, { sourceSide: e.target.value as FlowEdge["sourceSide"] })}
                      title="ทิศทางออก (Source Side)"
                    >
                      <option value="bottom">ออก: ล่าง</option>
                      <option value="top">ออก: บน</option>
                      <option value="right">ออก: ขวา</option>
                      <option value="left">ออก: ซ้าย</option>
                    </select>
                    <select
                      value={selectedEdge.targetSide || "top"}
                      onChange={(e) => updateEdge(selectedEdge.id, { targetSide: e.target.value as FlowEdge["targetSide"] })}
                      title="ทิศทางเข้า (Target Side)"
                    >
                      <option value="top">เข้า: บน</option>
                      <option value="bottom">เข้า: ล่าง</option>
                      <option value="left">เข้า: ซ้าย</option>
                      <option value="right">เข้า: ขวา</option>
                    </select>
                    <input
                      type="color"
                      value={selectedEdge.color || "#165B40"}
                      onChange={(e) => updateEdge(selectedEdge.id, { color: e.target.value })}
                      style={{ width: "36px", padding: "2px", height: "30px", cursor: "pointer" }}
                      title="เลือกสีเส้น"
                    />
                    <button
                      className="add-next-btn"
                      onClick={() => {
                        updateEdge(selectedEdge.id, {
                          source: selectedEdge.target,
                          target: selectedEdge.source,
                        });
                      }}
                      title="สลับทิศทางเส้น"
                    >
                      ⇄ สลับทิศทาง
                    </button>
                    <button className="del-node-btn" onClick={() => { deleteEdge(selectedEdge.id); setSelectedEdgeId(null); }}>
                      <Trash2 size={14} /> ลบเส้นเชื่อม
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="panel text-panel">
              <div className="text-panel-heading">
                <div>
                  <small>LIVE TEXT CONVERTER (SOP GENERATOR)</small>
                  <h2>ข้อความระเบียบปฏิบัติงาน (SOP 15 หมวด)</h2>
                </div>
                <div className="text-view-actions">
                  <button
                    className="text-action-btn"
                    disabled={!generatedText}
                    onClick={() => {
                      if (!generatedText) return;
                      navigator.clipboard.writeText(generatedText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? <Check size={14} color="#155b40" /> : <Copy size={14} />}
                    {copied ? "คัดลอกแล้ว!" : "คัดลอกข้อความ"}
                  </button>
                  <button className="text-action-btn primary" disabled={!generatedText} onClick={exportText}>
                    <Download size={14} /> ดาวน์โหลด .TXT
                  </button>
                </div>
              </div>
              <div className="text-stage-area">
                <div className="text-view-card">
                  <div className="text-view-header">
                    <strong><FileText size={16} /> สรุปขั้นตอนจาก Flowchart เป็นเนื้อหาข้อความ</strong>
                    <small style={{ color: "#66776f" }}>อัปเดตอัตโนมัติตามโครงสร้าง Flowchart</small>
                  </div>
                  <textarea
                    className="text-view-textarea"
                    value={generatedText}
                    readOnly
                    placeholder="ยังไม่มีข้อมูลขั้นตอน กรุณาอัปโหลดไฟล์หรือวางข้อความทางด้านซ้ายแล้วกดวิเคราะห์..."
                    aria-label="ข้อความ SOP 15 หมวด"
                  />
                </div>
              </div>
            </div>
          )}

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
            <button className="export-option featured" onClick={exportZip} disabled={Boolean(busy)}><span className="export-icon"><PackageCheck size={20} /></span><span><b>ชุดส่งมอบ ZIP</b><small>DOCX · PPTX · XLSX · TXT · JSON · PNG · QA</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportDocx} disabled={Boolean(busy)}><span className="export-icon blue"><FileText size={20} /></span><span><b>เอกสาร Word (DOCX)</b><small>ระเบียบปฏิบัติงาน SOP 15 หมวด</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportText} disabled={Boolean(busy)}><span className="export-icon"><FileText size={20} /></span><span><b>เอกสารข้อความ (TXT)</b><small>สรุปกระบวนงานฉบับตัวอักษร</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportPptx} disabled={Boolean(busy)}><span className="export-icon purple"><Presentation size={20} /></span><span><b>PowerPoint แก้ไขได้</b><small>Shapes + bound Connectors</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportXlsx} disabled={Boolean(busy)}><span className="export-icon green"><FileSpreadsheet size={20} /></span><span><b>Excel Data Model</b><small>Workflow · Nodes · Edges · QA</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportJson} disabled={Boolean(busy)}><span className="export-icon amber"><FileJson size={20} /></span><span><b>Canonical JSON</b><small>นำเข้าโปรเจกต์อื่นได้</small></span><Download size={17} /></button>
            <button className="export-option" onClick={exportPng} disabled={Boolean(busy)}><span className="export-icon teal"><FileText size={20} /></span><span><b>ภาพตรวจทาน PNG</b><small>ความละเอียด 2×</small></span><Download size={17} /></button>
            <div className="connector-guarantee"><GitBranch size={18} /><div><b>Connector Guarantee</b><span>ระบบแก้ OOXML ให้ปลายเส้นยึด Source/Target Shape จริง เมื่อลากกล่องใน PowerPoint เส้นจะขยับตาม</span></div></div>
          </div>

          <div className="panel status-panel"><small>สถานะล่าสุด</small><p>{busy || notice}</p><div className="status-actions"><button onClick={clearData} title="ล้างข้อมูลทั้งหมด"><RotateCcw size={14} /> ล้างข้อมูล</button><button onClick={() => { setWorkflow(cloneWorkflow(sampleWorkflow)); setManualText(sampleWorkflow.sourceText); setFileName("ตัวอย่างระบบ"); setNotice("คืนค่าตัวอย่างแล้ว"); }} title="โหลดชุดตัวอย่าง"><RotateCcw size={14} /> คืนค่าตัวอย่าง</button><button onClick={analyze} title="วิเคราะห์ใหม่"><Play size={14} /> รันใหม่</button></div></div>
        </aside>
      </section>

      <footer><span>Manual-to-Flowchart Generator</span><span>ข้อมูลประมวลผลในเบราว์เซอร์ · เหมาะสำหรับรันบน localhost</span></footer>
    </main>
  );
}
