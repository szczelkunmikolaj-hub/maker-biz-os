import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { Project, Payment, CustomerSource, PaymentMethod, PrintTemplate, getProjectProgress, getProjectPiecesTotal, getProjectEstimatedMargin, getProjectPaymentStatus, getProjectBalance, cleanDisplayName, normalizeStage, STAGE_META, getProgressSummary, getCurrencySymbol } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Search, Download, ArrowUpDown, Printer, Package, Calendar, CreditCard, Sparkles, Upload, ChevronDown, FileSpreadsheet, Wand2, BookTemplate, Trash2, LayoutGrid, LayoutList, MoreHorizontal, Pencil, Copy, DollarSign, MoveRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import ProjectDetail from "@/components/ProjectDetail";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog as ImportDialog, DialogContent as ImportDialogContent, DialogHeader as ImportDialogHeader, DialogTitle as ImportDialogTitle, DialogDescription as ImportDialogDescription } from "@/components/ui/dialog";
import { PlateImporter } from "@/components/PlateImporter";
import { RecurringBadge } from "@/components/RecurringBadge";
import { PlatePreview } from "@/components/PlatePreview";
import { deriveProjectStatus, getStatusMeta } from "@/lib/projectStatus";
import posthog from "@/lib/posthog";
import { PaymentBadge } from "@/components/PaymentBadge";
import { RecordPaymentDialog } from "@/components/RecordPaymentDialog";
import { useMarkAsPaid } from "@/hooks/useMarkAsPaid";
import { ImportFromSpreadsheet } from "@/components/ImportFromSpreadsheet";
import { ImportFromAI } from "@/components/ImportFromAI";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// PAYMENTS_TODO: import { UpgradeModal, ProjectLimitModal } from "@/components/UpgradeModal";
// PAYMENTS_TODO: import { useTier } from "@/context/TierContext";
// PAYMENTS_TODO: import { Lock } from "lucide-react";

const SOURCES: CustomerSource[] = ["Wallapop", "Instagram", "Website", "Other"];
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Other"];

type SortKey = "active-first" | "due-date" | "date" | "date-asc" | "price" | "customer-az";
type ViewMode = "cards" | "list";

const ACTIVE_STAGE_ORDER: Record<string, number> = {
  'awaiting-approval': 0, 'in-design': 1, 'printing': 2, 'ready': 3, 'new': 4, 'delivered': 5,
};

function newTemplate(): PrintTemplate {
  return { id: crypto.randomUUID(), name: "", estimatedPrintTime: 0, materialUsed: 0, notes: "" };
}

function newProject(): Project {
  return {
    id: crypto.randomUUID(), name: "", customerName: "", customerSource: "Other",
    paymentMethod: "Other",
    orderDate: new Date().toISOString().split("T")[0], dueDate: "", totalPrice: 0,
    printed: false, paid: false, sent: false, shippingDate: "",
    notes: "", prints: [], kanbanStatus: "new-order", projectExpenses: [],
  };
}

