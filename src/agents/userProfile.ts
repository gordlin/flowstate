/**
 * User Profile Metrics System
 *
 * Tracks and adapts user behavior metrics over time to personalize content simplification.
 * Metrics start at baseline 0.5 and converge after sufficient usage (~20 sessions).
 *
 * Uses exponential moving average with decreasing learning rate:
 * - Early sessions: High learning rate (0.3) for quick adaptation
 * - Later sessions: Low learning rate (0.05) for stability
 */

import type { Features } from '../tracker';

// Storage key for persisting metrics
const STORAGE_KEY = 'flowstate-user-metrics';

export interface UserMetrics {
  /**
   *Attentiveness: How well the user maintains focus from 0.0 - 1.0
  **/
  attentiveness: number;

  /**
   * Reading Speed: How quickly the user processes content from 0.0 - 1.0
   */
  readingSpeed: number;

  /**
   * Comprehension: How easily the user understands content from 0.0 - 1.0
   */
  comprehension: number;

  /**
   * Patience: How much detail the user tolerates from 0.0 - 1.0
   */
  patience: number;

  /**
   * Technical Familiarity: Comfort with complex/technical content from 0.0 - 1.0
   */
  technicalFamiliarity: number;

  /**
   * Session count for convergence calculation
   */
  sessionCount: number;

  /**
   * Timestamp of last update
   */
  lastUpdated: number;

  /**
   * Running averages for more stable calculations
   */
  _observations: {
    avgDwellTime: number;
    avgScrollSpeed: number;
    reversalRate: number;
    selectionRate: number;
    frustrationRate: number;
  };
}

/**
 * Default baseline metrics (all start at 0.5)
 */
const DEFAULT_METRICS: UserMetrics = {
  attentiveness: 0.5,
  readingSpeed: 0.5,
  comprehension: 0.5,
  patience: 0.5,
  technicalFamiliarity: 0.5,
  sessionCount: 0,
  lastUpdated: Date.now(),
  _observations: {
    avgDwellTime: 3000,      // 3 seconds baseline
    avgScrollSpeed: 0.5,     // px/ms baseline
    reversalRate: 0.1,       // 10% reversal baseline
    selectionRate: 0.05,     // 5% selection baseline
    frustrationRate: 0.05,   // 5% frustration baseline
  },
};

/**
 * Load user metrics from storage
 */
export function loadUserMetrics(): UserMetrics {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as UserMetrics;
      // Validate and merge with defaults for any missing fields
      return {
        ...DEFAULT_METRICS,
        ...parsed,
        _observations: {
          ...DEFAULT_METRICS._observations,
          ...parsed._observations,
        },
      };
    }
  } catch (error) {
    console.error('[UserProfile] Failed to load metrics:', error);
  }
  return { ...DEFAULT_METRICS };
}

/**
 * Save user metrics to storage
 */
export function saveUserMetrics(metrics: UserMetrics): void {
  try {
    metrics.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
    console.log('[UserProfile] Metrics saved:', formatMetricsForLog(metrics));
  } catch (error) {
    console.error('[UserProfile] Failed to save metrics:', error);
  }
}

/**
 * Calculate learning rate based on session count
 * Decreases over time for convergence:
 * - Session 1: α = 0.30 (high learning)
 * - Session 10: α = 0.15 (moderate)
 * - Session 20+: α = 0.05 (converged)
 */
function getLearningRate(sessionCount: number): number {
  const CONVERGENCE_SESSIONS = 20;
  const MAX_ALPHA = 0.30;
  const MIN_ALPHA = 0.05;

  const progress = Math.min(sessionCount / CONVERGENCE_SESSIONS, 1.0);
  return MAX_ALPHA - (MAX_ALPHA - MIN_ALPHA) * progress;
}

/**
 * Clamp a value between 0 and 1
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Exponential moving average update
 */
function ema(current: number, observation: number, alpha: number): number {
  return clamp(current * (1 - alpha) + observation * alpha);
}

/**
 * Update user metrics based on observed behavior features
 * Call this at the end of each session or periodically
 */
