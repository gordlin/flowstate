console.log("Pathfinder content script running!");

let splitScreenActive = false;
let splitContainer: HTMLDivElement | null = null;

function injectSplitScreenStyles() {
    const style = document.createElement('style');
    style.setAttribute('data-pathfinder', 'split-screen');
    style.textContent = `
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