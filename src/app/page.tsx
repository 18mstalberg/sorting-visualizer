"use client";

import Bar from "@/components/Bar";
import { useEffect, useState } from "react";

const randomNumbers: (count: number) => number[] = (count: number) => {
  const numbers: number[] = [];
  for (let i = 0; i < count; i++) {
    numbers.push(Math.floor(Math.random() * 100));
  }
  return numbers;
};

export default function Home() {
  // Start empty so the server and browser render the same HTML,
  // then generate random numbers only in the browser after the page loads.
  const [numbers, setNumbers] = useState<number[]>([]);

  useEffect(() => {
    // Intentional: random data can only be created in the browser to avoid a hydration mismatch.
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
          <button className="bg-green-600 rounded hover:bg-green-700 cursor-pointer">
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
          {numbers.map((value, index) => (
            <Bar key={index} value={value} />
          ))}
        </div>
      </main>
    </div>
  );
}