export default function Projects() {
  const { projects, addProject, updateProject, deleteProject, duplicateProject: duplicateProjectCtx, moveProject, templates, addTemplate, deleteTemplate, settings } = useApp();
  const navigate = useNavigate();
  const { filterProjectsForWorkflow, mode } = useMonth();
  const { t } = useTranslation();
  // PAYMENTS_TODO: const { isPro, canAddProject } = useTier();
  const [activeTab, setActiveTab] = useState<"projects" | "templates">("projects");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = usePersistedState<string>("projects_stage_filter", "all");
  const [payFilter, setPayFilter] = usePersistedState<string>("projects_pay_filter", "all");
  const [sourceFilter, setSourceFilter] = usePersistedState<string>("projects_source_filter", "all");
  const [sortBy, setSortBy] = usePersistedState<SortKey>("projects_sort_v2", "active-first");
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("projects_view", "cards");
  const [showDelivered, setShowDelivered] = useState(false);
  const [showAll, setShowAll] = usePersistedState<boolean>("projects_show_all", false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Project>(newProject());
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [importMode, setImportMode] = useState<null | "full" | "into">(null);
  const [appendTargetId, setAppendTargetId] = useState<string | null>(null);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // PAYMENTS_TODO: const [showUpgrade, setShowUpgrade] = useState(false);
  // PAYMENTS_TODO: const [upgradeFeature, setUpgradeFeature] = useState<'excel_csv_import' | 'templates'>('excel_csv_import');
  // PAYMENTS_TODO: const [showProjectLimit, setShowProjectLimit] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<PrintTemplate>(newTemplate());
  const [recordPaymentProject, setRecordPaymentProject] = useState<Project | null>(null);
  const markAsPaid = useMarkAsPaid();

  // Sync URL param to selectedId — also clears on back-navigation
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId && projects.find(p => p.id === urlId)) {
      setSelectedId(urlId);
    } else if (!urlId) {
      setSelectedId(null);
    }
  }, [searchParams, projects]);

  const handleSelectProject = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      setSearchParams({ id }, { replace: false });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const filtered = useMemo(() => {
    let list = (showAll || mode === 'all') ? [...projects] : filterProjectsForWorkflow(projects);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q));
    }
    if (stageFilter !== 'all') list = list.filter(p => normalizeStage(p) === stageFilter);
    if (payFilter === 'paid') list = list.filter(p => getProjectPaymentStatus(p) === 'paid');
    else if (payFilter === 'unpaid') list = list.filter(p => getProjectPaymentStatus(p) === 'unpaid');
    else if (payFilter === 'partial') list = list.filter(p => getProjectPaymentStatus(p) === 'partial');
    if (sourceFilter !== 'all') list = list.filter(p => p.customerSource === sourceFilter);

    list.sort((a, b) => {
      switch (sortBy) {
        case "active-first": {
          const ao = ACTIVE_STAGE_ORDER[normalizeStage(a)] ?? 99;
          const bo = ACTIVE_STAGE_ORDER[normalizeStage(b)] ?? 99;
          if (ao !== bo) return ao - bo;
          const aDue = a.dueDate || "9999";
          const bDue = b.dueDate || "9999";
          if (aDue !== bDue) return aDue.localeCompare(bDue);
          return (b.orderDate || "").localeCompare(a.orderDate || "");
        }
        case "due-date": return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
        case "date": return (b.orderDate || "").localeCompare(a.orderDate || "");
        case "date-asc": return (a.orderDate || "").localeCompare(b.orderDate || "");
        case "price": {
          const aT = getProjectPiecesTotal(a) || a.totalPrice || 0;
          const bT = getProjectPiecesTotal(b) || b.totalPrice || 0;
          return bT - aT;
        }
        case "customer-az": return (a.customerName || "").localeCompare(b.customerName || "");
        default: return 0;
      }
    });
    return list;
  }, [projects, search, stageFilter, payFilter, sourceFilter, sortBy, showAll, mode, filterProjectsForWorkflow]);

  const selectedProject = projects.find(p => p.id === selectedId);

  const handleAdd = () => {
    if (!draft.name) return;
    // PAYMENTS_TODO: if (!canAddProject(projects.length)) { setShowAdd(false); setShowProjectLimit(true); return; }
    // Auto-detect recurring customer
    const isRecurring = draft.customerName.trim() !== '' &&
      projects.some(p => p.customerName.toLowerCase().trim() === draft.customerName.toLowerCase().trim());
    addProject({ ...draft, isRecurringCustomer: isRecurring || draft.isRecurringCustomer });
    posthog.capture('project_created', {
      customer_source: draft.customerSource,
      payment_method: draft.paymentMethod,
      is_recurring_customer: isRecurring || draft.isRecurringCustomer,
    });
    setDraft(newProject());
    setShowAdd(false);
  };

  const handleBulkImport = (imported: Project[]) => {
    imported.forEach(p => addProject(p));
    posthog.capture('projects_bulk_imported', { count: imported.length });
  };

  const handleAddTemplate = () => {
    if (!templateDraft.name) return;
    addTemplate(templateDraft);
    posthog.capture('template_created', { estimated_print_time: templateDraft.estimatedPrintTime });
    setTemplateDraft(newTemplate());
    setShowAddTemplate(false);
  };

  const [paymentPopoverProjectId, setPaymentPopoverProjectId] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({ amount: '', date: new Date().toISOString().split('T')[0], method: 'Other' as PaymentMethod, notes: '' });

  const toggleStatus = (id: string, field: 'printed' | 'sent') => {
    const proj = projects.find(p => p.id === id);
    if (proj) {
      if (field === 'printed') {
        const newPrinted = !proj.printed;
        const updatedPrints = (proj.prints || []).map(pr => ({
          ...pr,
          completedQuantity: newPrinted ? (pr.quantity || 1) : 0,
        }));
        updateProject({ ...proj, printed: newPrinted, prints: updatedPrints });
      } else {
        const newValue = !proj[field];
        updateProject({ ...proj, [field]: newValue });
        posthog.capture('project_status_updated', { status_field: field, new_value: newValue, customer_source: proj.customerSource });
      }
    }
  };

  const handleRecordPayment = (proj: Project) => {
    const amt = parseFloat(paymentDraft.amount) || 0;
    if (amt <= 0) return;
    const payment: Payment = {
      id: crypto.randomUUID(),
      amount: amt,
      date: paymentDraft.date,
      method: paymentDraft.method,
      ...(paymentDraft.notes ? { notes: paymentDraft.notes } : {}),
    };
    updateProject({ ...proj, payments: [...(proj.payments || []), payment] });
    posthog.capture('payment_recorded', { amount: amt, method: paymentDraft.method, source: 'card_quick_action' });
    setPaymentPopoverProjectId(null);
    setPaymentDraft({ amount: '', date: new Date().toISOString().split('T')[0], method: 'Other', notes: '' });
  };

  const duplicateProject = (p: Project) => {
    duplicateProjectCtx(p.id);
  };

  const fireGuestGate = (message: string) => {
    document.dispatchEvent(new CustomEvent('guest-gate', { detail: { message } }));
  };

  const isGuest = localStorage.getItem('pt_guest_mode') === 'true';

  const exportCSV = () => {
    if (isGuest) { fireGuestGate('Create an account to export your data'); return; }
    const header = "Name,Customer,Source,PaymentMethod,Date,Price,Paid,Sent\n";
    const rows = projects.map(p =>
      `"${p.name}","${p.customerName}","${p.customerSource}","${p.paymentMethod || ''}","${p.orderDate}",${p.totalPrice},${p.paid},${p.sent}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "projects.csv";
    a.click();
  };

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={() => navigate(-1)} />;
  }

  return (
    <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "projects" | "templates")} className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <TabsList>
          <TabsTrigger value="projects">{t('nav.projects')}</TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-1.5">
            <BookTemplate className="h-3.5 w-3.5" />{t('nav.templates')}
          </TabsTrigger>
        </TabsList>
        {activeTab === 'projects' && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="hidden sm:flex"><Download className="h-4 w-4 mr-1" />{t('common.csv')}</Button>
          <Button size="sm" variant="outline" onClick={() => setShowSpreadsheetImport(true)}>
            <Upload className="h-4 w-4 mr-1" />{t('projects.importData')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" onClick={isGuest ? (e) => { e.preventDefault(); fireGuestGate('Create a free account to add your real orders — takes 30 seconds'); } : undefined}>
                <Plus className="h-4 w-4 mr-1" />{t('projects.newProject')}
                <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onClick={() => setImportMode("full")}>
                <Sparkles className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Start from a sliced file</div>
                  <div className="text-[11px] text-muted-foreground">Import .3mf, .gcode, or .stl</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Start with design work / blank</div>
                  <div className="text-[11px] text-muted-foreground">Add plates and files later</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImportMode("into")} disabled={projects.length === 0}>
                <Upload className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t('projects.importInto')}</div>
                  <div className="text-[11px] text-muted-foreground">{t('projects.importIntoDesc')}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowSpreadsheetImport(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t('projects.importFromSpreadsheet')}</div>
                  <div className="text-[11px] text-muted-foreground">{t('projects.importFromSpreadsheetDesc')}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAIImport(true)}>
                <Wand2 className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t('projects.importFromAI')}</div>
                  <div className="text-[11px] text-muted-foreground">{t('projects.importFromAIDesc')}</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        )}
        {activeTab === 'templates' && (
          <Button size="sm" onClick={() => setShowAddTemplate(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('templates.newTemplate')}
          </Button>
        )}
      </div>

      <TabsContent value="projects" className="space-y-4">
      {projects.length < 5 && projects.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Upload className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-primary font-medium">{t('projects.importBanner')}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSpreadsheetImport(true)}>
              <FileSpreadsheet className="h-3 w-3 mr-1" />Excel / CSV
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowAIImport(true)}>
              <Wand2 className="h-3 w-3 mr-1" />AI
            </Button>
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('projects.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9 min-h-[44px] md:min-h-[36px]" />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[130px] min-h-[44px] md:min-h-[36px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in-design">In design</SelectItem>
            <SelectItem value="awaiting-approval">Awaiting approval</SelectItem>
            <SelectItem value="printing">Printing</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
        <Select value={payFilter} onValueChange={setPayFilter}>
          <SelectTrigger className="w-[110px] min-h-[44px] md:min-h-[36px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[120px] min-h-[44px] md:min-h-[36px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[140px] min-h-[44px] md:min-h-[36px]">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active-first">Active first</SelectItem>
            <SelectItem value="due-date">Due date</SelectItem>
            <SelectItem value="date">Newest first</SelectItem>
            <SelectItem value="date-asc">Oldest first</SelectItem>
            <SelectItem value="price">Price high→low</SelectItem>
            <SelectItem value="customer-az">Customer A–Z</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border overflow-hidden shrink-0">
          <button
            className={`px-2.5 py-1.5 transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => setViewMode('cards')}
            title="Card view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            className={`px-2.5 py-1.5 transition-colors border-l border-border ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
        </div>
        {mode === 'month' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch checked={showAll} onCheckedChange={setShowAll} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4" />
            {t('projects.showAll')}
          </label>
        )}
      </div>

      {(() => {
        const currencySymbol = getCurrencySymbol(settings.currency);
        const isActiveFirst = sortBy === 'active-first' && stageFilter === 'all';
        const activeProjects = isActiveFirst ? filtered.filter(p => normalizeStage(p) !== 'delivered') : filtered;
        const deliveredProjects = isActiveFirst ? filtered.filter(p => normalizeStage(p) === 'delivered') : [];

        if (filtered.length === 0) {
          return (
            <Card><CardContent className="p-10 text-center space-y-5">
              {projects.length === 0 ? (
                <>
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <LayoutGrid className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">No projects yet</p>
                    <p className="text-sm text-muted-foreground mt-1">Add your first project or import existing data to get started.</p>
                  </div>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button onClick={() => setShowAdd(true)}>
                      <Plus className="h-4 w-4 mr-1" />Add your first project
                    </Button>
                    <Button variant="outline" onClick={() => setShowSpreadsheetImport(true)}>
                      <FileSpreadsheet className="h-4 w-4 mr-1" />Import from Excel
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">{mode === 'month' && !showAll ? t('projects.noProjectsMonth') : t('projects.noProjectsEmpty')}</p>
              )}
            </CardContent></Card>
          );
        }

        const renderCard = (p: Project) => {
          const prog = getProjectProgress(p);
          const piecesTotal = getProjectPiecesTotal(p);
          const effectivePrice = piecesTotal > 0 ? piecesTotal : (p.totalPrice || 0);
          const margin = getProjectEstimatedMargin(p, settings);
          const payStatus = getProjectPaymentStatus(p);
          const balance = getProjectBalance(p);
          const stage = normalizeStage(p);
          const stageMeta = STAGE_META[stage];
          const summary = getProgressSummary(p);
          const status = deriveProjectStatus(p);
          const isLate = status === "overdue";
          const isRecurring = !!p.isRecurringCustomer;

          return (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group"
              onClick={() => handleSelectProject(p.id)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <PlatePreview
                      thumbnail={p.coverThumbnail || p.prints?.[0]?.thumbnail}
                      color={(p.prints || []).map(pr => pr.color).filter(Boolean).join(", ") || undefined}
                      palette={(p.prints || []).flatMap(pr => pr.colorPalette || [])}
                      label={p.name}
                      size="sm"
                      noHover
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{cleanDisplayName(p.name) || p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.customerName}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: `color-mix(in srgb, var(${stageMeta.token}) 12%, transparent)`, color: `var(${stageMeta.token})` }}>
                      {stageMeta.label}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="More options">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {balance > 0 && (
                          <>
                            <DropdownMenuItem onClick={() => markAsPaid(p)}>
                              <CreditCard className="h-3.5 w-3.5 mr-2" />Mark as paid
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); setRecordPaymentProject(p); }}>
                              <DollarSign className="h-3.5 w-3.5 mr-2" />Record payment
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => handleSelectProject(p.id)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateProject(p)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmDeleteId(p.id)} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-lg font-bold tabular-nums">{currencySymbol}{effectivePrice.toFixed(2)}</span>
                    <PaymentBadge status={payStatus} balance={Math.max(0, balance)} currency={currencySymbol} />
                  </div>
                  {effectivePrice > 0 && (
                    <span className={`text-xs font-medium shrink-0 ${margin === null ? 'text-muted-foreground' : margin >= 60 ? 'text-[var(--pay-paid)]' : margin >= 30 ? 'text-[var(--pay-partial)]' : 'text-[var(--danger)]'}`}>
                      {margin === null ? '—' : `${margin.toFixed(0)}%`} Est. margin
                    </span>
                  )}
                </div>

                {prog.totalPieces > 0 && (
                  <div className="space-y-1">
                    <Progress value={prog.percent} className="h-1.5" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{summary || `${prog.completedPieces}/${prog.totalPieces} ${prog.totalPieces === 1 ? 'piece' : 'pieces'}`}</span>
                      <span>{prog.percent}%</span>
                    </div>
                  </div>
                )}
                {prog.totalPieces === 0 && summary && (
                  <p className="text-[10px] text-muted-foreground">{summary}</p>
                )}

                <div className="flex items-center gap-1.5 flex-wrap">
                  {isRecurring && <RecurringBadge />}
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{p.customerSource}</Badge>
                  {p.dueDate && (
                    <span className={`text-[10px] flex items-center gap-0.5 ${isLate ? 'text-[var(--danger)] font-medium' : 'text-muted-foreground'}`}>
                      <Calendar className="h-3 w-3" />{p.dueDate}
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
                  <button
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.printed ? 'badge-success' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}
                    onClick={() => toggleStatus(p.id, 'printed')}
                  >
                    <Printer className="h-3 w-3" />{p.printed ? '✓' : ''} {t('common.printed')}
                  </button>
                  <Popover
                    open={paymentPopoverProjectId === p.id}
                    onOpenChange={open => {
                      if (!open) { setPaymentPopoverProjectId(null); return; }
                      const remaining = Math.max(0, getProjectBalance(p));
                      setPaymentDraft({ amount: remaining > 0 ? remaining.toFixed(2) : '', date: new Date().toISOString().split('T')[0], method: (p.paymentMethod as PaymentMethod) || 'Other', notes: '' });
                      setPaymentPopoverProjectId(p.id);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.paid ? 'badge-success' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}>
                        <CreditCard className="h-3 w-3" />{p.paid ? '✓' : ''} {t('common.paid')}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-3" align="start" onClick={e => e.stopPropagation()}>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold">Record payment</p>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Amount (€)</Label>
                          <Input type="number" step="0.01" value={paymentDraft.amount} onChange={e => setPaymentDraft(d => ({ ...d, amount: e.target.value }))} className="h-7 text-xs mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Date</Label>
                          <Input type="date" value={paymentDraft.date} onChange={e => setPaymentDraft(d => ({ ...d, date: e.target.value }))} className="h-7 text-xs mt-0.5" />
                        </div>
                        <div>
                          <Label className="text-[10px] text-muted-foreground">Method</Label>
                          <Select value={paymentDraft.method} onValueChange={v => setPaymentDraft(d => ({ ...d, method: v as PaymentMethod }))}>
                            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" className="w-full h-7 text-xs" onClick={() => handleRecordPayment(p)}>Save payment</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.sent ? 'badge-success' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}
                    onClick={() => toggleStatus(p.id, 'sent')}
                  >
                    <Package className="h-3 w-3" />{p.sent ? '✓' : ''} {t('common.shipped')}
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        };

        const renderListRow = (p: Project) => {
          const piecesTotal = getProjectPiecesTotal(p);
          const effectivePrice = piecesTotal > 0 ? piecesTotal : (p.totalPrice || 0);
          const payStatus = getProjectPaymentStatus(p);
          const balance = getProjectBalance(p);
          const stage = normalizeStage(p);
          const stageMeta = STAGE_META[stage];
          const prog = getProjectProgress(p);

          return (
            <div
              key={p.id}
              className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors group"
              onClick={() => handleSelectProject(p.id)}
            >
              <div className="flex items-center gap-2 flex-[2] min-w-0">
                <PlatePreview thumbnail={p.coverThumbnail || p.prints?.[0]?.thumbnail} label={p.name} size="sm" noHover />
                <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{cleanDisplayName(p.name) || p.name}</span>
              </div>
              <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate hidden sm:block">{p.customerName}</span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 hidden md:inline"
                style={{ background: `color-mix(in srgb, var(${stageMeta.token}) 12%, transparent)`, color: `var(${stageMeta.token})` }}
              >
                {stageMeta.label}
              </span>
              <span className="shrink-0 hidden sm:block">
                <PaymentBadge status={payStatus} balance={balance} currency={currencySymbol} />
              </span>
              <span className="text-sm font-bold tabular-nums w-16 text-right shrink-0">{currencySymbol}{effectivePrice.toFixed(2)}</span>
              {prog.totalPieces > 0
                ? <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0 hidden md:block">{prog.percent}%</span>
                : <span className="w-10 hidden md:block" />
              }
              <span className="text-[10px] text-muted-foreground w-20 text-right shrink-0 hidden lg:block">{p.dueDate || ''}</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                {balance > 0 && (
                  <button className="h-6 text-[10px] px-2 rounded border border-border hover:bg-muted transition-colors" onClick={() => markAsPaid(p)}>
                    Mark paid
                  </button>
                )}
                {stageMeta.next && (
                  <button
                    className="h-6 text-[10px] px-2 rounded border border-border hover:bg-muted transition-colors flex items-center gap-1"
                    onClick={() => moveProject(p.id, stageMeta.next!)}
                  >
                    <MoveRight className="h-3 w-3" />{STAGE_META[stageMeta.next].label}
                  </button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors text-muted-foreground">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
                    {balance > 0 && (
                      <>
                        <DropdownMenuItem onClick={() => setRecordPaymentProject(p)}>
                          <DollarSign className="h-3.5 w-3.5 mr-2" />Record payment
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => handleSelectProject(p.id)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicateProject(p)}>
                      <Copy className="h-3.5 w-3.5 mr-2" />Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setConfirmDeleteId(p.id)} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        };

        const ListHeader = () => (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 border-b border-border text-[10px] font-medium text-muted-foreground uppercase tracking-wide sticky top-0 z-10">
            <span className="flex-[2]">Project</span>
            <span className="flex-1 hidden sm:block">Customer</span>
            <span className="hidden md:block w-28">Stage</span>
            <span className="hidden sm:block w-16">Payment</span>
            <span className="w-16 text-right">Price</span>
            <span className="w-10 text-right hidden md:block">Prog.</span>
            <span className="w-20 text-right hidden lg:block">Due</span>
            <span className="w-24 shrink-0" />
          </div>
        );

        return (
          <>
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {activeProjects.map(renderCard)}
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <ListHeader />
                {activeProjects.map(renderListRow)}
              </div>
            )}

            {isActiveFirst && deliveredProjects.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setShowDelivered(v => !v)}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDelivered ? '' : '-rotate-90'}`} />
                  Delivered ({deliveredProjects.length})
                </button>
                {showDelivered && (
                  viewMode === 'cards' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {deliveredProjects.map(renderCard)}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <ListHeader />
                      {deliveredProjects.map(renderListRow)}
                    </div>
                  )
                )}
              </div>
            )}
          </>
        );
      })()}
      </TabsContent>

      <TabsContent value="templates" className="space-y-4">
        {/* PAYMENTS_TODO: gate templates for free tier — remove wrapper when payments ready */}
        <>
        <p className="text-sm text-muted-foreground">{t('templates.description')}</p>
        {templates.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">{t('templates.noTemplates')}</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {templates.map(tmpl => (
              <Card key={tmpl.id}>
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{tmpl.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tmpl.estimatedPrintTime}h · {tmpl.materialUsed}g
                      {tmpl.notes ? ` · ${tmpl.notes}` : ''}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-8 w-8 shrink-0"
                    onClick={() => deleteTemplate(tmpl.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>
      </TabsContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('projects.dialogTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t('projects.projectName')}</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>{t('projects.customerName')}</Label><Input value={draft.customerName} onChange={e => setDraft({ ...draft, customerName: e.target.value })} /></div>
            <div><Label>{t('projects.customerSource')}</Label>
              <Select value={draft.customerSource} onValueChange={v => setDraft({ ...draft, customerSource: v as CustomerSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('projects.paymentMethod')}</Label>
              <Select value={draft.paymentMethod} onValueChange={v => setDraft({ ...draft, paymentMethod: v as PaymentMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('projects.orderDate')}</Label><Input type="date" value={draft.orderDate} onChange={e => setDraft({ ...draft, orderDate: e.target.value })} /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={draft.isRecurringCustomer || false} onCheckedChange={(v) => setDraft({ ...draft, isRecurringCustomer: !!v })} />
              <span className="text-sm">{t('projects.recurringCustomer')}</span>
            </label>
            <div><Label>{t('common.notes')}</Label><Textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>{t('projects.addProject')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportFromSpreadsheet
        open={showSpreadsheetImport}
        onClose={() => setShowSpreadsheetImport(false)}
        onImport={handleBulkImport}
      />
      <ImportFromAI
        open={showAIImport}
        onClose={() => setShowAIImport(false)}
        onImport={handleBulkImport}
      />
      {/* PAYMENTS_TODO: <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature={upgradeFeature} /> */}
      {/* PAYMENTS_TODO: <ProjectLimitModal open={showProjectLimit} onClose={() => setShowProjectLimit(false)} /> */}

      {/* Smart Import dialog (full new project OR append-into-existing) */}
      <ImportDialog open={importMode !== null} onOpenChange={(open) => { if (!open) { setImportMode(null); setAppendTargetId(null); } }}>
        <ImportDialogContent className="max-w-xl">
          <ImportDialogHeader>
            <ImportDialogTitle className="flex items-center gap-2">
              {importMode === "into" ? <><Upload className="h-4 w-4 text-primary" />{t('projects.importIntoTitle')}</> : <><Sparkles className="h-4 w-4 text-primary" />{t('projects.importFullTitle')}</>}
            </ImportDialogTitle>
            <ImportDialogDescription>
              {importMode === "into" ? t('projects.importIntoDesc2') : t('projects.importFullDesc2')}
            </ImportDialogDescription>
          </ImportDialogHeader>

          {importMode === "into" && (
            <div className="space-y-2">
              <Label className="text-xs">{t('projects.targetProject')}</Label>
              <Select value={appendTargetId ?? ""} onValueChange={setAppendTargetId}>
                <SelectTrigger><SelectValue placeholder={t('projects.selectProject')} /></SelectTrigger>
                <SelectContent>
                  {projects.map(pr => (
                    <SelectItem key={pr.id} value={pr.id}>{pr.name || t('projects.untitled')} {pr.customerName && `· ${pr.customerName}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="pt-2">
            {importMode === "full" && (
              <PlateImporter onImported={() => { posthog.capture('project_imported', { import_mode: 'full' }); setImportMode(null); }} />
            )}
            {importMode === "into" && appendTargetId && (
              <PlateImporter
                project={projects.find(pp => pp.id === appendTargetId)!}
                onImported={() => { posthog.capture('project_imported', { import_mode: 'append' }); setImportMode(null); setAppendTargetId(null); }}
              />
            )}
            {importMode === "into" && !appendTargetId && (
              <p className="text-xs text-muted-foreground text-center py-6">{t('projects.selectProjectAbove')}</p>
            )}
          </div>
        </ImportDialogContent>
      </ImportDialog>

      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('templates.dialogTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>{t('templates.printName')}</Label>
              <Input value={templateDraft.name} onChange={e => setTemplateDraft({ ...templateDraft, name: e.target.value })} />
            </div>
            <div>
              <Label>{t('templates.estimatedPrintTime')}</Label>
              <Input type="number" step="0.1" value={templateDraft.estimatedPrintTime || ""} onChange={e => setTemplateDraft({ ...templateDraft, estimatedPrintTime: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>{t('templates.materialUsed')}</Label>
              <Input type="number" value={templateDraft.materialUsed || ""} onChange={e => setTemplateDraft({ ...templateDraft, materialUsed: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>{t('common.notes')}</Label>
              <Textarea value={templateDraft.notes} onChange={e => setTemplateDraft({ ...templateDraft, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter><Button onClick={handleAddTemplate}>{t('templates.saveTemplate')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={open => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            "{projects.find(p => p.id === confirmDeleteId)?.name}" will be permanently deleted. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteId) deleteProject(confirmDeleteId);
                setConfirmDeleteId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {recordPaymentProject && (
        <RecordPaymentDialog
          project={recordPaymentProject}
          open={!!recordPaymentProject}
          onClose={() => setRecordPaymentProject(null)}
        />
      )}
    </Tabs>
  );
}
