import { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { Project, CustomerSource, PaymentMethod, getProjectProgress, getProjectTotalPieces, getProjectPiecesTotal, getProjectExpensesTotal } from "@/types";
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
import { Plus, Search, Download, ArrowUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import ProjectDetail from "@/components/ProjectDetail";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    addProject(draft);
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
    return <ProjectDetail project={selectedProject} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />CSV</Button>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />New Project</Button>
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
        <div className="grid gap-3">
          {filtered.map(p => {
            const prog = getProjectProgress(p);
            const totalPieces = getProjectTotalPieces(p);
            const piecesTotal = getProjectPiecesTotal(p);
            const effectivePrice = piecesTotal > 0 ? piecesTotal : (p.totalPrice || 0);
            const projExpenses = getProjectExpensesTotal(p);
            const margin = effectivePrice > 0 ? ((effectivePrice - projExpenses) / effectivePrice) * 100 : 0;
            const marginColor = margin >= 60 ? "text-green-600" : margin >= 30 ? "text-yellow-600" : "text-red-600";
            return (
              <Card key={p.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedId(p.id)}>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-muted-foreground">{p.customerName} · {p.customerSource} · {p.orderDate}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {totalPieces > 0 && <span className="text-xs text-muted-foreground">{totalPieces} piece{totalPieces !== 1 ? 's' : ''}</span>}
                        {prog.totalPieces > 0 && (
                          <div className="flex items-center gap-1.5">
                            <Progress value={prog.percent} className="h-1.5 w-20" />
                            <span className="text-xs text-muted-foreground">{prog.percent}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right cursor-pointer" onClick={() => setSelectedId(p.id)}>
                        <span className="font-bold text-primary">€{effectivePrice.toFixed(2)}</span>
                        {effectivePrice > 0 && <p className={`text-xs font-medium ${marginColor}`}>{margin.toFixed(0)}% margin</p>}
                      </div>
                      <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox checked={p.printed} onCheckedChange={() => toggleStatus(p.id, 'printed')} />
                          <span className="text-xs">Printed</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox checked={p.paid} onCheckedChange={() => toggleStatus(p.id, 'paid')} />
                          <span className="text-xs">Paid</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <Checkbox checked={p.sent} onCheckedChange={() => toggleStatus(p.id, 'sent')} />
                          <span className="text-xs">Shipped</span>
                        </label>
                      </div>
                    </div>
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
            <div><Label>Notes</Label><Textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>Add Project</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
