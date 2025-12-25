export type LoopHandle = { stop: () => void };

export function startLoop(tick: (dtMs: number) => void): LoopHandle {
    let raf = 0;
    let last = performance.now();
    let running = true;

    const frame = (now: number) => {
        if (!running) return;
        const dt = now - last;
        last = now;
        tick(dt);
        raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    return {
        stop: () => {
            running = false;
            cancelAnimationFrame(raf);
        },
    };
}
