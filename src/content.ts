import { initTracker, type Tracker } from './tracker';
import { showButton } from './popup';
import { classifyUser, type ClassificationResult } from './agents/classifier';
import { parseTextContent, parseActions } from "./parse";
import type { ParsedActions } from "./parse";
import {
  loadUserMetrics,
  updateUserMetrics,
  formatMetricsForLog,
  type UserMetrics,
} from './agents/userProfile';

// Constants
const SIDEBAR_WIDTH = 420;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 800;
const ANIMATION_DURATION = 300;
const CLASSIFICATION_INTERVAL = 15000; // Classify every 15 seconds
const MIN_EVENTS_FOR_CLASSIFICATION = 2;
const STORAGE_KEY_DYSLEXIA_FONT = "flowstate-dyslexia-font";

// State
let isSidebarOpen = false;
let sidebarFrame: HTMLIFrameElement | null = null;
let pageWrapper: HTMLElement | null = null;
let lastParsedActions: ParsedActions | null = null;
let floatingButton: HTMLElement | null = null; // Kept for type compatibility if needed

// Resize State
let currentSidebarWidth = SIDEBAR_WIDTH;
let resizeCleanup: (() => void) | null = null;

let _currentClassification: ClassificationResult | null = null;
let hasShownPopup = false;
let classificationInterval: number | null = null;
let isDyslexiaFontEnabled = false;

// User profile for adaptive personalization
let userMetrics: UserMetrics = loadUserMetrics();
const sessionStartTime = Date.now();

console.log('[FlowState] Loaded user profile:', formatMetricsForLog(userMetrics));

try {
  isDyslexiaFontEnabled =
    localStorage.getItem(STORAGE_KEY_DYSLEXIA_FONT) === "true";
} catch {
  // localStorage not available
}

// Initialize tracker and store reference
const tracker: Tracker = initTracker();

/**
 * Adds resize functionality to the sidebar
 */
function addSidebarResizeFunctionality(sidebarFrame: HTMLIFrameElement) {
  let isResizing = false;

  const resizeHandle = document.createElement('div');
  Object.assign(resizeHandle.style, {
    position: 'fixed',
    top: '0px',
    width: '2px',
    height: '100vh',
    backgroundColor: '#334155',
    opacity: '0.15',
    cursor: 'col-resize',
    zIndex: '2147483647',
    pointerEvents: 'none',
  });

  const hoverArea = document.createElement('div');
  Object.assign(hoverArea.style, {
    position: 'fixed',
    top: '0px',
    width: '16px',
    height: '100vh',
    cursor: 'col-resize',
    zIndex: '2147483647',
    backgroundColor: 'transparent',
    pointerEvents: 'auto',
  });

  function getSidebarLeftEdge(): number {
    const rect = sidebarFrame.getBoundingClientRect();
    // If layout is valid, trust it
    if (rect.width > 0 && rect.left > 0) {
      return rect.left;
    }

    // Fallback: right-docked sidebar
    return window.innerWidth - currentSidebarWidth;
  }

  function updateResizeHandlePosition() {
    const leftEdge = getSidebarLeftEdge();
    resizeHandle.style.left = `${leftEdge}px`;
    hoverArea.style.left = `${leftEdge}px`;
    hoverArea.style.width = '16px';
  }

  // --- Ensure correct position on first paint ---
  requestAnimationFrame(updateResizeHandlePosition);
  updateResizeHandlePosition();

  document.body.appendChild(resizeHandle);
  document.body.appendChild(hoverArea);

  // Event Handlers
  const onMouseEnter = () => {
    resizeHandle.style.opacity = '1';
    document.body.style.cursor = 'col-resize';
  };

  const onMouseLeave = () => {
    if (!isResizing) {
      resizeHandle.style.opacity = '0.15';
      document.body.style.cursor = '';
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isResizing = true;
    sidebarFrame.style.pointerEvents = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, window.innerWidth - e.clientX)
    );

    // Update state and styles
    currentSidebarWidth = newWidth;
    sidebarFrame.style.width = `${newWidth}px`;
    
    // Update wrapper margin immediately for smooth experience
    if (pageWrapper) {
      pageWrapper.style.marginRight = `${newWidth}px`;
    }
    
    updateResizeHandlePosition();
  };

  const onMouseUp = () => {
    if (!isResizing) return;
    isResizing = false;
    sidebarFrame.style.pointerEvents = 'auto';
    resizeHandle.style.opacity = '0.15';
    document.body.style.cursor = '';
  };

  const onWindowResize = () => updateResizeHandlePosition();

  // Attach Listeners
  hoverArea.addEventListener('mouseenter', onMouseEnter);
  hoverArea.addEventListener('mouseleave', onMouseLeave);
  hoverArea.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  window.addEventListener('resize', onWindowResize);

  // Return cleanup function
  return () => {
    hoverArea.removeEventListener('mouseenter', onMouseEnter);
    hoverArea.removeEventListener('mouseleave', onMouseLeave);
    hoverArea.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('resize', onWindowResize);
    
    resizeHandle.remove();
    hoverArea.remove();
  };
}

