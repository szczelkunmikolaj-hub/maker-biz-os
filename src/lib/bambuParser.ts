// Bambu Studio .3mf / .gcode parser
// .3mf is a ZIP archive. Bambu Studio writes per-plate metadata at:
//   Metadata/slice_info.config        (XML — global slice summary)
//   Metadata/project_settings.config  (JSON — print/filament settings)
//   Metadata/plate_<N>.json           (per-plate model + filament data)
//   Metadata/plate_<N>.gcode          (sliced gcode per plate)
import { unzipSync, strFromU8 } from "fflate";

export interface ParsedPlate {
  index: number;
  name: string;
  printTimeHours: number;
  filamentGrams: number;
  filamentType: string;
  /** Comma-joined human-friendly color labels (already normalized at parse time when possible). */
  filamentColor: string;
  /** Ordered hex palette for this plate (one entry per filament slot). */
  filamentPalette?: string[];
  modelNames: string[];
  /** Embedded preview thumbnail as data URL (PNG), if present in the .3mf. */
  thumbnail?: string;
}

export interface ParsedImport {
  source: "3mf" | "gcode";
  originalFileName: string;
  projectName: string;
  plates: ParsedPlate[];
  totalTimeHours: number;
  totalFilamentGrams: number;
  /** Project-level cover thumbnail (first plate's preview, if any). */
  coverThumbnail?: string;
  rawMetadata?: Record<string, unknown>;
}

/* ---------- gcode header parsing (Bambu / PrusaSlicer / OrcaSlicer) ---------- */
export function parseGcodeHeader(text: string): {
  timeHours: number;
  grams: number;
  material: string;
  color: string;
} {
  let timeHours = 0;
  let grams = 0;
  let material = "";
  let color = "";

  // Scan first ~8KB and last ~8KB (slicers write summary at end)
  const head = text.slice(0, 16_000);
  const tail = text.slice(-16_000);
  const scan = head + "\n" + tail;
  const lines = scan.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith(";")) continue;
    const lower = line.toLowerCase();

    // total estimated time: "; total estimated time: 1h 23m 45s"  or  "; estimated printing time (normal mode) = 2h 17m"
    if (timeHours === 0 && (lower.includes("estimated") || lower.includes("total estimated time"))) {
      const h = line.match(/(\d+)\s*h/i);
      const m = line.match(/(\d+)\s*m(?!s)/i);
      const s = line.match(/(\d+)\s*s/i);
      if (h || m || s) {
        timeHours =
          (h ? parseInt(h[1]) : 0) +
          (m ? parseInt(m[1]) / 60 : 0) +
          (s ? parseInt(s[1]) / 3600 : 0);
      }
    }

    // filament used [g] = 42.13   OR  ; total filament used [g] : 42.13
    if (grams === 0 && lower.includes("filament") && lower.includes("[g]")) {
      const m = line.match(/([\d.]+)/);
      if (m) grams = parseFloat(m[1]);
    } else if (grams === 0 && lower.includes("filament used") && lower.includes("g")) {
      const m = line.match(/=\s*([\d.]+)\s*g/i);
      if (m) grams = parseFloat(m[1]);
    }

    if (!material && (lower.startsWith("; filament_type") || lower.includes("filament_type"))) {
      const m = line.match(/=\s*(.+)/);
      if (m) material = m[1].trim().split(/[;,]/)[0].trim();
    }
    if (!color && (lower.includes("filament_colour") || lower.includes("filament_color"))) {
      const m = line.match(/=\s*(.+)/);
      if (m) color = m[1].trim().split(/[;,]/)[0].trim();
    }
  }

  return {
    timeHours: Math.round(timeHours * 100) / 100,
    grams: Math.round(grams * 10) / 10,
    material,
    color,
  };
}