export function updateUserMetrics(
  currentMetrics: UserMetrics,
  features: Features,
  sessionDuration: number // in milliseconds
): UserMetrics {
  const metrics = { ...currentMetrics };
  const alpha = getLearningRate(metrics.sessionCount);

  console.log(`[UserProfile] Updating metrics (session ${metrics.sessionCount + 1}, α=${alpha.toFixed(3)})`);

  // Extract behavior signals from features
  const dwellEvents = features.events.filter(e => e.type === 'dwell');
  const scrollEvents = features.events.filter(e => e.type === 'fast_scroll' || e.type === 'scroll_reversal');
  const reversalEvents = features.events.filter(e => e.type === 'scroll_reversal');
  const selectionEvents = features.events.filter(e => e.type === 'text_selection');
  const frustrationEvents = features.events.filter(e => e.type === 'rage_click' || e.type === 'dead_click');
  const totalEvents = features.events.length;

  // --- Calculate observation scores (0-1 scale) ---

  // 1. Attentiveness: Based on dwell time and focus patterns
  // Long, consistent dwells = high attentiveness
  let attentivenessObs = 0.5;
  if (dwellEvents.length > 0) {
    const avgDwell = dwellEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / dwellEvents.length;
    // Update running average
    metrics._observations.avgDwellTime = ema(metrics._observations.avgDwellTime, avgDwell, 0.3);

    // Score: 3-8 seconds is optimal (0.7-1.0), <2s is low (0.2-0.4), >10s might indicate confusion (0.5)
    if (avgDwell < 2000) {
      attentivenessObs = 0.2 + (avgDwell / 2000) * 0.2; // 0.2-0.4
    } else if (avgDwell <= 8000) {
      attentivenessObs = 0.4 + ((avgDwell - 2000) / 6000) * 0.6; // 0.4-1.0
    } else {
      attentivenessObs = Math.max(0.5, 1.0 - ((avgDwell - 8000) / 10000) * 0.3); // 0.5-0.7
    }
  }
  // Penalize for many distractions (frequent short events)
  const shortDwells = dwellEvents.filter(e => (e.duration || 0) < 1500).length;
  if (dwellEvents.length > 0 && shortDwells / dwellEvents.length > 0.5) {
    attentivenessObs *= 0.7;
  }
  // Penalize for erratic scrolling (lots of fast scrolls/reversals relative to session)
  if (scrollEvents.length > 5 && totalEvents > 0) {
    const scrollEventRate = scrollEvents.length / totalEvents;
    if (scrollEventRate > 0.3) {
      attentivenessObs *= 0.8; // High scroll activity = distracted/unfocused
    }
  }
  metrics.attentiveness = ema(metrics.attentiveness, attentivenessObs, alpha);

  // 2. Reading Speed: Based on scroll speed and progression rate
  let readingSpeedObs = 0.5;
  if (features.avg_scroll_speed > 0) {
    const scrollSpeed = features.avg_scroll_speed * 1000; // Convert to px/s
    metrics._observations.avgScrollSpeed = ema(metrics._observations.avgScrollSpeed, features.avg_scroll_speed, 0.3);

    // Score: Map scroll speed to 0-1
    // <200 px/s = slow (0.1-0.3), 200-600 = moderate (0.4-0.6), >600 = fast (0.7-1.0)
    if (scrollSpeed < 200) {
      readingSpeedObs = 0.1 + (scrollSpeed / 200) * 0.2;
    } else if (scrollSpeed <= 600) {
      readingSpeedObs = 0.3 + ((scrollSpeed - 200) / 400) * 0.4;
    } else {
      readingSpeedObs = Math.min(1.0, 0.7 + ((scrollSpeed - 600) / 1000) * 0.3);
    }
  }
  // Also consider heading dwell ratio (high = scanning = fast reader)
  if (features.heading_dwell_ratio > 0.5) {
    readingSpeedObs = Math.min(1.0, readingSpeedObs + 0.2);
  }
  metrics.readingSpeed = ema(metrics.readingSpeed, readingSpeedObs, alpha);

  // 3. Comprehension: Based on scroll reversals and re-reading patterns
  let comprehensionObs = 0.5;
  if (totalEvents > 0) {
    const reversalRate = reversalEvents.length / Math.max(totalEvents, 1);
    metrics._observations.reversalRate = ema(metrics._observations.reversalRate, reversalRate, 0.3);

    // Score: Fewer reversals = higher comprehension
    // 0% reversals = 1.0, 10% = 0.7, 20%+ = 0.3
    comprehensionObs = Math.max(0.2, 1.0 - (reversalRate * 4));

    // Also penalize for text selections (indicates confusion/highlighting for understanding)
    const selectionRate = selectionEvents.length / Math.max(totalEvents, 1);
    if (selectionRate > 0.1) {
      comprehensionObs *= 0.8;
    }
  }
  // Long dwells without progression also indicate comprehension struggles
  if (features.long_dwell_count > 3) {
    comprehensionObs *= 0.7;
  }
  metrics.comprehension = ema(metrics.comprehension, comprehensionObs, alpha);

  // 4. Patience: Based on frustration signals and reading thoroughness
  let patienceObs = 0.5;
  if (totalEvents > 0) {
    const frustrationRate = frustrationEvents.length / Math.max(totalEvents, 1);
    metrics._observations.frustrationRate = ema(metrics._observations.frustrationRate, frustrationRate, 0.3);

    // Score: No frustration = 1.0, any frustration decreases score
    patienceObs = Math.max(0.1, 1.0 - (frustrationRate * 10));

    // Bonus for thorough reading (long session, many dwells)
    if (sessionDuration > 60000 && dwellEvents.length > 5) {
      patienceObs = Math.min(1.0, patienceObs + 0.15);
    }
  }
  // Very fast scrolling with few dwells = impatient
  if (features.avg_scroll_speed > 1.5 && dwellEvents.length < 3) {
    patienceObs *= 0.6;
  }
  // Many scroll events (fast scrolls + reversals) relative to dwells = impatient browsing
  if (scrollEvents.length > 3 && dwellEvents.length > 0) {
    const scrollToDwellRatio = scrollEvents.length / dwellEvents.length;
    if (scrollToDwellRatio > 2) {
      patienceObs *= 0.75; // Scrolling more than reading = impatient
    }
  }
  metrics.patience = ema(metrics.patience, patienceObs, alpha);

  // 5. Technical Familiarity: Based on behavior on technical content
  // This is harder to measure directly - we infer from selection patterns
  let technicalObs = metrics.technicalFamiliarity; // Default to current
  if (selectionEvents.length > 0) {
    // If selecting text often, might be unfamiliar with terms
    const selectionRate = selectionEvents.length / Math.max(totalEvents, 1);
    metrics._observations.selectionRate = ema(metrics._observations.selectionRate, selectionRate, 0.3);

    if (selectionRate > 0.1) {
      technicalObs = Math.max(0.2, metrics.technicalFamiliarity - 0.1);
    } else if (selectionRate < 0.02 && features.avg_scroll_speed > 0.5) {
      // Fast reading with no selections = comfortable
      technicalObs = Math.min(1.0, metrics.technicalFamiliarity + 0.05);
    }
  }
  metrics.technicalFamiliarity = ema(metrics.technicalFamiliarity, technicalObs, alpha);

  // Increment session count
  metrics.sessionCount += 1;

  // Save updated metrics
  saveUserMetrics(metrics);

  console.log('[UserProfile] Updated metrics:', formatMetricsForLog(metrics));

  return metrics;
}

