import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { Project, CustomerSource, PaymentMethod, PrintTemplate, getProjectProgress, getProjectTotalPieces, getProjectPiecesTotal, getProjectExpensesTotal, getProjectTotalPrintTime, getProjectTotalMaterial } from "@/types";
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
import { Plus, Search, Download, ArrowUpDown, Printer, Package, Clock, Calendar, CreditCard, Sparkles, Upload, ChevronDown, FileSpreadsheet, Wand2, BookTemplate, Trash2, Zap, Users, LayoutGrid } from "lucide-react";
import { Label } from "@/components/ui/label";
import ProjectDetail from "@/components/ProjectDetail";
import { parseISO, isBefore, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog as ImportDialog, DialogContent as ImportDialogContent, DialogHeader as ImportDialogHeader, DialogTitle as ImportDialogTitle, DialogDescription as ImportDialogDescription } from "@/components/ui/dialog";
import { PlateImporter } from "@/components/PlateImporter";
import { RecurringBadge } from "@/components/RecurringBadge";
import { StatusPill } from "@/components/StatusPill";
import { ColorPills } from "@/components/ColorPills";
import { PlatePreview } from "@/components/PlatePreview";
import { deriveProjectStatus, getStatusMeta } from "@/lib/projectStatus";
import { normalizeMaterial } from "@/lib/normalize";
import posthog from "@/lib/posthog";
import { ImportFromSpreadsheet } from "@/components/ImportFromSpreadsheet";
import { ImportFromAI } from "@/components/ImportFromAI";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// PAYMENTS_TODO: import { UpgradeModal, ProjectLimitModal } from "@/components/UpgradeModal";
// PAYMENTS_TODO: import { useTier } from "@/context/TierContext";
// PAYMENTS_TODO: import { Lock } from "lucide-react";

const SOURCES: CustomerSource[] = ["Wallapop", "Instagram", "Website", "Other"];
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Other"];

