/**
 * Browser-compatible LLM client using OpenRouter API
 */

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT = 60000; // 60 seconds for slower models

export interface LLMConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean; // Enable structured JSON output
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
  // Try Chrome storage (for extension)
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      const result = await chrome.storage.local.get(["openrouter_api_key"]);
      if (result.openrouter_api_key && typeof result.openrouter_api_key === "string") {
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

  // Hardcoded fallback for development
  const devKey = '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';
  if (devKey && devKey.startsWith("sk-or-")) return devKey;

  return null;
}

/**
 * Call OpenRouter API directly using fetch with timeout and structured output support
 */
export async function callLLM(
  messages: Message[],
  config: LLMConfig = {},
): Promise<LLMResponse> {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not found. Please set your API key in the extension settings.",
    );
  }

  // Use DeepSeek as default model
  const model = config.model || "google/gemini-2.5-flash-lite";
  const temperature = config.temperature ?? 0.3;
  const maxTokens = config.maxTokens ?? 4096;
  const jsonMode = config.jsonMode ?? true; // Default to JSON mode

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  // Build request body
  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  // Add JSON mode if enabled (structured output)
  if (jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  try {
    console.log(`[LLM] Calling ${model} with JSON mode: ${jsonMode}`);

    const response = await fetch(OPENROUTER_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://flowstate.app",
        "X-Title": "FlowState Accessibility Assistant",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");

      if (response.status === 401) {
        throw new Error(
          "Invalid API key. Please check your OpenRouter API key.",
        );
      } else if (response.status === 429) {
        throw new Error("Rate limited. Please wait a moment and try again.");
      } else if (response.status === 402) {
        throw new Error(
          "Insufficient credits. Please add credits to your OpenRouter account.",
        );
      } else {
        throw new Error(
          `API error (${response.status}): ${errorText.slice(0, 200)}`,
        );
      }
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message?.content) {
      console.error(
        "[LLM] Empty response:",
        JSON.stringify(data).slice(0, 500),
      );
      throw new Error("Empty response from API");
    }

    const content = data.choices[0].message.content;
    console.log(`[LLM] Response received (${content.length} chars)`);

    return {
      content,
      model: data.model || model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Request timed out. The AI is taking too long to respond.",
        );
      }
      throw error;
    }

    throw new Error(`Unexpected error: ${error}`);
  }
}

/**
 * Helper to safely parse JSON from LLM response
 * With structured outputs, the response should already be valid JSON
 */
export function parseJsonResponse<T>(response: string): T | null {
  try {
    // First, try direct parse (should work with JSON mode)
    return JSON.parse(response) as T;
  } catch {
    // Fallback: try to extract JSON from markdown code blocks
    try {
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1].trim()) as T;
      }
    } catch {
      // Continue to next fallback
    }

    // Fallback: try to find JSON object in the response
    try {
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]) as T;
      }
    } catch {
      // Continue
    }

    console.error("Failed to parse JSON response:", response.slice(0, 500));
    return null;
  }
}
