import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "@/context/AppContext";
import {
  Project, Print, ProjectExpense, Payment, PaymentMethod, PaymentStatus,
  DesignItem, DesignItemStatus, TimelineEvent,
  getProjectTotalPrintTime, getProjectTotalMaterial, getProjectProgress,
  getProjectExpensesTotal, getProjectPiecesTotal, getProjectTotalPieces,
  getProjectEstimatedCost, getProjectEstimatedMargin, getProjectPaymentsTotal,
  getProjectBalance, getProjectPaymentStatus, getPrintDerivedStatus,
  getProjectDesignHours,
  cleanDisplayName, cleanPlateName, getCurrencySymbol,
  normalizeStage, STAGE_META, STAGE_ORDER, getProgressSummary,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Plus, Trash2, Copy, BookTemplate, Calendar, Kanban, Receipt,
  RefreshCw, ArrowUp, ArrowDown, Box, X, MoveRight, FileText, Link2, CreditCard,
  Check, Loader2, MoreHorizontal, ChevronDown, Pencil, Minus, Info, MessageSquare,
  Maximize2, Image,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlateImporter } from "@/components/PlateImporter";
import { RecurringBadge } from "@/components/RecurringBadge";
import { ColorPills } from "@/components/ColorPills";
import { PlatePreview } from "@/components/PlatePreview";
import { StatusPill } from "@/components/StatusPill";
import { normalizeMaterial } from "@/lib/normalize";
import { deriveProjectStatus } from "@/lib/projectStatus";
import posthog from "@/lib/posthog";
import { useToast } from "@/hooks/useToast";
import { PaymentBadge } from "@/components/PaymentBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PrintModel } from "@/types";
import { InvoiceModal } from "@/components/InvoicePDF";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENTS_ENABLED } from "@/config/features";

function newPrint(): Print {
  return { id: crypto.randomUUID(), name: "", estimatedPrintTime: 0, materialUsed: 0, printer: "", status: "not-printed", quantity: 1, completedQuantity: 0, color: "", material: "", pricePerPiece: 0 };
}

function newProjectExpense(): ProjectExpense {
  return { id: crypto.randomUUID(), name: "", amount: 0, category: "Other", notes: "" };
}

function newDesignItem(): DesignItem {
  return { id: crypto.randomUUID(), description: "", estimatedHours: 0, actualHours: 0, status: "not-started" };
}

const DESIGN_STATUS_LABELS: Record<DesignItemStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  'awaiting-approval': 'Awaiting approval',
  'approved': 'Approved',
};

