export type PointerPos = { x: number; y: number };

export function getCanvasPointerPos(e: PointerEvent, canvas: HTMLCanvasElement): PointerPos {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
}
