/**
 * Browser-compatible LLM client using OpenRouter API
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Get API key from various sources
 */
export async function getApiKey(): Promise<string | null> {
  // Try environment variable (for Node.js/build time)
  if (typeof process !== "undefined" && process.env?.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  // Try Chrome storage (for extension)
  if (typeof chrome !== "undefined" && chrome.storage) {
    try {
      const result = await chrome.storage.local.get(["openrouter_api_key"]);
      if (result.openrouter_api_key) {
        return result.openrouter_api_key;
      }
    } catch {
      // Not in extension context
    }
  }

  // Try localStorage (for web)
  if (typeof localStorage !== "undefined") {
    const key = localStorage.getItem("openrouter_api_key");
    if (key) return key;
  }

  // Hardcoded fallback for development (remove in production!)
  const devKey =
    "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";
  if (devKey) return devKey;

  return null;
}

/**
 * Call OpenRouter API directly using fetch
 */
export async function callLLM(
  messages: Message[],
  config: LLMConfig = {},
): Promise<LLMResponse> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not found. Set it in extension settings or localStorage.",
    );
  }

  const model = config.model || "deepseek/deepseek-v3.2";
  const temperature = config.temperature ?? 0.3;
  const maxTokens = config.maxTokens ?? 4096;

  const response = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://flowstate.app",
      "X-Title": "FlowState Accessibility Assistant",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      "reasoning": {"effort": "none"}
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model || model,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

/**
 * Helper to safely parse JSON from LLM response
 */
export function parseJsonResponse<T>(response: string): T | null {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();
    return JSON.parse(jsonStr) as T;
  } catch (e) {
    console.error("Failed to parse JSON response:", e);
    console.error("Raw response:", response.slice(0, 500));
    return null;
  }
}
