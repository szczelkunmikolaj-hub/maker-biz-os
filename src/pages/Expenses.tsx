import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useApp } from "@/context/AppContext";
import { useMonth } from "@/context/MonthContext";
import { Expense, ExpenseCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Download, ExternalLink } from "lucide-react";
import posthog from "@/lib/posthog";

const CATS: ExpenseCategory[] = ["Filament", "Shipping", "Equipment", "Tools", "Project Expense", "Other"];

function newExpense(): Expense {
  return { id: crypto.randomUUID(), date: new Date().toISOString().split("T")[0], name: "", category: "Other", amount: 0, notes: "" };
}

export default function Expenses() {
  const { expenses, addExpense, deleteExpense, projects } = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { filterExpenses, mode } = useMonth();
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState<Expense>(newExpense());
  const [catFilter, setCatFilter] = usePersistedState("expenses_cat_filter", "all");

  const filtered = useMemo(() => {
    const monthFiltered = mode === 'all' ? expenses : filterExpenses(expenses);
    return catFilter === "all" ? monthFiltered : monthFiltered.filter(e => e.category === catFilter);
  }, [expenses, catFilter, mode, filterExpenses]);

  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0);

  const handleAdd = () => {
    if (!draft.name) return;
    addExpense(draft);
    posthog.capture('expense_added', {
      category: draft.category,
      amount: draft.amount,
      has_linked_project: !!draft.linkedProject,
    });
    setDraft(newExpense());
    setShowAdd(false);
  };

  const exportCSV = () => {
    const header = "Date,Name,Category,Amount,Notes,LinkedProject\n";
    const rows = expenses.map(e => `"${e.date}","${e.name}","${e.category}",${e.amount},"${e.notes}","${e.linkedProject || ''}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "expenses.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('expenses.title')}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />{t('common.csv')}</Button>
          <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" />{t('expenses.addExpense')}</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[160px] min-h-[44px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('expenses.allCategories')}</SelectItem>
            {CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{t('expenses.total')}: <strong className="text-foreground">€{total.toFixed(2)}</strong></span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('expenses.tableDate')}</TableHead>
                <TableHead>{t('expenses.tableName')}</TableHead>
                <TableHead>{t('expenses.tableCategory')}</TableHead>
                <TableHead>{t('expenses.tableProject')}</TableHead>
                <TableHead className="text-right">{t('expenses.tableAmount')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {mode === 'month' ? t('expenses.noExpensesMonth') : t('expenses.noExpensesEmpty')}
                </TableCell></TableRow>
              )}
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm">{e.date}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{e.category}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.linkedProject ? (
                      <button
                        className="text-primary hover:underline cursor-pointer inline-flex items-center gap-1 text-xs"
                        onClick={() => {
                          const proj = projects.find(p => p.name === e.linkedProject);
                          if (proj) navigate(`/projects?id=${proj.id}`);
                        }}
                      >
                        {e.linkedProject}
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">€{(e.amount || 0).toFixed(2)}</TableCell>
                  <TableCell><Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => { deleteExpense(e.id); posthog.capture('expense_deleted', { category: e.category, amount: e.amount }); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('expenses.dialogTitle')}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>{t('common.date')}</Label><Input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></div>
            <div><Label>{t('common.name')}</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>{t('common.category')}</Label>
              <Select value={draft.category} onValueChange={v => setDraft({ ...draft, category: v as ExpenseCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('expenses.amount')}</Label><Input type="number" step="0.01" value={draft.amount || ""} onChange={e => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>{t('common.notes')}</Label><Textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={handleAdd}>{t('expenses.addExpenseBtn')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
