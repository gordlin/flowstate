console.log("Pathfinder content script running!");

let splitScreenActive = false;
let splitContainer: HTMLDivElement | null = null;

<<<<<<< HEAD
// Constants
const SIDEBAR_WIDTH = 420;
const BUTTON_SIZE = 56;
const ANIMATION_DURATION = 300;

// State
let isSidebarOpen = false;
let sidebarFrame: HTMLIFrameElement | null = null;
let floatingButton: HTMLElement | null = null;
let pageWrapper: HTMLElement | null = null;
let lastParsedActions: ParsedActions | null = null;

function injectSplitScreenStyles() {
  const style = document.createElement('style');
  style.setAttribute('data-pathfinder', 'split-screen');
  style.textContent = `
=======
function injectSplitScreenStyles() {
    const style = document.createElement('style');
    style.setAttribute('data-pathfinder', 'split-screen');
    style.textContent = `
>>>>>>> parent of 23a8a9c (Merge pull request #8 from gordlin/main)
        .pathfinder-split-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 999999 !important;
            display: flex !important;
            background: white !important;
            pointer-events: none !important;
<<<<<<< HEAD
        }
        
        /* Original side - 50% width, resizable */
        .pathfinder-original-side {
            width: 50% ;  //removed important
            height: 100vh !important;
            transition: width 0.1s ease;
            overflow: auto !important;
            background: white !important;
            pointer-events: auto !important;
            resize: horizontal !important;
            min-width: 20% !important;
            max-width: 80% !important;
            overflow-x: auto !important;
        }
        
        /* Resize handle visual feedback */
        .pathfinder-original-side:active {
            cursor: col-resize !important;
        }
        
        /* Interpreted side - takes remaining space */
        .pathfinder-interpreted-side {
            flex: 1 !important;
            height: 100vh !important;
            background: #f5f5f5 !important;
            border-left: 2px solid #ccc !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            color: #666 !important;
            font-family: Arial, sans-serif !important;
            pointer-events: auto !important;
            padding: 20px !important;
            box-sizing: border-box !important;
            min-width: 20% !important;
        }
        
        .pathfinder-page-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.01) !important;
            z-index: 999998 !important;
            pointer-events: auto !important;
            display: none !important;
        }
        
        .pathfinder-interpreted-side h3 {
            color: #333 !important;
            margin-bottom: 10px !important;
        }
        
        .pathfinder-interpreted-side p {
            text-align: center !important;
            max-width: 300px !important;
        }
        
        .inline-close-btn {
            background: #ff4757 !important;
            color: white !important;
            border: none !important;
            padding: 8px 16px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            margin-top: 20px !important;
        }
        
        .inline-close-btn:hover {
            background: #ff3742 !important;
        }
        
        /* Prevent text selection during resize */
        .pathfinder-split-container * {
            user-select: none !important;
        }
        
        .pathfinder-original-side * {
            user-select: auto !important;
        }
    `;
  document.head.appendChild(style);
}

function createSplitScreen() {
  if (isSidebarOpen) return;

  // Inject styles if not already injected
  if (!document.querySelector('style[data-pathfinder="split-screen"]')) {
    injectSplitScreenStyles();
  }

  const overlay = document.createElement('div');
  overlay.className = 'pathfinder-page-overlay';
  overlay.style.display = 'block';
  overlay.setAttribute('data-pathfinder', 'overlay');



  // Create split container
  const splitContainer = document.createElement('iframe');
  splitContainer.id = 'flowstate-split-screen';
  splitContainer.className = 'pathfinder-'
  });

  // Add resize functionality
  addResizeFunctionality(originalSide, interpretedSide);

  // Assemble the split screen
  splitContainer.appendChild(originalSide);
  splitContainer.appendChild(interpretedSide);

  // Replace the entire page with our split screen
  document.body.innerHTML = '';
  document.body.appendChild(overlay);
  document.body.appendChild(splitContainer);

  splitScreenActive = true; // UNCOMMENTED: Set to true
  console.log("Split Screen activated - 50/50 resizable");
}

function addResizeFunctionality(originalSide: HTMLElement, interpretedSide: HTMLElement) {
  let isResizing = false;
  let startX: number;
  let startLeftWidth: number;

  const resizeHandle = document.createElement('div');
  Object.assign(resizeHandle.style, {
    width: '4px',
    height: '100%',
    backgroundColor: '#ccc',
    cursor: 'col-resize',
    position: 'absolute',
    left: '50%',
    top: '0',
    zIndex: '1000000',
    transform: 'translateX(-50%)'
  });

  //add handle to the container
  const container = originalSide.parentElement;
  if(container){
    container.style.position = 'relative';
    container.appendChild(resizeHandle);
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) {return;}

    const dx = e.clientX - startX;
    const containerWidth = container?.offsetWidth || window.innerWidth;

    //get new wdith
    const newLeftWidth = Math.max(
        200,
        Math.min(
            containerWidth - 200,
            startLeftWidth + dx)
    );


    originalSide.style.width = `${newLeftWidth}px`;

    interpretedSide.style.width = '';
    interpretedSide.style.flex = '1';

    resizeHandle.style.left = `${newLeftWidth}px`;

    e.preventDefault();
  }

  //stop resizing
  const handleMouseUp = () => {
    if(!isResizing){return;}

    isResizing = false;

    document.body.style.userSelect = '';
    document.body.style.cursor = '';

    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp)
  }

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startLeftWidth = originalSide.offsetWidth;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    //add listeners for move and up
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    e.preventDefault();
    e.stopPropagation();
  });

  //mouse move to handle resizing



  // resizeHandle.addEventListener('mousedown', () => {
  //     document.addEventListener('mousemove', handleMouseMove);
  //     document.addEventListener('mouseup', handleMouseUp);
  // });

  const borderResizeArea = document.createElement('div');
  Object.assign(borderResizeArea.style, {
    position: 'absolute',
    right: '-5px',
    top: '0',
    width: '10px',
    height: '100%',
    cursor: 'col-resize',
    zIndex: '999999'
  })

  originalSide.style.position = 'relative';
  originalSide.appendChild(borderResizeArea);

  //border area also need to trigger resize
  borderResizeArea.addEventListener('mousedown', (e) => {
    resizeHandle.dispatchEvent(new MouseEvent('mousedown', e));
  })

  return () => {
    resizeHandle.remove();
    borderResizeArea.remove();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}


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
    
    .cta-section {
      margin-top: 20px;
      padding: 16px;
      background: #1e293b;
      border-radius: 12px;
    }
    
    .cta-section-title {
      font-size: 14px;
      font-weight: 600;
      color: #6366f1;
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
      border-color: #6366f1;
      transform: translateX(4px);
    }
    
    .cta-item.primary-cta {
      border-left: 3px solid #6366f1;
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
 * Creates the floating activation button
 */
function createFloatingButton(): HTMLElement {
  const existing = document.getElementById("flowstate-float-btn");
  if (existing) existing.remove();

  const button = document.createElement("div");
  button.id = "flowstate-float-btn";

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

  button.addEventListener("mouseenter", () => {
    button.style.transform = "scale(1.1)";
    button.style.boxShadow = "0 6px 24px rgba(99, 102, 241, 0.6)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.transform = "scale(1)";
    button.style.boxShadow = "0 4px 20px rgba(99, 102, 241, 0.5)";
  });

  button.addEventListener("click", toggleSidebar);

  document.body.appendChild(button);
  floatingButton = button;

  return button;
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
=======
>>>>>>> parent of 23a8a9c (Merge pull request #8 from gordlin/main)
        }
        
        /* Original side - 50% width, resizable */
        .pathfinder-original-side {
            width: 50% ;  //removed important
            height: 100vh !important;
            transition: width 0.1s ease;
            overflow: auto !important;
            background: white !important;
            pointer-events: auto !important;
            resize: horizontal !important;
            min-width: 20% !important;
            max-width: 80% !important;
            overflow-x: auto !important;
        }
        
        /* Resize handle visual feedback */
        .pathfinder-original-side:active {
            cursor: col-resize !important;
        }
        
        /* Interpreted side - takes remaining space */
        .pathfinder-interpreted-side {
            flex: 1 !important;
            height: 100vh !important;
            background: #f5f5f5 !important;
            border-left: 2px solid #ccc !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            color: #666 !important;
            font-family: Arial, sans-serif !important;
            pointer-events: auto !important;
            padding: 20px !important;
            box-sizing: border-box !important;
            min-width: 20% !important;
        }
        
        .pathfinder-page-overlay {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            background: rgba(0, 0, 0, 0.01) !important;
            z-index: 999998 !important;
            pointer-events: auto !important;
            display: none !important;
        }
        
        .pathfinder-interpreted-side h3 {
            color: #333 !important;
            margin-bottom: 10px !important;
        }
        
        .pathfinder-interpreted-side p {
            text-align: center !important;
            max-width: 300px !important;
        }
        
        .inline-close-btn {
            background: #ff4757 !important;
            color: white !important;
            border: none !important;
            padding: 8px 16px !important;
            border-radius: 4px !important;
            cursor: pointer !important;
            font-size: 14px !important;
            font-weight: 600 !important;
            margin-top: 20px !important;
        }
        
        .inline-close-btn:hover {
            background: #ff3742 !important;
        }
        
        /* Prevent text selection during resize */
        .pathfinder-split-container * {
            user-select: none !important;
        }
        
        .pathfinder-original-side * {
            user-select: auto !important;
        }
    `;
    document.head.appendChild(style);
}

