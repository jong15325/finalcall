export function wrap(value: number) {
    return ((value % 1) + 1) % 1
}
