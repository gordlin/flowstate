/**
 * Classifier Agent
 *
 * Analyzes user behavior and generates customized transformation prompts.
 * The classifier doesn't just categorize - it creates specific instructions
 * for the content transformer based on observed user struggles.
 *
 * IMPORTANT: This classifier is AGGRESSIVE about detecting user struggles.
 * It's better to offer help to someone who doesn't need it than to miss
 * someone who is genuinely struggling.
 */

import { callLLM, parseJsonResponse } from './llm';
import { AGENT_PROMPTS } from './prompts';
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

/**
 * Pre-check: Quick heuristic that GUARANTEES we detect obvious struggles
 * before even calling the LLM. This ensures we never miss clear signals.
 */
function checkObviousStruggles(features: Features): { shouldHelp: boolean; signals: string[] } {
    const signals: string[] = [];

    // Any scroll reversal = user went back to re-read = confusion
    if (features.scroll_reversal_count >= 1) {
        signals.push(`${features.scroll_reversal_count} scroll reversal(s) - user re-read content`);
    }

    // Any long dwell = user got stuck
    if (features.long_dwell_count >= 1) {
        signals.push(`${features.long_dwell_count} long dwell(s) >5s - user got stuck on content`);
    }

    // Any text selection = user highlighting to understand
    if (features.text_selection_count >= 1) {
        signals.push(`${features.text_selection_count} text selection(s) - user highlighting to focus`);
    }

    // Check for rage clicks in events
    const rageClicks = features.events.filter(e => e.type === 'rage_click').length;
    if (rageClicks >= 1) {
        signals.push(`${rageClicks} rage click(s) - user frustrated`);
    }

    // Check for dead clicks
    const deadClicks = features.events.filter(e => e.type === 'dead_click').length;
    if (deadClicks >= 2) {
        signals.push(`${deadClicks} dead click(s) - user clicking non-interactive elements`);
    }

    return {
        shouldHelp: signals.length >= 1,  // Any signal = help needed
        signals
    };
}

