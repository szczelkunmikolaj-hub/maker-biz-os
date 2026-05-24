import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { ArrowLeft, Plus, Trash2, Copy, BookTemplate, Calendar, Kanban, Receipt, RefreshCw, ArrowUp, ArrowDown, Box, X, MoveRight, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlateImporter } from "@/components/PlateImporter";
import { RecurringBadge } from "@/components/RecurringBadge";
import { ColorPills } from "@/components/ColorPills";
import { PlatePreview } from "@/components/PlatePreview";
import { normalizeMaterial } from "@/lib/normalize";
import posthog from "@/lib/posthog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PrintModel } from "@/types";
import { InvoiceModal } from "@/components/InvoicePDF";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useTier } from "@/context/TierContext";
import { Lock } from "lucide-react";

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
  const { t } = useTranslation();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { isPro } = useTier();

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
      <div className="flex items-start gap-2 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 mt-0.5"><ArrowLeft className="h-4 w-4" /></Button>
        <PlatePreview
          thumbnail={p.coverThumbnail || p.prints?.[0]?.thumbnail}
          color={(p.prints || []).map(pr => pr.color).filter(Boolean).join(", ") || undefined}
          palette={(p.prints || []).flatMap(pr => pr.colorPalette || [])}
          label={p.name}
          size="sm"
          noHover
        />
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold truncate max-w-full">{p.name || t('projectDetail.untitled')}</h1>
          {p.isRecurringCustomer && <RecurringBadge size="md" />}
        </div>
        <div className="flex gap-1.5 flex-wrap w-full sm:w-auto">
          <Button size="sm" variant="outline" className="text-xs gap-1 min-h-[36px]" onClick={() => navigate('/kanban')}>
            <Kanban className="h-3.5 w-3.5" />{t('projectDetail.kanban')}
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1 min-h-[36px]" onClick={() => navigate('/calendar')}>
            <Calendar className="h-3.5 w-3.5" />{t('projectDetail.calendar')}
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1 min-h-[36px]" onClick={() => navigate('/expenses')}>
            <Receipt className="h-3.5 w-3.5" />{t('projectDetail.expenses')}
          </Button>
          <Button size="sm" variant="outline" className="min-h-[36px]" onClick={() => { duplicateProject(p.id); posthog.capture('project_duplicated', { customer_source: p.customerSource }); onBack(); }}>
            <Copy className="h-4 w-4 mr-1" />{t('projectDetail.duplicate')}
          </Button>
          <Button size="sm" variant="outline" className="text-xs gap-1 min-h-[36px]" onClick={() => {
            if (!isPro) { setShowUpgrade(true); return; }
            setShowInvoice(true); posthog.capture('invoice_generated', { customer_source: p.customerSource });
          }}>
            {!isPro && <Lock className="h-3 w-3" />}
            <FileText className="h-3.5 w-3.5" />{t('invoice.generateBtn')}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t('projectDetail.projectProgress')}</span>
            <span>{progress.completedPieces}/{progress.totalPieces} {t('projects.pieces')} ({progress.percent}%)</span>
          </div>
          <Progress value={progress.percent} className="h-2" />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: t('projectDetail.piecesLabel'), value: `${totalPieces}` },
          { label: t('projectDetail.printTime'), value: `${totalTime.toFixed(1)}h` },
          { label: t('projectDetail.material'), value: `${totalMaterial.toFixed(0)}g` },
          { label: t('projectDetail.estMaterialCost'), value: `€${estimatedMatCost.toFixed(2)}`, subtitle: t('projectDetail.estimateOnly') },
          { label: t('projectDetail.expensesLabel'), value: `€${projectExpTotal.toFixed(2)}` },
          { label: t('projectDetail.profit'), value: `€${profit.toFixed(2)}`, highlight: true },
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
              <span className="text-muted-foreground">{t('projectDetail.profitMargin')}</span>
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
        <CardContent className="p-4 grid gap-3 grid-cols-1 md:grid-cols-2">
          <div><Label>{t('projectDetail.projectName')}</Label><Input value={p.name} onChange={e => set({ name: e.target.value })} /></div>
          <div><Label>{t('projectDetail.customer')}</Label><Input value={p.customerName} onChange={e => set({ customerName: e.target.value })} /></div>
          <div><Label>{t('projectDetail.source')}</Label>
            <Select value={p.customerSource} onValueChange={v => set({ customerSource: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Wallapop", "Instagram", "Website", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t('projectDetail.paymentMethod')}</Label>
            <Select value={p.paymentMethod || "Other"} onValueChange={v => set({ paymentMethod: v as PaymentMethod })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t('projectDetail.orderDate')}</Label><Input type="date" value={p.orderDate} onChange={e => set({ orderDate: e.target.value })} /></div>
          <div><Label>{t('projectDetail.dueDate')}</Label><Input type="date" value={p.dueDate || ""} onChange={e => set({ dueDate: e.target.value })} /></div>
          <div>
            <Label>{t('projectDetail.totalPrice')} {autoCalcTotal && <span className="text-xs text-muted-foreground ml-1">{t('projectDetail.autoFromPieces')}</span>}</Label>
            <Input type="number" step="0.01" value={autoCalcTotal ? piecesTotal.toFixed(2) : (p.totalPrice || "")} onChange={e => set({ totalPrice: parseFloat(e.target.value) || 0 })} readOnly={autoCalcTotal} className={autoCalcTotal ? "bg-muted" : ""} />
          </div>
          <div><Label>{t('projectDetail.shippingDate')}</Label><Input type="date" value={p.shippingDate} onChange={e => set({ shippingDate: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>{t('projectDetail.notes')}</Label><Textarea value={p.notes} onChange={e => set({ notes: e.target.value })} /></div>
          <div className="flex gap-6 md:col-span-2 flex-wrap">
            {(["printed", "paid", "sent"] as const).map(field => (
              <label key={field} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={p[field]} onCheckedChange={v => set({ [field]: !!v })} />
                <span className="text-sm">{field === 'printed' ? t('projectDetail.printedCheck') : field === 'paid' ? t('projectDetail.paidCheck') : t('projectDetail.sentCheck')}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 cursor-pointer" onClick={!isPro ? (e) => { e.preventDefault(); setShowUpgrade(true); } : undefined}>
              <Checkbox checked={p.isRecurringCustomer || false} onCheckedChange={v => { if (!isPro) { setShowUpgrade(true); return; } set({ isRecurringCustomer: !!v }); }} disabled={!isPro} />
              <span className="text-sm flex items-center gap-1">
                {!isPro && <Lock className="h-3 w-3 text-muted-foreground" />}
                <RefreshCw className="h-3 w-3" />{t('projectDetail.recurringCustomer')}
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Add Plates / Models — import from .3mf or .gcode */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            {t('projectDetail.addPlatesModels')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PlateImporter project={p} compact />
        </CardContent>
      </Card>

      {/* Prints / Pieces */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t('projectDetail.platesTitle')}</CardTitle>
          <div className="flex gap-2">
            {templates.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>
                <BookTemplate className="h-4 w-4 mr-1" />{t('projectDetail.fromTemplate')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addPrint}><Plus className="h-4 w-4 mr-1" />{t('projectDetail.addPlate')}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {p.prints.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('projectDetail.noPlatesYet')}</p>}
          {p.prints.map((pr, idx) => {
            const pieceTotal = (pr.pricePerPiece || 0) * (pr.quantity || 1);
            const models = pr.models || [];
            const otherPlates = p.prints.filter(x => x.id !== pr.id);
            return (
              <div key={pr.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                <div className="flex items-start gap-3 -mb-1">
                  <PlatePreview
                    thumbnail={pr.thumbnail}
                    color={pr.color}
                    palette={pr.colorPalette}
                    label={pr.name || `Plate ${idx + 1}`}
                    size="md"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => movePrint(pr.id, -1)} title={t('projectDetail.moveUp')}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === p.prints.length - 1} onClick={() => movePrint(pr.id, 1)} title={t('projectDetail.moveDown')}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground ml-1">#{idx + 1}</span>
                      {pr.material && (
                        <span className="text-[10px] font-semibold text-foreground bg-secondary rounded px-1.5 py-0.5 ml-1">
                          {normalizeMaterial(pr.material)}
                        </span>
                      )}
                      <ColorPills color={pr.color} palette={pr.colorPalette} material={normalizeMaterial(pr.material)} size="sm" showLabel />
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                      {pr.estimatedPrintTime > 0 && <span>⏱ {pr.estimatedPrintTime}h</span>}
                      {pr.materialUsed > 0 && <span>⚖ {pr.materialUsed}g</span>}
                      {(pr.models?.length || 0) > 0 && <span>🧩 {pr.models!.length} model{pr.models!.length > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                  <div className="col-span-2 md:col-span-1">
                    <Label className="text-xs">{t('projectDetail.platePieceName')}</Label>
                    <Input value={pr.name} onChange={e => updatePrint(pr.id, { name: e.target.value })} list={`names-${pr.id}`} placeholder="e.g. Plate 1 / Gear Housing" />
                    <datalist id={`names-${pr.id}`}>{allPrintNames.map(n => <option key={n} value={n} />)}</datalist>
                  </div>
                  <div><Label className="text-xs">{t('projectDetail.materialField')}</Label><Input value={pr.material || ""} onChange={e => updatePrint(pr.id, { material: e.target.value })} placeholder="PLA, PETG..." /></div>
                  <div><Label className="text-xs">{t('projectDetail.color')}</Label><Input value={pr.color || ""} onChange={e => updatePrint(pr.id, { color: e.target.value })} placeholder="Black, White..." /></div>
                  <div><Label className="text-xs">{t('projectDetail.qty')}</Label><Input type="number" min="1" value={pr.quantity || 1} onChange={e => updatePrint(pr.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                </div>
                <div className="grid gap-2 grid-cols-2 md:grid-cols-5 items-end">
                  <div><Label className="text-xs">{t('projectDetail.printTimeH')}</Label><Input type="number" step="0.1" value={pr.estimatedPrintTime || ""} onChange={e => updatePrint(pr.id, { estimatedPrintTime: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">{t('projectDetail.materialG')}</Label><Input type="number" value={pr.materialUsed || ""} onChange={e => updatePrint(pr.id, { materialUsed: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">{t('projectDetail.pricePerPiece')}</Label><Input type="number" step="0.01" value={pr.pricePerPiece || ""} onChange={e => updatePrint(pr.id, { pricePerPiece: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-xs">{t('projectDetail.done')}</Label><Input type="number" min="0" max={pr.quantity || 1} value={pr.completedQuantity || 0} onChange={e => updatePrint(pr.id, { completedQuantity: Math.min(pr.quantity || 1, Math.max(0, parseInt(e.target.value) || 0)) })} /></div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">{t('common.status')}</Label>
                      <Select value={pr.status || 'not-printed'} onValueChange={v => updatePrint(pr.id, { status: v as any })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not-printed">{t('projectDetail.notPrinted')}</SelectItem>
                          <SelectItem value="printing">{t('projectDetail.printingStatus')}</SelectItem>
                          <SelectItem value="completed">{t('projectDetail.completedStatus')}</SelectItem>
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
                      {t('projectDetail.models')} ({models.length})
                    </span>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => addModel(pr.id)}>
                      <Plus className="h-3 w-3" />{t('projectDetail.addModel')}
                    </Button>
                  </div>
                  {models.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/70 italic">{t('projectDetail.noModels')}</p>
                  ) : (
                    <div className="space-y-1">
                      {models.map(m => (
                        <div key={m.id} className="flex items-center gap-1.5 text-xs">
                          <Box className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Input
                            value={m.name}
                            onChange={e => updateModel(pr.id, m.id, { name: e.target.value })}
                            placeholder={t('projectDetail.modelName')}
                            className="h-7 text-xs"
                          />
                          <Input
                            value={m.material || ""}
                            onChange={e => updateModel(pr.id, m.id, { material: e.target.value })}
                            placeholder={t('projectDetail.modelMat')}
                            className="h-7 text-xs w-20"
                          />
                          <ColorPills color={m.color || pr.color} palette={pr.colorPalette} material={normalizeMaterial(m.material || pr.material)} size="xs" showLabel={false} className="shrink-0" />
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
                                    {t('projectDetail.moveToPlate', { name: op.name || 'plate' })}
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
                    {t('projectDetail.subtotal')} <span className="font-medium text-foreground">€{pieceTotal.toFixed(2)}</span>
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
          <CardTitle className="text-base">{t('projectDetail.projectExpenses')}</CardTitle>
          <Button size="sm" variant="outline" onClick={addProjectExpense}><Plus className="h-4 w-4 mr-1" />{t('projectDetail.addExpense')}</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(p.projectExpenses || []).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">{t('projectDetail.noProjectExpenses')}</p>}
          {(p.projectExpenses || []).map(pe => (
            <div key={pe.id} className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5 items-end p-3 rounded-lg border bg-muted/30">
              <div><Label className="text-xs">{t('projectDetail.expName')}</Label><Input value={pe.name} onChange={e => updateProjectExpense(pe.id, { name: e.target.value })} /></div>
              <div><Label className="text-xs">{t('projectDetail.expAmount')}</Label><Input type="number" step="0.01" value={pe.amount || ""} onChange={e => updateProjectExpense(pe.id, { amount: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label className="text-xs">{t('projectDetail.expCategory')}</Label><Input value={pe.category} onChange={e => updateProjectExpense(pe.id, { category: e.target.value })} placeholder={t('projectDetail.hardwareCategory')} /></div>
              <div><Label className="text-xs">{t('projectDetail.expNotes')}</Label><Input value={pe.notes} onChange={e => updateProjectExpense(pe.id, { notes: e.target.value })} /></div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => syncExpenseToGlobal(pe)}>{t('projectDetail.syncGlobal')}</Button>
                <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeProjectExpense(pe.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={() => { deleteProject(p.id); posthog.capture('project_deleted', { customer_source: p.customerSource, total_price: effectiveTotal }); onBack(); }}>
          <Trash2 className="h-4 w-4 mr-1" />{t('projectDetail.deleteProject')}
        </Button>
      </div>

      <InvoiceModal open={showInvoice} onClose={() => setShowInvoice(false)} project={p} settings={settings} />
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature="pdf_invoice" />

      {/* Template picker dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('projectDetail.insertFromTemplate')}</DialogTitle></DialogHeader>
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
