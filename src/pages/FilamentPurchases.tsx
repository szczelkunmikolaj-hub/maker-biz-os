import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          <h1 className="text-2xl font-bold">{t('filament.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('filament.description')}</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />{t('filament.addPurchase')}</Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {t('filament.totalSpend')}: <strong className="text-foreground">€{totalFilamentPurchasesCost.toFixed(2)}</strong>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('filament.tableDate')}</TableHead>
                <TableHead>{t('filament.tableMaterial')}</TableHead>
                <TableHead>{t('filament.tableBrand')}</TableHead>
                <TableHead>{t('filament.tableSpools')}</TableHead>
                <TableHead>{t('filament.tableWeightSpool')}</TableHead>
                <TableHead className="text-right">{t('filament.tableTotalCost')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filamentPurchases.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t('filament.noFilament')}</TableCell></TableRow>
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
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => { posthog.capture('filament_purchase_deleted', { material_type: fp.materialType, total_cost: fp.totalCost }); deleteFilamentPurchase(fp.id); }}>
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
          <DialogHeader><DialogTitle>{t('filament.dialogTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t('filament.purchaseDate')}</Label><Input type="date" value={draft.purchaseDate} onChange={e => setDraft({ ...draft, purchaseDate: e.target.value })} /></div>
            <div><Label>{t('filament.materialType')}</Label><Input value={draft.materialType} onChange={e => setDraft({ ...draft, materialType: e.target.value })} placeholder={t('filament.materialPlaceholder')} /></div>
            <div><Label>{t('filament.brand')}</Label><Input value={draft.brand} onChange={e => setDraft({ ...draft, brand: e.target.value })} placeholder={t('filament.brandPlaceholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t('filament.weightPerSpool')}</Label><Input type="number" value={draft.spoolWeight || ""} onChange={e => setDraft({ ...draft, spoolWeight: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>{t('filament.numberOfSpools')}</Label><Input type="number" min={1} value={draft.numberOfSpools} onChange={e => setDraft({ ...draft, numberOfSpools: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
            </div>
            <div><Label>{t('filament.totalCost')}</Label><Input type="number" step="0.01" value={draft.totalCost || ""} onChange={e => setDraft({ ...draft, totalCost: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>{t('common.notes')}</Label><Input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>{t('filament.addPurchaseBtn')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