/* ---------- 3MF parsing ---------- */
function parseSliceInfoXml(xml: string): { plates: Partial<ParsedPlate>[] } {
  // Bambu Studio's slice_info.config is XML with per-plate entries:
  //  <plate>
  //    <metadata key="index" value="1"/>
  //    <metadata key="prediction" value="3120"/>            (seconds)
  //    <metadata key="weight" value="14.32"/>               (grams total)
  //    <filament id="1" type="PLA" color="#000000" used_m="4.80" used_g="14.32"/>
  //    <object identify_id="..." name="model_name.stl"/>
  //  </plate>
  const plates: Partial<ParsedPlate>[] = [];
  const plateRegex = /<plate\b[^>]*>([\s\S]*?)<\/plate>/g;
  let pm: RegExpExecArray | null;
  while ((pm = plateRegex.exec(xml)) !== null) {
    const block = pm[1];
    const meta: Record<string, string> = {};
    const metaRegex = /<metadata\s+key="([^"]+)"\s+value="([^"]*)"\s*\/>/g;
    let mm: RegExpExecArray | null;
    while ((mm = metaRegex.exec(block)) !== null) meta[mm[1]] = mm[2];

    let totalGrams = 0;
    const materials: string[] = [];
    const palette: string[] = [];
    const filRegex = /<filament\b([^/]*)\/>/g;
    let fm: RegExpExecArray | null;
    while ((fm = filRegex.exec(block)) !== null) {
      const attrs = fm[1];
      const t = attrs.match(/type="([^"]+)"/);
      const c = attrs.match(/color="([^"]+)"/);
      const g = attrs.match(/used_g="([\d.]+)"/);
      if (t) materials.push(t[1]);
      if (c) palette.push(c[1]);
      if (g) totalGrams += parseFloat(g[1]);
    }

    const modelNames: string[] = [];
    const objRegex = /<object\b[^>]*name="([^"]+)"/g;
    let om: RegExpExecArray | null;
    while ((om = objRegex.exec(block)) !== null) modelNames.push(om[1]);

    const seconds = meta.prediction ? parseFloat(meta.prediction) : 0;
    const weight = meta.weight ? parseFloat(meta.weight) : totalGrams;
    const idx = meta.index ? parseInt(meta.index) : plates.length + 1;

    // Pick a primary material (most common, normalized) and join unique colors as labels
    const primaryMaterial = materials[0] || "";
    const uniquePalette = Array.from(new Set(palette));

    plates.push({
      index: idx,
      name: `Plate ${idx}`,
      printTimeHours: Math.round((seconds / 3600) * 100) / 100,
      filamentGrams: Math.round(weight * 10) / 10,
      filamentType: primaryMaterial,
      filamentColor: uniquePalette.join(", "),
      filamentPalette: uniquePalette,
      modelNames,
    });
  }
  return { plates };
}

function u8ToDataUrl(bytes: Uint8Array, mime = "image/png"): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

function extractThumbnails(entries: Record<string, Uint8Array>): {
  perPlate: Record<number, string>;
  cover?: string;
} {
  const perPlate: Record<number, string> = {};
  let cover: string | undefined;
  for (const key of Object.keys(entries)) {
    const lower = key.toLowerCase();
    if (!/\.(png|jpg|jpeg)$/i.test(lower)) continue;
    // Match Bambu's plate_<N>.png (no _small / _pick variants)
    const m = lower.match(/plate_(\d+)\.png$/);
    if (m) {
      const idx = parseInt(m[1], 10);
      perPlate[idx] = u8ToDataUrl(entries[key]);
      if (!cover) cover = perPlate[idx];
      continue;
    }
    // Generic top-level thumbnail fallback
    if (!cover && (lower.endsWith("/thumbnail.png") || lower === "thumbnail.png")) {
      cover = u8ToDataUrl(entries[key]);
    }
  }
  if (!cover) {
    const indices = Object.keys(perPlate).map(Number).sort((a, b) => a - b);
    if (indices.length) cover = perPlate[indices[0]];
  }
  return { perPlate, cover };
}

