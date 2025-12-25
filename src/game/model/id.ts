let counter = 0;

export function makeId(prefix = "id"): string {
    counter += 1;
    return `${prefix}-${counter}`;
}
