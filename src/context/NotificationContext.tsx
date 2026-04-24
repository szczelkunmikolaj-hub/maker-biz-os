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

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'seed-1',
    type: 'quote_request',
    title: 'New Quote Request',
    customerName: 'John Smith',
    customerEmail: 'john@example.com',
    files: ['bracket.stl'],
    urgent: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read: false,
  },
  {
    id: 'seed-2',
    type: 'upload_request',
    title: 'New Upload Request',
    customerName: 'Maria Garcia',
    files: ['part-a.stl', 'part-b.stl'],
    urgent: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: false,
  },
  {
    id: 'seed-3',
    type: 'message',
    title: 'Customer Message',
    customerName: 'Alex Lee',
    message: 'Could you confirm shipping times for my order?',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    read: true,
  },
];

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
