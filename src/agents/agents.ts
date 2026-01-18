/**
 * FlowState Agent Implementations
 * Browser-compatible agents using direct API calls
 */

import { callLLM, parseJsonResponse, Message } from "./llm";
import { createLogEntry } from "./orchestrator";
import { AGENT_PROMPTS } from "./prompts";
import {
  AgentState,
  IdentifiedCTA,
  PageStructure,
  SecurityAnalysis,
  WriterOutput,
  ArbiterDecision,
  QualityReport,
  CommunicationEntry,
} from "./types";

// Helper to format actions for prompts
function formatActions(state: AgentState): string {
  if (!state.parsedActions) return "No actions detected";

  const { primaryActions, actions } = state.parsedActions;
  const relevantActions =
    primaryActions.length > 0 ? primaryActions : actions.slice(0, 20);

  return relevantActions
    .map(
      (a) =>
        `- [${a.type}] "${a.label}" ${a.href ? `→ ${a.href}` : ""} ${a.disabled ? "(disabled)" : ""} [${a.importance}]`,
    )
    .join("\n");
}

function formatCTAs(ctas: IdentifiedCTA[]): string {
  return ctas
    .map((c) => `- "${c.label}" [${c.importance}]: ${c.purpose}`)
    .join("\n");
}

/**
 * Navigator Agent: Analyzes page structure and identifies CTAs
 */
export async function navigatorAgent(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const prompts = AGENT_PROMPTS.navigator;

  const humanPrompt = prompts.human
    .replace("{title}", state.pageContent.title || "Untitled")
    .replace("{content}", state.pageContent.textContent?.slice(0, 8000) || "")
    .replace("{actions}", formatActions(state));

  const logs: CommunicationEntry[] = [
    createLogEntry(
      "navigator",
      "state",
      "analyze",
      "Beginning page structure analysis",
      `Analyzing page: ${state.pageContent.title || "Untitled"}`,
    ),
  ];

  try {
    const messages: Message[] = [
      { role: "system", content: prompts.system },
      { role: "user", content: humanPrompt },
    ];

    const response = await callLLM(messages, { temperature: 0.2 });
    const parsed = parseJsonResponse<{
      pageType: PageStructure["pageType"];
      mainPurpose: string;
      complexity: PageStructure["complexity"];
      sections: { title: string; summary: string }[];
      identifiedCTAs: Omit<IdentifiedCTA, "originalAction">[];
    }>(response.content);

    if (!parsed) {
      logs.push(
        createLogEntry(
          "navigator",
          "state",
          "output",
          "Failed to parse response",
          response.content.slice(0, 200),
        ),
      );
      return {
        communicationLog: logs,
        errors: ["Navigator failed to parse response"],
      };
    }

    // Match identified CTAs back to original actions
    const identifiedCTAs: IdentifiedCTA[] = parsed.identifiedCTAs.map((cta) => {
      const matchingAction = state.parsedActions?.actions.find(
        (a) =>
          a.label.toLowerCase().includes(cta.label.toLowerCase()) ||
          cta.label.toLowerCase().includes(a.label.toLowerCase()),
      );
      return {
        ...cta,
        originalAction: matchingAction || {
          type: "button" as const,
          label: cta.label,
          disabled: false,
          importance: "unknown" as const,
        },
      };
    });

    logs.push(
      createLogEntry(
        "navigator",
        "security-sentinel",
        "output",
        `Identified ${identifiedCTAs.length} CTAs, page type: ${parsed.pageType}`,
        `Complexity: ${parsed.complexity}, Purpose: ${parsed.mainPurpose}`,
      ),
    );

    return {
      pageStructure: {
        pageType: parsed.pageType,
        mainPurpose: parsed.mainPurpose,
        complexity: parsed.complexity,
        sections: parsed.sections,
      },
      identifiedCTAs,
      communicationLog: logs,
    };
  } catch (error) {
    logs.push(
      createLogEntry("navigator", "state", "output", `Error: ${error}`),
    );
    return {
      communicationLog: logs,
      errors: [`Navigator error: ${error}`],
    };
  }
}

