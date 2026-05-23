import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "react-i18next";
import { PrintTemplate } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import posthog from "@/lib/posthog";

function newTemplate(): PrintTemplate {
  return { id: crypto.randomUUID(), name: "", estimatedPrintTime: 0, materialUsed: 0, notes: "" };
}

export default function TemplatesPage() {
  const { templates, addTemplate, deleteTemplate } = useApp();
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<PrintTemplate>(newTemplate());

  const handleAdd = () => {
    if (!draft.name) return;
    addTemplate(draft);
    posthog.capture('template_created', {
      estimated_print_time: draft.estimatedPrintTime,
      material_used_g: draft.materialUsed,
      has_notes: !!draft.notes,
    });
    setDraft(newTemplate());
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('templates.title')}</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />{t('templates.newTemplate')}</Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('templates.description')}
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('templates.tableName')}</TableHead>
                <TableHead>{t('templates.tablePrintTime')}</TableHead>
                <TableHead>{t('templates.tableMaterial')}</TableHead>
                <TableHead>{t('templates.tableNotes')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('templates.noTemplates')}</TableCell></TableRow>
              )}
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-sm">{t.estimatedPrintTime}h</TableCell>
                  <TableCell className="font-mono text-sm">{t.materialUsed}g</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.notes || "—"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => { deleteTemplate(t.id); posthog.capture('template_deleted'); }}>
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
          <DialogHeader><DialogTitle>{t('templates.dialogTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t('templates.printName')}</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>{t('templates.estimatedPrintTime')}</Label><Input type="number" step="0.1" value={draft.estimatedPrintTime || ""} onChange={e => setDraft({ ...draft, estimatedPrintTime: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>{t('templates.materialUsed')}</Label><Input type="number" value={draft.materialUsed || ""} onChange={e => setDraft({ ...draft, materialUsed: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>{t('common.notes')}</Label><Textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>{t('templates.saveTemplate')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
