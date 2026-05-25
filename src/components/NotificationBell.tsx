import { Bell, FileText, Upload, MessageSquare, Package, X, Check, Trash2, Plus, AlertCircle, Clock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, AppNotification, NotificationType } from "@/context/NotificationContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  quote_request: FileText,
  upload_request: Upload,
  message: MessageSquare,
  order_update: Package,
  due_tomorrow: Clock,
  project_paid: CreditCard,
};

const TYPE_ACCENT: Record<NotificationType, string> = {
  quote_request: 'text-primary bg-primary/10',
  upload_request: 'text-blue-500 bg-blue-500/10',
  message: 'text-muted-foreground bg-muted',
  order_update: 'text-green-500 bg-green-500/10',
  due_tomorrow: 'text-amber-500 bg-amber-500/10',
  project_paid: 'text-emerald-500 bg-emerald-500/10',
};

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismiss, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleCreateProject = (n: AppNotification) => {
    markAsRead(n.id);
    setOpen(false);
    const params = new URLSearchParams({ new: '1' });
    if (n.customerName) params.set('customerName', n.customerName);
    if (n.files?.length) params.set('printName', n.files[0].replace(/\.[^.]+$/, ''));
    navigate(`/projects?${params.toString()}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{unreadCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={markAllAsRead}>
                <Check className="h-3 w-3 mr-1" /> Mark all
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={clearAll}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-foreground">No new requests</p>
            <p className="text-xs mt-1">New quote requests from Dimension 3D will appear here.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                return (
                  <div
                    key={n.id}
                    className={`group p-3 hover:bg-accent/50 transition-colors cursor-pointer ${!n.read ? 'bg-accent/20' : ''}`}
                    onClick={() => markAsRead(n.id)}
                  >
                    <div className="flex gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${TYPE_ACCENT[n.type]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold leading-tight">{n.title}</span>
                            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                            {n.urgent && (
                              <Badge variant="destructive" className="h-4 px-1 text-[9px] gap-0.5">
                                <AlertCircle className="h-2.5 w-2.5" /> Urgent
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        {n.customerName && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Customer: <span className="text-foreground font-medium">{n.customerName}</span>
                          </p>
                        )}
                        {n.files && n.files.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {n.files.length === 1 ? n.files[0] : `${n.files.length} files submitted`}
                          </p>
                        )}
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <span className="text-[10px] text-muted-foreground">{formatRelative(n.timestamp)}</span>
                          {(n.type === 'quote_request' || n.type === 'upload_request') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={(e) => { e.stopPropagation(); handleCreateProject(n); }}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Create Project
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
