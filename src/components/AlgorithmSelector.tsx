import { algorithms, sortFunctions } from "@/lib/algorithms";

const AlgorithmSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {algorithms.map((name, index) => (
        <option key={index} value={name} disabled={!sortFunctions[name]}>
          {name}
        </option>
      ))}
    </select>
  );
};

export default AlgorithmSelector;
