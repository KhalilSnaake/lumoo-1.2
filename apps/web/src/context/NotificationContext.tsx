import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { Notification, NotificationContextType } from '../types/notifications';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Synthesized notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    // Guard against non-browser environments
    if (typeof window === 'undefined') return;

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, audioContext.currentTime); // D5
    oscillator.frequency.exponentialRampToValueAtTime(880.00, audioContext.currentTime + 0.1); // A5

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {
    // Avoid noisy logs in production
  }
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setNotifications(data.map(n => ({
        ...n,
        createdAt: n.created_at,
        userId: n.user_id,
        orderId: n.order_id
      })));
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    // Subscribe to new notifications
    if (user) {
      const channel = supabase
        .channel(`notifications_user_${user.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {

          const newNotif = {
            id: payload.new.id,
            userId: payload.new.user_id,
            title: payload.new.title,
            message: payload.new.message,
            type: payload.new.type,
            orderId: payload.new.order_id,
            read: payload.new.read,
            createdAt: payload.new.created_at
          } as Notification;
          
          playNotificationSound();
          setNotifications(prev => [newNotif, ...prev]);
        })
        .subscribe(() => {
          // noop
        });
      
      return () => { 
        supabase.removeChannel(channel); 
      };
    }
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const createNotification = async (data: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    const { data: newNotif, error } = await supabase
      .from('notifications')
      .insert({
        user_id: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
        order_id: data.orderId
      })
      .select()
      .single();

    if (!error && newNotif) {
      return {
        ...newNotif,
        createdAt: newNotif.created_at,
        userId: newNotif.user_id,
        orderId: newNotif.order_id
      } as Notification;
    }
    return null;
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      return true;
    }
    return false;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, createNotification, deleteNotification
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
