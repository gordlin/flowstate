/**
 * FlowState Content Script
 *
 * Injects a floating button and sidebar for accessibility assistance.
 * Uses iframe isolation to prevent conflicts with host page styles.
 */

import { parseTextContent, parseActions } from "./parse";
import type { ReadabilityType, ParsedActions } from "./parse";

// Constants
const SIDEBAR_WIDTH = 420;
const BUTTON_SIZE = 56;
const ANIMATION_DURATION = 300;

// State
let isSidebarOpen = false;
let sidebarFrame: HTMLIFrameElement | null = null;
let floatingButton: HTMLElement | null = null;
let pageWrapper: HTMLElement | null = null;

/**
 * Creates an isolated style element that won't be affected by page styles
 */
function createIsolatedStyles(): string {
  return `
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
    
    .sidebar-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: #0f172a;
    }
    
    .sidebar-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
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
      border-top-color: #6366f1;
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
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
    }
    
    .action-btn.primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }
    
    .action-btn.secondary {
      background: #334155;
      color: #e2e8f0;
    }
    
    .action-btn.secondary:hover {
      background: #475569;
    }
    
    .agent-log {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #334155;
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
      color: #6366f1;
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
      background: #6366f1;
      color: white;
    }
    
    .badge.secondary {
      background: #475569;
      color: #e2e8f0;
    }
    
    .badge.navigation {
      background: #0891b2;
      color: white;
    }
  `;
}

/**
 * Creates the sidebar iframe HTML content
 */
