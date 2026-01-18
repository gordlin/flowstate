import { ActionItem, ParsedActions, ReadabilityType } from "../parse";

// Communication log entry for tracking agent interactions
export interface CommunicationEntry {
  timestamp: number;
  fromAgent: AgentRole;
  toAgent: AgentRole | "state";
  action: "analyze" | "output" | "critique" | "decide" | "revise" | "approve";
  summary: string;
  details?: string;
}

export interface AgentState {
  // Input data
  pageContent: ReadabilityType;
  parsedActions: ParsedActions | null;
  rawHtml?: string;
  customPrompt?: string;  // Custom instructions from classifier agent

  // Navigator output
  identifiedCTAs: IdentifiedCTA[];
  pageStructure: PageStructure | null;

  // Security Sentinel output
  securityAnalysis: SecurityAnalysis | null;

  // Writer outputs (multiple perspectives)
  writerOutputs: WriterOutput[];

  // Arbiter output
  arbiterDecision: ArbiterDecision | null;

  // Guardian output
  qualityReport: QualityReport | null;
  needsRevision: boolean;
  revisionCount: number;
  revisionTarget?: AgentRole; // Which agent needs to revise

  // Final output
  finalSummary: string | null;

  // Logging & debugging
  communicationLog: CommunicationEntry[];
  errors: string[];
}

export interface IdentifiedCTA {
  label: string;
  purpose: string;
  importance: "critical" | "important" | "optional";
  elementType: string;
  originalAction: ActionItem;
}

export interface PageStructure {
  pageType:
    | "article"
    | "form"
    | "dashboard"
    | "checkout"
    | "login"
    | "settings"
    | "unknown";
  mainPurpose: string;
  sections: { title: string; summary: string }[];
  complexity: "simple" | "moderate" | "complex";
}

export interface SecurityAnalysis {
  riskLevel: "low" | "medium" | "high" | "critical";
  financialActions: FinancialAction[];
  dataCollectionWarnings: string[];
  darkPatterns: DarkPattern[];
  recommendations: string[];
}

export interface FinancialAction {
  action: string;
  description: string;
  risk: "low" | "medium" | "high";
  reversible: boolean;
  warning: string;
}

export interface DarkPattern {
  type:
    | "urgency"
    | "scarcity"
    | "misdirection"
    | "confirmshaming"
    | "hidden-cost"
    | "forced-continuity"
    | "other";
  description: string;
  location: string;
  severity: "minor" | "moderate" | "severe";
}

export interface WriterOutput {
  writerId: "compassionate" | "technical";
  title: string;
  summary: string;
  keyPoints: string[];
  legalNotes: LegalNote[];
  warnings: string[];
  tone: string;
  reasoning: string; // Why they wrote it this way
}

export interface LegalNote {
  original: string;
  simplified: string;
  importance: "high" | "medium" | "low";
}

export interface ArbiterDecision {
  chosenWriter: "compassionate" | "technical" | "merged";
  reasoning: string;
  mergedContent: {
    title: string;
    summary: string;
    keyPoints: string[];
    legalNotes: LegalNote[];
    warnings: string[];
  };
  disagreements: {
    topic: string;
    compassionateView: string;
    technicalView: string;
    resolution: string;
  }[];
}

export interface QualityReport {
  isComplete: boolean;
  missingCriticalInfo: string[];
  oversimplifications: string[];
  securityConcernsAddressed: boolean;
  accuracy: "high" | "medium" | "low";
  suggestions: string[];
  approved: boolean;
  revisionInstructions?: string;
}

export type AgentRole =
  | "navigator"
  | "security-sentinel"
  | "compassionate-writer"
  | "technical-writer"
  | "arbiter"
  | "guardian";