function createSplitScreen() {
    if (splitScreenActive) return;

    // Inject styles if not already injected
    if (!document.querySelector('style[data-pathfinder="split-screen"]')) {
        injectSplitScreenStyles();
    }

    const overlay = document.createElement('div');
    overlay.className = 'pathfinder-page-overlay';
    overlay.style.display = 'block';
    overlay.setAttribute('data-pathfinder', 'overlay');

    // Create split container
    splitContainer = document.createElement('div');
    splitContainer.className = 'pathfinder-split-container';
    splitContainer.setAttribute('data-pathfinder', 'split-container');

    // Create left side (original content)
    const originalSide = document.createElement('div');
    originalSide.className = 'pathfinder-original-side'; //  FIXED: Correct class name
    originalSide.setAttribute('data-pathfinder', 'original-side');

    // Clone the original body content
    const bodyClone = document.body.cloneNode(true) as HTMLElement;

    // Remove any existing Pathfinder elements from the clone
    const existingContainers = bodyClone.querySelectorAll('[data-pathfinder]');
    existingContainers.forEach(el => el.remove());

    // Add the cloned content to the left side
    originalSide.appendChild(bodyClone);

    // Create right side (interpreted content)
    const interpretedSide = document.createElement('div');
    interpretedSide.className = 'pathfinder-interpreted-side';
    interpretedSide.setAttribute('data-pathfinder', 'interpreted-side');
    interpretedSide.innerHTML = `
        <h3>Pathfinder Panel</h3>
        <p>This area will show the simplified content for the given web page</p>
        <button class="inline-close-btn">Exit Split View</button>
    `;

    // Add event listener to the close button
    interpretedSide.querySelector('.inline-close-btn')?.addEventListener('click', () => {
        exitSplitScreen();
    });

    // Add resize functionality
    addResizeFunctionality(originalSide, interpretedSide);

    // Assemble the split screen
    splitContainer.appendChild(originalSide);
    splitContainer.appendChild(interpretedSide);

    // Replace the entire page with our split screen
    document.body.innerHTML = '';
    document.body.appendChild(overlay);
    document.body.appendChild(splitContainer);

    splitScreenActive = true; // UNCOMMENTED: Set to true
    console.log("Split Screen activated - 50/50 resizable");
}

