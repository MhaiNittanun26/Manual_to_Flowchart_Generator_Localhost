export type NodeType = "start" | "process" | "decision" | "document" | "end" | "note";
export type LineStyle = "solid" | "dash";

export interface FlowNode {
  id: string;
  text: string;
  originalText: string;
  lane: string;
  type: NodeType;
  documents: string;
  sourceRef: string;
  confidence: "high" | "medium" | "review";
  order: number;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  style: LineStyle;
  sourceSide: "top" | "right" | "bottom" | "left";
  targetSide: "top" | "right" | "bottom" | "left";
}

export interface Workflow {
  id: string;
  name: string;
  sourceFile: string;
  sourceText: string;
  lanes: string[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  createdAt: string;
  analysisMode: "pattern" | "ai" | "sample";
}

export interface QaItem {
  level: "pass" | "warning" | "fail";
  text: string;
}

export interface ExtractionPattern {
  actorKeywords: string[];
  decisionKeywords: string[];
  documentKeywords: string[];
  endKeywords: string[];
}
