import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  X,
  Share2,
  Users,
  Crown,
  AlertTriangle,
  FileCheck,
  Trash,
  UserPlus,
  UserMinus,
  MessageCircle,
  Gift,
  Activity,
  Loader2,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/App";

// API
import { notifications as notificationsAPI } from "@/services/api";

const NotificationPanel = () => {
  // ============================================================================
  // STATE
  // ============================================================================
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, unread, read
  const { setUnreadCount, refreshUnreadCount } = useNotifications();
  const navigate = useNavigate();

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    loadNotifications();
  }, []);

  // ============================================================================
  // DATA LOADING
  // ============================================================================
  
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await notificationsAPI.getAll();
      setNotifications(response.data);
      
      // Atualizar contador de não lidas
      const unreadCount = response.data.filter(n => !n.read).length;
      setUnreadCount(unreadCount);
    } catch (error) {
      console.error("Error loading notifications:", error);
      toast.error("Erro ao carregar notificações");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationsAPI.markAsRead(notificationId);
      
      // Atualizar estado local
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      
      // Atualizar contador
      await refreshUnreadCount();
      
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Erro ao marcar como lida");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      
      // Atualizar estado local
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      
      // Atualizar contador
      setUnreadCount(0);
      
      toast.success("Todas marcadas como lidas! ✓");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Erro ao marcar todas como lidas");
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await notificationsAPI.delete(notificationId);
      
      // Remover do estado local
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Atualizar contador
      await refreshUnreadCount();
      
      toast.success("Notificação deletada");
    } catch (error) {
      console.error("Error deleting notification:", error);
      toast.error("Erro ao deletar notificação");
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Deletar todas as notificações?")) return;

    try {
      await notificationsAPI.clearAll();
      setNotifications([]);
      setUnreadCount(0);
      toast.success("Todas as notificações foram deletadas");
    } catch (error) {
      console.error("Error clearing all:", error);
      toast.error("Erro ao limpar notificações");
    }
  };

  const handleNotificationClick = async (notification) => {
    // Marcar como lida se não estiver
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }

    // Navegar baseado no tipo
    switch (notification.type) {
      case "file_share":
        navigate("/shared");
        break;
      case "team_invite":
        navigate("/teams");
        break;
      case "storage_warning":
        navigate("/upgrade");
        break;
      case "premium_activated":
        navigate("/");
        break;
      case "file_restored":
      case "share_revoked":
        navigate("/");
        break;
      default:
        break;
    }
  };

  // ============================================================================
  // FILTERS
  // ============================================================================
  
  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "read") return n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  const getNotificationIcon = (type) => {
    const iconMap = {
      file_share: Share2,
      team_invite: Users,
      team_join: UserPlus,
      team_leave: UserMinus,
      team_removed: UserMinus,
      team_deleted: Trash,
      share_revoked: X,
      storage_warning: AlertTriangle,
      premium_activated: Crown,
      file_restored: FileCheck,
      bug_resolved: Check,
      team_file_added: Activity,
      message: MessageCircle,
    };
    
    return iconMap[type] || Bell;
  };

  const getNotificationColor = (type) => {
    const colorMap = {
      file_share: "text-blue-600 bg-blue-100",
      team_invite: "text-purple-600 bg-purple-100",
      team_join: "text-green-600 bg-green-100",
      team_leave: "text-orange-600 bg-orange-100",
      team_removed: "text-red-600 bg-red-100",
      team_deleted: "text-red-600 bg-red-100",
      share_revoked: "text-red-600 bg-red-100",
      storage_warning: "text-orange-600 bg-orange-100",
      premium_activated: "text-yellow-600 bg-yellow-100",
      file_restored: "text-green-600 bg-green-100",
      bug_resolved: "text-green-600 bg-green-100",
      team_file_added: "text-blue-600 bg-blue-100",
      message: "text-gray-600 bg-gray-100",
    };
    
    return colorMap[type] || "text-gray-600 bg-gray-100";
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return "Agora mesmo";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d atrás`;
    
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (loading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-gray-900">Notificações</h3>
            {unreadCount > 0 && (
              <Badge className="bg-red-500">
                {unreadCount}
              </Badge>
            )}
          </div>

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {unreadCount > 0 && (
                <DropdownMenuItem onClick={handleMarkAllAsRead}>
                  <CheckCheck className="w-4 h-4 mr-2" />
                  Marcar todas como lidas
                </DropdownMenuItem>
              )}
              
              {notifications.length > 0 && (
                <DropdownMenuItem 
                  onClick={handleClearAll}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Limpar todas
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="all" className="text-xs">
              Todas ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Não lidas ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="read" className="text-xs">
              Lidas ({notifications.length - unreadCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Notifications List */}
      <ScrollArea className="h-[400px]">
        {filteredNotifications.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <BellOff className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {filter === "unread" 
                ? "Nenhuma notificação não lida" 
                : filter === "read"
                  ? "Nenhuma notificação lida"
                  : "Nenhuma notificação"}
            </p>
            <p className="text-xs text-gray-500">
              {filter === "all" && "Você será notificado sobre novas atividades aqui"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredNotifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const colorClass = getNotificationColor(notification.type);
              
              return (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer relative group ${
                    !notification.read ? "bg-blue-50/30" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Unread Indicator */}
                  {!notification.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                  )}

                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full ${colorClass} flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className={`text-sm font-semibold mb-1 ${
                            !notification.read ? "text-gray-900" : "text-gray-700"
                          }`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimestamp(notification.created_at)}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification.id);
                              }}
                              className="h-7 w-7 p-0"
                              title="Marcar como lida"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(notification.id);
                            }}
                            className="h-7 w-7 p-0"
                            title="Deletar"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-center text-gray-500">
            {unreadCount > 0 
              ? `${unreadCount} notificação${unreadCount > 1 ? "ões" : ""} não lida${unreadCount > 1 ? "s" : ""}`
              : "Todas as notificações foram lidas ✓"}
          </p>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;