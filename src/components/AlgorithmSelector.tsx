import { algorithms, sortFunctions } from "@/lib/algorithms";

const AlgorithmSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <select
      className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500/40"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {algorithms.map((name, index) => (
        <option key={index} value={name} disabled={!sortFunctions[name]}>
          {name}
        </option>
      ))}
    </select>
  );
};

export default AlgorithmSelector;
