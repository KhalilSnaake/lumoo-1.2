import { useNotifications } from '../context/NotificationContext';
import { NotificationType } from '../types/notifications';

interface NotificationMenuProps {
  onClose: () => void;
  onNavigate: (orderId: string) => void;
}

export default function NotificationMenu({ onClose, onNavigate }: NotificationMenuProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  const typeIcons: Record<NotificationType, string> = {
    new_order: '📦',
    assignment: '🛵',
    status_change: '🔄',
    general: '🔔'
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    return date.toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleNotifClick = (n: any) => {
    if (!n.read) markAsRead(n.id);
    if (n.orderId) {
      onNavigate(n.orderId);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end sm:p-4">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white w-full sm:w-[400px] sm:rounded-3xl shadow-2xl animate-slide-in h-full sm:h-[600px] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h3 className="font-black text-gray-800 text-lg">Notifications</h3>
            {unreadCount > 0 && <p className="text-xs text-green-600 font-bold">{unreadCount} non lue(s)</p>}
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button 
                onClick={() => markAllAsRead()}
                className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg transition-all"
              >
                Tout lire
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-300">
              <span className="text-6xl mb-4">🔔</span>
              <p className="font-bold">Aucune notification</p>
            </div>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => handleNotifClick(n)}
                className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${n.read ? 'bg-white border-gray-100 opacity-80' : 'bg-white border-green-200 shadow-md ring-1 ring-green-100'}`}
              >
                {!n.read && <div className="absolute top-4 right-4 w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${n.read ? 'bg-gray-100' : 'bg-green-100'}`}>
                    {typeIcons[n.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${n.read ? 'font-semibold text-gray-700' : 'font-black text-gray-900'}`}>{n.title}</p>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{fmtDate(n.createdAt)}</span>
                      <div className="flex items-center gap-3">
                        {n.orderId && <span className="text-[9px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">Détails →</span>}
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-all text-xs text-red-400 hover:text-red-600 font-bold"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