/**
 * Run classification with LLM and decide whether to show help
 */
async function runClassification() {
  if (hasShownPopup || isSidebarOpen) {
    console.log('[FlowState] Popup already shown or sidebar open, skipping classification');
    return;
  }

  const features = tracker.getFeatures();
  const eventLog = tracker.getEventLog();

  console.log('[FlowState] Running classification...');
  console.log('[FlowState] Events collected:', features.events.length);

  // Need minimum events to classify
  if (features.events.length < MIN_EVENTS_FOR_CLASSIFICATION) {
    console.log('[FlowState] Not enough events yet, will retry in 15s');
    return;
  }

  try {
    const result = await classifyUser(eventLog, features);
    _currentClassification = result;
    void _currentClassification;

    console.log('[FlowState] Classification result:', {
      needsHelp: result.needsHelp,
      cluster: result.cluster,
      confidence: result.confidence,
      reasoning: result.reasoning
    });

    if (result.needsHelp && result.confidence >= 0.5) {
      showHelpPopup(result);
      // Stop the interval once we've shown help
      if (classificationInterval) {
        clearInterval(classificationInterval);
        classificationInterval = null;
      }
    } else {
      console.log('[FlowState] User seems fine, will re-assess in 15s');
    }
  } catch (error) {
    console.error('[FlowState] Classification failed:', error);
  }
}

/**
 * Show the help popup with a message based on classification
 */
function showHelpPopup(classification: ClassificationResult) {
  if (hasShownPopup) return;
  hasShownPopup = true;

  // Generate message based on observed behaviors
  let message = "Need help understanding this page?";

  if (classification.cluster === 'scanner') {
    message = "Want the key points? I can summarize what matters.";
  } else if (classification.cluster === 'stumbler') {
    // Personalize based on problem areas
    if (classification.problemAreas.length > 0) {
      message = `Having trouble? Let me simplify it.`;
    } else {
      message = "This looks confusing. Want me to break it down?";
    }
  }

  console.log(`[FlowState] Showing popup for ${classification.cluster} user`);
  console.log('[FlowState] Transformer prompt:', classification.transformerPrompt);

  showButton(
    message,
    () => {
      console.log('[FlowState] User accepted help');
      // Pass the custom transformer prompt to the sidebar
      openSidebarWithPrompt(classification.transformerPrompt);
    },
    () => {
      console.log('[FlowState] User dismissed help');
      // User dismissed, don't show again for this page
    }
  );
}

/**
 * Open sidebar with a custom transformer prompt from the classifier
 */
function openSidebarWithPrompt(transformerPrompt: string) {
  // Store the prompt for the analysis to use
  (window as any).__flowstateTransformerPrompt = transformerPrompt;
  openSidebar();
}

// Start classification loop after initial delay
setTimeout(() => {
  // Run first classification
  runClassification();

  // Set up recurring classification every 15 seconds
  classificationInterval = window.setInterval(runClassification, CLASSIFICATION_INTERVAL);
}, CLASSIFICATION_INTERVAL);

/**
 * Creates an isolated style element that won't be affected by page styles
 */
function createIsolatedStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Lexend:wght@300;400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #e2e8f0;
      background: #0f172a;
      overflow-x: hidden;
    }
    
    body.dyslexia-font {
      font-family: 'Lexend', -apple-system, BlinkMacSystemFont, sans-serif;
      letter-spacing: 0.02em;
      word-spacing: 0.05em;
    }
    
    body.dyslexia-font .summary-content {
      line-height: 1.8;
    }
    
    body.dyslexia-font .summary-content p,
    body.dyslexia-font .summary-content li {
      line-height: 1.9;
    }
    
    .sidebar-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #0f172a;
    }
    
    .sidebar-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    
    .sidebar-title {
      font-size: 18px;
      font-weight: 600;
      color: white;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .close-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    
    .close-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    
    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
    
    .settings-section {
      background: #1e293b;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    
    .settings-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .settings-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #e2e8f0;
    }
    
    .settings-hint {
      font-size: 11px;
      color: #64748b;
      margin-top: 4px;
    }
    
    .toggle-switch {
      position: relative;
      width: 44px;
      height: 24px;
      background: #334155;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    
    .toggle-switch.active {
      background: #6366f1;
    }
    
    .toggle-switch::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    
    .toggle-switch.active::after {
      transform: translateX(20px);
    }
    
    .status-card {
      background: #1e293b;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .status-card.loading {
      text-align: center;
      padding: 40px 20px;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #334155;
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .status-text {
      color: #94a3b8;
      font-size: 14px;
    }
    
    .status-text.error {
      color: #f87171;
    }
    
    .summary-content {
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.7;
    }
    
    .summary-content h1 {
      font-size: 20px;
      color: #f1f5f9;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #334155;
    }
    
    .summary-content h2 {
      font-size: 16px;
      color: #e2e8f0;
      margin: 20px 0 12px;
    }
    
    .summary-content p {
      margin-bottom: 12px;
      color: #cbd5e1;
    }
    
    .summary-content ul {
      margin: 8px 0 16px 20px;
    }
    
    .summary-content li {
      margin-bottom: 6px;
      color: #cbd5e1;
    }
    
    .summary-content strong {
      color: #f1f5f9;
    }
    
    .summary-content blockquote {
      background: #1e293b;
      border-left: 3px solid #f59e0b;
      padding: 12px 16px;
      margin: 12px 0;
      border-radius: 0 8px 8px 0;
    }
    
    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #334155;
    }
    
    .action-btn {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .action-btn.primary {
      background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
      color: #0c1825;
    }

    .action-btn.primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(56, 189, 248, 0.4);
    }
    
    .action-btn.secondary {
      background: #334155;
      color: #e2e8f0;
    }
    
    .action-btn.secondary:hover {
      background: #475569;
    }
    
    .cta-section {
      margin-top: 20px;
      padding: 16px;
      background: #1e293b;
      border-radius: 12px;
    }
    
    .cta-section-title {
      font-size: 14px;
      font-weight: 600;
      color: #38bdf8;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .cta-item {
      padding: 12px;
      background: #0f172a;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    
    .cta-item:hover {
      border-color: #38bdf8;
      transform: translateX(4px);
    }

    .cta-item.primary-cta {
      border-left: 3px solid #38bdf8;
    }
    
    .cta-item.secondary-cta {
      border-left: 3px solid #64748b;
    }
    
    .cta-item .cta-label {
      font-weight: 500;
      color: #f1f5f9;
      margin-bottom: 4px;
    }
    
    .cta-item .cta-type {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
    }
    
    .cta-item .cta-hint {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 4px;
    }
    
    .agent-log {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #334155;
    }
    
    .agent-log-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .agent-log-title:hover {
      color: #94a3b8;
    }
    
    .agent-log-content {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 11px;
      background: #020617;
      border-radius: 8px;
      padding: 12px;
      max-height: 300px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: #64748b;
    }
    
    .parse-results {
      margin-top: 16px;
    }
    
    .parse-section {
      background: #1e293b;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
    }
    
    .parse-section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #38bdf8;
      margin-bottom: 8px;
    }
    
    .action-item {
      padding: 8px;
      background: #0f172a;
      border-radius: 6px;
      margin-bottom: 6px;
      font-size: 13px;
    }
    
    .action-item .label {
      color: #f1f5f9;
      font-weight: 500;
    }
    
    .action-item .meta {
      color: #64748b;
      font-size: 11px;
      margin-top: 2px;
    }
    
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .badge.primary {
      background: #38bdf8;
      color: #0c1825;
    }
    
    .badge.secondary {
      background: #475569;
      color: #e2e8f0;
    }
    
    .badge.navigation {
      background: #0891b2;
      color: white;
    }
    
    .error-card {
      background: #3f1f1f;
      border: 1px solid #7f1d1d;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }
    
    .error-title {
      color: #f87171;
      font-weight: 500;
      margin-bottom: 8px;
    }
    
    .error-message {
      color: #fca5a5;
      font-size: 13px;
    }
    
    .retry-hint {
      margin-top: 12px;
      padding: 12px;
      background: #1e293b;
      border-radius: 8px;
      color: #fbbf24;
      font-size: 12px;
    }
  `;
}

/**
 * Creates the sidebar iframe HTML content
 * NO inline scripts due to CSP restrictions
 */
function createSidebarHTML(): string {
  const dyslexiaClass = isDyslexiaFontEnabled ? "dyslexia-font" : "";
  
  // Get the correct URL for the extension asset
  const logoUrl = chrome.runtime.getURL("assets/flowstate128.png");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${createIsolatedStyles()}</style>
    </head>
    <body class="${dyslexiaClass}">
      <div class="sidebar-container">
        <div class="sidebar-header">
          <div class="sidebar-title">
            <img src="${logoUrl}" alt="FlowState" style="width: 24px; height: 24px;" />
            <span>FlowState</span>
          </div>
          <button class="close-btn" data-flowstate-action="close" title="Close sidebar">×</button>
        </div>
        <div class="sidebar-content" id="sidebar-content">
          <div class="status-card loading">
            <div class="spinner"></div>
            <div class="status-text">Analyzing page...</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Creates the sidebar iframe
 */
function createSidebar(): HTMLIFrameElement {
  const existing = document.getElementById("flowstate-sidebar");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "flowstate-sidebar";

  iframe.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: -${currentSidebarWidth}px !important;
    width: ${currentSidebarWidth}px !important;
    height: 100vh !important;
    height: 100dvh !important;
    border: none !important;
    z-index: 2147483647 !important;
    background: #0f172a !important;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3) !important;
    transition: right ${ANIMATION_DURATION}ms ease !important;
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
    max-height: none !important;
    min-width: 0 !important;
    min-height: 0 !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
    clip: auto !important;
    overflow: visible !important;
  `;

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(createSidebarHTML());
    iframeDoc.close();

    // Set up event listeners on iframe document after content is loaded
    setupIframeEventListeners(iframe);
  }

  sidebarFrame = iframe;
  return iframe;
}

/**
 * Set up event listeners on iframe content (CSP-safe approach)
 */
function setupIframeEventListeners(iframe: HTMLIFrameElement) {
  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) return;

  // Use event delegation on the document
  iframeDoc.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const actionEl = target.closest("[data-flowstate-action]");

    if (actionEl) {
      e.preventDefault();
      e.stopPropagation();

      const action = actionEl.getAttribute("data-flowstate-action");
      const selector = actionEl.getAttribute("data-flowstate-selector");

      console.log("[FlowState iframe] Action clicked:", action);

      // Handle actions directly
      if (action === "close") {
        closeSidebar();
      } else if (action === "refresh") {
        runAnalysis();
      } else if (action === "scroll-to" && selector) {
        scrollToElement(selector);
      } else if (action === "toggle-log") {
        const content = actionEl.nextElementSibling as HTMLElement;
        if (content) {
          content.style.display =
            content.style.display === "none" ? "block" : "none";
        }
      } else if (action === "toggle-dyslexia-font") {
        toggleDyslexiaFont();
      }
    }
  });

  console.log("[FlowState] Iframe event listeners set up");
}