function addResizeFunctionality(originalSide: HTMLElement, interpretedSide: HTMLElement) {
    let isResizing = false;
    let startX: number;
    let startLeftWidth: number;

    const resizeHandle = document.createElement('div');
    Object.assign(resizeHandle.style, {
        width: '4px',
        height: '100%',
        backgroundColor: '#ccc',
        cursor: 'col-resize',
        position: 'absolute',
        left: '50%',
        top: '0',
        zIndex: '1000000',
        transform: 'translateX(-50%)'
    });

    //add handle to the container
    const container = originalSide.parentElement;
    if(container){
        container.style.position = 'relative';
        container.appendChild(resizeHandle);
    }

    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) {return;}

        const dx = e.clientX - startX;
        const containerWidth = container?.offsetWidth || window.innerWidth;

        //get new wdith
        const newLeftWidth = Math.max(
            200,
            Math.min(
                containerWidth - 200,
                startLeftWidth + dx)
        );


        originalSide.style.width = `${newLeftWidth}px`;

        interpretedSide.style.width = '';
        interpretedSide.style.flex = '1';

        resizeHandle.style.left = `${newLeftWidth}px`;

        e.preventDefault();
    }

    //stop resizing
    const handleMouseUp = () => {
        if(!isResizing){return;}

        isResizing = false;

        document.body.style.userSelect = '';
        document.body.style.cursor = '';

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp)
    }

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startLeftWidth = originalSide.offsetWidth;

        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';

        //add listeners for move and up
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        e.preventDefault();
        e.stopPropagation();
    });

    //mouse move to handle resizing



        // resizeHandle.addEventListener('mousedown', () => {
        //     document.addEventListener('mousemove', handleMouseMove);
        //     document.addEventListener('mouseup', handleMouseUp);
        // });

        const borderResizeArea = document.createElement('div');
        Object.assign(borderResizeArea.style, {
            position: 'absolute',
            right: '-5px',
            top: '0',
            width: '10px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: '999999'
        })

        originalSide.style.position = 'relative';
        originalSide.appendChild(borderResizeArea);

        //border area also need to trigger resize
        borderResizeArea.addEventListener('mousedown', (e) => {
            resizeHandle.dispatchEvent(new MouseEvent('mousedown', e));
        })

        return () => {
            resizeHandle.remove();
            borderResizeArea.remove();
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
}

