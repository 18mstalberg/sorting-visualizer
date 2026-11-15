"use client";

import AlgorithmSelector from "@/components/AlgorithmSelector";
import Bar from "@/components/Bar";
import { Highlight, sortFunctions } from "@/lib/algorithms";
import { useEffect, useState } from "react";

const randomNumbers: (count: number) => number[] = (count: number) => {
  const numbers: number[] = [];
  for (let i = 0; i < count; i++) {
    numbers.push(Math.floor(Math.random() * 100));
  }
  return numbers;
};

export default function Home() {
  const [numbers, setNumbers] = useState<number[]>([]);
  const [algorithm, setAlgorithm] = useState("mergeSort");
  const [active, setActive] = useState<Highlight[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNumbers(randomNumbers(10));
  }, []);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sorting Visualizer
          </h1>
          <p className="font-mono text-sm text-zinc-500">
            {numbers.join(", ")}
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <AlgorithmSelector value={algorithm} onChange={setAlgorithm} />
          <button
            className="cursor-pointer rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400"
            onClick={async () => {
              const sort = sortFunctions[algorithm];
              if (!sort) return;
              const sorted = await sort(numbers, ({ array, active }) => {
                setNumbers(array);
                setActive(active);
              });
              setNumbers(sorted);
              setActive([]);
            }}
          >
            Sort Numbers
          </button>
          <button
            className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            onClick={() => setNumbers(randomNumbers(10))}
          >
            Reset Numbers
          </button>
        </div>
        <div className="flex h-96 items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          {numbers.map((value, index) => {
            // Each comparison in progress has its own range of bars, so the same
            // two colors work for all of them: amber = current slot, rose = compared value.
            const color = active.some((h) => h.i === index)
              ? "bg-amber-400"
              : active.some((h) => h.j === index)
                ? "bg-rose-500"
                : "bg-mist-400";

            return <Bar key={index} value={value} color={color} />;
          })}
        </div>
      </main>
    </div>
  );
}
