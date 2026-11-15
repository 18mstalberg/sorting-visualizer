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
# Importing between your own files without a `.ts` extension also needs tsx.
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

> **Optional if you're already on Part 3.** Step 7.9 practices the same ideas (a timer, keyboard input, cleanup) inside the React app.
>
> **Troubleshooting:** `setRawMode is not a function` means stdin isn't an interactive terminal. Run it from a real terminal window, not an IDE "Run" button or a command with piped input.

Build a player that holds `frames` and an `index`, and controls it from the keyboard:

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

Before touching React, prove the algorithms work. A quick throwaway check (temporarily in a file, or with Vitest in Step 9). Run it with `npx tsx path/to/file.ts`, not plain `node`, because Node's ESM loader won't resolve extensionless imports like `./lib/algorithms`:

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

### Step 7: Player controls

This is the biggest step, so it's split into parts. Snippets marked `TODO` or with a hint in a collapsed section are for you to finish.

What you're building:

```
[ mergeSort ▾ ]   [ ◀ ]  [ ▶ Sort ]  [ ▶ ]          [ ⤮ New array ]

Step   ━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━   42 / 118
Speed  ━━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━   120ms
```

#### 7.0: Packages

You don't need any packages. Everything here is React state, `<button>` and the browser's built-in `<input type="range">`.

Optional:

| Package | Command | Why |
| --- | --- | --- |
| `lucide-react` | `pnpm add lucide-react` | Icons for play/pause/step. Each icon is a small React component (`<Play className="size-4" />`), and only the icons you import end up in your bundle. **Recommended.** |
| `tsx` | `pnpm add -D tsx` | Saves it as a dev dependency so scratch scripts run with `pnpm tsx file.ts` instead of downloading it through `npx` each time. |
| `vitest` | `pnpm add -D vitest` | Step 9. |