/**
 * Toggles the dyslexia-friendly font
 */
function toggleDyslexiaFont() {
  isDyslexiaFontEnabled = !isDyslexiaFontEnabled;

  // Save preference
  try {
    localStorage.setItem(
      STORAGE_KEY_DYSLEXIA_FONT,
      String(isDyslexiaFontEnabled),
    );
  } catch {
    // localStorage not available
  }

  // Update iframe body class
  if (sidebarFrame) {
    const iframeDoc =
      sidebarFrame.contentDocument || sidebarFrame.contentWindow?.document;
    if (iframeDoc?.body) {
      if (isDyslexiaFontEnabled) {
        iframeDoc.body.classList.add("dyslexia-font");
      } else {
        iframeDoc.body.classList.remove("dyslexia-font");
      }
    }

    // Update toggle switch visual
    const toggle = iframeDoc?.querySelector(
      '[data-flowstate-action="toggle-dyslexia-font"]',
    );
    if (toggle) {
      if (isDyslexiaFontEnabled) {
        toggle.classList.add("active");
      } else {
        toggle.classList.remove("active");
      }
    }
  }

  console.log(
    "[FlowState] Dyslexia font:",
    isDyslexiaFontEnabled ? "enabled" : "disabled",
  );
}

/**
 * Renders the settings section with font toggle
 */
