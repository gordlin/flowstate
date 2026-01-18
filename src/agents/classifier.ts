/**
 * Classifier Agent
 *
 * Analyzes user behavior and generates customized transformation prompts.
 * The classifier doesn't just categorize - it creates specific instructions
 * for the content transformer based on observed user struggles.
 */

import { callLLM, parseJsonResponse } from './llm';
import type { Features } from '../tracker';

export interface ClassificationResult {
    needsHelp: boolean;
    cluster: 'scanner' | 'stumbler' | 'undetermined';
    confidence: number;
    reasoning: string;
    observedBehaviors: string[];
    problemAreas: string[];
    transformerPrompt: string;  // Customized prompt for the summarizer
}

const CLASSIFIER_PROMPT = `You are a behavioral analyst for an accessibility tool. Your job is to:
1. Analyze user behavior on a webpage
2. Determine if they need help understanding the content
3. Generate SPECIFIC instructions for a content simplifier based on their exact struggles

## User Behavior Log (Timestamped)
{eventLog}

## Behavior Metrics
- Total events: {totalEvents}
- Average scroll speed: {avgScrollSpeed}px/s
- Scroll reversals (going back to re-read): {scrollReversals}
- Long dwells (>5s on one area): {longDwells}
- Text selections (highlighting): {textSelections}
- Heading vs content dwell ratio: {headingRatio}%
- Average dwell time: {avgDwellTime}s

## Your Task

Analyze the behavior log carefully. Look for:
- **Specific sections** where the user struggled (dwelled long, scrolled back to)
- **Specific words/phrases** they highlighted (indicates confusion)
- **Patterns** like repeated scrolling between sections (comparing content)
- **Frustration signals** like rage clicks or dead clicks

Based on your analysis, generate a CUSTOMIZED prompt for the content simplifier that addresses THIS USER's specific needs.

### Examples of good transformer prompts:

**Example 1** (user kept scrolling back to "Terms of Service" section):
"Focus heavily on explaining the Terms of Service section in simple language. The user revisited this section 4 times. Break down any legal jargon. Use bullet points for obligations and rights."

**Example 2** (user highlighted medical terms):
"The user highlighted 'anaphylaxis' and 'contraindications'. Define these medical terms using everyday analogies. The user also dwelled on the dosage section - create a simple dosage chart or summary."

**Example 3** (fast scanner who skipped everything):
"User is scanning quickly - they want the bottom line only. Create an executive summary with: 1) Main action required 2) Key deadline if any 3) Cost/commitment 4) How to opt out. No fluff."

## Response Format
Return ONLY valid JSON:
{
    "needsHelp": true/false,
    "cluster": "scanner" | "stumbler" | "undetermined",
    "confidence": 0.0-1.0,
    "reasoning": "Why you classified this way, citing specific behaviors",
    "observedBehaviors": ["behavior 1", "behavior 2", ...],
    "problemAreas": ["Section or element they struggled with", ...],
    "transformerPrompt": "Detailed, specific instructions for the content simplifier based on THIS user's exact struggles. Reference specific sections/words from the behavior log. Be prescriptive about what to emphasize, simplify, or explain."
}

If needsHelp is false, set transformerPrompt to empty string.
If there's not enough data, set needsHelp to false and cluster to "undetermined".`;

export async function classifyUser(
    eventLog: string,
    features: Features
): Promise<ClassificationResult> {
    // Build the prompt with actual data
    const prompt = CLASSIFIER_PROMPT
        .replace('{eventLog}', eventLog || 'No events recorded yet.')
        .replace('{totalEvents}', features.events.length.toString())
        .replace('{avgScrollSpeed}', (features.avg_scroll_speed * 1000).toFixed(0))
        .replace('{scrollReversals}', features.scroll_reversal_count.toString())
        .replace('{longDwells}', features.long_dwell_count.toString())
        .replace('{textSelections}', features.text_selection_count.toString())
        .replace('{headingRatio}', (features.heading_dwell_ratio * 100).toFixed(0))
        .replace('{avgDwellTime}', (features.avg_dwell_time / 1000).toFixed(1));

    console.log('[Classifier] Analyzing user behavior...');
    console.log('[Classifier] Events:', features.events.length);
    console.log('[Classifier] Event log preview:', eventLog.slice(0, 500));

    try {
        const response = await callLLM(
            [{ role: 'user', content: prompt }],
            {
                model: 'deepseek/deepseek-chat',
                temperature: 0.3,
                maxTokens: 1024,
                jsonMode: true
            }
        );

        const result = parseJsonResponse<ClassificationResult>(response.content);

        if (!result) {
            console.error('[Classifier] Failed to parse response:', response.content);
            return createUndeterminedResult('Failed to parse LLM response');
        }

        console.log('[Classifier] Result:', {
            needsHelp: result.needsHelp,
            cluster: result.cluster,
            confidence: result.confidence,
            problemAreas: result.problemAreas,
            transformerPromptLength: result.transformerPrompt?.length || 0
        });

        if (result.transformerPrompt) {
            console.log('[Classifier] Transformer prompt:', result.transformerPrompt);
        }

        return result;

    } catch (error) {
        console.error('[Classifier] Error:', error);
        return createUndeterminedResult(`Classification error: ${error}`);
    }
}

function createUndeterminedResult(reasoning: string): ClassificationResult {
    return {
        needsHelp: false,
        cluster: 'undetermined',
        confidence: 0,
        reasoning,
        observedBehaviors: [],
        problemAreas: [],
        transformerPrompt: ''
    };
}
