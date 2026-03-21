import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { PrintTemplate } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

function newTemplate(): PrintTemplate {
  return { id: crypto.randomUUID(), name: "", estimatedPrintTime: 0, materialUsed: 0, notes: "" };
}

export default function TemplatesPage() {
  const { templates, addTemplate, deleteTemplate } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<PrintTemplate>(newTemplate());

  const handleAdd = () => {
    if (!draft.name) return;
    addTemplate(draft);
    setDraft(newTemplate());
    setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Print Templates</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />New Template</Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Save reusable print configurations here. Templates can be inserted into any project.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Print Time</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No templates yet.</TableCell></TableRow>
              )}
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="font-mono text-sm">{t.estimatedPrintTime}h</TableCell>
                  <TableCell className="font-mono text-sm">{t.materialUsed}g</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.notes || "—"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => deleteTemplate(t.id)}>
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
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Print Name</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>Estimated Print Time (hours)</Label><Input type="number" step="0.1" value={draft.estimatedPrintTime || ""} onChange={e => setDraft({ ...draft, estimatedPrintTime: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Material Used (grams)</Label><Input type="number" value={draft.materialUsed || ""} onChange={e => setDraft({ ...draft, materialUsed: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Notes</Label><Textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>Save Template</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
