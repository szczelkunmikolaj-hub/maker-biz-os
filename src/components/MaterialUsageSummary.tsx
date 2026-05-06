import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Palette, ChevronDown, ChevronRight } from "lucide-react";

interface ProjectBreakdown {
  projectId: string;
  projectName: string;
  customer?: string;
  grams: number;
}

interface MaterialGroup {
  key: string;
  material: string;
  color: string;
  totalGrams: number;
  spoolsNeeded: number;
  projectCount: number;
  byProject: ProjectBreakdown[];
}

function normalizeMaterialName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseMaterialColor(material: string, color: string): { mat: string; col: string } {
  const normMat = normalizeMaterialName(material);
  const normCol = normalizeMaterialName(color);

  // Handle cases like "PLA Black" in material field
  const knownMaterials = ['pla', 'petg', 'abs', 'tpu', 'nylon', 'asa', 'pc', 'pva', 'hips'];
  const matParts = normMat.split(' ');

  if (matParts.length > 1) {
    const baseMat = matParts[0];
    if (knownMaterials.includes(baseMat)) {
      const colorFromMat = matParts.slice(1).join(' ');
      return {
        mat: baseMat.toUpperCase(),
        col: normCol || colorFromMat,
      };
    }
  }

  // Also handle "Black PLA" (color first, material second)
  if (matParts.length > 1) {
    const lastPart = matParts[matParts.length - 1];
    if (knownMaterials.includes(lastPart)) {
      const colorFromMat = matParts.slice(0, -1).join(' ');
      return {
        mat: lastPart.toUpperCase(),
        col: normCol || colorFromMat,
      };
    }
  }

  return {
    mat: normMat ? normMat.toUpperCase() : 'UNKNOWN',
    col: normCol || 'unspecified',
  };
}

function capitalizeWords(s: string): string {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const SPOOL_SIZE_GRAMS = 1000;

export default function MaterialUsageSummary() {
  const { projects } = useApp();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const map = new Map<string, MaterialGroup>();
    const activeProjects = projects.filter(p => !p.sent);

    activeProjects.forEach(p => {
      const perProjectGrams = new Map<string, number>();
      (p.prints || []).forEach(pr => {
        if ((pr.materialUsed || 0) === 0) return;
        const remaining = ((pr.quantity || 1) - (pr.completedQuantity || 0));
        if (remaining <= 0) return;

        const { mat, col } = parseMaterialColor(pr.material || '', pr.color || '');
        const key = `${mat}|||${col}`;
        const grams = (pr.materialUsed || 0) * remaining;

        const existing = map.get(key) || {
          key, material: mat, color: col,
          totalGrams: 0, spoolsNeeded: 0, projectCount: 0,
          byProject: [] as ProjectBreakdown[],
        };
        existing.totalGrams += grams;
        existing.spoolsNeeded = Math.ceil(existing.totalGrams / SPOOL_SIZE_GRAMS);
        map.set(key, existing);

        perProjectGrams.set(key, (perProjectGrams.get(key) || 0) + grams);
      });

      perProjectGrams.forEach((grams, key) => {
        const g = map.get(key);
        if (!g) return;
        g.byProject.push({ projectId: p.id, projectName: p.name, customer: p.customer, grams });
        g.projectCount = g.byProject.length;
      });
    });

    const arr = Array.from(map.values());
    arr.forEach(g => g.byProject.sort((a, b) => b.grams - a.grams));
    return arr.sort((a, b) => b.totalGrams - a.totalGrams);
  }, [projects]);

  if (groups.length === 0) return null;

  const maxGrams = Math.max(...groups.map(g => g.totalGrams));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Material Usage Summary
        </CardTitle>
        <p className="text-xs text-muted-foreground">Filament needed per project to ship all open orders</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {groups.map(g => {
          const isOpen = !!expanded[g.key];
          return (
            <div key={g.key} className="space-y-1.5">
              <button
                type="button"
                onClick={() => setExpanded(s => ({ ...s, [g.key]: !s[g.key] }))}
                className="w-full flex items-center justify-between gap-2 text-left hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <span className="text-sm font-medium truncate">
                    {g.material} {g.color !== 'unspecified' ? capitalizeWords(g.color) : ''}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {g.projectCount} project{g.projectCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold">{g.totalGrams.toFixed(0)}g</span>
                  <span className="text-xs text-muted-foreground ml-1.5">
                    (~{g.spoolsNeeded} spool{g.spoolsNeeded !== 1 ? 's' : ''})
                  </span>
                </div>
              </button>
              <Progress value={(g.totalGrams / maxGrams) * 100} className="h-1.5" />
              {isOpen && (
                <ul className="mt-2 ml-5 space-y-1 border-l border-border pl-3">
                  {g.byProject.map(bp => (
                    <li key={bp.projectId} className="flex items-center justify-between gap-2 text-xs">
                      <Link
                        to={`/projects?id=${bp.projectId}`}
                        className="truncate hover:underline text-foreground"
                      >
                        {bp.projectName}
                        {bp.customer && <span className="text-muted-foreground"> · {bp.customer}</span>}
                      </Link>
                      <span className="font-medium tabular-nums shrink-0">{bp.grams.toFixed(0)}g</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground pt-1">
          Based on {SPOOL_SIZE_GRAMS / 1000}kg spool size. Only remaining (unprinted) quantities counted. Click a row to see per-project breakdown.
        </p>
      </CardContent>
    </Card>
  );
}