/**
 * Format metrics for display/logging
 */
export function formatMetricsForLog(metrics: UserMetrics): string {
  return [
    `Attentiveness: ${(metrics.attentiveness * 100).toFixed(0)}%`,
    `Reading Speed: ${(metrics.readingSpeed * 100).toFixed(0)}%`,
    `Comprehension: ${(metrics.comprehension * 100).toFixed(0)}%`,
    `Patience: ${(metrics.patience * 100).toFixed(0)}%`,
    `Technical: ${(metrics.technicalFamiliarity * 100).toFixed(0)}%`,
    `Sessions: ${metrics.sessionCount}`,
  ].join(' | ');
}

/**
 * Generate a natural language description of user profile for LLM prompts
 */
export function generateProfileDescription(metrics: UserMetrics): string {
  const lines: string[] = [];

  // Attentiveness description
  if (metrics.attentiveness < 0.35) {
    lines.push('User has LOW attention span - use very short paragraphs, frequent headers, and bullet points.');
  } else if (metrics.attentiveness < 0.65) {
    lines.push('User has MODERATE attention span - balance detail with concise sections.');
  } else {
    lines.push('User has GOOD attention span - can handle longer explanations when needed.');
  }

  // Reading speed description
  if (metrics.readingSpeed < 0.35) {
    lines.push('User reads SLOWLY - use simple sentence structures, avoid dense paragraphs.');
  } else if (metrics.readingSpeed > 0.7) {
    lines.push('User reads QUICKLY - can use executive summaries, skip obvious explanations.');
  }

  // Comprehension description
  if (metrics.comprehension < 0.4) {
    lines.push('User often STRUGGLES with comprehension - define all terms, use analogies, repeat key points.');
  } else if (metrics.comprehension < 0.6) {
    lines.push('User has MODERATE comprehension - explain complex concepts but don\'t over-simplify.');
  } else {
    lines.push('User has STRONG comprehension - can understand nuanced explanations.');
  }

  // Patience description
  if (metrics.patience < 0.35) {
    lines.push('User is IMPATIENT - get to the point immediately, minimize preamble, use TL;DR style.');
  } else if (metrics.patience > 0.7) {
    lines.push('User is PATIENT - can include context and background when helpful.');
  }

  // Technical familiarity description
  if (metrics.technicalFamiliarity < 0.35) {
    lines.push('User is NOT technically familiar - avoid jargon, explain all technical terms in plain language.');
  } else if (metrics.technicalFamiliarity > 0.7) {
    lines.push('User is TECHNICALLY comfortable - can use standard terminology without excessive explanation.');
  }

  // Convergence note
  if (metrics.sessionCount < 5) {
    lines.push(`(Profile still learning - session ${metrics.sessionCount}/20 for convergence)`);
  } else if (metrics.sessionCount >= 20) {
    lines.push('(Profile converged - stable preferences established)');
  }

  return lines.join('\n');
}

