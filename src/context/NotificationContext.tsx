import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { usePersistedState } from '@/hooks/usePersistedState';

export type NotificationType = 'quote_request' | 'upload_request' | 'message' | 'order_update';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  customerName?: string;
  customerEmail?: string;
  message?: string;
  files?: string[];
  urgent?: boolean;
  timestamp: string; // ISO
  read: boolean;
  meta?: Record<string, any>;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'> & { id?: string; timestamp?: string }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const SEED_NOTIFICATIONS: AppNotification[] = [];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = usePersistedState<AppNotification[]>(
    'pt_notifications',
    SEED_NOTIFICATIONS,
  );

  const addNotification: NotificationContextType['addNotification'] = useCallback((n) => {
    setNotifications((prev) => [
      {
        id: n.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: n.timestamp ?? new Date().toISOString(),
        read: false,
        ...n,
      } as AppNotification,
      ...prev,
    ]);
  }, [setNotifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, [setNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [setNotifications]);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, [setNotifications]);

  const clearAll = useCallback(() => setNotifications([]), [setNotifications]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, dismiss, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