export async function parse3mf(file: File): Promise<ParsedImport> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buffer);
  } catch (err) {
    throw new Error(`Could not open .3mf archive: ${(err as Error).message}`);
  }

  // Find slice_info — Bambu writes Metadata/slice_info.config
  const sliceInfoKey = Object.keys(entries).find((k) =>
    k.toLowerCase().endsWith("slice_info.config")
  );

  const { perPlate: thumbsByIndex, cover } = extractThumbnails(entries);

  let plates: ParsedPlate[] = [];

  if (sliceInfoKey) {
    const xml = strFromU8(entries[sliceInfoKey]);
    const { plates: parsed } = parseSliceInfoXml(xml);
    plates = parsed.map((p, i) => {
      const idx = p.index ?? i + 1;
      return {
        index: idx,
        name: p.name ?? `Plate ${idx}`,
        printTimeHours: p.printTimeHours ?? 0,
        filamentGrams: p.filamentGrams ?? 0,
        filamentType: p.filamentType ?? "",
        filamentColor: p.filamentColor ?? "",
        filamentPalette: p.filamentPalette,
        modelNames: p.modelNames ?? [],
        thumbnail: thumbsByIndex[idx],
      };
    });
  }

  // Fallback: scan any embedded plate_<N>.gcode for headers
  if (plates.length === 0) {
    const gcodeKeys = Object.keys(entries).filter((k) => k.toLowerCase().endsWith(".gcode"));
    plates = gcodeKeys.map((k, i) => {
      const text = strFromU8(entries[k]);
      const meta = parseGcodeHeader(text);
      return {
        index: i + 1,
        name: `Plate ${i + 1}`,
        printTimeHours: meta.timeHours,
        filamentGrams: meta.grams,
        filamentType: meta.material,
        filamentColor: meta.color,
        modelNames: [],
        thumbnail: thumbsByIndex[i + 1],
      };
    });
  }

  // Last resort: read 3dmodel name list
  if (plates.length === 0) {
    const modelKey = Object.keys(entries).find((k) => k.toLowerCase().endsWith("3dmodel.model"));
    const names: string[] = [];
    if (modelKey) {
      const xml = strFromU8(entries[modelKey]);
      const re = /<object\b[^>]*name="([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) names.push(m[1]);
    }
    plates = [
      {
        index: 1,
        name: "Plate 1",
        printTimeHours: 0,
        filamentGrams: 0,
        filamentType: "",
        filamentColor: "",
        modelNames: names,
        thumbnail: cover,
      },
    ];
  }

  const totalTimeHours = plates.reduce((s, p) => s + p.printTimeHours, 0);
  const totalFilamentGrams = plates.reduce((s, p) => s + p.filamentGrams, 0);
  const projectName = file.name.replace(/\.3mf$/i, "");

  return {
    source: "3mf",
    originalFileName: file.name,
    projectName,
    plates,
    totalTimeHours: Math.round(totalTimeHours * 100) / 100,
    totalFilamentGrams: Math.round(totalFilamentGrams * 10) / 10,
    coverThumbnail: cover,
  };
}

export async function parseGcodeFile(file: File): Promise<ParsedImport> {
  const text = await file.text();
  const meta = parseGcodeHeader(text);
  const projectName = file.name.replace(/\.gcode$/i, "");
  const plate: ParsedPlate = {
    index: 1,
    name: "Plate 1",
    printTimeHours: meta.timeHours,
    filamentGrams: meta.grams,
    filamentType: meta.material,
    filamentColor: meta.color,
    modelNames: [file.name],
  };
  return {
    source: "gcode",
    originalFileName: file.name,
    projectName,
    plates: [plate],
    totalTimeHours: meta.timeHours,
    totalFilamentGrams: meta.grams,
  };
}

/** Combine multiple gcode files into one ParsedImport (one plate per file). */
export function combineGcodeImports(imports: ParsedImport[], projectName: string): ParsedImport {
  const plates: ParsedPlate[] = imports.map((imp, i) => ({
    ...imp.plates[0],
    index: i + 1,
    name: `Plate ${i + 1}`,
  }));
  return {
    source: "gcode",
    originalFileName: imports.map((i) => i.originalFileName).join(", "),
    projectName,
    plates,
    totalTimeHours: Math.round(plates.reduce((s, p) => s + p.printTimeHours, 0) * 100) / 100,
    totalFilamentGrams: Math.round(plates.reduce((s, p) => s + p.filamentGrams, 0) * 10) / 10,
  };
}

/** Normalize material names: "pla", "PLA", "Pla" → "PLA". Re-exports the smart helper. */
export { normalizeMaterial } from "./normalize";

