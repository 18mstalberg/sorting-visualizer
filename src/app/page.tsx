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
    <div className="w-full min-h-screen">
      <main className="flex flex-col items-center w-full">
        <h1 className="text-base font-bold text-white w-full text-center">
          Testing Numbers: {numbers.join(", ")}
        </h1>
        <div className="w-full flex flex-row gap-4 align-left">
          <AlgorithmSelector value={algorithm} onChange={setAlgorithm} />
          <button
            className="bg-green-600 rounded hover:bg-green-700 cursor-pointer"
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
            className="bg-blue-500 rounded hover:bg-blue-600 cursor-pointer"
            onClick={() => setNumbers(randomNumbers(10))}
          >
            Reset Numbers
          </button>
        </div>
        <div className="flex flex-row gap-1 items-end h-80">
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
