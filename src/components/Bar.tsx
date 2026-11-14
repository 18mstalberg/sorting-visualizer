export default function Bar({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  // Height comes from data at runtime, so it must be an inline style:
  // Tailwind can only generate classes it sees as complete strings in the source.
  return (
    <div className={`${color} w-8`} style={{ height: `${value * 3}px` }} />
  );
}