function renderSettingsSection(): string {
  const toggleActiveClass = isDyslexiaFontEnabled ? "active" : "";

  return `
    <div class="settings-section">
      <div class="settings-row">
        <div>
          <div class="settings-label">
            <span>📖</span>
            <span>Reading-optimized font</span>
          </div>
          <div class="settings-hint">Uses Lexend font for easier reading</div>
        </div>
        <div class="toggle-switch ${toggleActiveClass}" data-flowstate-action="toggle-dyslexia-font"></div>
      </div>
    </div>
  `;
}

/**
 * Opens the sidebar with animation
 */
function openSidebar() {
  if (isSidebarOpen) return;

  if (!sidebarFrame) {
    createSidebar();
  }

  wrapPageContent();

  requestAnimationFrame(() => {
    if (sidebarFrame) {
      sidebarFrame.style.width = `${currentSidebarWidth}px`;
      sidebarFrame.style.right = "0px";
      
      // Initialize resize functionality and store cleanup
      const newCleanup = addSidebarResizeFunctionality(sidebarFrame);
      if (resizeCleanup) {
        resizeCleanup(); // Clean up any previous resize handlers
      }
      resizeCleanup = newCleanup;
    }
    
    if (pageWrapper) {
      pageWrapper.style.marginRight = `${currentSidebarWidth}px`;
    }
    
    if (floatingButton) {
      floatingButton.style.right = `${currentSidebarWidth + 24}px`;
    }
  });

  isSidebarOpen = true;
  runAnalysis();
}

/**
 * Closes the sidebar with animation
 */
function closeSidebar() {
  if (!isSidebarOpen) return;
  
  // Store current width for timeout check
  const closingWidth = currentSidebarWidth;

  // Clean up resize listeners
  if (resizeCleanup) {
    resizeCleanup();
    resizeCleanup = null;
  }

  if (sidebarFrame) {
    sidebarFrame.style.right = `-${currentSidebarWidth}px`;
  }

  if (pageWrapper) {
    pageWrapper.style.marginRight = "0px";
  }

  if (floatingButton) {
    floatingButton.style.right = "24px";
  }

  isSidebarOpen = false;

  setTimeout(() => {
    // Check that sidebar is still closed and hasn't been reopened
    if (!isSidebarOpen && sidebarFrame && sidebarFrame.style.right === `-${closingWidth}px`) {
      sidebarFrame.remove();
      sidebarFrame = null;
    }
    unwrapPageContent();
    
    // Optional: Reset to default width if sidebar was fully closed
    // Uncomment next line if you want width to reset every time
    // currentSidebarWidth = SIDEBAR_WIDTH; 
  }, ANIMATION_DURATION);
}

/**
 * Wraps page content to enable smooth margin animation
 */