/**
 * Security Sentinel Agent: Analyzes risks and dark patterns
 */
export async function securitySentinelAgent(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const prompts = AGENT_PROMPTS.securitySentinel;

  const humanPrompt = prompts.human
    .replace("{pageStructure}", JSON.stringify(state.pageStructure, null, 2))
    .replace("{content}", state.pageContent.textContent?.slice(0, 8000) || "")
    .replace("{actions}", formatCTAs(state.identifiedCTAs));

  const logs: CommunicationEntry[] = [
    createLogEntry(
      "security-sentinel",
      "state",
      "analyze",
      "Beginning security analysis",
      `Analyzing ${state.identifiedCTAs.length} actions for risks`,
    ),
  ];

  try {
    const messages: Message[] = [
      { role: "system", content: prompts.system },
      { role: "user", content: humanPrompt },
    ];

    const response = await callLLM(messages, { temperature: 0.1 });
    const parsed = parseJsonResponse<SecurityAnalysis>(response.content);

    if (!parsed) {
      logs.push(
        createLogEntry(
          "security-sentinel",
          "state",
          "output",
          "Failed to parse security analysis",
        ),
      );
      return {
        communicationLog: logs,
        securityAnalysis: {
          riskLevel: "medium",
          financialActions: [],
          dataCollectionWarnings: [],
          darkPatterns: [],
          recommendations: [
            "Unable to complete security analysis - proceed with caution",
          ],
        },
      };
    }

    logs.push(
      createLogEntry(
        "security-sentinel",
        "compassionate-writer",
        "output",
        `Security analysis complete. Risk level: ${parsed.riskLevel}`,
        `Found ${parsed.darkPatterns.length} dark patterns, ${parsed.financialActions.length} financial actions`,
      ),
    );

    return {
      securityAnalysis: parsed,
      communicationLog: logs,
    };
  } catch (error) {
    logs.push(
      createLogEntry("security-sentinel", "state", "output", `Error: ${error}`),
    );
    return {
      communicationLog: logs,
      errors: [`Security Sentinel error: ${error}`],
    };
  }
}

/**
 * Compassionate Writer Agent: Warm, reassuring summaries
 */
export async function compassionateWriterAgent(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const prompts = AGENT_PROMPTS.compassionateWriter;

  const humanPrompt = prompts.human
    .replace("{purpose}", state.pageStructure?.mainPurpose || "Unknown")
    .replace("{pageType}", state.pageStructure?.pageType || "unknown")
    .replace("{complexity}", state.pageStructure?.complexity || "moderate")
    .replace(
      "{securityAnalysis}",
      JSON.stringify(state.securityAnalysis, null, 2),
    )
    .replace("{content}", state.pageContent.textContent?.slice(0, 6000) || "")
    .replace("{ctas}", formatCTAs(state.identifiedCTAs));

  const logs: CommunicationEntry[] = [
    createLogEntry(
      "compassionate-writer",
      "state",
      "analyze",
      "Crafting compassionate summary",
      `Page complexity: ${state.pageStructure?.complexity}, Risk: ${state.securityAnalysis?.riskLevel}`,
    ),
  ];

  try {
    const messages: Message[] = [
      { role: "system", content: prompts.system },
      { role: "user", content: humanPrompt },
    ];

    const response = await callLLM(messages, { temperature: 0.5 });
    const parsed = parseJsonResponse<Omit<WriterOutput, "writerId">>(
      response.content,
    );

    if (!parsed) {
      logs.push(
        createLogEntry(
          "compassionate-writer",
          "state",
          "output",
          "Failed to generate compassionate summary",
        ),
      );
      return {
        communicationLog: logs,
        errors: ["Compassionate Writer failed to parse response"],
      };
    }

    const writerOutput: WriterOutput = { ...parsed, writerId: "compassionate" };

    logs.push(
      createLogEntry(
        "compassionate-writer",
        "arbiter",
        "output",
        `Completed compassionate summary: "${parsed.title}"`,
        `Tone: ${parsed.tone}. Reasoning: ${parsed.reasoning}`,
      ),
    );

    return {
      writerOutputs: [writerOutput],
      communicationLog: logs,
    };
  } catch (error) {
    logs.push(
      createLogEntry(
        "compassionate-writer",
        "state",
        "output",
        `Error: ${error}`,
      ),
    );
    return {
      communicationLog: logs,
      errors: [`Compassionate Writer error: ${error}`],
    };
  }
}