function exitSplitScreen() {
    if (!splitScreenActive || !splitContainer) return;

    // Get the original side as HTMLElement
    const originalSide = splitContainer.querySelector('.pathfinder-original-side');

    if (originalSide instanceof HTMLElement && originalSide.children.length > 0) {
        // The first child should be our cloned body
        const clonedBody = originalSide.children[0] as HTMLElement;

        // Clear current body
        document.body.innerHTML = '';

        // Move all children from cloned body to current body
        while (clonedBody.children.length > 0) {
            document.body.appendChild(clonedBody.children[0]);
        }

        // Copy body attributes
        document.body.className = clonedBody.className;
        document.body.setAttribute('style', clonedBody.getAttribute('style') || '');

        // Copy any other attributes
        for (const attr of clonedBody.attributes) {
            if (attr.name !== 'class' && attr.name !== 'style') {
                document.body.setAttribute(attr.name, attr.value);
            }
        }
    } else {
        // Fallback: reload the page
        console.warn('Could not find original content, reloading page');
        location.reload();
        return;
    }

    // Clean up
    splitContainer.remove();
    document.querySelector('.pathfinder-page-overlay')?.remove();

    splitContainer = null;
    splitScreenActive = false;
    console.log('Split Screen deactivated');
}

// Listen for messages from background or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('Content script received message:', message.action);

    if (message.action === 'activateSplitScreen') {
        createSplitScreen();
        sendResponse({ success: true });
    } else if (message.action === 'deactivateSplitScreen') {
        exitSplitScreen();
        sendResponse({ success: true });
    } else if (message.action === 'getSplitScreenStatus') {
        sendResponse({ active: splitScreenActive });
    }
    return true;
});

// Debug helper (development only)
if (import.meta.env?.DEV) {
    console.log('Pathfinder debug mode enabled');
    (window as any).Pathfinder = {
        activateSplitScreen: createSplitScreen,
        deactivateSplitScreen: exitSplitScreen,
        isSplitScreenActive: () => splitScreenActive
    };
}
// Also expose a global function for direct access
// Instead, just add this for debugging:
// if (process.env.NODE_ENV === 'development') {
//     // Only expose in development mode
//     window.Pathfinder = {
//         activateSplitScreen: createSplitScreen,
//         deactivateSplitScreen: exitSplitScreen,
//         isSplitScreenActive: () => splitScreenActive
//     };
//     console.log('🚧 Pathfinder debug API enabled (dev mode only)');
//     }