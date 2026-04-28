import { useEffect, useState } from "react";
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
} from "lucide-react";

const NAV_ITEMS: { label: string; path: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { label: "Dashboard", path: "/", Icon: LayoutDashboard },
  { label: "Projects", path: "/projects", Icon: FolderKanban },
  { label: "Kanban", path: "/kanban", Icon: Columns3 },
  { label: "Calendar", path: "/calendar", Icon: Calendar },
  { label: "Analytics", path: "/", Icon: BarChart3 }, // Dashboard hosts analytics
  { label: "Materials", path: "/filament", Icon: Package },
  { label: "Expenses", path: "/expenses", Icon: Receipt },
];

/**
 * Global ⌘K / Ctrl+K command palette. Pure overlay — does not modify routes/pages.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { projects } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const goProject = (id: string) => {
    setOpen(false);
    navigate(`/projects?id=${id}`);
  };

  return (
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
  );
}

export default CommandPalette;
