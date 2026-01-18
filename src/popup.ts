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

    popupButton = document.createElement('div');
    popupButton.id = 'flowstate-popup';
    popupButton.innerHTML = `
        <div class="flowstate-bubble">
            <button class="flowstate-close" aria-label="Dismiss">×</button>
            <div class="flowstate-message">${message}</div>
            <button class="flowstate-accept">Simplify for me</button>
        </div>
    `;

    document.body.appendChild(popupButton);

    // Event listeners
    const acceptBtn = popupButton.querySelector('.flowstate-accept');
    const closeBtn = popupButton.querySelector('.flowstate-close');

    acceptBtn?.addEventListener('click', () => {
        hideButton();
        onAccept();
    });

    closeBtn?.addEventListener('click', () => {
        hideButton();
        onDismiss?.();
    });
}

export function hideButton() {
    if (!popupButton) return;

    // Animate out
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
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes flowstate-slide-out {
        from {
            opacity: 1;
            transform: translateY(0);
        }
        to {
            opacity: 0;
            transform: translateY(20px);
        }
    }

    @keyframes flowstate-pulse {
        0%, 100% { box-shadow: 0 4px 20px rgba(56, 189, 248, 0.3); }
        50% { box-shadow: 0 4px 30px rgba(56, 189, 248, 0.5); }
    }

    .flowstate-bubble {
        background: #1e1e2e;
        color: #fff;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 280px;
        position: relative;
        animation: flowstate-pulse 2s ease-in-out infinite;
    }

    .flowstate-close {
        position: absolute;
        top: 8px;
        right: 12px;
        background: none;
        border: none;
        color: #888;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }

    .flowstate-close:hover {
        color: #fff;
    }

    .flowstate-message {
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 12px;
        padding-right: 20px;
    }

    .flowstate-accept {
        background: #38bdf8;
        color: #0c1825;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        width: 100%;
        transition: background 0.2s;
    }

    .flowstate-accept:hover {
        background: #0ea5e9;
    }

    .flowstate-sliding-out {
        animation: flowstate-slide-out 0.2s ease-in forwards;
    }
`;