/**
 * Technical Writer Agent: Precise, efficient summaries
 */
export async function technicalWriterAgent(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const prompts = AGENT_PROMPTS.technicalWriter;

  const humanPrompt = prompts.human
    .replace("{purpose}", state.pageStructure?.mainPurpose || "Unknown")
    .replace("{pageType}", state.pageStructure?.pageType || "unknown")
    .replace("{complexity}", state.pageStructure?.complexity || "moderate")
    .replace(
      "{securityAnalysis}",
      JSON.stringify(state.securityAnalysis, null, 2),
    )
    .replace("{content}", state.pageContent.textContent?.slice(0, 6000) || "")
    .replace("{ctas}", formatCTAs(state.identifiedCTAs));

  const logs: CommunicationEntry[] = [
    createLogEntry(
      "technical-writer",
      "state",
      "analyze",
      "Crafting technical summary",
      `Page type: ${state.pageStructure?.pageType}`,
    ),
  ];

  try {
    const messages: Message[] = [
      { role: "system", content: prompts.system },
      { role: "user", content: humanPrompt },
    ];

    const response = await callLLM(messages, { temperature: 0.2 });
    const parsed = parseJsonResponse<Omit<WriterOutput, "writerId">>(
      response.content,
    );

    if (!parsed) {
      logs.push(
        createLogEntry(
          "technical-writer",
          "state",
          "output",
          "Failed to generate technical summary",
        ),
      );
      return {
        communicationLog: logs,
        errors: ["Technical Writer failed to parse response"],
      };
    }

    const writerOutput: WriterOutput = { ...parsed, writerId: "technical" };

    logs.push(
      createLogEntry(
        "technical-writer",
        "arbiter",
        "output",
        `Completed technical summary: "${parsed.title}"`,
        `Tone: ${parsed.tone}. Reasoning: ${parsed.reasoning}`,
      ),
    );

    return {
      writerOutputs: [writerOutput],
      communicationLog: logs,
    };
  } catch (error) {
    logs.push(
      createLogEntry("technical-writer", "state", "output", `Error: ${error}`),
    );
    return {
      communicationLog: logs,
      errors: [`Technical Writer error: ${error}`],
    };
  }
}

/**
 * Arbiter Agent: Evaluates and merges writer outputs
 */