type SortKey = "date" | "date-asc" | "price" | "paid" | "shipped" | "due-date";
type DateRange = "all" | "this-week" | "this-month";

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
  const { projects, addProject, updateProject, templates, addTemplate, deleteTemplate } = useApp();
  const { filterProjectsForWorkflow, mode } = useMonth();
  const { t } = useTranslation();
  // PAYMENTS_TODO: const { isPro, canAddProject } = useTier();
  const [activeTab, setActiveTab] = useState<"projects" | "templates">("projects");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = usePersistedState<string>("projects_filter", "all");
  const [sortBy, setSortBy] = usePersistedState<SortKey>("projects_sort", "date");
  const [showAll, setShowAll] = usePersistedState<boolean>("projects_show_all", false);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Project>(newProject());
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [importMode, setImportMode] = useState<null | "full" | "into">(null);
  const [appendTargetId, setAppendTargetId] = useState<string | null>(null);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  // PAYMENTS_TODO: const [showUpgrade, setShowUpgrade] = useState(false);
  // PAYMENTS_TODO: const [upgradeFeature, setUpgradeFeature] = useState<'excel_csv_import' | 'templates'>('excel_csv_import');
  // PAYMENTS_TODO: const [showProjectLimit, setShowProjectLimit] = useState(false);
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<PrintTemplate>(newTemplate());
  const [dateRange, setDateRange] = usePersistedState<DateRange>("projects_date_range", "all");

  // Sync URL param to selectedId
  useEffect(() => {
    const urlId = searchParams.get('id');
    if (urlId && projects.find(p => p.id === urlId)) {
      setSelectedId(urlId);
    }
  }, [searchParams, projects]);

  const handleSelectProject = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      setSearchParams({ id });
    } else {
      setSearchParams({});
    }
  };

  const filtered = useMemo(() => {
    let list = (showAll || mode === 'all') ? [...projects] : filterProjectsForWorkflow(projects);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q));
    }
    if (filter === "paid") list = list.filter(p => p.paid);
    if (filter === "unpaid") list = list.filter(p => !p.paid);
    if (filter === "sent") list = list.filter(p => p.sent);
    if (filter === "not-sent") list = list.filter(p => !p.sent);
    if (filter === "recurring") list = list.filter(p => p.isRecurringCustomer);
    if (filter === "new-customer") list = list.filter(p => !p.isRecurringCustomer);

    // Date range filter
    if (dateRange !== "all") {
      const now = new Date();
      const interval = dateRange === "this-week"
        ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
        : { start: startOfMonth(now), end: endOfMonth(now) };
      list = list.filter(p => {
        if (!p.orderDate) return false;
        try { return isWithinInterval(parseISO(p.orderDate), interval); } catch { return false; }
      });
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case "date": return (b.orderDate || "").localeCompare(a.orderDate || "");
        case "date-asc": return (a.orderDate || "").localeCompare(b.orderDate || "");
        case "price": {
          const aTotal = getProjectPiecesTotal(a) || a.totalPrice || 0;
          const bTotal = getProjectPiecesTotal(b) || b.totalPrice || 0;
          return bTotal - aTotal;
        }
        case "paid": return (a.paid === b.paid ? 0 : a.paid ? 1 : -1);
        case "shipped": return (a.sent === b.sent ? 0 : a.sent ? 1 : -1);
        case "due-date": return (a.dueDate || "9999").localeCompare(b.dueDate || "9999");
        default: return 0;
      }
    });
    return list;
  }, [projects, search, filter, sortBy, dateRange, showAll, mode, filterProjectsForWorkflow]);

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

  const toggleStatus = (id: string, field: 'printed' | 'paid' | 'sent') => {
    const proj = projects.find(p => p.id === id);
    if (proj) {
      const newValue = !proj[field];
      updateProject({ ...proj, [field]: newValue });
      posthog.capture('project_status_updated', {
        status_field: field,
        new_value: newValue,
        customer_source: proj.customerSource,
      });
    }
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
    return <ProjectDetail project={selectedProject} onBack={() => handleSelectProject(null)} />;
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
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t('projects.manualProject')}</div>
                  <div className="text-[11px] text-muted-foreground">{t('projects.manualProjectDesc')}</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportMode("full")}>
                <Sparkles className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{t('projects.importFull')}</div>
                  <div className="text-[11px] text-muted-foreground">{t('projects.importFullDesc')}</div>
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
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[130px] min-h-[44px] md:min-h-[36px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('projects.all')}</SelectItem>
            <SelectItem value="paid">{t('projects.paid')}</SelectItem>
            <SelectItem value="unpaid">{t('projects.unpaid')}</SelectItem>
            <SelectItem value="sent">{t('projects.shipped')}</SelectItem>
            <SelectItem value="not-sent">{t('projects.notShipped')}</SelectItem>
            <SelectItem value="recurring">{t('projects.recurring')}</SelectItem>
            <SelectItem value="new-customer">{t('projects.newCustomer')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={v => setDateRange(v as DateRange)}>
          <SelectTrigger className="w-[130px] min-h-[44px] md:min-h-[36px]">
            <Calendar className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="this-week">This week</SelectItem>
            <SelectItem value="this-month">This month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[140px] min-h-[44px] md:min-h-[36px]">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Newest first</SelectItem>
            <SelectItem value="date-asc">Oldest first</SelectItem>
            <SelectItem value="price">Highest value</SelectItem>
            <SelectItem value="due-date">Due date</SelectItem>
            <SelectItem value="paid">{t('projects.sortPaid')}</SelectItem>
            <SelectItem value="shipped">{t('projects.sortShipped')}</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'month' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch checked={showAll} onCheckedChange={setShowAll} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4" />
            {t('projects.showAll')}
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => {
            const prog = getProjectProgress(p);
            const totalPieces = getProjectTotalPieces(p);
            const piecesTotal = getProjectPiecesTotal(p);
            const effectivePrice = piecesTotal > 0 ? piecesTotal : (p.totalPrice || 0);
            const projExpenses = getProjectExpensesTotal(p);
            const margin = effectivePrice > 0 ? ((effectivePrice - projExpenses) / effectivePrice) * 100 : 0;
            const totalTime = getProjectTotalPrintTime(p);

            const status = deriveProjectStatus(p);
            const meta = getStatusMeta(status);
            const isLate = status === "overdue";
            const isRecurring = !!p.isRecurringCustomer;

            return (
              <Card
                key={p.id}
                className={`border-t-[3px] ${meta.borderTop} cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 group ${
                  isRecurring ? "ring-1 ring-recurring-from/30 hover:ring-recurring-from/60" : ""
                }`}
                onClick={() => handleSelectProject(p.id)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
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
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.customerName}</p>
                      </div>
                    </div>
                    <StatusPill status={status} className="shrink-0" />
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-primary">€{effectivePrice.toFixed(2)}</span>
                    {effectivePrice > 0 && (
                      <span className={`text-xs font-medium ${margin >= 60 ? 'text-emerald-600' : margin >= 30 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {margin.toFixed(0)}% {t('projects.margin')}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {prog.totalPieces > 0 && (
                    <div className="space-y-1">
                      <Progress value={prog.percent} className="h-1.5" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{prog.completedPieces}/{prog.totalPieces} {t('projects.pieces')}</span>
                        <span>{prog.percent}%</span>
                      </div>
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground items-center">
                    {(() => {
                      const grams = getProjectTotalMaterial(p);
                      const mats = Array.from(new Set((p.prints || [])
                        .map(pr => normalizeMaterial(pr.material))
                        .filter(Boolean)));
                      const matLabel = mats.length === 0 ? null : mats.length === 1 ? mats[0] : `${mats[0]} +${mats.length - 1}`;
                      if (!matLabel && grams === 0) return null;
                      return (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 font-medium text-foreground/80">
                          {matLabel || "—"}{grams > 0 && <span className="text-muted-foreground">· {Math.round(grams)}g</span>}
                        </span>
                      );
                    })()}
                    {totalPieces > 0 && (
                      <span className="flex items-center gap-0.5"><Package className="h-3 w-3" />{totalPieces} {t('projects.pieces')}</span>
                    )}
                    {totalTime > 0 && (
                      <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{totalTime.toFixed(0)}h</span>
                    )}
                    {p.dueDate && (
                      <span className={`flex items-center gap-0.5 ${isLate ? 'text-red-600 font-medium' : ''}`}>
                        <Calendar className="h-3 w-3" />{p.dueDate}
                      </span>
                    )}
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isRecurring && <RecurringBadge />}
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">{p.customerSource}</Badge>
                    {(() => {
                      const allColors = (p.prints || []).map(pr => pr.color).filter(Boolean).join(", ");
                      const allPalettes = (p.prints || []).flatMap(pr => pr.colorPalette || []);
                      if (!allColors) return null;
                      return <ColorPills color={allColors} palette={allPalettes.length ? allPalettes : undefined} size="xs" showLabel={false} />;
                    })()}
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-1.5 pt-2 border-t border-border/50" onClick={e => e.stopPropagation()}>
                    <button
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.printed ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}
                      onClick={() => toggleStatus(p.id, 'printed')}
                    >
                      <Printer className="h-3 w-3" />{p.printed ? '✓' : ''} {t('common.printed')}
                    </button>
                    <button
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.paid ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}
                      onClick={() => toggleStatus(p.id, 'paid')}
                    >
                      <CreditCard className="h-3 w-3" />{p.paid ? '✓' : ''} {t('common.paid')}
                    </button>
                    <button
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.sent ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}
                      onClick={() => toggleStatus(p.id, 'sent')}
                    >
                      <Package className="h-3 w-3" />{p.sent ? '✓' : ''} {t('common.shipped')}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
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
    </Tabs>
  );
}