function wrapPageContent() {
  if (pageWrapper) return;

  document.body.style.transition = `margin-right ${ANIMATION_DURATION}ms ease`;
  document.body.style.marginRight = "0px";
  document.documentElement.style.overflow = "auto";

  pageWrapper = document.body;
}

/**
 * Removes page content wrapper
 */
function unwrapPageContent() {
  if (pageWrapper) {
    pageWrapper.style.transition = "";
    pageWrapper.style.marginRight = "";
    pageWrapper = null;
  }
}

/**
 * Updates sidebar content and re-attaches event listeners
 */
function updateSidebarContent(html: string) {
  if (!sidebarFrame) return;

  const iframeDoc =
    sidebarFrame.contentDocument || sidebarFrame.contentWindow?.document;
  const contentEl = iframeDoc?.getElementById("sidebar-content");

  if (contentEl) {
    contentEl.innerHTML = html;
    // Event listeners are already set up via delegation, no need to reattach
  }
}

/**
 * Escapes HTML for safe display
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Formats the summary as HTML
 */
function formatSummaryHTML(summary: string): string {
  let html = escapeHtml(summary);

  // Headers
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // List items
  html = html.replace(/^• (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Paragraphs
  html = html.replace(/^([^<\n].+)$/gm, "<p>$1</p>");

  // Clean up
  html = html.replace(/<p><\/p>/g, "");

  return html;
}

/**
 * Generates unique selector for an element
 */
function generateSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .slice(0, 2)
    .map((c) => `.${CSS.escape(c)}`)
    .join("");

  if (classes) return `${tag}${classes}`;

  // Fallback to nth-child
  const parent = el.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === el.tagName,
    );
    const index = siblings.indexOf(el) + 1;
    return `${tag}:nth-of-type(${index})`;
  }

  return tag;
}

/**
 * Renders the CTAs section
 */
function renderCTAsSection(actions: ParsedActions | null): string {
  if (!actions) return "";

  const { primaryActions, actions: allActions } = actions;

  // Get primary and some secondary actions
  const ctasToShow = [
    ...primaryActions,
    ...allActions
      .filter(
        (a) => a.importance !== "primary" && a.importance !== "navigation",
      )
      .slice(0, 5),
  ].slice(0, 10);

  if (ctasToShow.length === 0) return "";

  const ctaItems = ctasToShow
    .map((action) => {
      const isPrimary = action.importance === "primary";
      const ctaClass = isPrimary ? "primary-cta" : "secondary-cta";

      // Try to find the element and get a selector
      let selector = "";
      try {
        const elements = document.querySelectorAll(
          action.type === "button"
            ? 'button, [role="button"], input[type="submit"]'
            : action.type === "link"
              ? "a"
              : "*",
        );
        for (const el of elements) {
          if (el.textContent?.trim().includes(action.label.slice(0, 20))) {
            selector = generateSelector(el);
            break;
          }
        }
      } catch (e) {
        // Selector generation failed, skip
      }

      const dataAttrs = selector
        ? `data-flowstate-action="scroll-to" data-flowstate-selector="${escapeHtml(selector)}"`
        : "";

      return `
      <div class="cta-item ${ctaClass}" ${dataAttrs} style="cursor: ${selector ? "pointer" : "default"}">
        <div class="cta-label">${escapeHtml(action.label)}</div>
        <div class="cta-type">${action.type}${action.disabled ? " • disabled" : ""}</div>
        ${selector ? '<div class="cta-hint">Click to scroll to this element</div>' : ""}
      </div>
    `;
    })
    .join("");

  return `
    <div class="cta-section">
      <div class="cta-section-title">
        🎯 Actions on This Page
      </div>
      ${ctaItems}
    </div>
  `;
}

/**
 * Scrolls to and highlights an element
 */
function scrollToElement(selector: string) {
  try {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight briefly
      const originalOutline = (el as HTMLElement).style.outline;
      const originalTransition = (el as HTMLElement).style.transition;

      (el as HTMLElement).style.transition = "outline 0.3s ease";
      (el as HTMLElement).style.outline = "3px solid #38bdf8";

      setTimeout(() => {
        (el as HTMLElement).style.outline = originalOutline;
        setTimeout(() => {
          (el as HTMLElement).style.transition = originalTransition;
        }, 300);
      }, 2000);
    }
  } catch (e) {
    console.error("[FlowState] Failed to scroll to element:", e);
  }
}

