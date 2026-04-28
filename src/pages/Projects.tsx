import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { Project, CustomerSource, PaymentMethod, getProjectProgress, getProjectTotalPieces, getProjectPiecesTotal, getProjectExpensesTotal, getProjectTotalPrintTime, getProjectTotalMaterial } from "@/types";
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
import { Plus, Search, Download, ArrowUpDown, RefreshCw, Printer, Package, Clock, Calendar, CreditCard, Sparkles, Upload, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import ProjectDetail from "@/components/ProjectDetail";
import { parseISO, isBefore } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog as ImportDialog, DialogContent as ImportDialogContent, DialogHeader as ImportDialogHeader, DialogTitle as ImportDialogTitle, DialogDescription as ImportDialogDescription } from "@/components/ui/dialog";
import { PlateImporter } from "@/components/PlateImporter";
import { RecurringBadge } from "@/components/RecurringBadge";
import { StatusPill } from "@/components/StatusPill";
import { ColorPills } from "@/components/ColorPills";
import { PlatePreview } from "@/components/PlatePreview";
import { deriveProjectStatus, getStatusMeta } from "@/lib/projectStatus";

const SOURCES: CustomerSource[] = ["Wallapop", "Instagram", "Website", "Other"];
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Other"];

type SortKey = "date" | "price" | "paid" | "shipped";

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
  const { projects, addProject, updateProject } = useApp();
  const { filterProjectsForWorkflow, mode } = useMonth();
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

    list.sort((a, b) => {
      switch (sortBy) {
        case "date": return (b.orderDate || "").localeCompare(a.orderDate || "");
        case "price": {
          const aTotal = getProjectPiecesTotal(a) || a.totalPrice || 0;
          const bTotal = getProjectPiecesTotal(b) || b.totalPrice || 0;
          return bTotal - aTotal;
        }
        case "paid": return (a.paid === b.paid ? 0 : a.paid ? 1 : -1);
        case "shipped": return (a.sent === b.sent ? 0 : a.sent ? 1 : -1);
        default: return 0;
      }
    });
    return list;
  }, [projects, search, filter, sortBy, showAll, mode, filterProjectsForWorkflow]);

  const selectedProject = projects.find(p => p.id === selectedId);

  const handleAdd = () => {
    if (!draft.name) return;
    // Auto-detect recurring customer
    const isRecurring = draft.customerName.trim() !== '' &&
      projects.some(p => p.customerName.toLowerCase().trim() === draft.customerName.toLowerCase().trim());
    addProject({ ...draft, isRecurringCustomer: isRecurring || draft.isRecurringCustomer });
    setDraft(newProject());
    setShowAdd(false);
  };

  const toggleStatus = (id: string, field: 'printed' | 'paid' | 'sent') => {
    const proj = projects.find(p => p.id === id);
    if (proj) updateProject({ ...proj, [field]: !proj[field] });
  };

  const exportCSV = () => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />New Project
                <ChevronDown className="h-3 w-3 ml-1 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Manual Project</div>
                  <div className="text-[11px] text-muted-foreground">Blank, fill in by hand</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setImportMode("full")}>
                <Sparkles className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Import Project (Full)</div>
                  <div className="text-[11px] text-muted-foreground">Upload .3mf / .gcode → new project</div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setImportMode("into")} disabled={projects.length === 0}>
                <Upload className="h-4 w-4 mr-2" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Import into Project</div>
                  <div className="text-[11px] text-muted-foreground">Append plates to existing project</div>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="sent">Shipped</SelectItem>
            <SelectItem value="not-sent">Not Shipped</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
            <SelectItem value="new-customer">New Customer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[130px]">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
          </SelectContent>
        </Select>
        {mode === 'month' && (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Switch checked={showAll} onCheckedChange={setShowAll} className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 data-[state=checked]:[&>span]:translate-x-4" />
            Show All
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {mode === 'month' && !showAll ? "No projects for this month. Toggle 'Show All' or switch to All Time." : "No projects yet. Click \"New Project\" to get started."}
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
                        {margin.toFixed(0)}% margin
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {prog.totalPieces > 0 && (
                    <div className="space-y-1">
                      <Progress value={prog.percent} className="h-1.5" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{prog.completedPieces}/{prog.totalPieces} pieces</span>
                        <span>{prog.percent}%</span>
                      </div>
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                    {totalPieces > 0 && (
                      <span className="flex items-center gap-0.5"><Package className="h-3 w-3" />{totalPieces} pcs</span>
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
                      <Printer className="h-3 w-3" />{p.printed ? '✓' : ''} Printed
                    </button>
                    <button
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.paid ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}
                      onClick={() => toggleStatus(p.id, 'paid')}
                    >
                      <CreditCard className="h-3 w-3" />{p.paid ? '✓' : ''} Paid
                    </button>
                    <button
                      className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md border transition-colors ${p.sent ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'}`}
                      onClick={() => toggleStatus(p.id, 'sent')}
                    >
                      <Package className="h-3 w-3" />{p.sent ? '✓' : ''} Shipped
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Project Name</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>Customer Name</Label><Input value={draft.customerName} onChange={e => setDraft({ ...draft, customerName: e.target.value })} /></div>
            <div><Label>Customer Source</Label>
              <Select value={draft.customerSource} onValueChange={v => setDraft({ ...draft, customerSource: v as CustomerSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Payment Method</Label>
              <Select value={draft.paymentMethod} onValueChange={v => setDraft({ ...draft, paymentMethod: v as PaymentMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Order Date</Label><Input type="date" value={draft.orderDate} onChange={e => setDraft({ ...draft, orderDate: e.target.value })} /></div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={draft.isRecurringCustomer || false} onCheckedChange={(v) => setDraft({ ...draft, isRecurringCustomer: !!v })} />
              <span className="text-sm">Recurring Customer</span>
            </label>
            <div><Label>Notes</Label><Textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>Add Project</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Smart Import dialog (full new project OR append-into-existing) */}
      <ImportDialog open={importMode !== null} onOpenChange={(open) => { if (!open) { setImportMode(null); setAppendTargetId(null); } }}>
        <ImportDialogContent className="max-w-xl">
          <ImportDialogHeader>
            <ImportDialogTitle className="flex items-center gap-2">
              {importMode === "into" ? <><Upload className="h-4 w-4 text-primary" />Import into Existing Project</> : <><Sparkles className="h-4 w-4 text-primary" />Import Full Project</>}
            </ImportDialogTitle>
            <ImportDialogDescription>
              {importMode === "into"
                ? "Pick the target project, then drop a .3mf or .gcode file."
                : "Drop a Bambu Studio .3mf or .gcode file to create a fully-structured new project."}
            </ImportDialogDescription>
          </ImportDialogHeader>

          {importMode === "into" && (
            <div className="space-y-2">
              <Label className="text-xs">Target project</Label>
              <Select value={appendTargetId ?? ""} onValueChange={setAppendTargetId}>
                <SelectTrigger><SelectValue placeholder="Select project…" /></SelectTrigger>
                <SelectContent>
                  {projects.map(pr => (
                    <SelectItem key={pr.id} value={pr.id}>{pr.name || "Untitled"} {pr.customerName && `· ${pr.customerName}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="pt-2">
            {importMode === "full" && (
              <PlateImporter onImported={() => setImportMode(null)} />
            )}
            {importMode === "into" && appendTargetId && (
              <PlateImporter
                project={projects.find(pp => pp.id === appendTargetId)!}
                onImported={() => { setImportMode(null); setAppendTargetId(null); }}
              />
            )}
            {importMode === "into" && !appendTargetId && (
              <p className="text-xs text-muted-foreground text-center py-6">Select a project above to enable the dropzone.</p>
            )}
          </div>
        </ImportDialogContent>
      </ImportDialog>
    </div>
  );
}
