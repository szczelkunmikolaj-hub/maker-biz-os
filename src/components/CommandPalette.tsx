import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Columns3,
  Calendar,
  Receipt,
  Package,
  FolderKanban,
  BarChart3,
  Plus,
  Keyboard,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS: { label: string; path: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Dashboard", path: "/", Icon: LayoutDashboard },
  { label: "Projects", path: "/projects", Icon: FolderKanban },
  { label: "Kanban", path: "/kanban", Icon: Columns3 },
  { label: "Calendar", path: "/calendar", Icon: Calendar },
  { label: "Analytics", path: "/", Icon: BarChart3 },
  { label: "Materials", path: "/filament", Icon: Package },
  { label: "Expenses", path: "/expenses", Icon: Receipt },
  { label: "Customers", path: "/customers", Icon: Users },
];

const SHORTCUTS = [
  { key: "N", description: "New project" },
  { key: "K", description: "Go to Kanban" },
  { key: "D", description: "Go to Dashboard" },
  { key: "/", description: "Focus search" },
  { key: "?", description: "Show shortcuts" },
  { key: "⌘K", description: "Open command palette" },
];

/**
 * Global ⌘K / Ctrl+K command palette + keyboard shortcuts.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { projects } = useApp();
  const navigate = useNavigate();

  const go = useCallback((path: string) => {
    setOpen(false);
    navigate(path);
  }, [navigate]);

  const goProject = useCallback((id: string) => {
    setOpen(false);
    navigate(`/projects?id=${id}`);
  }, [navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.contentEditable === "true";

      // ⌘K / Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
        return;
      }

      // Only fire single-key shortcuts when NOT typing in an input
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "n": case "N":
          e.preventDefault();
          document.dispatchEvent(new CustomEvent("quick-add-project"));
          break;
        case "k": case "K":
          e.preventDefault();
          navigate("/kanban");
          break;
        case "d": case "D":
          e.preventDefault();
          navigate("/");
          break;
        case "?":
          e.preventDefault();
          setShowShortcuts(prev => !prev);
          break;
        case "/":
          e.preventDefault();
          // Focus the search input on projects page if present
          document.querySelector<HTMLInputElement>('input[placeholder*="search" i], input[placeholder*="Search" i]')?.focus();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search projects, customers, navigate…" autoFocus />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Navigation">
            {NAV_ITEMS.map(item => (
              <CommandItem
                key={item.label}
                value={`nav ${item.label}`}
                onSelect={() => go(item.path)}
              >
                <item.Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Actions">
            <CommandItem value="new project add" onSelect={() => { setOpen(false); document.dispatchEvent(new CustomEvent("quick-add-project")); }}>
              <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>New project</span>
              <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">N</kbd>
            </CommandItem>
            <CommandItem value="shortcuts keyboard" onSelect={() => { setOpen(false); setShowShortcuts(true); }}>
              <Keyboard className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Keyboard shortcuts</span>
              <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">?</kbd>
            </CommandItem>
          </CommandGroup>

          {projects.length > 0 && (
            <CommandGroup heading="Projects">
              {projects.slice(0, 50).map(p => (
                <CommandItem
                  key={p.id}
                  value={`project ${p.name} ${p.customerName}`}
                  onSelect={() => goProject(p.id)}
                >
                  <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{p.name || "(untitled)"}</span>
                    {p.customerName && (
                      <span className="text-[11px] text-muted-foreground truncate">{p.customerName}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" /> Keyboard shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {SHORTCUTS.map(s => (
              <div key={s.key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{s.description}</span>
                <kbd className="text-xs bg-muted px-2 py-1 rounded font-mono">{s.key}</kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CommandPalette;
