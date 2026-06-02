/** Iniciais e contraste de texto para os escudos de times. */

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** Luminância relativa de uma cor hex (#rrggbb). */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  if (c.length < 6) return 0.5;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Escolhe texto escuro ou claro conforme o fundo. */
export function contrastText(hex: string): string {
  return luminance(hex) > 0.6 ? "#0b0e15" : "#ffffff";
}

/** Clareia/escurece um hex (amount > 0 clareia, < 0 escurece). */
export function shade(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return hex;
  const f = (i: number) => {
    const v = parseInt(c.slice(i, i + 2), 16);
    const n = Math.max(0, Math.min(255, Math.round(v + amount * 255)));
    return n.toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(2)}${f(4)}`;
}
