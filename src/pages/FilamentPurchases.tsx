import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { FilamentPurchase } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, AlertTriangle, Package } from "lucide-react";
import posthog from "@/lib/posthog";

function newPurchase(): FilamentPurchase {
  return {
    id: crypto.randomUUID(),
    purchaseDate: new Date().toISOString().split("T")[0],
    materialType: "PLA",
    brand: "",
    spoolWeight: 1000,
    numberOfSpools: 1,
    totalCost: 0,
    notes: "",
    color: "",
    colorSwatch: "",
  };
}

const LOW_STOCK_THRESHOLD = 200; // grams

export default function FilamentPurchases() {
  const { filamentPurchases, addFilamentPurchase, deleteFilamentPurchase, totalFilamentPurchasesCost, projects } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<FilamentPurchase>(newPurchase());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const handleAdd = () => {
    if (!draft.totalCost) return;
    addFilamentPurchase(draft);
    posthog.capture('filament_purchase_added', {
      material_type: draft.materialType,
      brand: draft.brand || null,
      number_of_spools: draft.numberOfSpools,
      spool_weight_g: draft.spoolWeight,
      total_cost: draft.totalCost,
      color: draft.color || null,
    });
    setDraft(newPurchase());
    setShowAdd(false);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group purchases by material + color
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; material: string; color: string; swatch: string; purchases: FilamentPurchase[]; totalBought: number }>();
    filamentPurchases.forEach(fp => {
      const color = fp.color || '';
      const key = `${fp.materialType}__${color}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          material: fp.materialType,
          color,
          swatch: fp.colorSwatch || '',
          purchases: [],
          totalBought: 0,
        });
      }
      const g = map.get(key)!;
      g.purchases.push(fp);
      g.totalBought += (fp.spoolWeight || 0) * (fp.numberOfSpools || 1);
      if (fp.colorSwatch && !g.swatch) g.swatch = fp.colorSwatch;
    });

    // Estimated grams used per material (from all project plates)
    const usedByMaterial = new Map<string, number>();
    projects.forEach(p => {
      (p.prints || []).forEach(pr => {
        const mat = (pr.material || 'PLA').trim();
        const used = (pr.materialUsed || 0) * (pr.quantity || 1);
        usedByMaterial.set(mat, (usedByMaterial.get(mat) || 0) + used);
    });
    });

    return Array.from(map.values())
      .sort((a, b) => a.material.localeCompare(b.material) || a.color.localeCompare(b.color))
      .map(g => {
        const estUsed = usedByMaterial.get(g.material.trim()) || 0;
        // Distribute usage across groups of same material proportionally to bought
        const totalBoughtSameMat = Array.from(map.values())
          .filter(x => x.material === g.material)
          .reduce((s, x) => s + x.totalBought, 0);
        const share = totalBoughtSameMat > 0 ? g.totalBought / totalBoughtSameMat : 1;
        const estUsedThis = Math.round(estUsed * share);
        const estRemaining = Math.max(0, g.totalBought - estUsedThis);
        return { ...g, estUsed: estUsedThis, estRemaining };
      });
  }, [filamentPurchases, projects]);

  const currencySymbol = '€';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Filament</h1>
          <p className="text-sm text-muted-foreground">Track filament purchases and estimated stock levels.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Add purchase</Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Total spend: <strong className="text-foreground">{currencySymbol}{totalFilamentPurchasesCost.toFixed(2)}</strong>
      </div>

      {filamentPurchases.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-4">
            <Package className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <p className="font-semibold">No filament purchases yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add your spool purchases to track spending and estimated remaining stock.</p>
            </div>
            <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Add first purchase</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const isExpanded = expandedGroups.has(g.key);
            const isLowStock = g.estRemaining < LOW_STOCK_THRESHOLD;
            const groupLabel = g.color ? `${g.material} – ${g.color}` : g.material;

            return (
              <Card key={g.key} className={isLowStock ? "border-[hsl(38,85%,46%/0.4)]" : ""}>
                <CardHeader className="pb-0 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                      onClick={() => toggleGroup(g.key)}
                    >
                      {g.swatch && (
                        <span className="w-4 h-4 rounded-full ring-1 ring-border shrink-0" style={{ backgroundColor: g.swatch }} />
                      )}
                      <CardTitle className="text-base">{groupLabel}</CardTitle>
                      <span className="text-xs text-muted-foreground">{g.purchases.length} {g.purchases.length === 1 ? 'purchase' : 'purchases'}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? '' : '-rotate-90'}`} />
                    </button>
                    {isLowStock && (
                      <Badge variant="outline" className="bg-[hsl(38,85%,46%/0.12)] text-[hsl(38,85%,34%)] border-[hsl(38,85%,46%/0.3)] shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />Low stock
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-3 pb-4">
                  {/* Stock summary */}
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Total bought</p>
                      <p className="font-semibold">{g.totalBought.toLocaleString()}g</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Est. used *</p>
                      <p className="font-semibold">{g.estUsed.toLocaleString()}g</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Est. remaining *</p>
                      <p className={`font-semibold ${isLowStock ? 'text-[hsl(38,85%,36%)]' : ''}`}>{g.estRemaining.toLocaleString()}g</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">* Estimates based on project plate usage — actual remaining may differ.</p>

                  {/* Individual purchases (expandable) */}
                  {isExpanded && (
                    <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
                      {g.purchases.map(fp => (
                        <div key={fp.id} className="flex items-center justify-between gap-3 text-sm py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground w-24 shrink-0">{fp.purchaseDate}</span>
                            <span className="text-muted-foreground truncate">{fp.brand || '—'}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span>{fp.numberOfSpools} × {fp.spoolWeight}g</span>
                            <span className="font-mono text-muted-foreground">{currencySymbol}{(fp.totalCost || 0).toFixed(2)}</span>
                            <button
                              className="text-destructive hover:bg-destructive/10 h-6 w-6 rounded flex items-center justify-center transition-colors"
                              onClick={() => { posthog.capture('filament_purchase_deleted', { material_type: fp.materialType }); deleteFilamentPurchase(fp.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add filament purchase</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Purchase date</Label><Input type="date" value={draft.purchaseDate} onChange={e => setDraft({ ...draft, purchaseDate: e.target.value })} /></div>
              <div><Label>Material type</Label><Input value={draft.materialType} onChange={e => setDraft({ ...draft, materialType: e.target.value })} placeholder="PLA, PETG, ABS…" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Colour name</Label>
                <Input value={draft.color || ''} onChange={e => setDraft({ ...draft, color: e.target.value })} placeholder="Arctic White, Galaxy Black…" />
              </div>
              <div>
                <Label>Colour swatch</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={draft.colorSwatch || '#888888'}
                    onChange={e => setDraft({ ...draft, colorSwatch: e.target.value })}
                    className="h-9 w-12 rounded border border-input cursor-pointer p-0.5"
                  />
                  <span className="text-xs text-muted-foreground">{draft.colorSwatch || 'Pick a colour'}</span>
                </div>
              </div>
            </div>
            <div><Label>Brand</Label><Input value={draft.brand} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder="Bambu, Prusament, Polymaker…" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Weight per spool (g)</Label><Input type="number" value={draft.spoolWeight || ""} onChange={e => setDraft({ ...draft, spoolWeight: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Number of spools</Label><Input type="number" min={1} value={draft.numberOfSpools} onChange={e => setDraft({ ...draft, numberOfSpools: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
            </div>
            <div><Label>Total cost ({currencySymbol})</Label><Input type="number" step="0.01" value={draft.totalCost || ""} onChange={e => setDraft({ ...draft, totalCost: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Notes</Label><Input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>Add purchase</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
