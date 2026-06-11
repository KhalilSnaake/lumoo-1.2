import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ContactMessage } from '../types';
import { useToast } from './ToastContext';

type ContactMessagesContextType = {
  messages: ContactMessage[];
  unreadCount: number;
  loading: boolean;
  refreshMessages: () => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAsUnread: (messageId: string) => Promise<void>;
  sendReply: (messageId: string, response: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  createTestMessage: () => Promise<void>;
};

const ContactMessagesContext = createContext<ContactMessagesContextType | undefined>(undefined);

export function ContactMessagesProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  // Fetch messages from Supabase
  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📧 Fetching contact messages...');

      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching messages:', error);
        showToast('Erreur de chargement des messages: ' + error.message, 'error');
        setMessages([]);
        setLoading(false);
        return;
      }

      console.log('✅ Messages loaded:', data?.length || 0, data);
      const normalized = (data || []).map((m: any) => ({
        ...m,
        is_read: m.is_read ?? false,
      }));
      setMessages(normalized);
    } catch (err: any) {
      console.error('❌ Unexpected error:', err);
      showToast('Erreur inattendue', 'error');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Initial fetch on mount
  useEffect(() => {
    console.log('📧 ContactMessagesProvider mounted, fetching messages...');
    fetchMessages();
    return () => {};
  }, []);

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('contact_messages_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contact_messages' },
        (payload) => {
          console.log('🔔 New message received:', payload.new);
          setMessages(prev => [payload.new as ContactMessage, ...prev]);
          showToast('📬 Nouveau message reçu !', 'info');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const refreshMessages = async () => {
    await fetchMessages();
  };

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ is_read: true })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, is_read: true } : msg
      ));

      showToast('Message marqué comme lu ✅');
    } catch (err: any) {
      console.error('Error marking as read:', err);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const markAsUnread = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ is_read: false })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg =>
        msg.id === messageId ? { ...msg, is_read: false } : msg
      ));

      showToast('Message marqué comme non lu ✅');
    } catch (err: any) {
      console.error('Error marking as unread:', err);
      showToast('Erreur lors de la mise à jour', 'error');
    }
  };

  const sendReply = async (messageId: string, response: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({
          response: response,
          responded_at: new Date().toISOString(),
          is_read: true
        })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, response, responded_at: new Date().toISOString(), is_read: true }
          : msg
      ));

      showToast('Réponse envoyée avec succès ✅');
    } catch (err: any) {
      console.error('Error sending reply:', err);
      showToast('Erreur lors de l\'envoi de la réponse', 'error');
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!confirm('Supprimer ce message définitivement ?')) return;

    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      showToast('Message supprimé ✅');
    } catch (err: any) {
      console.error('Error deleting message:', err);
      showToast('Erreur lors de la suppression', 'error');
    }
  };

  const createTestMessage = async () => {
    try {
      console.log('🧪 Creating test message...');
      const { error } = await supabase
        .from('contact_messages')
        .insert([
          {
            name: 'Test User',
            email: 'test@example.com',
            phone: '+223000000000',
            subject: 'Test Message',
            message: 'This is a test message created at ' + new Date().toISOString(),
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('❌ Test error:', error);
        showToast('Erreur de test: ' + error.message, 'error');
      } else {
        console.log('✅ Test message created');
        showToast('Message de test créé ✅');
        await refreshMessages();
      }
    } catch (err: any) {
      console.error('❌ Unexpected test error:', err);
      showToast('Erreur de test inattendue', 'error');
    }
  };

  const unreadCount = messages.filter((msg) => !msg.is_read).length;

  return (
    <ContactMessagesContext.Provider
      value={{
        messages,
        unreadCount,
        loading,
        refreshMessages,
        markAsRead,
        markAsUnread,
        sendReply,
        deleteMessage,
        createTestMessage,
      }}
    >
      {children}
    </ContactMessagesContext.Provider>
  );
}

export function useContactMessages() {
  const context = useContext(ContactMessagesContext);
  if (context === undefined) {
    throw new Error('useContactMessages must be used within a ContactMessagesProvider');
  }
  return context;
}