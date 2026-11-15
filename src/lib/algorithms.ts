export const algorithms: string[] = [
  "bubbleSort",
  "mergeSort",
  "quickSort",
  "selectionSort",
];

export type Highlight = { i: number; j: number };
export type SortStep = { array: number[]; active: Highlight[] };

export type SortGenerator = (input: number[]) => Generator<SortStep>;

export function* selectionSort(arr: number[]): Generator<SortStep> {
  const array = [...arr];
  for (let i = 0; i < array.length - 1; i++) {
    let min = i;
    for (let j = i; j < array.length; j++) {
      if (array[j] < array[min]) {
        min = j;
      }
      yield { array: [...array], active: [{ i, j }] };
    }
    [array[i], array[min]] = [array[min], array[i]];
  }
  yield { array: [...array], active: [] };
}

export function* mergeSort(arr: number[]): Generator<SortStep> {
  const array = [...arr];
  const active = new Set<Highlight>();
  yield* mergeSortRange(array, 0, array.length);
  yield { array: [...array], active: [] };
}

function* mergeSortRange(
  array: number[],
  start: number,
  end: number,
): Generator<SortStep> {
  if (end - start < 2) {
    return;
  }
  const mid = Math.floor((start + end) / 2);
  yield* mergeSortRange(array, start, mid);
  yield* mergeSortRange(array, mid, end);

  // Copies, because writing back into array overwrites these slots.
  const left = array.slice(start, mid);
  const right = array.slice(mid, end);
  let leftIndex = 0;
  let rightIndex = 0;
  let k = start;

  while (leftIndex < left.length && rightIndex < right.length) {
    yield { array: [...array], active: [{ i: leftIndex, j: rightIndex }] };

    if (left[leftIndex] < right[rightIndex]) {
      array[k] = left[leftIndex];
      leftIndex++;
    } else {
      array[k] = right[rightIndex];
      rightIndex++;
    }
    k++;
  }

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

export const sortFunctions: Partial<Record<string, SortGenerator>> = {
  mergeSort,
  selectionSort,
};
