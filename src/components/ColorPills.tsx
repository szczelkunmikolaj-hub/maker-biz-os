import { normalizeColors } from "@/lib/normalize";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  /** Raw color string from the data (may be a slot id, hex, name, or comma-separated list). */
  color?: string;
  /** Optional ordered list of palette hex codes (from .3mf filament metadata) for slot resolution. */
  palette?: string[];
  /** Optional material to combine in the tooltip (e.g. "PLA"). */
  material?: string;
  size?: "xs" | "sm" | "md";
  /** Show the label text next to the dots (default: only first label). */
  showLabel?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-2 w-2",
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
};

export function ColorPills({ color, palette, material, size = "sm", showLabel = true, className = "" }: Props) {
  const colors = normalizeColors(color, palette);
  if (colors.length === 0) return null;

  const dotCls = SIZE[size];
  const labelText = colors.map((c) => c.label).join(" + ");
  const tooltipText = material ? `${material} · ${labelText}` : labelText;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 ${className}`}>
            <span className="inline-flex items-center -space-x-0.5">
              {colors.map((c, i) => (
                <span
                  key={i}
                  className={`${dotCls} rounded-full ring-1 ring-border shrink-0`}
                  style={{ backgroundColor: c.swatch }}
                  aria-label={c.label}
                />
              ))}
            </span>
            {showLabel && (
              <span className="text-[10px] text-muted-foreground truncate">
                {colors.length === 1 ? colors[0].label : `${colors[0].label} +${colors.length - 1}`}
              </span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
