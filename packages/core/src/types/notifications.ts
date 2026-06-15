export type NotificationType = 'new_order' | 'assignment' | 'status_change' | 'general' | 'new_message';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (data: Omit<Notification, 'id' | 'createdAt' | 'read'>) => Promise<Notification | null>;
  deleteNotification: (id: string) => Promise<boolean>;
}