export async function classifyUser(
    eventLog: string,
    features: Features
): Promise<ClassificationResult> {
    const prompts = AGENT_PROMPTS.classifier;

    // First, check obvious signals that MUST trigger help
    const preCheck = checkObviousStruggles(features);

    console.log('[Classifier] Pre-check signals:', preCheck.signals);
    console.log('[Classifier] Should definitely help:', preCheck.shouldHelp);

    // Build the prompt with actual data
    const humanPrompt = prompts.human
        .replace('{eventLog}', eventLog || 'No events recorded yet.')
        .replace('{totalEvents}', features.events.length.toString())
        .replace('{avgScrollSpeed}', (features.avg_scroll_speed * 1000).toFixed(0))
        .replace('{scrollReversals}', features.scroll_reversal_count.toString())
        .replace('{longDwells}', features.long_dwell_count.toString())
        .replace('{textSelections}', features.text_selection_count.toString())
        .replace('{headingRatio}', (features.heading_dwell_ratio * 100).toFixed(0))
        .replace('{avgDwellTime}', (features.avg_dwell_time / 1000).toFixed(1));

    console.log('[Classifier] Analyzing user behavior with LLM...');
    console.log('[Classifier] Events:', features.events.length);
    console.log('[Classifier] Metrics:', {
        scrollReversals: features.scroll_reversal_count,
        longDwells: features.long_dwell_count,
        textSelections: features.text_selection_count,
        avgDwellTime: (features.avg_dwell_time / 1000).toFixed(1) + 's'
    });

    try {
        const response = await callLLM(
            [
                { role: 'system', content: prompts.system },
                { role: 'user', content: humanPrompt }
            ],
            {
                model: 'google/gemini-2.5-flash-lite',  // Fast, reliable model
                temperature: 0.2,  // Low temperature for consistent detection
                maxTokens: 1024,
                jsonMode: true
            }
        );

        const result = parseJsonResponse<ClassificationResult>(response.content);

        if (!result) {
            console.error('[Classifier] Failed to parse response:', response.content);

            // If LLM failed but we have pre-check signals, still help the user
            if (preCheck.shouldHelp) {
                return createFallbackResult(preCheck.signals, features);
            }
            return createUndeterminedResult('Failed to parse LLM response');
        }

        // OVERRIDE: If our pre-check found signals but LLM said "no help needed",
        // force needsHelp to true. We trust the signals over the LLM.
        if (preCheck.shouldHelp && !result.needsHelp) {
            console.log('[Classifier] OVERRIDE: Pre-check signals detected, forcing needsHelp=true');
            result.needsHelp = true;
            result.confidence = Math.max(result.confidence, 0.7);
            result.observedBehaviors = [...preCheck.signals, ...(result.observedBehaviors || [])];

            // If no transformer prompt, create one from signals
            if (!result.transformerPrompt) {
                result.transformerPrompt = createTransformerPromptFromSignals(preCheck.signals, eventLog);
            }
        }

        console.log('[Classifier] Final result:', {
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

        // If LLM failed but we have pre-check signals, still help the user
        if (preCheck.shouldHelp) {
            return createFallbackResult(preCheck.signals, features);
        }
        return createUndeterminedResult(`Classification error: ${error}`);
    }
}

/**
 * Create a transformer prompt from detected signals when LLM fails
 */
function createTransformerPromptFromSignals(signals: string[], eventLog: string): string {
    const prompts: string[] = [];

    if (signals.some(s => s.includes('scroll reversal'))) {
        prompts.push('User scrolled back to re-read content - they are struggling to understand. Simplify and use bullet points.');
    }
    if (signals.some(s => s.includes('long dwell'))) {
        prompts.push('User got stuck on certain sections - break down complex content into smaller chunks.');
    }
    if (signals.some(s => s.includes('text selection'))) {
        prompts.push('User highlighted text to focus - define any jargon or technical terms in simple language.');
    }
    if (signals.some(s => s.includes('rage click') || s.includes('dead click'))) {
        prompts.push('User showed frustration - make the content clearer and highlight main actions prominently.');
    }

    // Try to extract specific sections from event log
    const dwellMatches = eventLog.match(/stopped at "([^"]+)"/g);
    if (dwellMatches && dwellMatches.length > 0) {
        const sections = dwellMatches.slice(0, 3).map(m => m.replace(/stopped at "|"/g, ''));
        prompts.push(`Focus especially on these sections the user struggled with: ${sections.join(', ')}`);
    }

    return prompts.join(' ');
}

/**
 * Create a fallback result when LLM fails but we detected obvious struggles
 */
function createFallbackResult(signals: string[], features: Features): ClassificationResult {
    // Scanner: Fast, frequent scrolling with few reversals - jumping around looking for something
    // Stumbler: Slower scrolling with reversals - small back-and-forth motions, struggling to understand
    const hasHighScrollSpeed = features.avg_scroll_speed > 0.8;
    const hasLowReversalRate = features.scroll_reversal_count <= 1;
    const isScanner = hasHighScrollSpeed && hasLowReversalRate;

    const cluster = isScanner ? 'scanner' : 'stumbler';
    const transformerPrompt = isScanner
        ? 'User is scanning rapidly, jumping around the page. Create an executive summary with clear section headers and bullet points. Make it easy to find specific information quickly.'
        : 'User is struggling to understand, scrolling back and forth in small motions. Simplify the language, define terms, and break down complex topics into step-by-step explanations.';

    return {
        needsHelp: true,
        cluster,
        confidence: 0.7,
        reasoning: `Detected user struggles via behavioral signals: ${signals.join('; ')}`,
        observedBehaviors: signals,
        problemAreas: ['Content comprehension'],
        transformerPrompt
    };
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
