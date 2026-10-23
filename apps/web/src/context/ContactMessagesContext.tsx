import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getSupabase } from '@lumoo/core';
import type { ContactMessage } from '@lumoo/core';
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
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Fetch messages from Supabase
  const fetchMessages = useCallback(async () => {
    const supabase = getSupabase();
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contact messages:', error);
        showToast('Impossible de charger les messages : ' + error.message, 'error');
        return;
      }

      const normalized = (data || []).map((m: any) => ({
        ...m,
        is_read: m.is_read ?? false,
      }));
      setMessages(normalized);
    } catch (error) {
      console.error('Unexpected error fetching contact messages:', error);
      showToast('Impossible de charger les messages. Vérifiez votre connexion.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Initial fetch on mount
  useEffect(() => {
    void fetchMessages();
    return () => {};
  }, []);

  // Real-time subscription for new messages
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel('contact_messages_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'contact_messages' },
        (payload) => {
          setMessages(prev => prev.some(message => message.id === payload.new.id)
            ? prev
            : [{ ...payload.new, is_read: false } as ContactMessage, ...prev]);
          showToast('Nouveau message reçu.', 'info');
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
    const supabase = getSupabase();
    const { error } = await supabase
      .from('contact_messages')
      .update({ is_read: true })
      .eq('id', messageId);

    if (error) throw new Error(error.message || 'Le message n’a pas pu être marqué comme lu.');
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, is_read: true } : msg
    ));
  };

  const markAsUnread = async (messageId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('contact_messages')
      .update({ is_read: false })
      .eq('id', messageId);

    if (error) throw new Error(error.message || 'Le message n’a pas pu être marqué comme non lu.');
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, is_read: false } : msg
    ));
  };

  const sendReply = async (messageId: string, response: string) => {
    const supabase = getSupabase();
    const respondedAt = new Date().toISOString();
    const { error } = await supabase
      .from('contact_messages')
      .update({
        response,
        responded_at: respondedAt,
        is_read: true,
      })
      .eq('id', messageId);

    if (error) throw new Error(error.message || 'La réponse n’a pas pu être enregistrée.');
    setMessages(prev => prev.map(msg =>
      msg.id === messageId
        ? { ...msg, response, responded_at: respondedAt, is_read: true }
        : msg
    ));
  };

  const deleteMessage = async (messageId: string) => {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('contact_messages')
      .delete()
      .eq('id', messageId);

    if (error) throw new Error(error.message || 'Le message n’a pas pu être supprimé.');
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const createTestMessage = async () => {
    const supabase = getSupabase();
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