**Skip** slider component libraries (Radix, shadcn's Slider). The built-in range input already supports the keyboard and screen readers, and styling it yourself is the CSS practice. Also skip `clsx` until your class strings actually get messy.

The icons you'll probably want from lucide are `Play`, `Pause`, `RotateCcw` (replay), `StepBack`, `StepForward` and `Shuffle` (new array). You can browse the rest at lucide.dev.

#### 7.1: Before you start: check `mergeSort`

Two things in the current `algorithms.ts`:

- **The highlight indices are wrong.** `{ i: leftIndex, j: rightIndex }` are positions inside the `left` and `right` *copies*, not positions of bars on screen, so the highlight will always appear near the start of the array. Ask yourself which bar index is about to be written to, and which bar index holds the right-hand value being compared.
  <details><summary>Hint</summary>`k` is the slot being written. The right candidate started at `mid + rightIndex`, and nothing has overwritten it yet.</details>
- **The `active` Set in `mergeSort` is no longer used.** Delete it.

#### 7.2: Player status

Right now you have `isPlaying`, `isDone` and `isRunning`. The UI actually needs to tell apart **four** states, each with its own button label and behavior:

| Status | When | Main button | Clicking it |
| --- | --- | --- | --- |
| `idle` | no steps yet | Sort | build steps, go to 0, play |
| `playing` | running | Pause | pause |
| `paused` | has steps, not playing, not done | Resume | play |
| `done` | on the last frame | Replay | go to 0, play |

Give that a name with a union type, and compute it like the other derived values:

```tsx
type PlayerStatus = "idle" | "playing" | "paused" | "done";

const hasSteps = steps.length > 0;
const status: PlayerStatus = /* TODO */;
```

<details><summary>Hint</summary>

The order of checks matters. `isPlaying` can still be `true` when you reach the last frame, because nothing sets it back to false. So check `idle` first, then `done`, then `playing`, and anything left over is `paused`.

</details>

A union type plus a `Record` lookup gives you labels with no nested ternaries, and TypeScript will error if you add a status and forget to give it a label:

```tsx
const PLAY_LABEL: Record<PlayerStatus, string> = {
  idle: "Sort",
  playing: "Pause",
  paused: "Resume",
  done: "Replay",
};
```

Put `PlayerStatus` and `PLAY_LABEL` **outside** the component, since they never change.

#### 7.3: Handlers

Two functions do all the work. `goTo` is complete:

```tsx
// Any manual navigation pauses, so the clock doesn't fight the user.
const goTo = (index: number) => {
  setIsPlaying(false);
  setStepIndex(Math.min(Math.max(index, 0), steps.length - 1));
};
```

`togglePlay` replaces the current Sort button's `onClick`:

```tsx
const togglePlay = () => {
  switch (status) {
    case "playing":
      setIsPlaying(false);
      return;
    case "idle": {
      const sort = sortFunctions[algorithm];
      if (!sort) return;
      // TODO: build the steps and start from frame 0
      break;
    }
    case "done":
      // TODO: what's the smallest change that replays from the start?
      break;
    case "paused":
      break; // nothing extra needed; the line below handles it
  }
  setIsPlaying(true);
};
```

Question: in the `done` case, do you need to rebuild the steps? (`numbers` and `algorithm` haven't changed.)

#### 7.4: Buttons

Replace the Sort button and add the two step buttons:

```tsx
<button onClick={() => goTo(stepIndex - 1)} disabled={/* TODO */} aria-label="Step back">
  <StepBack className="size-4" />
</button>

<button onClick={togglePlay} /* primary styles */>
  {/* TODO: icon based on status (Pause when playing, RotateCcw when done, Play otherwise) */}
  {PLAY_LABEL[status]}
</button>

{/* TODO: step forward button */}
```

Things to figure out:

- **`disabled` on each step button.** When should step back be disabled? Step forward? (There are two reasons for each.)
- **`aria-label` on buttons that only show an icon.** A screen reader can't read an SVG, so without it the button is announced as just "button". The Play button has visible text, so it doesn't need one.
- **The selector.** Add a `disabled?: boolean` prop to `AlgorithmSelector`, pass it through to the `<select>`, and disable it while `status === "playing"`. Add `disabled:opacity-50 disabled:cursor-not-allowed` while you're there.
- **Repeated styles.** You'll now have four or five buttons with the same long class strings. Pull them out into a small `Button` component with a `variant: "primary" | "secondary"` prop.

#### 7.5: The step scrubber

A **controlled** range input: React owns the value, and the input just reports changes.

```tsx
<input
  type="range"
  min={0}
  max={Math.max(steps.length - 1, 0)}
  value={stepIndex}
  onChange={(e) => goTo(Number(e.target.value))}
  disabled={!hasSteps}
  aria-label="Step"
  aria-valuetext={/* TODO: e.g. "Step 42 of 118" */}
/>
<span className="font-mono tabular-nums">{/* TODO: "42 / 118", or "–" when idle */}</span>
```

Notes:

- `e.target.value` is always a **string**, even on a range input. That's why it goes through `Number(...)`.
- `Math.max(..., 0)` stops `max` from becoming `-1` when there are no steps.
- `aria-valuetext` is what a screen reader announces. Without it, it reads the raw number ("41"), which is also off by one from what you show on screen.
- `tabular-nums` makes every digit the same width, so the counter doesn't shift as it changes.
- Arrow keys on a focused range input already work, and they go through `onChange`, so stepping by keyboard needs no extra code.

#### 7.6: The speed slider

The state is a `delay` in milliseconds, but users expect **right = faster**. A larger delay is slower, so the slider has to be inverted.

```tsx
const MIN_DELAY = 20;
const MAX_DELAY = 1000;

<input
  type="range"
  min={MIN_DELAY}
  max={MAX_DELAY}
  step={20}
  value={/* TODO: map delay → slider position */}
  onChange={(e) => setDelay(/* TODO: map slider position → delay */)}
  aria-label="Speed"
/>
```

<details><summary>Hint</summary>

If the slider runs from `MIN` to `MAX`, then `MIN + MAX - x` flips any value in that range. It's its own inverse, so the same formula works in both directions.

</details>

Question: why does changing speed while playing take effect on the very next frame? (Look at the clock effect's dependency array.)

#### 7.7: CSS practice: layout

Goal: the two slider rows line up as columns (labels, then tracks, then values) without guessing fixed widths like `w-16`.

Here's the structure. You write the Tailwind classes:

```tsx
<div className="/* TODO: grid with 3 columns: auto, 1fr, auto */">
  <label className="/* TODO: this row shares the parent's columns */">
    <span>Step</span>
    <input type="range" ... />
    <span>42 / 118</span>
  </label>
  <label className="/* same */">
    <span>Speed</span>
    <input type="range" ... />
    <span>120ms</span>
  </label>
</div>
```

<details><summary>Hint</summary>

The parent is `grid grid-cols-[auto_1fr_auto]`. Each `<label>` is a single grid item, so on its own its children wouldn't use the parent's columns. Look up **CSS subgrid**: `grid-cols-subgrid col-span-3` makes each label lay out its children on the parent's columns. Then the widest label sets the column width for both rows.

</details>

For the toolbar: `flex flex-wrap` is fine, but push New Array to the far right. (Hint: one class on that button. Look up how `margin-left: auto` behaves in a flex container.)

#### 7.8: CSS practice: styling the range inputs

**Level 1:** add `accent-emerald-500`. That's the `accent-color` CSS property, which recolors native form controls in one line. It's good enough to ship.

**Level 2:** a fully custom track and thumb. Range inputs are made of browser-specific parts, so this goes in `globals.css` instead of utility classes. Start from:

```css
@layer components {
  .range {
    appearance: none; /* turn off the browser's built-in look */
    height: 0.375rem;
    border-radius: 9999px;
    cursor: pointer;
    /* the filled part of the track up to --fill, then the empty part */
    background: linear-gradient(
      to right,
      var(--color-emerald-500) var(--fill, 0%),
      var(--color-zinc-800) var(--fill, 0%)
    );
  }

  .range::-webkit-slider-thumb {
    appearance: none;
    /* TODO: size, border-radius, background, a ring/shadow, transition */
  }

  .range::-moz-range-thumb {
    /* TODO: same look as above */
  }

  .range:focus-visible {
    /* TODO: visible focus ring for keyboard users */
  }

  .range:disabled {
    /* TODO */
  }
}
```

Things to learn here:

- **Why are the webkit and moz thumbs separate rules?** Try combining them into one selector list (`::-webkit-slider-thumb, ::-moz-range-thumb { ... }`) and test in Chrome. If a browser doesn't recognize any selector in a list, it drops the **whole rule**.
- **The fill:** `--fill` is a CSS variable set from React. TypeScript doesn't know about custom properties, so you need a cast:
  ```tsx
  style={{ "--fill": `${percent}%` } as React.CSSProperties}
  ```
  Work out `percent` from `stepIndex` and `steps.length` yourself, and watch out for dividing by zero.
- **Why `@layer components`?** Tailwind v4 puts its utilities in a later cascade layer than `components`, so a utility class on the element can still override your `.range` styles. Plain, unlayered CSS would beat every utility.
- **Hover/active feedback:** scale the thumb up a little on `:hover` and `:active`. Then wrap that in `@media (prefers-reduced-motion: no-preference)` so people who've asked for less motion don't get it.
- If a `var(--color-…)` you reference doesn't seem to apply, Tailwind may not be outputting that variable because no class uses it. Check the computed styles in devtools.

#### 7.9: Keyboard shortcuts (the input practice)

This is the React version of Exercise 4, and it uses everything from the `useEffect` cleanup discussion.

| Key | Action |
| --- | --- |
| `Space` | play / pause |
| `←` / `→` | step back / forward |
| `n` | new array |

Start with this **deliberately buggy** version and use it for a bit:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === " ") {
      e.preventDefault(); // stop the page from scrolling
      togglePlay();
    }
    // TODO: arrows, n
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

Press Space to start a sort, then press it again to pause. **What happens, and why?**

<details><summary>Explanation</summary>

With `[]` the effect runs once, so `handler` holds onto the `togglePlay` from the **first render**. In that render `status` was `"idle"`, and it stays `"idle"` for that function forever. Every Space press rebuilds the steps and restarts. This is called a **stale closure**.

There are two fixes:

1. Add `togglePlay` (and everything else the handler uses) to the dependencies. That works, but since `togglePlay` is a new function on every render, the listener gets removed and re-added every frame.
2. **`useEffectEvent`** (stable since React 19.2). It wraps a function so that it always sees the latest props and state, without being a dependency:

```tsx
const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
  // always sees the current status, steps, stepIndex...
});

useEffect(() => {
  const handler = (e: KeyboardEvent) => onKeyDown(e);
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, []);
```

</details>

Edge cases to handle in `onKeyDown`:

- **Focus inside a form control.** If the focus is in an `input`, `select` or `textarea`, return early, because those controls use the arrows and Space themselves. (`e.target instanceof HTMLElement && e.target.closest("input, select, textarea")`)
- **Space on a focused button.** Click Play with the mouse, and the focus stays on that button. Pressing Space now *also* clicks the button natively, so it toggles twice and nothing seems to happen. Skip Space when `e.target` is inside a `button`, but still handle the arrows.
- **Modifier keys.** Ignore the key when `e.metaKey` or `e.ctrlKey` is held, so you don't take over browser shortcuts.
- **Key repeat.** Holding Space fires `keydown` repeatedly, and `e.repeat` is `true` for those. What should happen?

#### 7.10: Extract `PlayerControls`

Once everything works inline, move the toolbar and sliders into `src/components/PlayerControls.tsx`. Make it **presentational**: it receives values and callbacks, and has no state of its own.

```tsx
type PlayerControlsProps = {
  status: PlayerStatus;
  stepIndex: number;
  stepCount: number;
  delay: number;
  onTogglePlay: () => void;
  onStepTo: (index: number) => void;
  onDelayChange: (delay: number) => void;
};
```

`PlayerStatus` and `PLAY_LABEL` would then live in the component file, or in `src/lib/`. Decide which, and be able to explain why. `page.tsx` keeps the state, the clock and the handlers; `PlayerControls` only renders them.

#### 7.11: Manual test pass

- [ ] Sort, then Pause partway, then Resume: it continues from the same frame
- [ ] Pause, step back 3 frames, then Resume: it continues from the earlier frame
- [ ] Drag the scrubber while playing: it pauses
- [ ] Change speed while playing: it takes effect right away
- [ ] At the end: the label says Replay, and clicking it starts from frame 1
- [ ] New Array partway through a sort: the new bars appear and nothing keeps moving
- [ ] Change the algorithm partway through: it stops and shows the original numbers
- [ ] Step buttons are disabled at both ends and when idle
- [ ] Keyboard: Space, ← and → work, Space doesn't scroll the page, and arrows inside the scrubber and select still work normally
- [ ] Tab through every control: each one shows a visible focus ring

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
- **Array size slider:** reuse your `.range` styles. What should happen to existing steps when the size changes?
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
- [ ] `mergeSort` highlight indices fixed, unused Set removed (7.1)
- [ ] `PlayerStatus` + `PLAY_LABEL` (7.2)
- [ ] `goTo` + `togglePlay` (7.3)
- [ ] Play/pause + step buttons, `AlgorithmSelector` disabled prop (7.4)
- [ ] Step scrubber (7.5) and speed slider (7.6)
- [ ] Subgrid slider layout (7.7)
- [ ] Custom range styles (7.8)
- [ ] Keyboard shortcuts with `useEffectEvent` (7.9)
- [ ] `PlayerControls` extracted (7.10)
- [ ] Manual test pass (7.11)
- [ ] Old async code deleted, `pnpm lint && pnpm build` pass
- [ ] (Optional) Vitest suite
