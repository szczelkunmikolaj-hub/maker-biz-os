// Smart normalization for material names + filament colors.
// Pure presentation-layer helpers — never mutates stored data.

const NAMED_COLORS: Record<string, string> = {
  // hex → human
  "#000000": "Black",
  "#ffffff": "White",
  "#ff0000": "Red",
  "#00ff00": "Green",
  "#0000ff": "Blue",
  "#ffff00": "Yellow",
  "#ffa500": "Orange",
  "#800080": "Purple",
  "#a52a2a": "Brown",
  "#808080": "Gray",
  "#c0c0c0": "Silver",
  "#ffd700": "Gold",
  "#ffc0cb": "Pink",
  "#00ffff": "Cyan",
  "#008000": "Dark Green",
  "#000080": "Navy",
  "#f5f5dc": "Beige",
};

const COMMON_NAMES = [
  "black","white","red","green","blue","yellow","orange","purple","pink",
  "cyan","magenta","brown","gray","grey","silver","gold","beige","navy",
  "transparent","clear","natural","skin","ivory","tan","teal","violet","lime",
];

const FALLBACK_PALETTE = ["Black", "Yellow", "White", "Red", "Blue", "Green", "Orange", "Purple"];

function nearestNamed(hex: string): string | null {
  const h = hex.toLowerCase();
  if (NAMED_COLORS[h]) return NAMED_COLORS[h];
  // crude nearest by RGB distance
  if (!/^#([0-9a-f]{6})$/i.test(h)) return null;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  let bestName: string | null = null;
  let bestDist = Infinity;
  for (const [hx, name] of Object.entries(NAMED_COLORS)) {
    const rr = parseInt(hx.slice(1, 3), 16);
    const gg = parseInt(hx.slice(3, 5), 16);
    const bb = parseInt(hx.slice(5, 7), 16);
    const d = (r - rr) ** 2 + (g - gg) ** 2 + (b - bb) ** 2;
    if (d < bestDist) { bestDist = d; bestName = name; }
  }
  return bestName;
}

/** Convert any color string ("1", "Slot 2", "#FFAA00", "Black", "PLA black") into:
 *  { label, swatch }  where label is human-readable and swatch is a CSS color (hex or name). */
export function normalizeColor(
  raw: string | undefined,
  index = 0,
  paletteHexes?: string[],
): { label: string; swatch: string } {
  const trimmed = (raw || "").trim();

  // Empty / unknown → fallback palette by index
  if (!trimmed) {
    const label = FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    return { label, swatch: label.toLowerCase() };
  }

  // Slot/filament IDs like "1", "Slot 2", "Filament 3", "Color 1", "T0"
  const idMatch = trimmed.match(/^(?:slot|filament|color|colour|tool|t)\s*[#]?\s*(\d+)$/i)
    || trimmed.match(/^(\d+)$/);
  if (idMatch) {
    const slot = parseInt(idMatch[1], 10);
    const slotIdx = Math.max(0, slot - (slot >= 1 ? 1 : 0)); // "1"→0, "0"→0
    const hex = paletteHexes?.[slotIdx];
    if (hex) {
      const named = nearestNamed(hex) || FALLBACK_PALETTE[slotIdx % FALLBACK_PALETTE.length];
      return { label: named, swatch: hex };
    }
    return {
      label: FALLBACK_PALETTE[slotIdx % FALLBACK_PALETTE.length],
      swatch: FALLBACK_PALETTE[slotIdx % FALLBACK_PALETTE.length].toLowerCase(),
    };
  }

  // Hex color
  if (/^#?[0-9a-f]{6}$/i.test(trimmed)) {
    const hex = trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
    const named = nearestNamed(hex);
    return { label: named || hex.toUpperCase(), swatch: hex };
  }

  // "PLA Black", "pla_black", "Black PLA"
  const lower = trimmed.toLowerCase().replace(/[_\-]/g, " ");
  for (const name of COMMON_NAMES) {
    if (new RegExp(`(^|\\s)${name}(\\s|$)`).test(lower)) {
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      return { label, swatch: label.toLowerCase() };
    }
  }

  // Last resort — use the trimmed string as label, derive swatch from text
  return { label: trimmed, swatch: trimmed.toLowerCase() };
}

/** Parse one or several colors from a string ("Black, Yellow" / "1,2,3" / "#000000;#ffaa00"). */
export function normalizeColors(
  raw: string | undefined,
  paletteHexes?: string[],
): Array<{ label: string; swatch: string }> {
  if (!raw) return [normalizeColor("", 0, paletteHexes)];
  const parts = raw.split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return [normalizeColor("", 0, paletteHexes)];
  const seen = new Set<string>();
  const out: Array<{ label: string; swatch: string }> = [];
  parts.forEach((p, i) => {
    const c = normalizeColor(p, i, paletteHexes);
    const key = c.label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(c);
    }
  });
  return out;
}

/** PLA / pla / Pla / pla_+ → "PLA". Strips slicer-suffixes. */
export function normalizeMaterial(raw: string | undefined): string {
  const s = (raw || "").trim();
  if (!s) return "PLA";
  const cleaned = s.replace(/[_\-]+/g, " ").trim();
  const upper = cleaned.toUpperCase();
  // Common materials — pick the first matching token
  const KNOWN = ["PLA+","PLA","PETG","ABS","ASA","TPU","PC","PA","PVA","HIPS","PET","NYLON"];
  for (const k of KNOWN) {
    if (new RegExp(`(^|\\b)${k.replace("+","\\+")}(\\b|$)`).test(upper)) return k;
  }
  // fallback — Title Case
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}
