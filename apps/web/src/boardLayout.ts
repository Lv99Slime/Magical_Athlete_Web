/** Physical U route: wide Start, upper straight, two right corners, lower straight, Finish. */
export function boardCell(position: number) {
  if (position === 0) return { gridColumn: "1 / span 3", gridRow: "1" };
  if (position <= 12) return { gridColumn: String(position + 3), gridRow: "1" };
  if (position <= 15)
    return { gridColumn: "15", gridRow: String(position - 11) };
  if (position < 30) return { gridColumn: String(30 - position), gridRow: "4" };
  return { gridColumn: "1", gridRow: "2 / span 2" };
}
