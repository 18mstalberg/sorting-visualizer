# Generator Refactor Guide

A guide to moving the sorting visualizer from **async + sleep + onStep** to **generators + a player**. You write the code yourself; this file explains the concepts and gives you starting snippets.

This guide has three parts:

1. [How it works](#part-1-how-it-works): the concepts.
2. [Warm-up project](#part-2-warm-up-project-towers-of-hanoi-player): a small standalone exercise to practice them.
3. [Refactor guide](#part-3-refactoring-the-visualizer): step-by-step changes to this repo.

---

## Part 1: How it works

### The problem with the current design

Right now each sort algorithm does three jobs:

```ts
for (...) {
  onStep({ array: [...array], active: [{ i, j }] }); // 1. reports a frame
  await sleep(500);                                   // 2. controls timing
  // ...                                              // 3. sorts
}
```

The algorithm also owns the clock, which causes these problems:

- **You can't pause.** The loop keeps going until it finishes.
- **You can't step back.** Old frames are thrown away.
- **You can't cancel.** Once the promise starts, it keeps calling `setNumbers`, even after you click Reset.
- **Speed is hardcoded inside each algorithm** (`500` in one, `1500` in another).
- **It's hard to test.** To check the result, you have to wait for the real `sleep()` calls to finish.

### The idea: the algorithm records frames, a player shows them

Split the work into two parts:

```
┌──────────────────────┐   frames   ┌───────────────────────────┐
│ Algorithm            │ ─────────▶ │ Player (React)            │
│ pure, synchronous    │            │ owns time: play, pause,   │
│ yields a frame for   │            │ step, scrub, speed        │
│ each comparison      │            │ shows frames[index]       │
└──────────────────────┘            └───────────────────────────┘
```

Think of a film strip. The algorithm records every frame. The player decides which frame is on screen and when to move to the next one. Pausing means "stop moving the index", stepping back means `index - 1`, and scrubbing means "set the index to whatever the slider says".

### Generators in 2 minutes

A **generator function** (`function*`) can pause partway through. Each `yield` hands out a value and freezes the function until someone asks for the next value.

```ts
function* countdown(n: number) {
  while (n > 0) {
    yield n;   // pause here and hand out n
    n--;
  }
  return "liftoff";
}

const it = countdown(3); // nothing has run yet!
it.next(); // { value: 3, done: false }
it.next(); // { value: 2, done: false }
it.next(); // { value: 1, done: false }
it.next(); // { value: "liftoff", done: true }
it.next(); // { value: undefined, done: true }  (used up)
```

Key facts:

| Fact | Why it matters here |
| --- | --- |
| Calling `countdown(3)` runs **none** of the body. It returns an iterator. | You decide when the work happens. |
| Each `.next()` runs the code up to the next `yield`. | One `next()` gives one frame. |
| Generators are **iterable**, so `for...of` and `[...gen()]` work. | `[...selectionSort(nums)]` collects every frame into an array. |
| An iterator can be used **once**. Spreading it a second time gives `[]`. | Call the generator function again for a fresh run. |
| `yield*` passes through every value from another generator. | This is how recursive sorts (merge, quick) work. |
| `return` values are **not** included by `for...of` or spread. | If you need the final frame, `yield` it. Don't `return` it. |

### Lazy vs eager playback

There are two ways a player can use a generator:

- **Lazy:** keep the iterator and call `.next()` on every tick. This uses little memory, but you can only move forward.
- **Eager:** collect everything up front with `const frames = [...gen(input)]`, then play `frames[index]`. Stepping back and scrubbing are trivial.

**Use eager.** Bubble sort on 100 numbers produces about 5,000 frames × 100 numbers = 500k numbers in memory, which is nothing for a browser.

### The bug you will definitely hit once

```ts
const a = [3, 1, 2];
yield { array: a };       // ❌ every frame references the SAME array
yield { array: [...a] };  // ✅ a snapshot of the array at this moment
```

If every frame stores the same array, then after the sort finishes they all show the final sorted state, and the animation looks like it skips straight to the end. Always yield **copies**.

---

## Part 2: Warm-up project: Towers of Hanoi player

Towers of Hanoi is a good warm-up for two reasons:

- Its solution is recursive, so you practice `yield*`, which you'll need for merge sort.
- You build a terminal version of the exact player architecture you'll use in React.

### Setup

Do this **outside this repo** so Next's type-check doesn't pick it up.

```bash
mkdir ~/generator-playground && cd ~/generator-playground
# Node 22.18+ / 24 runs .ts files directly (types are stripped).
# Older Node: use `npx tsx file.ts` instead of `node file.ts`.
```

### Exercise 1: Poke at a generator (5 min)

In `countdown.ts`, write the `countdown` generator from Part 1. Then try:

- Call `.next()` manually and `console.log` each result.
- Loop over it with `for...of`. Is `"liftoff"` printed? Why not?
- `const it = countdown(3); console.log([...it], [...it]);` Why is the second array empty?
- Write `function* naturals()` that yields 1, 2, 3, ... forever. Then write `function* take<T>(n: number, it: Iterable<T>)` that yields the first `n` values. Laziness is the only reason `[...take(5, naturals())]` doesn't hang.

### Exercise 2: Hanoi moves with `yield*` (15 min)

In `hanoi.ts`, write a generator that yields every move needed to solve Hanoi with `n` disks.

```ts
type Move = { disk: number; from: number; to: number };

function* hanoiMoves(n: number, from = 0, to = 2, via = 1): Generator<Move> {
  // TODO: base case, then three steps:
  //   1. move n-1 disks out of the way (from → via)
  //   2. move disk n (from → to)
  //   3. move the n-1 disks on top of it (via → to)
}

console.log([...hanoiMoves(3)].length); // should be 7  (2^n - 1)
```

<details>
<summary>Hint (try it first)</summary>

Steps 1 and 3 are recursive calls. Use `yield* hanoiMoves(...)` so the inner generator's moves are passed through to the caller. Step 2 is a plain `yield`.

</details>

### Exercise 3: Moves → snapshots (10 min)

The visualizer yields **snapshots** (the full array), not **events** (single moves). Do the same here: write a generator that applies each move to the pegs and yields the full board after each one.

```ts
type Frame = { pegs: number[][]; move?: Move };

function* hanoiFrames(n: number): Generator<Frame> {
  const pegs: number[][] = [[/* n..1 */], [], []];
  yield { pegs: /* ? */ };            // the starting position
  for (const move of hanoiMoves(n)) {
    // TODO: pop from pegs[move.from], push onto pegs[move.to]
    // TODO: yield a snapshot. Copy carefully: pegs is an array of arrays!
  }
}
```

Test the copy bug on purpose. Yield `pegs` without copying and print every frame. Then fix it. (`structuredClone(pegs)` or `pegs.map(p => [...p])`.)

### Exercise 4: Terminal player (20–30 min)

This exercise is the important one. Build a player that holds `frames` and an `index`, and controls it from the keyboard:

| Key | Action |
| --- | --- |
| `space` | play / pause |
| `→` / `←` | step forward / back (also pauses) |
| `+` / `-` | faster / slower |
| `r` | restart |
| `q` | quit |

Starter code:

```ts
import readline from "node:readline";

const frames = [...hanoiFrames(4)];
let index = 0;
let playing = false;
let delay = 400;
let timer: ReturnType<typeof setTimeout> | undefined;

function render() {
  console.clear();
  // TODO: draw frames[index].pegs (e.g. one line per peg: "A: 4 3 2")
  console.log(`frame ${index + 1}/${frames.length}  ${playing ? "▶" : "⏸"}  ${delay}ms`);
}

function tick() {
  // TODO: if playing and not at the end, index++, render, schedule the next tick
  // TODO: if at the end, stop playing
}

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on("keypress", (_str, key) => {
  if (key.name === "q" || (key.ctrl && key.name === "c")) process.exit();
  // TODO: handle space, left, right, +, -, r
  render();
});

render();
```

**Questions to answer before moving on:**

1. How did you prevent two timers from running at once when you press space quickly?
2. What happens if you press `→` while playing? What *should* happen?
3. Where does "is it done?" live: as its own variable, or computed from `index` and `frames.length`? Which is less buggy?

Question 3 is the same question you asked about `active` and `isSorting`. You'll answer it the same way in React.

---

## Part 3: Refactoring the visualizer

Work through these in order. Each step should leave the app working (or at least compiling) before you start the next.

### Step 1: New types (`src/lib/algorithms.ts`)

Replace the `onStep`-based signature with a generator signature:

```ts
export type Highlight = { i: number; j: number };
export type SortStep = { array: number[]; active: Highlight[] };

// Takes the input, yields one SortStep per frame. No async, no callback.
export type SortGenerator = (input: number[]) => Generator<SortStep>;
```

Delete `sleep`. The algorithm no longer knows what time is.

### Step 2: Convert `selectionSort` (worked example)

Here's the full change for one algorithm so you can see the pattern:

```diff
-export async function selectionSort(
-  arr: number[],
-  onStep: (step: SortStep) => void,
-): Promise<number[]> {
+export function* selectionSort(arr: number[]): Generator<SortStep> {
   const array = [...arr];
   for (let i = 0; i < array.length - 1; i++) {
     let min = i;
     for (let j = i; j < array.length; j++) {
       if (array[j] < array[min]) {
         min = j;
       }
-      onStep({ array: [...array], active: [{ i, j }] });
-      await sleep(500);
+      yield { array: [...array], active: [{ i, j }] };
     }
     [array[i], array[min]] = [array[min], array[i]];
   }
-  return array;
+  yield { array: [...array], active: [] }; // final, sorted frame
 }
```

The rules for any algorithm:

1. `async function` → `function*`
2. `onStep(x); await sleep(n);` → `yield x;`
3. `return array` → `yield` a final frame with `active: []` (remember: spread drops `return` values).
4. Always yield **copies** (`[...array]`).

### Step 3: Convert `mergeSort` (your turn)

Things to watch for:

- `await mergeSortRange(...)` → `yield* mergeSortRange(...)`, and `mergeSortRange` becomes a `function*` too.
- **`Promise.all` goes away.** Generators run one step at a time, so the two halves are sorted one after the other. That's how merge sort normally runs anyway. The parallel version only *looked* parallel because of interleaved `await`s.
- Since only one merge happens at a time, the shared `active` Set and the mutated `highlight` object aren't needed anymore. Yield `active: [{ i: k, j: mid + rightIndex }]` directly.
- Bonus: also yield a frame inside the two "drain the leftovers" loops so you can see those writes.

### Step 4: Sanity-check without the UI

Before touching React, prove the algorithms work. A quick throwaway check (temporarily in a file, or with Vitest in Step 9):

```ts
const frames = [...mergeSort([5, 3, 8, 1, 9, 2])];
console.log(frames.length);          // more than 0
console.log(frames.at(-1)?.array);   // [1, 2, 3, 5, 8, 9]
console.log(frames.at(-1)?.active);  // []
```

Then update the lookup table:

```ts
export const sortFunctions: Partial<Record<string, SortGenerator>> = {
  mergeSort,
  selectionSort,
};
```

### Step 5: Player state (`src/app/page.tsx`)

`numbers` stays as the **input** and is no longer overwritten during playback. What's on screen is **derived** from the frames:

```tsx
const [numbers, setNumbers] = useState<number[]>([]);
const [steps, setSteps] = useState<SortStep[]>([]);
const [stepIndex, setStepIndex] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const [delay, setDelay] = useState(300); // ms per frame

// Derived. Don't store these in state!
const frame = steps[stepIndex] ?? { array: numbers, active: [] };
const isDone = steps.length > 0 && stepIndex >= steps.length - 1;
const isRunning = isPlaying && !isDone;
```

`active` is no longer separate state either. It's `frame.active`. Your bars render from `frame.array` and `frame.active`.

This answers the earlier `active.length === 0` question: "is it running?" is computed from the data that actually defines it, so it can never get out of sync.

### Step 6: The clock

```tsx
useEffect(() => {
  if (!isRunning) return;
  const id = setTimeout(() => setStepIndex((i) => i + 1), delay);
  return () => clearTimeout(id);
}, [isRunning, stepIndex, delay]);
```

Why this shape works:

- It schedules **one** `setTimeout` per frame instead of a long-running `setInterval`. When `stepIndex` changes, the effect runs again and schedules the next one.
- Pausing, changing speed, or unmounting all trigger the cleanup, so there are never stray timers. (Compare this to your answer to question 1 in Exercise 4.)
- It never needs to call `setIsPlaying(false)` at the end, because `isRunning` turns false on its own when `isDone` becomes true.
- Changing `delay` while playing takes effect on the next frame, with no special handling.

### Step 7: Controls

Each control is now a small state change:

| Control | What it does |
| --- | --- |
| **Sort / Play** | If there are no steps (or `isDone`): `setSteps([...sort(numbers)])`, `setStepIndex(0)`. Then `setIsPlaying(true)`. |
| **Pause** | `setIsPlaying(false)` |
| **Step ←/→** | `setIsPlaying(false)` and `setStepIndex(i => clamp(i ± 1, 0, steps.length - 1))` |
| **Scrub** | `<input type="range" min={0} max={steps.length - 1} value={stepIndex} />` → `setIsPlaying(false); setStepIndex(Number(e.target.value))` |
| **Speed** | `<input type="range">` → `setDelay(...)`. Tip: put "fast" on the right by inverting the value. |
| **Reset / New array** | `setNumbers(randomNumbers(n))`, `setSteps([])`, `setStepIndex(0)`, `setIsPlaying(false)` |
| **Change algorithm** | Clear `steps` too, or you'll replay the old algorithm's frames. |

Disable the algorithm selector while `isRunning`. Reset no longer needs to be disabled, because clearing `steps` cancels the run.

Styling the two range inputs is good CSS practice: start with `accent-color`, then look up `::-webkit-slider-thumb` and `::-moz-range-thumb`.

### Step 8: Delete the old code

Go back over the diff and remove: `sleep`, `onStep`, `SortFunction`, the `active` state, the `async` click handler, and the `numbers.join(", ")` debug line if you no longer want it. Run `pnpm lint` and `pnpm build`.

### Step 9 (optional): Tests with Vitest

Generators make the algorithms easy to test. They're synchronous and pure, so there's no fake timer setup.

```bash
pnpm add -D vitest
```

```ts
// src/lib/algorithms.test.ts
import { describe, expect, it } from "vitest";
import { sortFunctions } from "./algorithms";

const cases = [[], [1], [2, 1], [5, 3, 8, 1, 9, 2], [4, 4, 1, 4], [9, 8, 7, 6, 5]];

for (const [name, sort] of Object.entries(sortFunctions)) {
  describe(name, () => {
    for (const input of cases) {
      it(`sorts ${JSON.stringify(input)}`, () => {
        // TODO: collect the frames, assert the last frame's array equals input.toSorted((a, b) => a - b)
        // TODO: what should happen for [] and [1]? Do you yield a final frame there?
      });
    }
    // TODO: does the generator leave the input array unchanged?
  });
}
```

Add `"test": "vitest"` to `package.json` scripts.

### Step 10: Ideas once it's working

These are small now that the player exists:

- **Stats:** count comparisons and writes. Add them to `SortStep`, or compute them from the frames.
- **Sorted sweep:** after the final frame, yield frames that turn bars green one by one. You'll need a new field such as `sorted: number[]` and a new color token.
- **Keyboard shortcuts:** the same idea as Exercise 4, using `useEffect` + `keydown`.
- **Remaining algorithms:** bubble sort and quick sort (quick sort uses `yield*` like merge sort).

---

## Checklist

- [ ] Part 2 exercises done, and you can answer the three questions
- [ ] `SortGenerator` type, `sleep` removed
- [ ] `selectionSort` converted
- [ ] `mergeSort` converted (no `Promise.all`)
- [ ] Sanity check: last frame is sorted
- [ ] Player state with derived `frame` / `isDone` / `isRunning`
- [ ] `setTimeout` clock effect
- [ ] Play / pause / step / scrub / speed / reset
- [ ] Old async code deleted, `pnpm lint && pnpm build` pass
- [ ] (Optional) Vitest suite