export async function arbiterAgent(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const prompts = AGENT_PROMPTS.arbiter;

  const compassionateOutput = state.writerOutputs.find(
    (w) => w.writerId === "compassionate",
  );
  const technicalOutput = state.writerOutputs.find(
    (w) => w.writerId === "technical",
  );

  if (!compassionateOutput || !technicalOutput) {
    return {
      errors: ["Arbiter missing writer outputs"],
      communicationLog: [
        createLogEntry(
          "arbiter",
          "state",
          "output",
          "Missing writer outputs - cannot arbitrate",
        ),
      ],
    };
  }

  const humanPrompt = prompts.human
    .replace("{pageType}", state.pageStructure?.pageType || "unknown")
    .replace("{purpose}", state.pageStructure?.mainPurpose || "Unknown")
    .replace("{riskLevel}", state.securityAnalysis?.riskLevel || "unknown")
    .replace("{complexity}", state.pageStructure?.complexity || "moderate")
    .replace(
      "{compassionateOutput}",
      JSON.stringify(compassionateOutput, null, 2),
    )
    .replace("{technicalOutput}", JSON.stringify(technicalOutput, null, 2))
    .replace(
      "{securityAnalysis}",
      JSON.stringify(state.securityAnalysis, null, 2),
    );

  const logs: CommunicationEntry[] = [
    createLogEntry(
      "arbiter",
      "state",
      "analyze",
      "Evaluating writer outputs",
      `Comparing compassionate ("${compassionateOutput.title}") vs technical ("${technicalOutput.title}")`,
    ),
  ];

  try {
    const messages: Message[] = [
      { role: "system", content: prompts.system },
      { role: "user", content: humanPrompt },
    ];

    const response = await callLLM(messages, { temperature: 0.3 });
    const parsed = parseJsonResponse<ArbiterDecision>(response.content);

    if (!parsed) {
      logs.push(
        createLogEntry(
          "arbiter",
          "state",
          "output",
          "Failed to parse arbiter decision",
        ),
      );
      return {
        communicationLog: logs,
        errors: ["Arbiter failed to parse response"],
      };
    }

    logs.push(
      createLogEntry(
        "arbiter",
        "guardian",
        "decide",
        `Decision: ${parsed.chosenWriter}. ${parsed.disagreements.length} disagreements resolved.`,
        parsed.reasoning,
      ),
    );

    // Log each disagreement resolution
    parsed.disagreements.forEach((d, i) => {
      logs.push(
        createLogEntry(
          "arbiter",
          "state",
          "decide",
          `Disagreement ${i + 1}: ${d.topic}`,
          `Resolution: ${d.resolution}`,
        ),
      );
    });

    return {
      arbiterDecision: parsed,
      communicationLog: logs,
    };
  } catch (error) {
    logs.push(createLogEntry("arbiter", "state", "output", `Error: ${error}`));
    return {
      communicationLog: logs,
      errors: [`Arbiter error: ${error}`],
    };
  }
}

/**
 * Guardian Agent: Final QA with potential revision loop
 */
export async function guardianAgent(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const prompts = AGENT_PROMPTS.guardian;

  if (!state.arbiterDecision) {
    return {
      errors: ["Guardian missing arbiter decision"],
      needsRevision: false,
    };
  }

  const humanPrompt = prompts.human
    .replace(
      "{originalContent}",
      state.pageContent.textContent?.slice(0, 6000) || "",
    )
    .replace(
      "{securityAnalysis}",
      JSON.stringify(state.securityAnalysis, null, 2),
    )
    .replace("{ctas}", formatCTAs(state.identifiedCTAs))
    .replace(
      "{finalContent}",
      JSON.stringify(state.arbiterDecision.mergedContent, null, 2),
    )
    .replace("{arbiterReasoning}", state.arbiterDecision.reasoning);

  const logs: CommunicationEntry[] = [
    createLogEntry(
      "guardian",
      "state",
      "analyze",
      `Quality review (attempt ${state.revisionCount + 1})`,
      `Reviewing arbiter's ${state.arbiterDecision.chosenWriter} decision`,
    ),
  ];

  try {
    const messages: Message[] = [
      { role: "system", content: prompts.system },
      { role: "user", content: humanPrompt },
    ];

    const response = await callLLM(messages, { temperature: 0.1 });
    const parsed = parseJsonResponse<QualityReport>(response.content);

    if (!parsed) {
      logs.push(
        createLogEntry(
          "guardian",
          "state",
          "output",
          "Failed to parse quality report - approving with caution",
        ),
      );
      return {
        communicationLog: logs,
        qualityReport: {
          isComplete: true,
          missingCriticalInfo: [],
          oversimplifications: [],
          securityConcernsAddressed: true,
          accuracy: "medium",
          suggestions: [],
          approved: true,
        },
        needsRevision: false,
      };
    }

    const needsRevision = !parsed.approved && state.revisionCount < 2;

    if (parsed.approved) {
      logs.push(
        createLogEntry(
          "guardian",
          "state",
          "approve",
          `✓ Approved. Accuracy: ${parsed.accuracy}`,
          parsed.suggestions.length > 0
            ? `Minor suggestions: ${parsed.suggestions.join("; ")}`
            : undefined,
        ),
      );
    } else {
      logs.push(
        createLogEntry(
          "guardian",
          needsRevision ? "arbiter" : "state",
          "critique",
          `✗ Not approved. Issues: ${parsed.missingCriticalInfo.length} missing, ${parsed.oversimplifications.length} oversimplified`,
          parsed.revisionInstructions,
        ),
      );
    }

    return {
      qualityReport: parsed,
      needsRevision,
      revisionCount: state.revisionCount + 1,
      communicationLog: logs,
    };
  } catch (error) {
    logs.push(createLogEntry("guardian", "state", "output", `Error: ${error}`));
    return {
      communicationLog: logs,
      errors: [`Guardian error: ${error}`],
      needsRevision: false,
    };
  }
}

