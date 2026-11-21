const units = [
  { label: "d", milliseconds: 86_400_000 },
  { label: "h", milliseconds: 3_600_000 },
  { label: "min", milliseconds: 60_000 },
  { label: "s", milliseconds: 1_000 },
];

export default function formatDuration(milliseconds: number) {
  const parts = [];
  let remaining = Math.max(milliseconds, 0);

  for (const unit of units) {
    const amount = Math.floor(remaining / unit.milliseconds);
    remaining -= amount * unit.milliseconds;
    if (amount > 0) parts.push(`${amount} ${unit.label}`);
  }

  return parts.slice(0, 2).join(" ") || "0 s";
}
