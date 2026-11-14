export default function Bar({ value }: { value: number }) {
  // Height comes from data at runtime, so it must be an inline style:
  // Tailwind can only generate classes it sees as complete strings in the source.
  return <div className="bg-mist-400 w-8" style={{ height: `${value * 3}px` }} />;
}