/**
 * Final assembly: Combines all agent outputs into user-friendly summary
 */
export function assembleOutput(state: AgentState): Partial<AgentState> {
  const logs: CommunicationEntry[] = [
    createLogEntry(
      "guardian",
      "state",
      "output",
      "Assembling final output",
      `Total communication entries: ${state.communicationLog.length}`,
    ),
  ];

  if (!state.arbiterDecision?.mergedContent) {
    return {
      finalSummary: "Unable to generate summary. Please try again.",
      communicationLog: logs,
    };
  }

  const { mergedContent } = state.arbiterDecision;
  const { securityAnalysis, identifiedCTAs, qualityReport } = state;

  const sections: string[] = [];

  // Title and summary
  sections.push(`# ${mergedContent.title}`);
  sections.push(mergedContent.summary);

  // Security banner if high risk
  if (
    securityAnalysis &&
    (securityAnalysis.riskLevel === "high" ||
      securityAnalysis.riskLevel === "critical")
  ) {
    sections.push(
      `\n> ⚠️ **${securityAnalysis.riskLevel.toUpperCase()} RISK**: Please read carefully before proceeding.`,
    );
  }

  // Key points
  if (mergedContent.keyPoints.length > 0) {
    sections.push("\n## What You Need to Know");
    sections.push(mergedContent.keyPoints.map((p) => `• ${p}`).join("\n"));
  }

  // Financial actions (from security analysis)
  if (securityAnalysis?.financialActions.length) {
    sections.push("\n## 💰 Financial Actions");
    securityAnalysis.financialActions.forEach((fa) => {
      const reversibleNote = fa.reversible
        ? "✓ Can be undone"
        : "⚠️ Cannot be undone";
      sections.push(`• **${fa.action}** - ${fa.warning} (${reversibleNote})`);
    });
  }

  // Dark patterns warning
  if (securityAnalysis?.darkPatterns.length) {
    const severePatterns = securityAnalysis.darkPatterns.filter(
      (p) => p.severity === "severe",
    );
    if (severePatterns.length > 0) {
      sections.push("\n## ⚠️ Watch Out For");
      severePatterns.forEach((dp) => {
        sections.push(`• **${dp.type}**: ${dp.description}`);
      });
    }
  }

  // Important actions
  const criticalCTAs = identifiedCTAs.filter(
    (c) => c.importance === "critical",
  );
  if (criticalCTAs.length > 0) {
    sections.push("\n## Main Actions");
    criticalCTAs.forEach((cta) => {
      sections.push(`• **${cta.label}**: ${cta.purpose}`);
    });
  }

  // Warnings
  if (mergedContent.warnings.length > 0) {
    sections.push("\n## ⚠️ Important Warnings");
    sections.push(mergedContent.warnings.map((w) => `• ${w}`).join("\n"));
  }

  // Legal notes
  const highImportanceLegal = mergedContent.legalNotes.filter(
    (n) => n.importance === "high",
  );
  if (highImportanceLegal.length > 0) {
    sections.push("\n## Fine Print (Simplified)");
    highImportanceLegal.forEach((note) => {
      sections.push(`• ${note.simplified}`);
    });
  }

  // Quality indicator
  if (qualityReport && !qualityReport.approved) {
    sections.push("\n---");
    sections.push(
      "*Note: This summary may be incomplete. Please review the original page carefully.*",
    );
  }

  return {
    finalSummary: sections.join("\n"),
    communicationLog: logs,
  };
}
