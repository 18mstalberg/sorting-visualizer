export const algorithms: string[] = [
  "bubbleSort",
  "binarySort",
  "quickSort",
  "selection",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type SortStep = { array: number[]; i: number; j: number };

export async function selectionSort(
  arr: number[],
  onStep: (step: SortStep) => void,
): Promise<number[]> {
  const array = [...arr];
  for (let i = 0; i < array.length - 1; i++) {
    let min = i;
    for (let j = i; j < array.length; j++) {
      if (array[j] < array[min]) {
        min = j;
      }
      onStep({ array: [...array], i, j });
      await sleep(500);
    }
    [array[i], array[min]] = [array[min], array[i]];
  }
  return array;
}
