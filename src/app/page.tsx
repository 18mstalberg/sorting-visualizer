"use client";

import AlgorithmSelector from "@/components/AlgorithmSelector";
import Bar from "@/components/Bar";
import { selectionSort } from "@/lib/algorithms";
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
  const [active, setActive] = useState<{ i: number; j: number } | null>(null);

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
          <AlgorithmSelector />
          <button
            className="bg-green-600 rounded hover:bg-green-700 cursor-pointer"
            onClick={async () => {
              const sorted = await selectionSort(numbers, ({ array, i, j }) => {
                setNumbers(array);
                setActive({ i, j });
              });
              setNumbers(sorted);
              setActive(null);
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
            const color =
              index === active?.i
                ? "bg-amber-400"
                : index === active?.j
                  ? "bg-rose-500"
                  : "bg-mist-400";

            return <Bar key={index} value={value} color={color} />;
          })}
        </div>
      </main>
    </div>
  );
}
