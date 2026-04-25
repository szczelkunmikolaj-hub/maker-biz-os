import { Layers } from "lucide-react";
import { normalizeColors } from "@/lib/normalize";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface Props {
  /** Embedded thumbnail data URL (preferred). */
  thumbnail?: string;
  /** Raw filament color string (resolved + visualized when no thumbnail). */
  color?: string;
  /** Hex palette captured at import — used to resolve numeric slot ids. */
  palette?: string[];
  /** Plate label shown on the fallback (e.g. "Plate 1"). */
  label?: string;
  /** Pixel size — square. */
  size?: "sm" | "md" | "lg";
  /** Disable hover-zoom popover (useful inside lists where it gets noisy). */
  noHover?: boolean;
  className?: string;
}

const SIZE_CLS: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-10 w-10 rounded-md",
  md: "h-16 w-16 rounded-lg",
  lg: "h-24 w-24 rounded-xl",
};

const LABEL_CLS: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-[8px]",
  md: "text-[10px]",
  lg: "text-xs",
};

/**
 * Renders the visual identity of a single plate / model.
 * - Preferred: real thumbnail extracted from the .3mf
 * - Fallback: a stylised silhouette with the plate's filament color(s) and label
 *
 * Used everywhere a plate is surfaced (project detail, project cards, kanban cards, importer preview).
 */
export function PlatePreview({
  thumbnail,
  color,
  palette,
  label,
  size = "md",
  noHover = false,
  className = "",
}: Props) {
  const sizeCls = SIZE_CLS[size];
  const labelCls = LABEL_CLS[size];

  const trigger = thumbnail ? (
    <img
      src={thumbnail}
      alt={label || "Plate preview"}
      className={`${sizeCls} object-cover border border-border bg-muted shrink-0 ${className}`}
      loading="lazy"
    />
  ) : (
    <FallbackPreview
      color={color}
      palette={palette}
      label={label}
      sizeCls={sizeCls}
      labelCls={labelCls}
      className={className}
    />
  );

  if (noHover) return trigger;

  return (
    <HoverCard openDelay={250} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="inline-block">{trigger}</span>
      </HoverCardTrigger>
      <HoverCardContent side="right" className="w-56 p-2">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={label || "Plate preview"}
            className="w-full h-auto rounded-md border border-border object-contain bg-muted"
          />
        ) : (
          <FallbackPreview
            color={color}
            palette={palette}
            label={label}
            sizeCls="w-full aspect-square rounded-md"
            labelCls="text-xs"
          />
        )}
        {label && (
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center truncate">{label}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function FallbackPreview({
  color,
  palette,
  label,
  sizeCls,
  labelCls,
  className = "",
}: {
  color?: string;
  palette?: string[];
  label?: string;
  sizeCls: string;
  labelCls: string;
  className?: string;
}) {
  const colors = normalizeColors(color, palette);
  // Build a soft gradient from the resolved swatches (one or more)
  const swatches = colors.slice(0, 3).map((c) => c.swatch);
  const stops =
    swatches.length === 1
      ? `${swatches[0]}, ${swatches[0]}`
      : swatches.join(", ");
  const bg = `linear-gradient(135deg, ${stops})`;

  return (
    <div
      className={`${sizeCls} relative overflow-hidden border border-border shrink-0 flex flex-col items-center justify-center ${className}`}
      style={{ backgroundImage: bg }}
      aria-label={label || "Plate preview"}
    >
      {/* subtle plate silhouette */}
      <div className="absolute inset-0 flex items-center justify-center opacity-40">
        <Layers className="h-1/2 w-1/2 text-foreground/70 mix-blend-overlay" />
      </div>
      {label && (
        <span
          className={`${labelCls} relative font-semibold text-foreground/90 bg-background/70 backdrop-blur-sm rounded px-1 leading-none py-0.5 truncate max-w-[90%]`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
