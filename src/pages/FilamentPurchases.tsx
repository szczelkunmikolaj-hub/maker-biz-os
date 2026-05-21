import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { FilamentPurchase } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
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
  };
}

export default function FilamentPurchases() {
  const { filamentPurchases, addFilamentPurchase, deleteFilamentPurchase, totalFilamentPurchasesCost } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<FilamentPurchase>(newPurchase());

  const handleAdd = () => {
    if (!draft.totalCost) return;
    addFilamentPurchase(draft);
    posthog.capture('filament_purchase_added', {
      material_type: draft.materialType,
      brand: draft.brand || null,
      number_of_spools: draft.numberOfSpools,
      spool_weight_g: draft.spoolWeight,
      total_cost: draft.totalCost,
    });
    setDraft(newPurchase());
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Filament Purchases</h1>
          <p className="text-sm text-muted-foreground">Track real filament costs. These are used for profit calculations instead of per-print estimates.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />Add Purchase</Button>
      </div>

      <div className="text-sm text-muted-foreground">
        Total Filament Spend: <strong className="text-foreground">€{totalFilamentPurchasesCost.toFixed(2)}</strong>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Spools</TableHead>
                <TableHead>Weight/Spool</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filamentPurchases.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No filament purchases yet.</TableCell></TableRow>
              )}
              {filamentPurchases.map(fp => (
                <TableRow key={fp.id}>
                  <TableCell className="text-sm">{fp.purchaseDate}</TableCell>
                  <TableCell className="font-medium">{fp.materialType}</TableCell>
                  <TableCell className="text-sm">{fp.brand || "—"}</TableCell>
                  <TableCell className="text-sm">{fp.numberOfSpools}</TableCell>
                  <TableCell className="text-sm">{fp.spoolWeight}g</TableCell>
                  <TableCell className="text-right font-mono">€{(fp.totalCost || 0).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteFilamentPurchase(fp.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Filament Purchase</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Purchase Date</Label><Input type="date" value={draft.purchaseDate} onChange={e => setDraft({ ...draft, purchaseDate: e.target.value })} /></div>
            <div><Label>Material Type</Label><Input value={draft.materialType} onChange={e => setDraft({ ...draft, materialType: e.target.value })} placeholder="PLA, PETG, ABS..." /></div>
            <div><Label>Brand</Label><Input value={draft.brand} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder="e.g. Bambu, Sunlu..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Weight per Spool (g)</Label><Input type="number" value={draft.spoolWeight || ""} onChange={e => setDraft({ ...draft, spoolWeight: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Number of Spools</Label><Input type="number" min={1} value={draft.numberOfSpools} onChange={e => setDraft({ ...draft, numberOfSpools: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
            </div>
            <div><Label>Total Cost (€)</Label><Input type="number" step="0.01" value={draft.totalCost || ""} onChange={e => setDraft({ ...draft, totalCost: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Notes</Label><Input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>Add Purchase</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
