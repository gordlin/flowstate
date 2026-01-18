/**
 * FlowState Agent Graph
 * Defines the multi-agent workflow using our browser-compatible orchestrator
 */

import { StateGraph, END, formatCommunicationLog } from "./orchestrator";
import { AgentState, CommunicationEntry } from "./types";
import {
  navigatorAgent,
  securitySentinelAgent,
  compassionateWriterAgent,
  technicalWriterAgent,
  arbiterAgent,
  guardianAgent,
  assembleOutput,
} from "./agents";
import { ParsedActions, ReadabilityType } from "../parse";

/**
 * Routing function: decides where to go after Guardian
 */
function routeAfterGuardian(state: AgentState): string {
  if (state.needsRevision && state.revisionCount < 3) {
    console.log(
      `[Router] Guardian requested revision (attempt ${state.revisionCount})`,
    );
    return "revise";
  }
  console.log("[Router] Guardian approved, proceeding to assembly");
  return "assemble";
}

/**
 * Creates the multi-agent workflow graph
 *
 * Flow:
 * 1. Navigator analyzes page structure
 * 2. Security Sentinel analyzes risks
 * 3. Both Writers run in parallel
 * 4. Arbiter merges their outputs
 * 5. Guardian reviews (may loop back)
 * 6. Assembly produces final output
 */
export function createSummaryGraph(): ReturnType<StateGraph["compile"]> {
  const workflow = new StateGraph();

  // Add all agent nodes
  workflow.addNode("navigator", navigatorAgent);
  workflow.addNode("security", securitySentinelAgent);
  workflow.addNode("compassionate_writer", compassionateWriterAgent);
  workflow.addNode("technical_writer", technicalWriterAgent);
  workflow.addNode("arbiter", arbiterAgent);
  workflow.addNode("guardian", guardianAgent);
  workflow.addNode("assemble", assembleOutput);

  // Define the flow
  workflow.setEntryPoint("navigator");

  // Navigator → Security
  workflow.addEdge("navigator", "security");

  // Security → Both Writers (handled specially in orchestrator for parallel execution)
  workflow.addEdge("security", "compassionate_writer");
  workflow.addEdge("security", "technical_writer");

  // Writers → Arbiter (orchestrator handles this after parallel execution)
  workflow.addEdge("compassionate_writer", "arbiter");
  workflow.addEdge("technical_writer", "arbiter");

  // Arbiter → Guardian
  workflow.addEdge("arbiter", "guardian");

  // Guardian → conditional (revise or finish)
  workflow.addConditionalEdges("guardian", routeAfterGuardian, {
    revise: "compassionate_writer", // Go back to writers for revision
    assemble: "assemble",
  });

  // Assemble → END
  workflow.addEdge("assemble", END);

  return workflow.compile();
}

/**
 * Create initial state from parsed content
 */
function createInitialState(
  pageContent: ReadabilityType,
  parsedActions: ParsedActions | null,
  customPrompt?: string,
): AgentState {
  return {
    pageContent,
    parsedActions,
    customPrompt: customPrompt || '',  // Custom instructions from classifier
    identifiedCTAs: [],
    pageStructure: null,
    securityAnalysis: null,
    writerOutputs: [],
    arbiterDecision: null,
    qualityReport: null,
    needsRevision: false,
    revisionCount: 0,
    finalSummary: null,
    communicationLog: [],
    errors: [],
  };
}

/**
 * Main entry point: Run the full summarization pipeline
 */
export async function summarizePage(
  pageContent: ReadabilityType,
  parsedActions: ParsedActions | null,
  options: {
    verbose?: boolean;
    customPrompt?: string;  // Custom instructions from the classifier
    onProgress?: (node: string, state: AgentState) => void;
  } = {},
): Promise<{
  summary: string;
  errors: string[];
  communicationLog: CommunicationEntry[];
  formattedLog: string;
}> {
  const graph = createSummaryGraph();
  const initialState = createInitialState(pageContent, parsedActions, options.customPrompt);

  console.log("[FlowState] Starting multi-agent summarization...");

  try {
    const result = await graph.invoke(initialState, {
      onNodeStart: (node) => {
        console.log(`[FlowState] Agent starting: ${node}`);
      },
      onNodeEnd: (node, state) => {
        console.log(`[FlowState] Agent completed: ${node}`);
        options.onProgress?.(node, state);
      },
    });

    const formattedLog = formatCommunicationLog(result.communicationLog || []);

    if (options.verbose) {
      console.log(formattedLog);
    }

    return {
      summary: result.finalSummary || "Failed to generate summary",
      errors: result.errors || [],
      communicationLog: result.communicationLog || [],
      formattedLog,
    };
  } catch (error) {
    console.error("[FlowState] Graph execution error:", error);
    return {
      summary: "An error occurred while summarizing the page.",
      errors: [`Graph execution error: ${error}`],
      communicationLog: [],
      formattedLog: "Error: Could not generate communication log",
    };
  }
}

// Re-export for convenience
export { formatCommunicationLog };
