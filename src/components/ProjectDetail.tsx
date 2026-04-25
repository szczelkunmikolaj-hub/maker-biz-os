import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { Project, Print, ProjectExpense, getProjectTotalPrintTime, getProjectTotalMaterial, getProjectProgress, getProjectExpensesTotal, getProjectPiecesTotal, getProjectTotalPieces, getEstimatedMaterialCost, PaymentMethod } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Trash2, Copy, BookTemplate, Calendar, Kanban, Receipt, RefreshCw, ArrowUp, ArrowDown, Box, X, MoveRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlateImporter } from "@/components/PlateImporter";
import { RecurringBadge } from "@/components/RecurringBadge";
import { ColorPills } from "@/components/ColorPills";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PrintModel } from "@/types";

function newPrint(): Print {
  return { id: crypto.randomUUID(), name: "", estimatedPrintTime: 0, materialUsed: 0, printer: "", status: "not-printed", quantity: 1, completedQuantity: 0, color: "", material: "", pricePerPiece: 0 };
}

function newProjectExpense(): ProjectExpense {
  return { id: crypto.randomUUID(), name: "", amount: 0, category: "Other", notes: "" };
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Other"];

interface Props { project: Project; onBack: () => void; }

export default function ProjectDetail({ project, onBack }: Props) {
  const { updateProject, deleteProject, duplicateProject, settings, templates, addExpense, allPrintNames } = useApp();
  const navigate = useNavigate();
  const [showTemplates, setShowTemplates] = useState(false);

  // Use project from props directly (always fresh from context) instead of local state copy
  const p = project;
  const save = (updated: Project) => { updateProject(updated); };
  const set = (partial: Partial<Project>) => save({ ...p, ...partial });

  const addPrint = () => save({ ...p, prints: [...p.prints, newPrint()] });
  const addFromTemplate = (t: { name: string; estimatedPrintTime: number; materialUsed: number }) => {
    const pr = newPrint();
    pr.name = t.name;
    pr.estimatedPrintTime = t.estimatedPrintTime;
    pr.materialUsed = t.materialUsed;
    save({ ...p, prints: [...p.prints, pr] });
    setShowTemplates(false);
  };
  const updatePrint = (id: string, partial: Partial<Print>) => {
    save({ ...p, prints: p.prints.map(pr => pr.id === id ? { ...pr, ...partial } : pr) });
  };
  const removePrint = (id: string) => save({ ...p, prints: p.prints.filter(pr => pr.id !== id) });
  const movePrint = (id: string, dir: -1 | 1) => {
    const idx = p.prints.findIndex(pr => pr.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= p.prints.length) return;
    const arr = [...p.prints];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    save({ ...p, prints: arr });
  };
  const addModel = (printId: string) => {
    const m: PrintModel = { id: crypto.randomUUID(), name: "" };
    updatePrint(printId, { models: [...(p.prints.find(pr => pr.id === printId)?.models || []), m] });
  };
  const updateModel = (printId: string, modelId: string, partial: Partial<PrintModel>) => {
    const pr = p.prints.find(x => x.id === printId);
    if (!pr) return;
    updatePrint(printId, { models: (pr.models || []).map(m => m.id === modelId ? { ...m, ...partial } : m) });
  };
  const removeModel = (printId: string, modelId: string) => {
    const pr = p.prints.find(x => x.id === printId);
    if (!pr) return;
    updatePrint(printId, { models: (pr.models || []).filter(m => m.id !== modelId) });
  };
  const moveModel = (fromPrintId: string, modelId: string, toPrintId: string) => {
    if (fromPrintId === toPrintId) return;
    const from = p.prints.find(x => x.id === fromPrintId);
    const to = p.prints.find(x => x.id === toPrintId);
    if (!from || !to) return;
    const model = (from.models || []).find(m => m.id === modelId);
    if (!model) return;
    save({
      ...p,
      prints: p.prints.map(pr => {
        if (pr.id === fromPrintId) return { ...pr, models: (pr.models || []).filter(m => m.id !== modelId) };
        if (pr.id === toPrintId) return { ...pr, models: [...(pr.models || []), model] };
        return pr;
      }),
    });
  };

  // Project expenses
  const addProjectExpense = () => save({ ...p, projectExpenses: [...(p.projectExpenses || []), newProjectExpense()] });
  const updateProjectExpense = (id: string, partial: Partial<ProjectExpense>) => {
    const updated = { ...p, projectExpenses: (p.projectExpenses || []).map(e => e.id === id ? { ...e, ...partial } : e) };
    save(updated);
  };
  const removeProjectExpense = (id: string) => {
    save({ ...p, projectExpenses: (p.projectExpenses || []).filter(e => e.id !== id) });
  };
  const syncExpenseToGlobal = (pe: ProjectExpense) => {
    addExpense({
      id: crypto.randomUUID(),
      date: p.orderDate || new Date().toISOString().split("T")[0],
      name: pe.name,
      category: 'Project Expense',
      amount: pe.amount,
      notes: `Project: ${p.name}`,
      linkedProject: p.name,
    });
  };

  // Auto-calculate total from piece prices
  const piecesTotal = getProjectPiecesTotal(p);
  const autoCalcTotal = piecesTotal > 0;
  const effectiveTotal = autoCalcTotal ? piecesTotal : (p.totalPrice || 0);

  const totalTime = getProjectTotalPrintTime(p);
  const totalMaterial = getProjectTotalMaterial(p);
  const totalPieces = getProjectTotalPieces(p);
  const estimatedMatCost = getEstimatedMaterialCost(p, settings.filamentCostPerGram);
  const projectExpTotal = getProjectExpensesTotal(p);
  const projectForCalc = { ...p, totalPrice: effectiveTotal };
  // Real profit excludes estimated material cost — only project expenses count
  const profit = effectiveTotal - projectExpTotal;
  const profitMargin = effectiveTotal > 0 ? (profit / effectiveTotal) * 100 : 0;
  const progress = getProjectProgress(p);

  const marginColor = profitMargin >= 60 ? "text-green-600" : profitMargin >= 30 ? "text-yellow-600" : "text-red-600";
  const marginBg = profitMargin >= 60 ? "bg-green-500" : profitMargin >= 30 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex items-center gap-2 flex-1 flex-wrap min-w-0">
          <h1 className="text-2xl font-bold truncate">{p.name || "Untitled Project"}</h1>
          {p.isRecurringCustomer && <RecurringBadge size="md" />}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/kanban')}>
            <Kanban className="h-3.5 w-3.5" />Kanban
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/calendar')}>
            <Calendar className="h-3.5 w-3.5" />Calendar
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => navigate('/expenses')}>
            <Receipt className="h-3.5 w-3.5" />Expenses
          </Button>
          <Button size="sm" variant="outline" onClick={() => { duplicateProject(p.id); onBack(); }}>
            <Copy className="h-4 w-4 mr-1" />Duplicate
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Project Progress</span>
            <span>{progress.completedPieces}/{progress.totalPieces} pieces ({progress.percent}%)</span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Pieces", value: `${totalPieces}` },
          { label: "Print Time", value: `${totalTime.toFixed(1)}h` },
          { label: "Material", value: `${totalMaterial.toFixed(0)}g` },
          { label: "Est. Material Cost", value: `€${estimatedMatCost.toFixed(2)}`, subtitle: "estimate only" },
          { label: "Expenses", value: `€${projectExpTotal.toFixed(2)}` },
          { label: "Profit", value: `€${profit.toFixed(2)}`, highlight: true },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-lg font-bold ${(s as any).highlight ? "text-primary" : ""}`}>{s.value}</p>
              {(s as any).subtitle && <p className="text-[10px] text-muted-foreground italic">{(s as any).subtitle}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Profit margin bar */}
      {effectiveTotal > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Profit Margin</span>
              <span className={`font-bold ${marginColor}`}>{profitMargin.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${marginBg}`} style={{ width: `${Math.min(100, Math.max(0, profitMargin))}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project fields */}
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-2">
          <div><Label>Project Name</Label><Input value={p.name} onChange={e => set({ name: e.target.value })} /></div>
          <div><Label>Customer</Label><Input value={p.customerName} onChange={e => set({ customerName: e.target.value })} /></div>
          <div><Label>Source</Label>
            <Select value={p.customerSource} onValueChange={v => set({ customerSource: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Wallapop", "Instagram", "Website", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Payment Method</Label>
            <Select value={p.paymentMethod || "Other"} onValueChange={v => set({ paymentMethod: v as PaymentMethod })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Order Date</Label><Input type="date" value={p.orderDate} onChange={e => set({ orderDate: e.target.value })} /></div>
          <div><Label>Due Date</Label><Input type="date" value={p.dueDate || ""} onChange={e => set({ dueDate: e.target.value })} /></div>
          <div>
            <Label>Total Price (€) {autoCalcTotal && <span className="text-xs text-muted-foreground ml-1">auto from pieces</span>}</Label>
            <Input type="number" step="0.01" value={autoCalcTotal ? piecesTotal.toFixed(2) : (p.totalPrice || "")} onChange={e => set({ totalPrice: parseFloat(e.target.value) || 0 })} readOnly={autoCalcTotal} className={autoCalcTotal ? "bg-muted" : ""} />
          </div>
          <div><Label>Shipping Date</Label><Input type="date" value={p.shippingDate} onChange={e => set({ shippingDate: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Notes</Label><Textarea value={p.notes} onChange={e => set({ notes: e.target.value })} /></div>
          <div className="flex gap-6 md:col-span-2 flex-wrap">
            {(["printed", "paid", "sent"] as const).map(field => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={p[field]} onCheckedChange={v => set({ [field]: !!v })} />
                <span className="text-sm capitalize">{field}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={p.isRecurringCustomer || false} onCheckedChange={v => set({ isRecurringCustomer: !!v })} />
              <span className="text-sm flex items-center gap-1"><RefreshCw className="h-3 w-3" />Recurring Customer</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Add Plates / Models — import from .3mf or .gcode */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            Add Plates / Models
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlateImporter project={p} compact />
        </CardContent>
      </Card>

      {/* Prints / Pieces */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Plates / Pieces</CardTitle>
          <div className="flex gap-2">
            {templates.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>
                <BookTemplate className="h-4 w-4 mr-1" />From Template
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addPrint}><Plus className="h-4 w-4 mr-1" />Add Plate</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.prints.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No plates yet. Click "Add Plate" or import a .3mf above.</p>}
          {p.prints.map((pr, idx) => {
            const pieceTotal = (pr.pricePerPiece || 0) * (pr.quantity || 1);
            const models = pr.models || [];
            const otherPlates = p.prints.filter(x => x.id !== pr.id);
            return (
              <div key={pr.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-center gap-1 -mb-1">
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => movePrint(pr.id, -1)} title="Move up">
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === p.prints.length - 1} onClick={() => movePrint(pr.id, 1)} title="Move down">
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground ml-1">#{idx + 1}</span>
                  {pr.thumbnail && (
                    <img src={pr.thumbnail} alt={pr.name} className="h-8 w-8 rounded border object-cover ml-2" />
                  )}
                  <div className="ml-2">
                    <ColorPills color={pr.color} palette={pr.colorPalette} material={pr.material} size="sm" showLabel />
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                  <div className="col-span-2 md:col-span-1">
                    <Label className="text-xs">Plate / Piece Name</Label>
                    <Input value={pr.name} onChange={e => updatePrint(pr.id, { name: e.target.value })} list={`names-${pr.id}`} placeholder="e.g. Plate 1 / Gear Housing" />
                    <datalist id={`names-${pr.id}`}>{allPrintNames.map(n => <option key={n} value={n} />)}</datalist>
                  </div>
                  <div><Label className="text-xs">Material</Label><Input value={pr.material || ""} onChange={e => updatePrint(pr.id, { material: e.target.value })} placeholder="PLA, PETG..." /></div>
                  <div><Label className="text-xs">Color</Label><Input value={pr.color || ""} onChange={e => updatePrint(pr.id, { color: e.target.value })} placeholder="Black, White..." /></div>
                  <div><Label className="text-xs">Qty</Label><Input type="number" min="1" value={pr.quantity || 1} onChange={e => updatePrint(pr.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                </div>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-5 items-end">
                  <div><Label className="text-xs">Print Time (h)</Label><Input type="number" step="0.1" value={pr.estimatedPrintTime || ""} onChange={e => updatePrint(pr.id, { estimatedPrintTime: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">Material (g)</Label><Input type="number" value={pr.materialUsed || ""} onChange={e => updatePrint(pr.id, { materialUsed: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">Price/Piece (€)</Label><Input type="number" step="0.01" value={pr.pricePerPiece || ""} onChange={e => updatePrint(pr.id, { pricePerPiece: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">Done</Label><Input type="number" min="0" max={pr.quantity || 1} value={pr.completedQuantity || 0} onChange={e => updatePrint(pr.id, { completedQuantity: Math.min(pr.quantity || 1, Math.max(0, parseInt(e.target.value) || 0)) })} /></div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Status</Label>
                      <Select value={pr.status || 'not-printed'} onValueChange={v => updatePrint(pr.id, { status: v as any })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not-printed">Not Printed</SelectItem>
                          <SelectItem value="printing">Printing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive h-9 w-9" onClick={() => removePrint(pr.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* Models on this plate */}
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                      Models ({models.length})
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => addModel(pr.id)}>
                      <Plus className="h-3 w-3" />Add Model
                    </Button>
                  </div>
                  {models.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/70 italic">No individual models tracked.</p>
                  ) : (
                    <div className="space-y-1">
                      {models.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5 text-xs">
                          <Box className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Input
                            value={m.name}
                            onChange={e => updateModel(pr.id, m.id, { name: e.target.value })}
                            placeholder="Model name"
                            className="h-7 text-xs"
                          />
                          <Input
                            value={m.material || ""}
                            onChange={e => updateModel(pr.id, m.id, { material: e.target.value })}
                            placeholder="Mat."
                            className="h-7 text-xs w-20"
                          />
                          {otherPlates.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Move to plate">
                                  <MoveRight className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {otherPlates.map(op => (
                                  <DropdownMenuItem key={op.id} onClick={() => moveModel(pr.id, m.id, op.id)}>
                                    Move to {op.name || "plate"}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeModel(pr.id, m.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {pieceTotal > 0 && (
                  <div className="text-xs text-muted-foreground text-right">
                    Subtotal: <span className="font-medium text-foreground">€{pieceTotal.toFixed(2)}</span>
                    {(pr.quantity || 1) > 1 && <span className="ml-1">({pr.quantity} × €{(pr.pricePerPiece || 0).toFixed(2)})</span>}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Project Expenses */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Project Expenses</CardTitle>
          <Button size="sm" variant="outline" onClick={addProjectExpense}><Plus className="h-4 w-4 mr-1" />Add Expense</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(p.projectExpenses || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No project expenses. Add LEDs, magnets, packaging, etc.</p>}
          {(p.projectExpenses || []).map(pe => (
            <div key={pe.id} className="grid gap-2 md:grid-cols-5 items-end p-3 rounded-lg border bg-muted/30">
              <div><Label className="text-xs">Name</Label><Input value={pe.name} onChange={e => updateProjectExpense(pe.id, { name: e.target.value })} /></div>
              <div><Label className="text-xs">Amount (€)</Label><Input type="number" step="0.01" value={pe.amount || ""} onChange={e => updateProjectExpense(pe.id, { amount: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label className="text-xs">Category</Label><Input value={pe.category} onChange={e => updateProjectExpense(pe.id, { category: e.target.value })} placeholder="e.g. Hardware" /></div>
              <div><Label className="text-xs">Notes</Label><Input value={pe.notes} onChange={e => updateProjectExpense(pe.id, { notes: e.target.value })} /></div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => syncExpenseToGlobal(pe)}>Sync Global</Button>
                <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeProjectExpense(pe.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={() => { deleteProject(p.id); onBack(); }}>
          <Trash2 className="h-4 w-4 mr-1" />Delete Project
        </Button>
      </div>

      {/* Template picker dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent>
          <DialogHeader><DialogTitle>Insert from Template</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {templates.map(t => (
              <Card key={t.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => addFromTemplate(t)}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.estimatedPrintTime}h · {t.materialUsed}g</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
