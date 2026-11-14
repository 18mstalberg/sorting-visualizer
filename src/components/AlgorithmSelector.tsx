import { algorithms } from "@/lib/algorithms";

const AlgorithmSelector = () => {
  return (
    <select>
      {algorithms.map((value, index) => (
        <option key={index} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
};

export default AlgorithmSelector;
