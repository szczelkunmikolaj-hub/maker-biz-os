import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Users, RefreshCw, DollarSign, Package } from "lucide-react";
import { getProjectPiecesTotal } from "@/types";

interface Customer {
  name: string;
  projects: ReturnType<typeof useApp>["projects"];
  totalSpent: number;
  avgOrderValue: number;
  notes: string;
}

const NOTES_KEY = "pt_customer_notes";

function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); } catch { return {}; }
}
function saveNotes(notes: Record<string, string>) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

export default function CustomersPage() {
  const { projects } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    projects.forEach(p => {
      const name = (p.customerName || "").trim();
      if (!name) return;
      if (!map.has(name)) {
        map.set(name, { name, projects: [], totalSpent: 0, avgOrderValue: 0, notes: notes[name] || "" });
      }
      const c = map.get(name)!;
      c.projects.push(p);
      const price = getProjectPiecesTotal(p) || p.totalPrice || 0;
      c.totalSpent += price;
    });
    map.forEach(c => {
      c.avgOrderValue = c.projects.length > 0 ? c.totalSpent / c.projects.length : 0;
      c.notes = notes[c.name] || "";
    });
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [projects, notes]);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(q));
  }, [customers, search]);

  const openCustomer = (c: Customer) => {
    setSelected(c);
    setNotesDraft(notes[c.name] || "");
  };

  const saveCustomerNotes = () => {
    if (!selected) return;
    const updated = { ...notes, [selected.name]: notesDraft };
    setNotes(updated);
    saveNotes(updated);
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">Auto-built from your project history. {customers.length} unique customers.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <p className="font-semibold">No customers yet</p>
          <p className="text-sm text-muted-foreground">Customers are auto-created from your project customer names.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <Card
              key={c.name}
              className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all"
              onClick={() => openCustomer(c)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{c.name}</p>
                      {c.projects.some(p => p.isRecurringCustomer) && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 flex items-center gap-0.5 w-fit">
                          <RefreshCw className="h-2.5 w-2.5" />Recurring
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-primary">€{c.totalSpent.toFixed(0)}</span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Package className="h-3 w-3" />{c.projects.length} order{c.projects.length !== 1 ? "s" : ""}</span>
                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />Avg €{c.avgOrderValue.toFixed(2)}</span>
                </div>
                {c.notes && (
                  <p className="text-xs text-muted-foreground italic line-clamp-2">{c.notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                {selected.name}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xl font-bold text-primary">€{selected.totalSpent.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total spent</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xl font-bold">{selected.projects.length}</p>
                <p className="text-xs text-muted-foreground">Orders</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xl font-bold">€{selected.avgOrderValue.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Avg order</p>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Past orders</p>
              {selected.projects.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => { setSelected(null); navigate(`/projects?id=${p.id}`); }}
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.orderDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">€{(getProjectPiecesTotal(p) || p.totalPrice || 0).toFixed(2)}</span>
                    {p.paid && <Badge variant="outline" className="text-[9px] px-1">Paid</Badge>}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Add notes about this customer..."
                value={notesDraft}
                onChange={e => setNotesDraft(e.target.value)}
                className="resize-none"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              <Button onClick={saveCustomerNotes}>Save notes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
