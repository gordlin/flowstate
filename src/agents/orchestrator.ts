/**
 * FlowState Agent Orchestrator
 *
 * A lightweight, browser-compatible agent orchestration framework
 * implementing LangGraph-style patterns: state machines, nodes, edges,
 * conditional routing, and communication logging.
 */

import { AgentState, CommunicationEntry, AgentRole } from "./types";

// Node function type - takes state, returns partial state update
export type AgentNode = (state: AgentState) => Promise<Partial<AgentState>>;

// Condition function for routing
export type RouteCondition = (state: AgentState) => string;

// Edge definition
interface Edge {
  from: string;
  to: string | RouteCondition;
  condition?: RouteCondition;
}

// Graph definition
interface GraphDefinition {
  nodes: Map<string, AgentNode>;
  edges: Edge[];
  entryPoint: string;
}

/**
 * StateGraph - Browser-compatible implementation of LangGraph patterns
 */
export class StateGraph {
  private nodes: Map<string, AgentNode> = new Map();
  private edges: Edge[] = [];
  private conditionalEdges: Map<
    string,
    { condition: RouteCondition; routes: Record<string, string> }
  > = new Map();
  private entryPoint: string = "";

  /**
   * Add a node (agent) to the graph
   */
  addNode(name: string, fn: AgentNode): this {
    this.nodes.set(name, fn);
    return this;
  }

  /**
   * Set the entry point node
   */
  setEntryPoint(name: string): this {
    this.entryPoint = name;
    return this;
  }

  /**
   * Add a direct edge between nodes
   */
  addEdge(from: string, to: string): this {
    this.edges.push({ from, to });
    return this;
  }

  /**
   * Add conditional edges (routing based on state)
   */
  addConditionalEdges(
    from: string,
    condition: RouteCondition,
    routes: Record<string, string>,
  ): this {
    this.conditionalEdges.set(from, { condition, routes });
    return this;
  }

  /**
   * Compile and return a runnable graph
   */
  compile(): CompiledGraph {
    return new CompiledGraph(
      this.nodes,
      this.edges,
      this.conditionalEdges,
      this.entryPoint,
    );
  }
}

/**
 * CompiledGraph - Executable graph with state management
 */
export class CompiledGraph {
  private nodes: Map<string, AgentNode>;
  private edges: Edge[];
  private conditionalEdges: Map<
    string,
    { condition: RouteCondition; routes: Record<string, string> }
  >;
  private entryPoint: string;

  constructor(
    nodes: Map<string, AgentNode>,
    edges: Edge[],
    conditionalEdges: Map<
      string,
      { condition: RouteCondition; routes: Record<string, string> }
    >,
    entryPoint: string,
  ) {
    this.nodes = nodes;
    this.edges = edges;
    this.conditionalEdges = conditionalEdges;
    this.entryPoint = entryPoint;
  }

  /**
   * Get next node(s) after a given node
   */
  private getNextNodes(currentNode: string, state: AgentState): string[] {
    const nextNodes: string[] = [];

    // Check conditional edges first
    const conditional = this.conditionalEdges.get(currentNode);
    if (conditional) {
      const routeKey = conditional.condition(state);
      const nextNode = conditional.routes[routeKey];
      if (nextNode && nextNode !== "__end__") {
        nextNodes.push(nextNode);
      }
      return nextNodes;
    }

    // Check regular edges
    for (const edge of this.edges) {
      if (edge.from === currentNode) {
        if (typeof edge.to === "string" && edge.to !== "__end__") {
          nextNodes.push(edge.to);
        }
      }
    }

    return nextNodes;
  }

  /**
   * Merge partial state update into current state
   */
  private mergeState(
    current: AgentState,
    update: Partial<AgentState>,
  ): AgentState {
    return {
      ...current,
      ...update,
      // Special handling for arrays - concatenate instead of replace
      communicationLog: [
        ...current.communicationLog,
        ...(update.communicationLog || []),
      ],
      errors: [...current.errors, ...(update.errors || [])],
      // Merge writer outputs by ID
      writerOutputs: update.writerOutputs
        ? this.mergeWriterOutputs(current.writerOutputs, update.writerOutputs)
        : current.writerOutputs,
    };
  }

  /**
   * Merge writer outputs, avoiding duplicates
   */
  private mergeWriterOutputs(
    current: AgentState["writerOutputs"],
    update: AgentState["writerOutputs"],
  ): AgentState["writerOutputs"] {
    const merged = [...current];
    for (const output of update) {
      const existingIndex = merged.findIndex(
        (w) => w.writerId === output.writerId,
      );
      if (existingIndex >= 0) {
        merged[existingIndex] = output; // Replace with newer version
      } else {
        merged.push(output);
      }
    }
    return merged;
  }