function createSidebarHTML(
  initialState: "loading" | "ready" = "loading",
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${createIsolatedStyles()}</style>
    </head>
    <body>
      <div class="sidebar-container">
        <div class="sidebar-header">
          <div class="sidebar-title">
            <span>🌊</span>
            <span>FlowState</span>
          </div>
          <button class="close-btn" id="close-sidebar" title="Close sidebar">×</button>
        </div>
        <div class="sidebar-content" id="sidebar-content">
          <div class="status-card loading">
            <div class="spinner"></div>
            <div class="status-text">Analyzing page...</div>
          </div>
        </div>
      </div>
      <script>
        document.getElementById('close-sidebar').addEventListener('click', function() {
          window.parent.postMessage({ type: 'flowstate-close' }, '*');
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * Creates the floating activation button
 */
function createFloatingButton(): HTMLElement {
  // Remove existing button if present
  const existing = document.getElementById("flowstate-float-btn");
  if (existing) existing.remove();

  const button = document.createElement("div");
  button.id = "flowstate-float-btn";

  // Use inline styles to avoid any CSS conflicts
  button.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    right: 24px !important;
    width: ${BUTTON_SIZE}px !important;
    height: ${BUTTON_SIZE}px !important;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
    border-radius: 50% !important;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.5) !important;
    cursor: pointer !important;
    z-index: 2147483646 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 24px !important;
    transition: transform 0.2s ease, box-shadow 0.2s ease !important;
    user-select: none !important;
    border: none !important;
    outline: none !important;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
  `;

  button.innerHTML = "🌊";
  button.title = "Open FlowState Accessibility Helper";

  // Hover effects
  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.1)";
    button.style.boxShadow = "0 6px 24px rgba(99, 102, 241, 0.6)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
    button.style.boxShadow = "0 4px 20px rgba(99, 102, 241, 0.5)";
  });

  // Click handler
  button.addEventListener("click", toggleSidebar);

  document.body.appendChild(button);
  floatingButton = button;

  return button;
}

/**
 * Creates the sidebar iframe
 */
function createSidebar(): HTMLIFrameElement {
  // Remove existing sidebar if present
  const existing = document.getElementById("flowstate-sidebar");
  if (existing) existing.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "flowstate-sidebar";

  // Critical: Use inline styles with !important to override any page styles
  iframe.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: -${SIDEBAR_WIDTH}px !important;
    width: ${SIDEBAR_WIDTH}px !important;
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

  // Set sandbox to allow scripts but isolate from parent
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");

  // Write content to iframe
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(createSidebarHTML());
    iframeDoc.close();
  }

  sidebarFrame = iframe;
  return iframe;
}

/**
 * Opens the sidebar with animation
 */
function openSidebar() {
  if (isSidebarOpen) return;

  // Create sidebar if it doesn't exist
  if (!sidebarFrame) {
    createSidebar();
  }

  // Animate page content to make room
  wrapPageContent();

  // Small delay to ensure DOM is ready
  requestAnimationFrame(() => {
    if (sidebarFrame) {
      sidebarFrame.style.right = "0px";
    }
    if (pageWrapper) {
      pageWrapper.style.marginRight = `${SIDEBAR_WIDTH}px`;
    }
    // Move floating button
    if (floatingButton) {
      floatingButton.style.right = `${SIDEBAR_WIDTH + 24}px`;
    }
  });

  isSidebarOpen = true;

  // Start analysis
  runAnalysis();
}

/**
 * Closes the sidebar with animation
 */
function closeSidebar() {
  if (!isSidebarOpen) return;

  if (sidebarFrame) {
    sidebarFrame.style.right = `-${SIDEBAR_WIDTH}px`;
  }

  if (pageWrapper) {
    pageWrapper.style.marginRight = "0px";
  }

  if (floatingButton) {
    floatingButton.style.right = "24px";
  }

  isSidebarOpen = false;

  // Remove sidebar after animation
  setTimeout(() => {
    if (!isSidebarOpen && sidebarFrame) {
      sidebarFrame.remove();
      sidebarFrame = null;
    }
    unwrapPageContent();
  }, ANIMATION_DURATION);
}

/**
 * Toggles sidebar open/closed
 */
function toggleSidebar() {
  if (isSidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

/**
 * Wraps page content to enable smooth margin animation
 */
function wrapPageContent() {
  if (pageWrapper) return; // Already wrapped

  // Apply transition to body for margin change
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
 * Updates sidebar content
 */
function updateSidebarContent(html: string) {
  if (!sidebarFrame) return;

  const iframeDoc =
    sidebarFrame.contentDocument || sidebarFrame.contentWindow?.document;
  const contentEl = iframeDoc?.getElementById("sidebar-content");

  if (contentEl) {
    contentEl.innerHTML = html;
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
  // Convert markdown-like formatting to HTML
  let html = escapeHtml(summary);

  // Headers
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Blockquotes (lines starting with >)
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

  // List items
  html = html.replace(/^• (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Paragraphs (wrap remaining text blocks)
  html = html.replace(/^([^<\n].+)$/gm, "<p>$1</p>");

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, "");

  return html;
}

/**
 * Runs the page analysis
 */
async function runAnalysis() {
  updateSidebarContent(`
    <div class="status-card loading">
      <div class="spinner"></div>
      <div class="status-text">Analyzing page structure...</div>
    </div>
  `);

  try {
    // Clone document for parsing (Readability modifies the DOM)
    const docClone = document.cloneNode(true) as Document;

    // Parse content
    updateSidebarContent(`
      <div class="status-card loading">
        <div class="spinner"></div>
        <div class="status-text">Extracting page content...</div>
      </div>
    `);

    const pageContent = parseTextContent(docClone as unknown as HTMLDocument);
    const parsedActions = parseActions(document as unknown as HTMLDocument);

    // Show parse results first
    let parseResultsHTML = '<div class="parse-results">';

    if (pageContent) {
      parseResultsHTML += `
        <div class="parse-section">
          <div class="parse-section-title">📄 Page Info</div>
          <div class="action-item">
            <div class="label">${escapeHtml(pageContent.title || "Untitled")}</div>
            <div class="meta">${pageContent.length || 0} characters extracted</div>
          </div>
        </div>
      `;
    }

    if (parsedActions && parsedActions.primaryActions.length > 0) {
      parseResultsHTML += `
        <div class="parse-section">
          <div class="parse-section-title">🎯 Primary Actions Found (${parsedActions.primaryActions.length})</div>
          ${parsedActions.primaryActions
            .slice(0, 5)
            .map(
              (a) => `
            <div class="action-item">
              <div class="label">${escapeHtml(a.label)}</div>
              <div class="meta">
                <span class="badge ${a.importance}">${a.importance}</span>
                ${a.type}
                ${a.disabled ? " • disabled" : ""}
              </div>
            </div>
          `,
            )
            .join("")}
          ${parsedActions.primaryActions.length > 5 ? `<div class="meta">...and ${parsedActions.primaryActions.length - 5} more</div>` : ""}
        </div>
      `;
    }

    parseResultsHTML += "</div>";

    // Show loading state for AI
    updateSidebarContent(`
      <div class="status-card loading">
        <div class="spinner"></div>
        <div class="status-text">Running AI agents...</div>
        <div class="status-text" style="font-size: 12px; margin-top: 8px;">This may take 30-60 seconds</div>
      </div>
      ${parseResultsHTML}
    `);

    // Run AI summary using browser-compatible agents
    const { summarizePage } = await import("./agents");

    const result = await summarizePage(pageContent!, parsedActions, {
      verbose: true,
      onProgress: (node, _state) => {
        // Update status as agents complete
        const agentNames: Record<string, string> = {
          navigator: "📍 Navigator analyzed page structure",
          security: "🛡️ Security Sentinel checked for risks",
          compassionate_writer: "💝 Compassionate Writer drafted summary",
          technical_writer: "📋 Technical Writer drafted summary",
          arbiter: "⚖️ Arbiter merged summaries",
          guardian: "✅ Guardian reviewing quality",
          assemble: "📝 Assembling final output",
        };

        const statusText = agentNames[node] || `Processing: ${node}`;

        // Only update the status text, keep the rest
        const statusEl =
          sidebarFrame?.contentDocument?.querySelector(".status-text");
        if (statusEl) {
          statusEl.textContent = statusText;
        }
      },
    });

    // Show final result
    const summaryHTML = formatSummaryHTML(result.summary);

    let errorsHTML = "";
    if (result.errors.length > 0) {
      errorsHTML = `
        <div class="status-card" style="background: #3f1f1f; border: 1px solid #7f1d1d;">
          <div style="color: #f87171; font-weight: 500; margin-bottom: 8px;">⚠️ Some issues occurred:</div>
          <ul style="color: #fca5a5; font-size: 12px; margin-left: 16px;">
            ${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    updateSidebarContent(`
      ${errorsHTML}
      <div class="summary-content">
        ${summaryHTML}
      </div>
      <div class="agent-log">
        <div class="agent-log-title" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
          📋 Agent Communication Log (${result.communicationLog.length} entries - click to expand)
        </div>
        <div class="agent-log-content" style="display: none;">
          ${escapeHtml(result.formattedLog)}
        </div>
      </div>
      <div class="action-buttons">
        <button class="action-btn primary" onclick="window.parent.postMessage({type:'flowstate-refresh'},'*')">
          🔄 Re-analyze
        </button>
        <button class="action-btn secondary" onclick="window.parent.postMessage({type:'flowstate-close'},'*')">
          Close
        </button>
      </div>
    `);
  } catch (error) {
    console.error("[FlowState] Analysis error:", error);
    updateSidebarContent(`
      <div class="status-card" style="background: #3f1f1f; border: 1px solid #7f1d1d;">
        <div style="color: #f87171; font-weight: 500; margin-bottom: 8px;">❌ Analysis Failed</div>
        <div class="status-text error">${escapeHtml(String(error))}</div>
        ${
          String(error).includes("API")
            ? `
          <div style="margin-top: 12px; padding: 12px; background: #1e293b; border-radius: 8px;">
            <div style="color: #fbbf24; font-size: 12px;">
              💡 Make sure your OpenRouter API key is set correctly.
            </div>
          </div>
        `
            : ""
        }
      </div>
      <div class="action-buttons">
        <button class="action-btn primary" onclick="window.parent.postMessage({type:'flowstate-refresh'},'*')">
          🔄 Try Again
        </button>
        <button class="action-btn secondary" onclick="window.parent.postMessage({type:'flowstate-close'},'*')">
          Close
        </button>
      </div>
    `);
  }
}

/**
 * Handle messages from sidebar iframe
 */
function handleMessage(event: MessageEvent) {
  if (event.data?.type === "flowstate-close") {
    closeSidebar();
  } else if (event.data?.type === "flowstate-refresh") {
    runAnalysis();
  }
}

/**
 * Initialize FlowState
 */
function init() {
  // Prevent double initialization
  if (document.getElementById("flowstate-float-btn")) {
    console.log("[FlowState] Already initialized");
    return;
  }

  console.log("[FlowState] Initializing...");

  // Create floating button
  createFloatingButton();

  // Listen for messages from iframe
  window.addEventListener("message", handleMessage);

  // Listen for keyboard shortcut (Ctrl+Shift+F)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      toggleSidebar();
    }
  });

  console.log(
    "[FlowState] Ready. Click the 🌊 button or press Ctrl+Shift+F to open.",
  );
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Export for external use
export { openSidebar, closeSidebar, toggleSidebar, runAnalysis };