/**
 * Generate structured metrics for LLM consumption
 */
export function generateMetricsForPrompt(metrics: UserMetrics): string {
  return `USER READING PROFILE (personalized based on ${metrics.sessionCount} sessions):
- Attention Span: ${getLevel(metrics.attentiveness)} (${(metrics.attentiveness * 100).toFixed(0)}%)
- Reading Speed: ${getLevel(metrics.readingSpeed)} (${(metrics.readingSpeed * 100).toFixed(0)}%)
- Comprehension: ${getLevel(metrics.comprehension)} (${(metrics.comprehension * 100).toFixed(0)}%)
- Patience Level: ${getLevel(metrics.patience)} (${(metrics.patience * 100).toFixed(0)}%)
- Technical Familiarity: ${getLevel(metrics.technicalFamiliarity)} (${(metrics.technicalFamiliarity * 100).toFixed(0)}%)

PERSONALIZATION GUIDANCE:
${generateProfileDescription(metrics)}`;
}

/**
 * Convert numeric level to descriptive string
 */
function getLevel(value: number): string {
  if (value < 0.25) return 'Very Low';
  if (value < 0.4) return 'Low';
  if (value < 0.6) return 'Moderate';
  if (value < 0.75) return 'Good';
  return 'High';
}

/**
 * Check if profile has converged (stable enough for reliable personalization)
 */
export function isProfileConverged(metrics: UserMetrics): boolean {
  return metrics.sessionCount >= 20;
}

/**
 * Get convergence progress (0-1)
 */
export function getConvergenceProgress(metrics: UserMetrics): number {
  return Math.min(1.0, metrics.sessionCount / 20);
}

/**
 * Reset user profile to defaults (for testing or user request)
 */
export function resetUserProfile(): UserMetrics {
  const metrics = { ...DEFAULT_METRICS };
  saveUserMetrics(metrics);
  console.log('[UserProfile] Profile reset to defaults');
  return metrics;
}
