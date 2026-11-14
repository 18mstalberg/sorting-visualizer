export const algorithms: string[] = [
  "bubbleSort",
  "binarySort",
  "quickSort",
  "bruteForce",
];
export type SortStep = { array: number[]; i: number; j: number };

export async function bruteForce(
  arr: number[],
  onStep: (step: SortStep) => void,
): Promise<number[]> {
  let array = [...arr];
  for (let i = 0; i < array.length; i++) {
    for (let j = 0; j < array.length; j++) {
      if (array[j] > array[i]) {
        let higher = array[j];
        let lower = array[i];
        array[j] = lower;
        array[i] = higher;
      }
      onStep({ array: [...array], i, j });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  return Promise.resolve(array);
}
