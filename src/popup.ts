let popupButton: HTMLDivElement | null = null;
let styleElement: HTMLStyleElement | null = null;

function injectStyles() {
    if (styleElement) return;

    styleElement = document.createElement('style');
    styleElement.setAttribute('data-flowstate', 'popup-styles');
    styleElement.textContent = POPUP_STYLES;
    document.head.appendChild(styleElement);
}

export function showButton(
    message: string = 'Losing focus? Let me help.',
    onAccept: () => void,
    onDismiss?: () => void
) {
    if (popupButton) return;

    injectStyles();

    // Use UI-sized icon (not 128px)
    const logoUrl = chrome.runtime.getURL('assets/flowstate48.png');

    popupButton = document.createElement('div');
    popupButton.id = 'flowstate-popup';

    popupButton.innerHTML = `
        <div class="flowstate-bubble">
            <button class="flowstate-close" aria-label="Dismiss">×</button>

            <div class="flowstate-content-wrapper">
                <div class="flowstate-logo-wrapper">
                    <img
                        src="${logoUrl}"
                        alt="FlowState"
                        class="flowstate-logo"
                        draggable="false"
                    />
                </div>

                <div class="flowstate-text-wrapper">
                    <div class="flowstate-message">${message}</div>
                    <button class="flowstate-accept">Simplify for me</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(popupButton);

    popupButton.querySelector('.flowstate-accept')?.addEventListener('click', () => {
        hideButton();
        onAccept();
    });

    popupButton.querySelector('.flowstate-close')?.addEventListener('click', () => {
        hideButton();
        onDismiss?.();
    });
}

export function hideButton() {
    if (!popupButton) return;

    popupButton.classList.add('flowstate-sliding-out');

    setTimeout(() => {
        popupButton?.remove();
        popupButton = null;
    }, 200);
}

export function isVisible(): boolean {
    return popupButton !== null;
}

const POPUP_STYLES = `
#flowstate-popup {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: flowstate-slide-in 0.3s ease-out;
}

@keyframes flowstate-slide-in {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes flowstate-slide-out {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(20px); }
}

@keyframes flowstate-pulse {
    0%, 100% { box-shadow: 0 4px 20px rgba(56, 189, 248, 0.25); }
    50% { box-shadow: 0 6px 28px rgba(56, 189, 248, 0.45); }
}

.flowstate-bubble {
    background: rgba(30, 30, 46, 0.9);
    backdrop-filter: blur(12px);
    color: #fff;
    padding: 16px;
    border-radius: 14px;
    max-width: 320px;
    position: relative;
    animation: flowstate-pulse 2s ease-in-out infinite;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.flowstate-content-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;
}

/* Icon container */
.flowstate-logo-wrapper {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25);
}

.flowstate-logo {
    width: 24px;
    height: 24px;
    object-fit: contain;
    user-select: none;
    pointer-events: none;
}

.flowstate-text-wrapper {
    flex: 1;
}

.flowstate-close {
    position: absolute;
    top: 6px;
    right: 8px;
    background: none;
    border: none;
    color: #64748b;
    font-size: 18px;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    transition: color 0.2s;
}

.flowstate-close:hover {
    color: #fff;
}

.flowstate-message {
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 12px;
    padding-right: 16px;
    color: #e2e8f0;
}

.flowstate-accept {
    background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
    color: #0c1825;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    transition: transform 0.1s, box-shadow 0.2s;
}

.flowstate-accept:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
}

.flowstate-sliding-out {
    animation: flowstate-slide-out 0.2s ease-in forwards;
}
`;
