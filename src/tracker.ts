interface TrackerEvent {
    type: string;
    element?: string;
    elementType?: string;  // 'heading' | 'paragraph' | 'list' | 'interactive' | 'other'
    timestamp: number;
    duration?: number;
    count?: number;
    x?: number;
    y?: number;
    from?: number;
    to?: number;
    speed?: number;        // px/ms for scroll events
    text?: string;         // selected text or element text snippet
}

interface ScrollSample {
    time: number;
    position: number;
}

interface Features {
    events: TrackerEvent[];
    // Scanner signals
    avg_scroll_speed: number;
    heading_dwell_ratio: number;  // % of dwells on headings vs content
    // Stumbler signals
    scroll_reversal_count: number;
    avg_dwell_time: number;
    long_dwell_count: number;     // dwells > 5s
    text_selection_count: number;
}

export function initTracker() {
    console.log('[Flowstate] tracker loaded');

    const sessionStart = Date.now();
    const events: TrackerEvent[] = [];
    let clickHistory: { time: number; element: Element }[] = [];
    const scrollSamples: ScrollSample[] = [];
    let hoverStart: number | null = null;
    let hoverElement: Element | null = null;
    let lastScrollY = 0;
    let lastScrollTime = Date.now();

    // Format timestamp as MM:SS relative to session start
    function formatTime(timestamp: number): string {
        const elapsed = Math.floor((timestamp - sessionStart) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    }

    // Get readable description of an element
    function getReadableElement(element: Element): string {
        // Try to get meaningful text
        const text = element.textContent?.trim().slice(0, 50) || '';
        const tag = element.tagName.toLowerCase();

        // For headings, use the heading text
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            return `"${text}" heading`;
        }
        // For buttons/links, describe the action
        if (tag === 'button' || tag === 'a') {
            return `"${text}" ${tag === 'a' ? 'link' : 'button'}`;
        }
        // For inputs, describe the field
        if (tag === 'input' || tag === 'textarea') {
            const label = element.getAttribute('placeholder') || element.getAttribute('name') || 'field';
            return `"${label}" input`;
        }
        // For paragraphs with text
        if (text.length > 0) {
            return `"${text}${text.length >= 50 ? '...' : ''}" section`;
        }
        // Fallback to selector
        return getSelector(element);
    }

    // Log event in narrative format
    function logEvent(message: string) {
        console.log(`[Flowstate] ${formatTime(Date.now())}: ${message}`);
    }

    // Find the nearest heading at a scroll position
    function getVisibleHeading(scrollPos: number): string {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let nearestHeading = 'top of page';
        let nearestDist = Infinity;

        headings.forEach(h => {
            const rect = h.getBoundingClientRect();
            const headingPos = rect.top + scrollPos;
            const dist = Math.abs(headingPos - scrollPos);
            if (dist < nearestDist && headingPos <= scrollPos + window.innerHeight) {
                nearestDist = dist;
                const text = h.textContent?.trim().slice(0, 30) || '';
                nearestHeading = `"${text}" section`;
            }
        });

        return nearestHeading;
    }

    // Attach listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick);
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('selectionchange', handleSelection);

    function handleMouseMove(event: MouseEvent) {
        const element = document.elementFromPoint(event.clientX, event.clientY);

        if (element !== hoverElement) {
            // Record dwell if > 2s
            if (hoverElement && hoverStart) {
                const duration = Date.now() - hoverStart;
                if (duration > 2000) {
                    const elType = getElementType(hoverElement);
                    const textSnippet = getTextSnippet(hoverElement);
                    events.push({
                        type: 'dwell',
                        element: getSelector(hoverElement),
                        elementType: elType,
                        duration: duration,
                        timestamp: Date.now(),
                        text: textSnippet
                    });
                    const dwellDesc = textSnippet ? `"${textSnippet.slice(0, 40)}${textSnippet.length > 40 ? '...' : ''}"` : elType;
                    logEvent(`User stopped at ${dwellDesc} for ${(duration/1000).toFixed(1)}s.`);
                }
            }
            hoverElement = element;
            hoverStart = Date.now();
        }
    }

    function handleClick(event: MouseEvent) {
        const now = Date.now();
        const element = event.target as Element;

        clickHistory.push({ time: now, element });
        clickHistory = clickHistory.filter(c => now - c.time < 500);

        const selector = getSelector(element);
        const elType = getElementType(element);

        events.push({
            type: 'click',
            element: selector,
            elementType: elType,
            x: event.clientX,
            y: event.clientY,
            timestamp: now
        });
        logEvent(`User clicked on ${getReadableElement(element)}.`);

        // Rage click: 3+ clicks in 500ms
        if (clickHistory.length >= 3) {
            events.push({
                type: 'rage_click',
                element: selector,
                elementType: elType,
                count: clickHistory.length,
                timestamp: now
            });
            logEvent(`User rage-clicked on ${getReadableElement(element)} (${clickHistory.length}x in 500ms).`);
            clickHistory = [];
        }

        // Dead click: non-interactive element
        if (!isInteractive(element)) {
            events.push({
                type: 'dead_click',
                element: selector,
                elementType: elType,
                timestamp: now
            });
            logEvent(`User clicked on non-interactive ${getReadableElement(element)} (dead click).`);
        }
    }

    function handleScroll() {
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const now = Date.now();
        const timeDelta = now - lastScrollTime;
        const posDelta = Math.abs(scrollY - lastScrollY);

        // Calculate scroll speed (px/ms)
        const speed = timeDelta > 0 ? posDelta / timeDelta : 0;

        scrollSamples.push({ time: now, position: scrollY });
        // Keep last 5 seconds of samples
        while (scrollSamples.length > 0 && now - scrollSamples[0].time > 5000) {
            scrollSamples.shift();
        }

        // Detect direction change (reversal)
        if (scrollSamples.length >= 3) {
            const recent = scrollSamples.slice(-3);
            const dir1 = recent[1].position - recent[0].position; // first movement
            const dir2 = recent[2].position - recent[1].position; // second movement

            // Direction changed (was going down, now going up or vice versa)
            if ((dir1 > 10 && dir2 < -10) || (dir1 < -10 && dir2 > 10)) {
                events.push({
                    type: 'scroll_reversal',
                    from: recent[0].position,
                    to: scrollY,
                    speed: speed,
                    timestamp: now
                });
                const direction = dir2 < 0 ? 'up' : 'down';
                const fromSection = getVisibleHeading(recent[0].position);
                const toSection = getVisibleHeading(scrollY);
                logEvent(`User scrolled ${direction} from ${fromSection} back to ${toSection}.`);
            }
        }

        // Track fast scrolls (Scanner signal)
        if (speed > 2 && posDelta > 200) {  // > 2px/ms and moved > 200px
            events.push({
                type: 'fast_scroll',
                from: lastScrollY,
                to: scrollY,
                speed: speed,
                timestamp: now
            });
            const fromSection = getVisibleHeading(lastScrollY);
            const toSection = getVisibleHeading(scrollY);
            logEvent(`User scrolled quickly past ${fromSection} to ${toSection}.`);
        }

        lastScrollY = scrollY;
        lastScrollTime = now;
    }

    function handleSelection() {
        const selection = document.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (text.length < 3 || text.length > 500) return;  // Ignore tiny or huge selections

        // Debounce: don't log same selection repeatedly
        const lastSelection = events.filter(e => e.type === 'text_selection').pop();
        if (lastSelection?.text === text) return;

        // Find what element the selection is in
        const anchorNode = selection.anchorNode;
        const element = anchorNode?.parentElement;
        const elType = element ? getElementType(element) : 'unknown';

        events.push({
            type: 'text_selection',
            element: element ? getSelector(element) : 'unknown',
            elementType: elType,
            text: text,
            timestamp: Date.now()
        });
        const wordCount = text.split(/\s+/).length;
        const desc = wordCount <= 3 ? `the word "${text}"` : `"${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`;
        logEvent(`User highlighted ${desc}.`);
    }

    function getSelector(element: Element | null): string {
        if (!element) return 'unknown';
        if (element.id) return '#' + element.id;
        if (element.className && typeof element.className === 'string') {
            const cls = element.className.split(' ').filter(c => c)[0];
            if (cls) return '.' + cls;
        }
        return element.tagName.toLowerCase();
    }

    function getElementType(element: Element): string {
        const tag = element.tagName.toUpperCase();

        if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) return 'heading';
        if (['P', 'ARTICLE', 'SECTION', 'BLOCKQUOTE'].includes(tag)) return 'paragraph';
        if (['UL', 'OL', 'LI', 'DL', 'DT', 'DD'].includes(tag)) return 'list';
        if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return 'interactive';
        if (['IMG', 'VIDEO', 'FIGURE', 'CANVAS', 'SVG'].includes(tag)) return 'media';
        if (['TABLE', 'TR', 'TD', 'TH', 'THEAD', 'TBODY'].includes(tag)) return 'table';
        if (['CODE', 'PRE', 'KBD'].includes(tag)) return 'code';
        if (['STRONG', 'B', 'EM', 'I', 'MARK'].includes(tag)) return 'emphasis';

        // Check parent for context
        const parent = element.parentElement;
        if (parent) {
            const parentTag = parent.tagName.toUpperCase();
            if (['P', 'ARTICLE', 'SECTION'].includes(parentTag)) return 'paragraph';
            if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(parentTag)) return 'heading';
        }

        return 'other';
    }

    function getTextSnippet(element: Element): string {
        const text = element.textContent?.trim() || '';
        return text.slice(0, 100);
    }

    function isInteractive(element: Element): boolean {
        const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
        return interactiveTags.includes(element.tagName) ||
               (element as HTMLElement).onclick !== null ||
               element.getAttribute('role') === 'button' ||
               element.closest('a, button') !== null;
    }

    function getFeatures(): Features {
        const dwells = events.filter(e => e.type === 'dwell');
        const scrollReversals = events.filter(e => e.type === 'scroll_reversal');
        const fastScrolls = events.filter(e => e.type === 'fast_scroll');
        const textSelections = events.filter(e => e.type === 'text_selection');

        // Scanner signals
        const avgScrollSpeed = fastScrolls.length > 0
            ? fastScrolls.reduce((sum, e) => sum + (e.speed || 0), 0) / fastScrolls.length
            : 0;

        const headingDwells = dwells.filter(e => e.elementType === 'heading').length;
        const contentDwells = dwells.filter(e => e.elementType === 'paragraph').length;
        const headingDwellRatio = (headingDwells + contentDwells) > 0
            ? headingDwells / (headingDwells + contentDwells)
            : 0;

        // Stumbler signals
        const avgDwellTime = dwells.length > 0
            ? dwells.reduce((sum, e) => sum + (e.duration || 0), 0) / dwells.length
            : 0;

        const longDwells = dwells.filter(e => (e.duration || 0) > 5000).length;

        return {
            events,
            avg_scroll_speed: avgScrollSpeed,
            heading_dwell_ratio: headingDwellRatio,
            scroll_reversal_count: scrollReversals.length,
            avg_dwell_time: avgDwellTime,
            long_dwell_count: longDwells,
            text_selection_count: textSelections.length
        };
    }

    // Log session summary every 30s
    setInterval(() => {
        const f = getFeatures();
        if (f.events.length === 0) return;

        // Classify user based on signals
        const isScanner = f.avg_scroll_speed > 1 && f.heading_dwell_ratio > 0.5;
        const isStumbler = f.scroll_reversal_count > 3 || f.long_dwell_count > 2 || f.text_selection_count > 1;

        let classification = 'Undetermined';
        if (isScanner && !isStumbler) classification = 'Scanner (skimming content)';
        else if (isStumbler && !isScanner) classification = 'Stumbler (struggling with content)';
        else if (isScanner && isStumbler) classification = 'Mixed signals';

        logEvent(`--- Session Summary ---`);
        logEvent(`Total events: ${f.events.length}`);
        logEvent(`Avg scroll speed: ${(f.avg_scroll_speed * 1000).toFixed(0)}px/s`);
        logEvent(`Scroll reversals: ${f.scroll_reversal_count}`);
        logEvent(`Long dwells (>5s): ${f.long_dwell_count}`);
        logEvent(`Text selections: ${f.text_selection_count}`);
        logEvent(`User classification: ${classification}`);
        logEvent(`-----------------------`);
    }, 30000);

    return {
        getEvents: () => events,
        getFeatures: getFeatures
    };
}