  /**
   * Execute the graph with given initial state
   */
  async invoke(
    initialState: AgentState,
    options: {
      onNodeStart?: (node: string) => void;
      onNodeEnd?: (node: string, state: AgentState) => void;
    } = {},
  ): Promise<AgentState> {
    let state = { ...initialState };
    const visited = new Set<string>();
    const queue: string[] = [this.entryPoint];
    const maxIterations = 50; // Safety limit
    let iterations = 0;

    // Track which nodes have been executed in parallel groups
    const parallelGroups = new Map<string, Set<string>>();

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++;
      const currentNode = queue.shift()!;

      // Skip if already visited (unless it's a revision loop)
      const nodeKey = `${currentNode}-${state.revisionCount}`;
      if (visited.has(nodeKey) && !currentNode.includes("writer")) {
        continue;
      }
      visited.add(nodeKey);

      const nodeFn = this.nodes.get(currentNode);
      if (!nodeFn) {
        console.warn(`[Orchestrator] Unknown node: ${currentNode}`);
        continue;
      }

      // Execute node
      options.onNodeStart?.(currentNode);

      try {
        console.log(`[Orchestrator] Executing: ${currentNode}`);
        const update = await nodeFn(state);
        state = this.mergeState(state, update);

        options.onNodeEnd?.(currentNode, state);
      } catch (error) {
        console.error(`[Orchestrator] Error in ${currentNode}:`, error);
        state = this.mergeState(state, {
          errors: [`${currentNode} failed: ${error}`],
        });
      }

      // Determine next nodes
      const nextNodes = this.getNextNodes(currentNode, state);

      // Handle parallel execution (multiple writers)
      // If we're at security and both writers are next, we need special handling
      if (currentNode === "security" && nextNodes.length > 1) {
        // Execute writers in parallel
        const writerPromises = nextNodes
          .filter((n) => n.includes("writer"))
          .map(async (writerNode) => {
            const writerFn = this.nodes.get(writerNode);
            if (writerFn) {
              console.log(`[Orchestrator] Executing (parallel): ${writerNode}`);
              return writerFn(state);
            }
            return {};
          });

        const writerResults = await Promise.all(writerPromises);

        // Merge all writer results
        for (const result of writerResults) {
          state = this.mergeState(state, result);
        }

        // Add arbiter to queue (skip writers since we already ran them)
        const nonWriterNext = nextNodes.filter((n) => !n.includes("writer"));
        queue.push(...nonWriterNext);

        // After parallel writers, go to arbiter
        if (!queue.includes("arbiter")) {
          queue.push("arbiter");
        }
      } else {
        queue.push(...nextNodes);
      }
    }

    if (iterations >= maxIterations) {
      console.warn("[Orchestrator] Max iterations reached");
      state = this.mergeState(state, {
        errors: ["Orchestration max iterations reached"],
      });
    }

    return state;
  }
}

/**
 * Helper to create communication log entries
 */
export function createLogEntry(
  from: AgentRole,
  to: AgentRole | "state",
  action: CommunicationEntry["action"],
  summary: string,
  details?: string,
): CommunicationEntry {
  return {
    timestamp: Date.now(),
    fromAgent: from,
    toAgent: to,
    action,
    summary,
    details,
  };
}

/**
 * Format communication log for display
 */
export function formatCommunicationLog(log: CommunicationEntry[]): string {
  const lines: string[] = [
    "═".repeat(60),
    "           AGENT COMMUNICATION LOG",
    "═".repeat(60),
    "",
  ];

  let lastAgent = "";

  for (const entry of log) {
    const time = new Date(entry.timestamp)
      .toISOString()
      .split("T")[1]
      .split(".")[0];
    const arrow = entry.toAgent === "state" ? "→ 📋" : `→ ${entry.toAgent}`;

    if (entry.fromAgent !== lastAgent) {
      lines.push(`\n┌─ ${entry.fromAgent.toUpperCase()} ${"─".repeat(40)}`);
      lastAgent = entry.fromAgent;
    }

    const actionEmoji: Record<string, string> = {
      analyze: "🔍",
      output: "📤",
      critique: "⚠️",
      decide: "⚖️",
      revise: "🔄",
      approve: "✅",
    };

    lines.push(
      `│ [${time}] ${actionEmoji[entry.action] || "•"} ${entry.action.toUpperCase()} ${arrow}`,
    );
    lines.push(`│   ${entry.summary}`);
    if (entry.details) {
      const truncated =
        entry.details.length > 80
          ? entry.details.slice(0, 77) + "..."
          : entry.details;
      lines.push(`│   └─ ${truncated}`);
    }
  }

  lines.push("");
  lines.push("═".repeat(60));

  return lines.join("\n");
}

// Export END constant for graph termination
export const END = "__end__";
