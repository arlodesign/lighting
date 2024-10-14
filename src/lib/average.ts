export default function getAverage(arr: number[] | Uint8Array): number {
  return [...arr].reduce((a, b) => a + b, 0);
}
