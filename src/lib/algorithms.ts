export const algorithms: string[] = [
  "bubbleSort",
  "mergeSort",
  "quickSort",
  "selectionSort",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One comparison in progress: i is the current slot, j is what it's compared with.
export type Highlight = { i: number; j: number };
export type SortStep = { array: number[]; active: Highlight[] };
export type SortFunction = (
  arr: number[],
  onStep: (step: SortStep) => void,
) => Promise<number[]>;

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
      onStep({ array: [...array], active: [{ i, j }] });
      await sleep(500);
    }
    [array[i], array[min]] = [array[min], array[i]];
  }
  return array;
}

export async function mergeSort(
  arr: number[],
  onStep: (step: SortStep) => void,
): Promise<number[]> {
  const array = [...arr];
  const active = new Set<Highlight>();
  await mergeSortRange(array, 0, array.length, active, onStep);
  return array;
}

async function mergeSortRange(
  array: number[],
  start: number,
  end: number,
  active: Set<Highlight>,
  onStep: (step: SortStep) => void,
): Promise<void> {
  if (end - start < 2) {
    return;
  }
  const mid = Math.floor((start + end) / 2);
  await Promise.all([
    mergeSortRange(array, start, mid, active, onStep),
    mergeSortRange(array, mid, end, active, onStep),
  ]);

  // Copies, because writing back into array overwrites these slots.
  const left = array.slice(start, mid);
  const right = array.slice(mid, end);
  let leftIndex = 0;
  let rightIndex = 0;
  let k = start;

  const highlight: Highlight = { i: start, j: mid };
  active.add(highlight);

  while (leftIndex < left.length && rightIndex < right.length) {
    highlight.i = k;
    highlight.j = mid + rightIndex;
    onStep({ array: [...array], active: [...active].map((h) => ({ ...h })) });
    await sleep(1500);

    if (left[leftIndex] < right[rightIndex]) {
      array[k] = left[leftIndex];
      leftIndex++;
    } else {
      array[k] = right[rightIndex];
      rightIndex++;
    }
    k++;
  }
  active.delete(highlight);

  while (leftIndex < left.length) {
    array[k] = left[leftIndex];
    leftIndex++;
    k++;
  }
  while (rightIndex < right.length) {
    array[k] = right[rightIndex];
    rightIndex++;
    k++;
  }
}


export const sortFunctions: Partial<Record<string, SortFunction>> = {
  mergeSort,
  selectionSort,
};