/**
 * Runs the page analysis with retry logic
 */
async function runAnalysis(retryCount = 0) {
  const MAX_RETRIES = 2;

  updateSidebarContent(`
    <div class="status-card loading">
      <div class="spinner"></div>
      <div class="status-text" id="status-text">Analyzing page structure...</div>
    </div>
  `);

  try {
    // Clone document for parsing
    const docClone = document.cloneNode(true) as Document;

    // Update status
    const updateStatus = (text: string) => {
      if (!sidebarFrame) return;
      const statusEl =
        sidebarFrame.contentDocument?.getElementById("status-text");
      if (statusEl) statusEl.textContent = text;
    };

    updateStatus("Extracting page content...");

    const pageContent = parseTextContent(docClone as unknown as HTMLDocument);
    const parsedActions = parseActions(document as unknown as HTMLDocument);
    lastParsedActions = parsedActions;

    if (!pageContent) {
      throw new Error("Failed to parse page content");
    }

    // Show initial parse results
    let parseResultsHTML = '<div class="parse-results">';

    parseResultsHTML += `
      <div class="parse-section">
        <div class="parse-section-title">📄 Page Info</div>
        <div class="action-item">
          <div class="label">${escapeHtml(pageContent.title || "Untitled")}</div>
          <div class="meta">${pageContent.length || 0} characters extracted</div>
        </div>
      </div>
    `;

    if (parsedActions && parsedActions.primaryActions.length > 0) {
      parseResultsHTML += `
        <div class="parse-section">
          <div class="parse-section-title">🎯 Primary Actions Found (${parsedActions.primaryActions.length})</div>
          ${parsedActions.primaryActions
            .slice(0, 3)
            .map(
              (a) => `
            <div class="action-item">
              <div class="label">${escapeHtml(a.label)}</div>
              <div class="meta">
                <span class="badge ${a.importance}">${a.importance}</span>
                ${a.type}
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    }

    parseResultsHTML += "</div>";

    // Show loading for AI
    updateSidebarContent(`
      <div class="status-card loading">
        <div class="spinner"></div>
        <div class="status-text" id="status-text">Running AI agents...</div>
        <div class="status-text" style="font-size: 12px; margin-top: 8px;">This may take 10-15 seconds</div>
      </div>
      ${parseResultsHTML}
    `);

    // Run AI summary
    const { summarizePage } = await import("./agents");

    // Get the custom transformer prompt from the classifier (if available)
    const transformerPrompt = (window as any).__flowstateTransformerPrompt || '';
    if (transformerPrompt) {
      console.log('[FlowState] Using custom transformer prompt:', transformerPrompt);
    }

    // Update user metrics before analysis (captures this session's behavior)
    const sessionDuration = Date.now() - sessionStartTime;
    userMetrics = updateUserMetrics(userMetrics, tracker.getFeatures(), sessionDuration);
    console.log('[FlowState] Updated user profile for personalization');

    const result = await summarizePage(pageContent, parsedActions, {
      verbose: true,
      customPrompt: transformerPrompt,  // Pass classifier's custom instructions
      userProfile: userMetrics,  // Pass adaptive user metrics for personalization
      onProgress: (node) => {
        const agentNames: Record<string, string> = {
          navigator: "📍 Navigator analyzing...",
          security: "🛡️ Security check...",
          writer: "✍️ Writing summary...",
          guardian: "✅ Quality review...",
          assemble: "📝 Finishing up...",
        };
        updateStatus(agentNames[node] || `Processing: ${node}`);
      },
    });

    // Check for critical errors
    if (
      !result.summary ||
      result.summary.includes("Unable to generate summary")
    ) {
      throw new Error(result.errors.join("; ") || "Failed to generate summary");
    }

    // Render final result
    const summaryHTML = formatSummaryHTML(result.summary);
    const ctasHTML = renderCTAsSection(parsedActions);
    const settingsHTML = renderSettingsSection();

    let errorsHTML = "";
    if (result.errors.length > 0) {
      errorsHTML = `
        <div class="error-card">
          <div class="error-title">⚠️ Some issues occurred:</div>
          <ul class="error-message" style="margin-left: 16px;">
            ${result.errors
              .slice(0, 3)
              .map((e) => `<li>${escapeHtml(e)}</li>`)
              .join("")}
          </ul>
        </div>
      `;
    }

    updateSidebarContent(`
      <div class="agent-log">
        <div class="agent-log-title" data-flowstate-action="toggle-log" style="cursor: pointer;">
          📋 Agent Communication Log (${result.communicationLog.length} entries - click to expand)
        </div>
        <div class="agent-log-content" style="display: none;">
          ${escapeHtml(result.formattedLog)}
        </div>
      </div>
      ${settingsHTML}
      ${errorsHTML}
      <div class="summary-content">
        ${summaryHTML}
      </div>
      ${ctasHTML}

      <div class="action-buttons">
        <button class="action-btn primary" data-flowstate-action="refresh">
          🔄 Re-analyze
        </button>
        <button class="action-btn secondary" data-flowstate-action="close">
          Close
        </button>
      </div>
    `);

    // Log current user metrics at the end of each summary
    console.log('[FlowState] Summary complete. Current user metrics:', formatMetricsForLog(userMetrics));
  } catch (error) {
    console.error("[FlowState] Analysis error:", error);

    const errorMessage = String(error);
    const isRetryable =
      errorMessage.includes("fetch") ||
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("API");

    if (isRetryable && retryCount < MAX_RETRIES) {
      updateSidebarContent(`
        <div class="status-card loading">
          <div class="spinner"></div>
          <div class="status-text">Retrying... (attempt ${retryCount + 2}/${MAX_RETRIES + 1})</div>
        </div>
      `);

      setTimeout(() => runAnalysis(retryCount + 1), 2000);
      return;
    }

    // Show error with helpful message
    let helpText = "";
    if (errorMessage.includes("API") || errorMessage.includes("key")) {
      helpText = `
        <div class="retry-hint">
          💡 Make sure your OpenRouter API key is valid and has credits.
        </div>
      `;
    } else if (
      errorMessage.includes("fetch") ||
      errorMessage.includes("network")
    ) {
      helpText = `
        <div class="retry-hint">
          💡 Check your internet connection and try again.
        </div>
      `;
    }

    // Still show CTAs even if AI failed
    const ctasHTML = renderCTAsSection(lastParsedActions);
    const settingsHTML = renderSettingsSection();

    updateSidebarContent(`
      ${settingsHTML}
      <div class="error-card">
        <div class="error-title">❌ Analysis Failed</div>
        <div class="error-message">${escapeHtml(errorMessage)}</div>
        ${helpText}
      </div>
      ${
        ctasHTML
          ? `
        <div style="margin-top: 16px;">
          <p style="color: #94a3b8; margin-bottom: 12px;">We found these actions on the page:</p>
          ${ctasHTML}
        </div>
      `
          : ""
      }
      <div class="action-buttons">
        <button class="action-btn primary" data-flowstate-action="refresh">
          🔄 Try Again
        </button>
        <button class="action-btn secondary" data-flowstate-action="close">
          Close
        </button>
      </div>
    `);
  }
}

/**
 * Handle messages from sidebar iframe (kept for potential future use)
 */
function handleMessage(event: MessageEvent) {
  // Check if this is a FlowState message
  const { type, selector } = event.data || {};

  if (!type || !type.startsWith("flowstate-")) return;

  console.log("[FlowState] Received message:", type);

  switch (type) {
    case "flowstate-close":
      console.log("[FlowState] Closing sidebar");
      closeSidebar();
      break;
    case "flowstate-refresh":
      console.log("[FlowState] Refreshing analysis");
      runAnalysis();
      break;
    case "flowstate-scroll-to":
      if (selector) {
        scrollToElement(selector);
      }
      break;
  }
}

// Message listener
window.addEventListener("message", handleMessage);