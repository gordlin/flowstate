import {API_KEY} from './secrets.ts';

const OPENROUTER_API_KEY = API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
}

interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

export async function chat(
    messages: Message[],
    options: ChatOptions = {}
): Promise<string> {
    const {
        model = 'anthropic/claude-3-haiku',
        temperature = 0.3,
        maxTokens = 1024,
        jsonMode = false
    } = options;

    const response = await fetch(OPENROUTER_BASE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://flowstate.app',
            'X-Title': 'Flowstate'
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode && { response_format: { type: 'json_object' } })
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter error: ${response.status} ${error}`);
    }

    const data: OpenRouterResponse = await response.json();
    return data.choices[0].message.content;
}

// Convenience wrapper for single prompt
export async function prompt(
    userPrompt: string,
    options: ChatOptions = {}
): Promise<string> {
    return chat([{ role: 'user', content: userPrompt }], options);
}

// JSON response wrapper
export async function promptJSON<T>(
    userPrompt: string,
    options: ChatOptions = {}
): Promise<T> {
    const response = await chat(
        [{ role: 'user', content: userPrompt }],
        { ...options, jsonMode: true }
    );
    return JSON.parse(response);
}
