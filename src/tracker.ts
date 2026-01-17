interface TrackerEvent {
    type: string;
    element?: string;
    timestamp: number;
    duration?: number;
    count?: number;
    x?: number;
    y?: number;
    from?: number;
    to?: number;
}

interface ClickEntry {
    time: number;
    element: Element;
}

interface ScrollEntry {
    time: number;
    direction: number;
}

interface Features {
    events: TrackerEvent[];
    rage_rate: number;
    dwell_time: number;
    scroll_back: number;
}

export function initTracker() {
    console.log('tracker loaded');

    const events: TrackerEvent[] = [];
    const mousePos = { x: 0, y: 0 };
    let clickHistory: ClickEntry[] = [];
    const scrollHistory: ScrollEntry[] = [];
    let hoverStart: number | null = null;
    let hoverElement: Element | null = null;
    let lastScrollY = 0;

    document.onmousemove = handleMouseMove;
    document.onclick = handleClick;
    document.onscroll = handleScroll;

    function handleMouseMove(event: MouseEvent) {
        mousePos.x = event.clientX;
        mousePos.y = event.clientY;

        const element = document.elementFromPoint(event.clientX, event.clientY);

        if (element !== hoverElement) {
            if (hoverElement && hoverStart) {
                const duration = Date.now() - hoverStart;
                if (duration > 2000) {
                    const evt = {
                        type: 'dwell',
                        element: getSelector(hoverElement),
                        duration: duration,
                        timestamp: Date.now()
                    };
                    events.push(evt);
                    console.log('[Flowstate] dwell', evt.element, `${(duration/1000).toFixed(1)}s`);
                }
            }
            hoverElement = element;
            hoverStart = Date.now();
        }
    }

    function handleClick(event: MouseEvent) {
        const now = Date.now();
        const element = event.target as Element;

        clickHistory.push({ time: now, element: element });

        while (clickHistory.length > 0 && now - clickHistory[0].time > 500) {
            clickHistory.shift();
        }

        const selector = getSelector(element);
        events.push({
            type: 'click',
            element: selector,
            x: event.clientX,
            y: event.clientY,
            timestamp: now
        });
        console.log('[Flowstate] click', selector);

        if (clickHistory.length >= 3) {
            events.push({
                type: 'rage_click',
                element: selector,
                count: clickHistory.length,
                timestamp: now
            });
            console.log('[Flowstate] rage_click', selector, `${clickHistory.length} clicks`);
            clickHistory = [];
        }

        if (!isInteractive(element)) {
            events.push({
                type: 'dead_click',
                element: selector,
                timestamp: now
            });
            console.log('[Flowstate] dead_click', selector);
        }
    }

    function handleScroll() {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const now = Date.now();

        scrollHistory.push({ time: now, direction: scrollY });

        while (scrollHistory.length > 0 && now - scrollHistory[0].time > 5000) {
            scrollHistory.shift();
        }

        if (scrollY < lastScrollY && scrollHistory.length >= 2) {
            let reversals = 0;
            for (let i = 1; i < scrollHistory.length; i++) {
                const prev = scrollHistory[i - 1].direction;
                const curr = scrollHistory[i].direction;
                if ((prev < curr && scrollHistory[i - 1].direction > scrollHistory[i].direction) ||
                    (prev > curr && scrollHistory[i - 1].direction < scrollHistory[i].direction)) {
                    reversals++;
                }
            }

            if (reversals > 0) {
                events.push({
                    type: 'scroll_reversal',
                    from: lastScrollY,
                    to: scrollY,
                    timestamp: now
                });
                console.log('[Flowstate] scroll_reversal', `${lastScrollY} → ${scrollY}`);
            }
        }

        lastScrollY = scrollY;
    }

    function getSelector(element: Element | null): string {
        if (!element) return 'unknown';
        if (element.id) return '#' + element.id;
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter((c: string) => c);
            if (classes.length > 0) return '.' + classes[0];
        }
        return element.tagName.toLowerCase();
    }

    function isInteractive(element: Element): boolean {
        const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
        return interactiveTags.includes(element.tagName) ||
               (element as HTMLElement).onclick !== null ||
               element.getAttribute('role') === 'button';
    }

    function getFeatures(): Features {
        const rageClicks = events.filter(e => e.type === 'rage_click');
        const dwellEvents = events.filter(e => e.type === 'dwell');
        const scrollReversals = events.filter(e => e.type === 'scroll_reversal');
        const allClicks = events.filter(e => e.type === 'click');

        const rage_rate_avg = allClicks.length > 0 ? rageClicks.length / allClicks.length : 0;

        let totalDwell = 0;
        for (let i = 0; i < dwellEvents.length; i++) {
            totalDwell += dwellEvents[i].duration || 0;
        }
        const dwell_time_avg = dwellEvents.length > 0 ? totalDwell / dwellEvents.length : 0;

        const scroll_back_avg = scrollReversals.length;

        return {
            events: events,
            rage_rate: rage_rate_avg,
            dwell_time: dwell_time_avg,
            scroll_back: scroll_back_avg
        };
    }

    setInterval(() => {
        const features = getFeatures();
        console.log('features:', features);
    }, 10000);

    return {
        getEvents: () => events,
        getFeatures: getFeatures
    };
}