function newPayment(method: PaymentMethod = "Other"): Payment {
  return { id: crypto.randomUUID(), amount: 0, date: new Date().toISOString().split("T")[0], method };
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Other"];
const SOURCES = ["Wallapop", "Instagram", "Website", "Other"] as const;


interface Props { project: Project; onBack: () => void; }

export default function ProjectDetail({ project, onBack }: Props) {
  const { updateProject, deleteProject, duplicateProject, settings, templates, addExpense, allPrintNames } = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [trackingCopied, setTrackingCopied] = useState(false);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState(project.stripePaymentLinkUrl || "");
  const [paymentLinkCopied, setPaymentLinkCopied] = useState(false);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState(false);

  // Section state
  const [detailsEditMode, setDetailsEditMode] = useState(false);
  const [detailsDraft, setDetailsDraft] = useState<Partial<Project>>({});
  const [expandedPlateId, setExpandedPlateId] = useState<string | null>(null);
  const [expandedModelsPlateId, setExpandedModelsPlateId] = useState<string | null>(null);
  // Payment section state
  const [paymentsExpanded, setPaymentsExpanded] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [amountType, setAmountType] = useState<'fixed' | 'percent'>('fixed');
  const [paymentDraft, setPaymentDraft] = useState<Payment>(newPayment(project.paymentMethod || "Other"));
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentDraft, setEditPaymentDraft] = useState<Payment | null>(null);

  // Sidebar section editing
  const [editSection, setEditSection] = useState<'customer' | 'dates' | 'notes' | null>(null);

  // Preview state
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState(0);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Timeline
  const [timelineNote, setTimelineNote] = useState('');

  // Ref to always get the latest project for undo
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  const p = project;
  const save = (updated: Project) => { updateProject(updated); };
  const set = (partial: Partial<Project>) => save({ ...p, ...partial });

  // ── Design work helpers ──
  const designItems = p.designItems || [];
  const addDesignItem = () => {
    const item = newDesignItem();
    set({ designItems: [...designItems, item] });
  };
  const updateDesignItem = (id: string, changes: Partial<DesignItem>) => {
    set({ designItems: designItems.map(d => d.id === id ? { ...d, ...changes } : d) });
  };
  const removeDesignItem = (id: string) => {
    set({ designItems: designItems.filter(d => d.id !== id) });
  };

  // ── Stage helpers ──
  const currentStage = normalizeStage(p);
  const stageMeta = STAGE_META[currentStage];
  const nextStageMeta = stageMeta.next ? STAGE_META[stageMeta.next] : null;
  const setStage = (stage: typeof currentStage) => {
    const updates: Partial<Project> = { stage };
    if (stage === 'delivered') {
      updates.sent = true;
      if (!p.shippingDate) updates.shippingDate = new Date().toISOString().split('T')[0];
    }
    if (stage === 'printing' || stage === 'ready') updates.printed = stage !== 'new';
    set(updates as Project);
  };

  const currencySymbol = getCurrencySymbol(settings.currency);

  // ── Details section ──
  const startEditSection = (section: 'customer' | 'dates' | 'notes') => {
    setDetailsDraft({
      name: p.name,
      customerName: p.customerName,
      customerEmail: p.customerEmail || '',
      customerSource: p.customerSource,
      paymentMethod: p.paymentMethod,
      orderDate: p.orderDate,
      dueDate: p.dueDate || '',
      shippingDate: p.shippingDate || '',
      notes: p.notes || '',
      isRecurringCustomer: p.isRecurringCustomer || false,
      totalPrice: p.totalPrice || 0,
    });
    setEditSection(section);
    setDetailsEditMode(true);
  };

  const saveDetails = () => {
    set(detailsDraft);
    setDetailsEditMode(false);
    setEditSection(null);
  };

  const cancelDetails = () => { setDetailsEditMode(false); setEditSection(null); };

  const addTimelineNote = () => {
    if (!timelineNote.trim()) return;
    const event: TimelineEvent = {
      id: crypto.randomUUID(),
      type: 'note',
      date: new Date().toISOString().split('T')[0],
      label: 'Note',
      note: timelineNote.trim(),
    };
    set({ timelineEvents: [...(p.timelineEvents || []), event] });
    setTimelineNote('');
  };

  // ── Plate helpers ──
  const addPrint = () => save({ ...p, prints: [...p.prints, newPrint()] });

  const addFromTemplate = (tmpl: { name: string; estimatedPrintTime: number; materialUsed: number }) => {
    const pr = newPrint();
    pr.name = tmpl.name;
    pr.estimatedPrintTime = tmpl.estimatedPrintTime;
    pr.materialUsed = tmpl.materialUsed;
    save({ ...p, prints: [...p.prints, pr] });
    setShowTemplates(false);
  };

  const updatePrint = (id: string, partial: Partial<Print>) => {
    save({ ...p, prints: p.prints.map(pr => pr.id === id ? { ...pr, ...partial } : pr) });
  };

  const removePrint = (id: string) => save({ ...p, prints: p.prints.filter(pr => pr.id !== id) });

  const duplicatePrint = (id: string) => {
    const pr = p.prints.find(x => x.id === id);
    if (!pr) return;
    const copy = { ...pr, id: crypto.randomUUID(), name: pr.name ? `${pr.name} (copy)` : '', completedQuantity: 0, status: 'not-printed' as const };
    const idx = p.prints.findIndex(x => x.id === id);
    const arr = [...p.prints];
    arr.splice(idx + 1, 0, copy);
    save({ ...p, prints: arr });
  };

  const movePrint = (id: string, dir: -1 | 1) => {
    const idx = p.prints.findIndex(pr => pr.id === id);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= p.prints.length) return;
    const arr = [...p.prints];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    save({ ...p, prints: arr });
  };

  const markAllPrinted = () => {
    save({ ...p, prints: p.prints.map(pr => ({ ...pr, completedQuantity: pr.quantity || 1, status: 'completed' as const })) });
  };

  const stepCompleted = (id: string, delta: number) => {
    const pr = p.prints.find(x => x.id === id);
    if (!pr) return;
    const next = Math.min(pr.quantity || 1, Math.max(0, (pr.completedQuantity || 0) + delta));
    updatePrint(id, { completedQuantity: next });
  };

  // ── Model helpers ──
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

  // ── Project expenses ──
  const addProjectExpense = () => save({ ...p, projectExpenses: [...(p.projectExpenses || []), newProjectExpense()] });

  const updateProjectExpense = (id: string, partial: Partial<ProjectExpense>) => {
    save({ ...p, projectExpenses: (p.projectExpenses || []).map(e => e.id === id ? { ...e, ...partial } : e) });
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

  // ── Payments ──
  // recordFormAmount depends on effectiveTotal which is computed below — see derived values
  const addPaymentRecord = (resolvedAmount: number) => {
    if (resolvedAmount <= 0) return;
    const payment = { ...paymentDraft, amount: resolvedAmount };
    save({ ...p, payments: [...(p.payments || []), payment] });
    setPaymentDraft(newPayment(p.paymentMethod || "Other"));
    setAmountType('fixed');
    setShowRecordForm(false);
  };

  const removePaymentRecord = (id: string) => {
    save({ ...p, payments: (p.payments || []).filter(pay => pay.id !== id) });
  };

  const startEditPayment = (pay: Payment) => {
    setEditingPaymentId(pay.id);
    setEditPaymentDraft({ ...pay });
  };

  const saveEditPayment = () => {
    if (!editPaymentDraft || !editingPaymentId) return;
    save({ ...p, payments: (p.payments || []).map(pay => pay.id === editingPaymentId ? editPaymentDraft : pay) });
    setEditingPaymentId(null);
    setEditPaymentDraft(null);
  };

  const cancelEditPayment = () => {
    setEditingPaymentId(null);
    setEditPaymentDraft(null);
  };

  const markAsPaid = () => {
    if (balance <= 0) return;
    const paymentId = crypto.randomUUID();
    const payment: Payment = {
      id: paymentId,
      amount: balance,
      date: new Date().toISOString().split('T')[0],
      method: p.paymentMethod || 'Other',
    };
    save({ ...p, payments: [...(p.payments || []), payment] });
    toast.success(`Marked as paid · ${currencySymbol}${balance.toFixed(2)}`, {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          const latest = projectRef.current;
          save({ ...latest, payments: (latest.payments || []).filter(pay => pay.id !== paymentId) });
        },
      },
    });
  };

  // ── Tracking / Stripe ──
  const copyTrackingLink = () => {
    const url = `${window.location.origin}/track/${p.id}`;
    navigator.clipboard.writeText(url).then(() => {
      localStorage.setItem("pt_checklist_copied_tracking", "true");
      setTrackingCopied(true);
      setTimeout(() => setTrackingCopied(false), 2500);
    });
  };

  const generatePaymentLink = async () => {
    setPaymentLinkLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: { projectId: p.id, projectName: p.name, amount: effectiveTotal },
      });
      if (error) throw error;
      if (data?.url) {
        setPaymentLinkUrl(data.url);
        save({ ...p, stripePaymentLinkUrl: data.url, stripePaymentLinkId: data.paymentLinkId });
      }
    } catch (err) {
      console.error("[stripe] payment link error:", err);
      alert("Failed to generate payment link. Check that the create-payment-link edge function is deployed and STRIPE_SECRET_KEY is set.");
    } finally {
      setPaymentLinkLoading(false);
    }
  };

  const copyPaymentLink = () => {
    navigator.clipboard.writeText(paymentLinkUrl).then(() => {
      setPaymentLinkCopied(true);
      setTimeout(() => setPaymentLinkCopied(false), 2500);
    });
  };

  // ── Derived values ──
  const piecesTotal = getProjectPiecesTotal(p);
  const autoCalcTotal = piecesTotal > 0;
  const effectiveTotal = autoCalcTotal ? piecesTotal : (p.totalPrice || 0);
  const totalTime = getProjectTotalPrintTime(p);
  const totalMaterial = getProjectTotalMaterial(p);
  const estimatedCost = getProjectEstimatedCost(p, settings);
  const estimatedMargin = getProjectEstimatedMargin(p, settings);
  const profit = effectiveTotal - estimatedCost;
  const profitMargin = effectiveTotal > 0 ? (profit / effectiveTotal) * 100 : null;
  const progress = getProjectProgress(p);
  const paymentsTotal = getProjectPaymentsTotal(p);
  const balance = getProjectBalance(p);
  const paymentStatus = getProjectPaymentStatus(p);
  const projectStatus = deriveProjectStatus(p);
  const displayName = cleanDisplayName(p.name) || t('projectDetail.untitled');

  const marginColor = profitMargin !== null
    ? (profitMargin >= 60 ? "text-[var(--pay-paid)]" : profitMargin >= 30 ? "text-[var(--pay-partial)]" : "text-[var(--danger)]")
    : "text-muted-foreground";

  const allPrinted = p.prints.length > 0 && p.prints.every(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
  const recordFormAmount = amountType === 'percent'
    ? (paymentDraft.amount || 0) / 100 * effectiveTotal
    : (paymentDraft.amount || 0);

  // Cost breakdown for sidebar
  const matCost = totalMaterial * (settings.filamentCostPerGram || 0.025);
  const machineCost = totalTime * (settings.hourlyRate ?? 2);
  const designHours = getProjectDesignHours(p);
  const designCost = designHours * (settings.designRate ?? 20);
  const expensesCost = getProjectExpensesTotal(p);

  // Preview derived
  const previewPlate = p.prints[selectedPreviewIdx] || p.prints[0];
  const previewThumb = previewPlate?.thumbnail || p.coverThumbnail;

  const NEXT_ACTION: Record<string, string> = {
    'new': designItems.length > 0 ? 'Start design' : 'Start printing',
    'in-design': 'Request approval',
    'awaiting-approval': 'Approve & print',
    'printing': 'Mark ready',
    'ready': 'Mark delivered',
  };
  const nextActionLabel = nextStageMeta ? (NEXT_ACTION[currentStage] ?? nextStageMeta.label) : null;

  // ── Sidebar edit helpers ──
  const SidebarEditBtn = ({ section }: { section: 'customer' | 'dates' | 'notes' }) => (
    <button
      onClick={() => startEditSection(section)}
      className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
    >
      <Pencil className="h-3 w-3" />
    </button>
  );

  return (
    <div className="space-y-4 pb-8">
      {/* ── HEADER ── */}
      <div className="space-y-2">
        {/* Row 1: Back + name + next step */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 -ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold truncate">{displayName}</h1>
          </div>
          {nextStageMeta && (
            <Button size="sm" className="shrink-0 gap-1" onClick={() => setStage(nextStageMeta.key)}>
              {nextActionLabel} <MoveRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Row 2: customer · stage · payment · price */}
        <div className="flex items-center gap-2 flex-wrap text-sm">
          {p.customerName && <span className="text-muted-foreground">{p.customerName}</span>}
          {p.customerName && <span className="text-muted-foreground">·</span>}
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, var(${stageMeta.token}) 12%, transparent)`, color: `var(${stageMeta.token})` }}>
            {stageMeta.label}
          </span>
          <PaymentBadge status={paymentStatus} balance={Math.max(0, balance)} currency={currencySymbol} />
          {p.isRecurringCustomer && <RecurringBadge size="md" />}
          <span className="font-bold text-primary ml-auto tabular-nums">{currencySymbol}{effectiveTotal.toFixed(2)}{autoCalcTotal && <span className="text-[10px] font-normal text-muted-foreground ml-1">from pieces</span>}</span>
        </div>

        {/* Row 3: action buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {balance > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1">
                  Collect payment <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={markAsPaid}>
                  <CreditCard className="h-3.5 w-3.5 mr-2" />Mark as paid · {currencySymbol}{balance.toFixed(2)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowRecordForm(true)}>
                  Record partial payment…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button size="sm" variant="outline" className="gap-1" onClick={copyTrackingLink}>
            {trackingCopied ? <Check className="h-3.5 w-3.5 text-[var(--pay-paid)]" /> : <Link2 className="h-3.5 w-3.5" />}
            {trackingCopied ? "Copied!" : "Tracking link"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="px-2.5">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                if (localStorage.getItem('pt_guest_mode') === 'true') {
                  document.dispatchEvent(new CustomEvent('guest-gate', { detail: { message: 'Sign up free to generate and download invoices' } }));
                  return;
                }
                setShowInvoice(true);
                posthog.capture('invoice_generated', { customer_source: p.customerSource });
              }}>
                <FileText className="h-3.5 w-3.5 mr-2" />{t('invoice.generateBtn')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { duplicateProject(p.id); posthog.capture('project_duplicated'); onBack(); }}>
                <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/kanban')}>
                <Kanban className="h-3.5 w-3.5 mr-2" />{t('projectDetail.kanban')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/calendar')}>
                <Calendar className="h-3.5 w-3.5 mr-2" />{t('projectDetail.calendar')}
              </DropdownMenuItem>
              {PAYMENTS_ENABLED && (
                <>
                  <DropdownMenuSeparator />
                  {!paymentLinkUrl ? (
                    <DropdownMenuItem onClick={generatePaymentLink} disabled={paymentLinkLoading || effectiveTotal <= 0}>
                      {paymentLinkLoading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <CreditCard className="h-3.5 w-3.5 mr-2" />}
                      Send payment link
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={copyPaymentLink}>
                      {paymentLinkCopied ? <Check className="h-3.5 w-3.5 mr-2 text-[var(--pay-paid)]" /> : <CreditCard className="h-3.5 w-3.5 mr-2" />}
                      {paymentLinkCopied ? "Copied!" : "Copy payment link"}
                    </DropdownMenuItem>
                  )}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => { if (!window.confirm('Delete this project? This cannot be undone.')) return; deleteProject(p.id); posthog.capture('project_deleted'); onBack(); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── MAIN: two columns on lg ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr,300px] items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-4 min-w-0">

          {/* 3D Preview */}
          {(p.prints.length > 0 || p.coverThumbnail) && (
            <Card>
              <CardContent className="p-3">
                <div className="relative bg-muted/40 rounded-lg overflow-hidden min-h-[280px] flex items-center justify-center">
                  {previewThumb ? (
                    <>
                      <img
                        src={previewThumb}
                        alt={previewPlate?.name || 'Preview'}
                        className="w-full h-auto max-h-72 object-contain rounded-md"
                        loading="lazy"
                      />
                      <button
                        onClick={() => setShowFullscreen(true)}
                        className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                        title="Fullscreen"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground py-10">
                      <Image className="h-10 w-10 mx-auto mb-2 opacity-20" />
                      <p className="text-xs">No preview image</p>
                    </div>
                  )}
                </div>
                {p.prints.length > 1 && (
                  <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
                    {p.prints.map((pr, idx) => (
                      <button
                        key={pr.id}
                        onClick={() => setSelectedPreviewIdx(idx)}
                        className={`shrink-0 rounded-md transition-all ${selectedPreviewIdx === idx ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100'}`}
                      >
                        <PlatePreview
                          thumbnail={pr.thumbnail}
                          color={pr.color}
                          palette={pr.colorPalette}
                          label={`#${idx + 1}`}
                          size="sm"
                          noHover
                        />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}


      {/* ── PLATES SECTION ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t('projectDetail.platesTitle')}</CardTitle>
          <div className="flex gap-1.5">
            {p.prints.length > 0 && !allPrinted && (
              <Button size="sm" variant="outline" className="text-xs" onClick={markAllPrinted}>
                <Check className="h-3.5 w-3.5 mr-1" />Mark all printed
              </Button>
            )}
            {templates.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowTemplates(true)}>
                <BookTemplate className="h-4 w-4 mr-1" />{t('projectDetail.fromTemplate')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addPrint}><Plus className="h-4 w-4 mr-1" />{t('projectDetail.addPlate')}</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {p.prints.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">{t('projectDetail.noPlatesYet')}</p>}

          {p.prints.map((pr, idx) => {
            const printStatus = getPrintDerivedStatus(pr);
            const isExpanded = expandedPlateId === pr.id;
            const modelsExpanded = expandedModelsPlateId === pr.id;
            const models = pr.models || [];
            const otherPlates = p.prints.filter(x => x.id !== pr.id);
            const pieceTotal = (pr.pricePerPiece || 0) * (pr.quantity || 1);
            const cleanName = cleanPlateName(pr.name, idx, models);

            return (
              <div key={pr.id} className="rounded-lg border bg-muted/20 overflow-hidden">
                {/* Compact row */}
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setExpandedPlateId(isExpanded ? null : pr.id)}
                >
                  <PlatePreview
                    thumbnail={pr.thumbnail}
                    color={pr.color}
                    palette={pr.colorPalette}
                    label={cleanName}
                    size="sm"
                    noHover
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                      <span className="text-sm font-medium truncate">{cleanName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                      {pr.material && <span>{normalizeMaterial(pr.material)}</span>}
                      <ColorPills color={pr.color} palette={pr.colorPalette} material={normalizeMaterial(pr.material)} size="xs" showLabel={false} />
                      {pr.estimatedPrintTime > 0 && <span>⏱ {pr.estimatedPrintTime}h</span>}
                      {pr.materialUsed > 0 && <span>⚖ {pr.materialUsed}g</span>}
                      <span className={printStatus.done ? 'text-[var(--pay-paid)] font-medium' : printStatus.partial ? 'text-[var(--pay-partial)]' : ''}>
                        {printStatus.label}
                      </span>
                    </div>
                  </div>
                  {/* +/- stepper */}
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 rounded-full"
                      onClick={() => stepCompleted(pr.id, -1)}
                      disabled={(pr.completedQuantity || 0) <= 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs font-medium w-10 text-center">{pr.completedQuantity || 0}/{pr.quantity}</span>
                    <Button
                      size="icon" variant="ghost"
                      className="h-7 w-7 rounded-full"
                      onClick={() => stepCompleted(pr.id, 1)}
                      disabled={(pr.completedQuantity || 0) >= (pr.quantity || 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    {!printStatus.done && (
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-[10px] px-2 text-[var(--pay-paid)] hover:text-[var(--stage-delivered)]"
                        onClick={(e) => { e.stopPropagation(); updatePrint(pr.id, { completedQuantity: pr.quantity || 1 }); }}
                      >
                        ✓ Done
                      </Button>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded edit form */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-2 border-t space-y-3 bg-card">
                    <div className="flex items-center gap-1 flex-wrap -mb-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => movePrint(pr.id, -1)} title={t('projectDetail.moveUp')}><ArrowUp className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === p.prints.length - 1} onClick={() => movePrint(pr.id, 1)} title={t('projectDetail.moveDown')}><ArrowDown className="h-3 w-3" /></Button>
                      <span className="text-[10px] text-muted-foreground ml-1">#{idx + 1}</span>
                      <div className="flex-1" />
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicate" onClick={() => duplicatePrint(pr.id)}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => removePrint(pr.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>

                    <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
                      <div className="col-span-2 md:col-span-2">
                        <Label className="text-xs">{t('projectDetail.platePieceName')}</Label>
                        <Input value={pr.name} onChange={e => updatePrint(pr.id, { name: e.target.value })} list={`names-${pr.id}`} placeholder="e.g. Plate 1 / Gear Housing" />
                        <datalist id={`names-${pr.id}`}>{allPrintNames.map(n => <option key={n} value={n} />)}</datalist>
                      </div>
                      <div><Label className="text-xs">{t('projectDetail.materialField')}</Label><Input value={pr.material || ""} onChange={e => updatePrint(pr.id, { material: e.target.value })} placeholder="PLA, PETG…" /></div>
                      <div><Label className="text-xs">{t('projectDetail.color')}</Label><Input value={pr.color || ""} onChange={e => updatePrint(pr.id, { color: e.target.value })} placeholder="Black, White…" /></div>
                    </div>

                    <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
                      <div><Label className="text-xs">{t('projectDetail.qty')}</Label><Input type="number" min="1" value={pr.quantity || 1} onChange={e => updatePrint(pr.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} /></div>
                      <div><Label className="text-xs">{t('projectDetail.printTimeH')}</Label><Input type="number" step="0.1" value={pr.estimatedPrintTime || ""} onChange={e => updatePrint(pr.id, { estimatedPrintTime: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">{t('projectDetail.materialG')}</Label><Input type="number" value={pr.materialUsed || ""} onChange={e => updatePrint(pr.id, { materialUsed: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">{t('projectDetail.pricePerPiece')}</Label><Input type="number" step="0.01" value={pr.pricePerPiece || ""} onChange={e => updatePrint(pr.id, { pricePerPiece: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label className="text-xs">Done</Label><Input type="number" min="0" max={pr.quantity || 1} value={pr.completedQuantity || 0} onChange={e => updatePrint(pr.id, { completedQuantity: Math.min(pr.quantity || 1, Math.max(0, parseInt(e.target.value) || 0)) })} /></div>
                    </div>

                    {pieceTotal > 0 && (
                      <div className="text-xs text-muted-foreground text-right">
                        {t('projectDetail.subtotal')} <span className="font-medium text-foreground">{currencySymbol}{pieceTotal.toFixed(2)}</span>
                        {(pr.quantity || 1) > 1 && <span className="ml-1">({pr.quantity} × {currencySymbol}{(pr.pricePerPiece || 0).toFixed(2)})</span>}
                      </div>
                    )}

                    {/* Models section — collapsed by default */}
                    <div className="border-t pt-2">
                      <button
                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
                        onClick={() => setExpandedModelsPlateId(modelsExpanded ? null : pr.id)}
                      >
                        <Box className="h-3 w-3" />
                        {t('projectDetail.models')} ({models.length})
                        <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${modelsExpanded ? 'rotate-180' : ''}`} />
                        <span className="flex-1" />
                        <span
                          className="text-primary hover:underline"
                          onClick={(e) => { e.stopPropagation(); setExpandedModelsPlateId(pr.id); addModel(pr.id); }}
                        >+ {t('projectDetail.addModel')}</span>
                      </button>

                      {modelsExpanded && (
                        <div className="mt-2 space-y-1">
                          {models.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground/70 italic">{t('projectDetail.noModels')}</p>
                          ) : models.map(m => (
                            <div key={m.id} className="flex items-center gap-1.5 text-xs">
                              <Box className="h-3 w-3 text-muted-foreground shrink-0" />
                              <Input value={m.name} onChange={e => updateModel(pr.id, m.id, { name: e.target.value })} placeholder={t('projectDetail.modelName')} className="h-7 text-xs" />
                              <Input value={m.material || ""} onChange={e => updateModel(pr.id, m.id, { material: e.target.value })} placeholder={t('projectDetail.modelMat')} className="h-7 text-xs w-20" />
                              <ColorPills color={m.color || pr.color} palette={pr.colorPalette} material={normalizeMaterial(m.material || pr.material)} size="xs" showLabel={false} className="shrink-0" />
                              {otherPlates.length > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Move to plate"><MoveRight className="h-3 w-3" /></Button>
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
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeModel(pr.id, m.id)}><X className="h-3 w-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ADD TO THIS PROJECT */}
      <Card>
        <CardContent className={p.prints.length > 0 ? "p-3 space-y-2" : "p-4 space-y-3"}>
          {p.prints.length === 0 && (
            <div>
              <p className="text-sm font-medium mb-0.5">Import a sliced file</p>
              <p className="text-xs text-muted-foreground mb-2">.3mf, .gcode, or .stl — auto-fills print time, material, and colours</p>
            </div>
          )}
          <PlateImporter project={p} compact={p.prints.length > 0} />
          <div className={p.prints.length > 0 ? "" : ""}>
            {p.prints.length === 0 && <p className="text-xs text-muted-foreground mt-1 mb-1">or</p>}
            <Button variant="outline" size="sm" className={`gap-1 ${p.prints.length > 0 ? 'w-full' : 'w-full'}`} onClick={addPrint}>
              <Plus className="h-3.5 w-3.5" />Add plate manually
              {p.prints.length === 0 && <span className="text-muted-foreground text-xs ml-1">— enter time, material, price</span>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── DESIGN WORK ── */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Design work</CardTitle>
          <Button size="sm" variant="outline" onClick={addDesignItem}><Plus className="h-4 w-4 mr-1" />Add item</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {designItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No design items. Add one to track design time and get it costed in the margin.</p>
          )}
          {designItems.map(d => (
            <div key={d.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Input
                  placeholder="Design task description"
                  value={d.description}
                  onChange={e => updateDesignItem(d.id, { description: e.target.value })}
                  className="flex-1 text-sm"
                />
                <Button size="icon" variant="ghost" className="text-destructive h-8 w-8 shrink-0" onClick={() => removeDesignItem(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Est. hours</Label>
                  <Input type="number" step="0.5" min={0} value={d.estimatedHours || ''} onChange={e => updateDesignItem(d.id, { estimatedHours: parseFloat(e.target.value) || 0 })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Actual hours</Label>
                  <Input type="number" step="0.5" min={0} value={d.actualHours || ''} onChange={e => updateDesignItem(d.id, { actualHours: parseFloat(e.target.value) || 0 })} className="text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={d.status} onValueChange={v => updateDesignItem(d.id, { status: v as DesignItemStatus })}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(DESIGN_STATUS_LABELS) as [DesignItemStatus, string][]).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── PROJECT EXPENSES ── */}
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
        </div>{/* end left column */}

        {/* RIGHT SIDEBAR */}
        <div className="space-y-4">

          {/* CUSTOMER */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Customer</CardTitle>
              {editSection !== 'customer' && <SidebarEditBtn section="customer" />}
            </CardHeader>
            <CardContent>
              {editSection === 'customer' ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={detailsDraft.customerName || ''} onChange={e => setDetailsDraft(d => ({ ...d, customerName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input type="email" value={detailsDraft.customerEmail || ''} onChange={e => setDetailsDraft(d => ({ ...d, customerEmail: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Source</Label>
                    <Select value={detailsDraft.customerSource || 'Other'} onValueChange={v => setDetailsDraft(d => ({ ...d, customerSource: v as typeof p.customerSource }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={detailsDraft.isRecurringCustomer || false} onCheckedChange={v => setDetailsDraft(d => ({ ...d, isRecurringCustomer: !!v }))} />
                    <Label className="text-xs">Recurring customer</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDetails}>Save</Button>
                    <Button size="sm" variant="outline" onClick={cancelDetails}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-sm">
                  {p.customerName ? <p className="font-medium">{p.customerName}</p> : <p className="text-muted-foreground text-xs italic">No customer name</p>}
                  {p.customerEmail && <p className="text-xs text-muted-foreground">{p.customerEmail}</p>}
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.customerSource && <Badge variant="outline" className="text-[10px]">{p.customerSource}</Badge>}
                    {p.isRecurringCustomer && <RecurringBadge size="sm" />}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PAYMENT */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 px-3 py-2.5">
                <div>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="font-bold text-sm tabular-nums">{currencySymbol}{effectiveTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Paid</p>
                  <p className="font-bold text-sm tabular-nums">{currencySymbol}{paymentsTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Balance</p>
                  <p className="font-bold text-sm tabular-nums">{currencySymbol}{Math.max(0, balance).toFixed(2)}</p>
                </div>
                <div className="ml-auto">
                  <PaymentBadge status={paymentStatus} balance={Math.max(0, balance)} currency={currencySymbol} />
                </div>
              </div>
              {balance > 0 && (
                <div className="flex items-center gap-1">
                  <Button size="sm" className="flex-1" onClick={markAsPaid}>
                    Mark as paid · {currencySymbol}{balance.toFixed(2)}
                  </Button>
                  <Button size="sm" variant="outline" className="px-2" title="Record partial payment"
                    onClick={() => setShowRecordForm(v => !v)}>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${showRecordForm ? 'rotate-180' : ''}`} />
                  </Button>
                </div>
              )}
              {showRecordForm && (
                <div className="grid gap-2 grid-cols-2 rounded-lg border p-3 bg-muted/20">
                  <div className="col-span-2">
                    <Label className="text-xs">Amount</Label>
                    <div className="flex gap-1 my-1">
                      <button className={`text-xs px-2 py-0.5 rounded border transition-colors ${amountType === 'fixed' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
                        onClick={() => setAmountType('fixed')}>{currencySymbol} Fixed</button>
                      <button className={`text-xs px-2 py-0.5 rounded border transition-colors ${amountType === 'percent' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'} disabled:opacity-40`}
                        onClick={() => setAmountType('percent')} disabled={effectiveTotal <= 0}>% of total</button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Input type="number" step="0.01" placeholder="0.00" value={paymentDraft.amount || ''}
                        onChange={e => setPaymentDraft(d => ({ ...d, amount: parseFloat(e.target.value) || 0 }))} className="flex-1" />
                      {amountType === 'percent' && effectiveTotal > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">= {currencySymbol}{recordFormAmount.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Date</Label>
                    <Input type="date" value={paymentDraft.date} onChange={e => setPaymentDraft(d => ({ ...d, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Method</Label>
                    <Select value={paymentDraft.method} onValueChange={v => setPaymentDraft(d => ({ ...d, method: v as PaymentMethod }))}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Note (optional)</Label>
                    <Input placeholder="Deposit, invoice #…" value={paymentDraft.notes || ''}
                      onChange={e => setPaymentDraft(d => ({ ...d, notes: e.target.value }))} />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <Button size="sm" onClick={() => addPaymentRecord(recordFormAmount)} disabled={recordFormAmount <= 0}>Record payment</Button>
                    <Button size="sm" variant="outline" onClick={() => { setShowRecordForm(false); setPaymentDraft(newPayment(p.paymentMethod || 'Other')); setAmountType('fixed'); }}>Cancel</Button>
                  </div>
                </div>
              )}
              {(p.payments || []).length > 0 ? (
                <div>
                  <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setPaymentsExpanded(v => !v)}>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${paymentsExpanded ? 'rotate-180' : ''}`} />
                    {(p.payments || []).length} {(p.payments || []).length === 1 ? 'payment' : 'payments'}
                  </button>
                  {paymentsExpanded && (
                    <div className="space-y-1.5 mt-2">
                      {(p.payments || []).map(pay => (
                        <div key={pay.id}>
                          {editingPaymentId === pay.id && editPaymentDraft ? (
                            <div className="grid gap-2 grid-cols-2 rounded-lg border p-2.5 bg-muted/20">
                              <div>
                                <Label className="text-xs">Amount</Label>
                                <Input type="number" step="0.01" value={editPaymentDraft.amount || ''}
                                  onChange={e => setEditPaymentDraft(d => d ? { ...d, amount: parseFloat(e.target.value) || 0 } : d)} />
                              </div>
                              <div>
                                <Label className="text-xs">Date</Label>
                                <Input type="date" value={editPaymentDraft.date}
                                  onChange={e => setEditPaymentDraft(d => d ? { ...d, date: e.target.value } : d)} />
                              </div>
                              <div>
                                <Label className="text-xs">Method</Label>
                                <Select value={editPaymentDraft.method} onValueChange={v => setEditPaymentDraft(d => d ? { ...d, method: v as PaymentMethod } : d)}>
                                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Note</Label>
                                <Input placeholder="Optional" value={editPaymentDraft.notes || ''}
                                  onChange={e => setEditPaymentDraft(d => d ? { ...d, notes: e.target.value } : d)} />
                              </div>
                              <div className="col-span-2 flex gap-2">
                                <Button size="sm" onClick={saveEditPayment}>Save</Button>
                                <Button size="sm" variant="outline" onClick={cancelEditPayment}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-mono font-medium text-sm tabular-nums">{currencySymbol}{pay.amount.toFixed(2)}</span>
                                <span className="text-xs text-muted-foreground">{pay.date}</span>
                                <Badge variant="outline" className="text-[10px] shrink-0">{pay.method}</Badge>
                                {pay.notes && <span className="text-xs text-muted-foreground truncate">{pay.notes}</span>}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => startEditPayment(pay)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removePaymentRecord(pay.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-1">No payments recorded</p>
              )}
            </CardContent>
          </Card>

          {/* DATES & PRICING */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Dates & pricing</CardTitle>
              {editSection !== 'dates' && <SidebarEditBtn section="dates" />}
            </CardHeader>
            <CardContent>
              {editSection === 'dates' ? (
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Project name</Label>
                    <Input value={detailsDraft.name || ''} onChange={e => setDetailsDraft(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Order date</Label>
                    <Input type="date" value={detailsDraft.orderDate || ''} onChange={e => setDetailsDraft(d => ({ ...d, orderDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Due date</Label>
                    <Input type="date" value={detailsDraft.dueDate || ''} onChange={e => setDetailsDraft(d => ({ ...d, dueDate: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Shipping date</Label>
                    <Input type="date" value={detailsDraft.shippingDate || ''} onChange={e => setDetailsDraft(d => ({ ...d, shippingDate: e.target.value }))} />
                  </div>
                  {!autoCalcTotal && (
                    <div>
                      <Label className="text-xs">Price ({currencySymbol})</Label>
                      <Input type="number" step="0.01" value={detailsDraft.totalPrice || ''} onChange={e => setDetailsDraft(d => ({ ...d, totalPrice: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Payment method</Label>
                    <Select value={detailsDraft.paymentMethod || 'Other'} onValueChange={v => setDetailsDraft(d => ({ ...d, paymentMethod: v as PaymentMethod }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDetails}>Save</Button>
                    <Button size="sm" variant="outline" onClick={cancelDetails}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {p.orderDate && <div className="flex justify-between"><span>Ordered</span><span className="text-foreground">{p.orderDate}</span></div>}
                  {p.dueDate && <div className="flex justify-between"><span>Due</span><span className="text-foreground">{p.dueDate}</span></div>}
                  {p.shippingDate && <div className="flex justify-between"><span>Shipped</span><span className="text-foreground">{p.shippingDate}</span></div>}
                  {p.paymentMethod && <div className="flex justify-between"><span>Payment</span><span className="text-foreground">{p.paymentMethod}</span></div>}
                  {!autoCalcTotal && p.totalPrice ? <div className="flex justify-between"><span>Price</span><span className="font-medium text-foreground tabular-nums">{currencySymbol}{(p.totalPrice || 0).toFixed(2)}</span></div> : null}
                  {!p.orderDate && !p.dueDate && !p.shippingDate && <p className="italic">No dates set</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* COSTS & MARGIN */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                Costs & margin
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="text-muted-foreground hover:text-foreground"><Info className="h-3.5 w-3.5" /></button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 text-xs space-y-1.5 p-3">
                    <p className="font-semibold mb-1">Cost breakdown</p>
                    <div className="flex justify-between"><span>Material ({totalMaterial.toFixed(0)}g)</span><span>{currencySymbol}{matCost.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span>Machine ({totalTime.toFixed(1)}h × {currencySymbol}{settings.hourlyRate ?? 2}/h)</span><span>{currencySymbol}{machineCost.toFixed(2)}</span></div>
                    {designCost > 0 && <div className="flex justify-between"><span>Design ({designHours.toFixed(1)}h × {currencySymbol}{settings.designRate ?? 20}/h)</span><span>{currencySymbol}{designCost.toFixed(2)}</span></div>}
                    {expensesCost > 0 && <div className="flex justify-between"><span>Expenses</span><span>{currencySymbol}{expensesCost.toFixed(2)}</span></div>}
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total cost</span><span>{currencySymbol}{estimatedCost.toFixed(2)}</span></div>
                  </PopoverContent>
                </Popover>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Material</span><span className="tabular-nums">{currencySymbol}{matCost.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Machine time</span><span className="tabular-nums">{currencySymbol}{machineCost.toFixed(2)}</span></div>
              {designCost > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Design</span><span className="tabular-nums">{currencySymbol}{designCost.toFixed(2)}</span></div>}
              {expensesCost > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Expenses</span><span className="tabular-nums">{currencySymbol}{expensesCost.toFixed(2)}</span></div>}
              <div className="flex justify-between text-xs font-medium border-t pt-1.5"><span>Est. cost</span><span className="tabular-nums">{currencySymbol}{estimatedCost.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs font-medium"><span>Revenue</span><span className="tabular-nums">{currencySymbol}{effectiveTotal.toFixed(2)}</span></div>
              <div className={`flex justify-between text-sm font-bold border-t pt-1.5 ${marginColor}`}>
                <span>Margin</span>
                <span>{profitMargin !== null ? `${profitMargin.toFixed(0)}%` : '—'}</span>
              </div>
            </CardContent>
          </Card>

          {/* NOTES */}
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Notes</CardTitle>
              {editSection !== 'notes' && <SidebarEditBtn section="notes" />}
            </CardHeader>
            <CardContent>
              {editSection === 'notes' ? (
                <div className="space-y-2">
                  <Textarea value={detailsDraft.notes || ''} onChange={e => setDetailsDraft(d => ({ ...d, notes: e.target.value }))}
                    placeholder="Project notes…" className="min-h-[80px] text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveDetails}>Save</Button>
                    <Button size="sm" variant="outline" onClick={cancelDetails}>Cancel</Button>
                  </div>
                </div>
              ) : p.notes ? (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{p.notes}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No notes</p>
              )}
            </CardContent>
          </Card>

        </div>{/* end right sidebar */}
      </div>{/* end grid */}

      {/* TIMELINE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-primary" />Timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(p.timelineEvents || []).length > 0 && (
            <div className="space-y-2">
              {[...(p.timelineEvents || [])].sort((a, b) => a.date < b.date ? 1 : -1).map(event => (
                <div key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums w-20">{event.date}</span>
                  <span className="font-medium text-xs text-muted-foreground shrink-0">{event.label}</span>
                  {event.note && <span className="text-xs">{event.note}</span>}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1 border-t">
            <Input placeholder="Add a note…" value={timelineNote} onChange={e => setTimelineNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTimelineNote(); }}}
              className="flex-1 text-sm" />
            <Button size="sm" onClick={addTimelineNote} disabled={!timelineNote.trim()}>Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* FULLSCREEN PREVIEW */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-4xl p-2">
          <DialogHeader><DialogTitle className="sr-only">Preview</DialogTitle></DialogHeader>
          {previewThumb && (
            <img src={previewThumb} alt={previewPlate?.name || 'Preview'}
              className="w-full h-auto max-h-[80vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>

      <InvoiceModal open={showInvoice} onClose={() => setShowInvoice(false)} project={p} settings={settings} />

      {/* Template picker dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('projectDetail.insertFromTemplate')}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {templates.map(tmpl => (
              <Card key={tmpl.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => addFromTemplate(tmpl)}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{tmpl.name}</p>
                  <p className="text-xs text-muted-foreground">{tmpl.estimatedPrintTime}h · {tmpl.materialUsed}g</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
