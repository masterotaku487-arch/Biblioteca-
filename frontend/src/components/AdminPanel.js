import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Users, HardDrive, Files, MessageCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const AdminPanel = ({ onChatToggle }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem("token");
      const statsRes = await axios.get(`${API}/admin/stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setStats(statsRes.data);
      toast.success("Dados carregados com sucesso!");
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do painel");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChat = async () => {
    try {
      const token = localStorage.getItem("token");
      const newStatus = !stats?.chat_enabled;
      
      await axios.post(
        `${API}/admin/chat/toggle`,
        { enabled: newStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      toast.success(`Chat ${newStatus ? "ativado" : "desativado"} com sucesso!`);
      loadData(); // Recarregar dados
      
      if (onChatToggle) {
        onChatToggle(newStatus);
      }
    } catch (error) {
      console.error("Erro ao alternar chat:", error);
      toast.error("Erro ao alterar status do chat");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12" data-testid="admin-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aviso de manutenção Google OAuth */}
      <Alert className="bg-orange-50 border-orange-300">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <strong>Login Google em Manutenção:</strong> O sistema de autenticação via Google OAuth 
          está temporariamente desabilitado. Os usuários devem usar login tradicional.
        </AlertDescription>
      </Alert>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass border-0 shadow-lg" data-testid="stats-users">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Usuários</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-users">
                  {stats?.total_users || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-0 shadow-lg" data-testid="stats-files">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Files className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Arquivos</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-files">
                  {stats?.total_files || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-0 shadow-lg" data-testid="stats-storage">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Armazenamento</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="total-storage">
                  {stats?.total_storage_mb || 0} MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-0 shadow-lg" data-testid="stats-chat">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                stats?.chat_enabled ? "bg-green-100" : "bg-red-100"
              }`}>
                <MessageCircle className={`w-6 h-6 ${
                  stats?.chat_enabled ? "text-green-600" : "text-red-600"
                }`} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Chat</p>
                <p className="text-lg font-bold text-gray-900" data-testid="chat-status">
                  {stats?.chat_enabled ? "Ativado" : "Desativado"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <Card className="glass border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{fontFamily: 'Manrope'}}>
            <Shield className="w-5 h-5" />
            Ações de Administrador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toggle Chat */}
            <div className="space-y-2">
              <Button
                onClick={handleToggleChat}
                className={`w-full ${
                  stats?.chat_enabled 
                    ? "bg-red-600 hover:bg-red-700" 
                    : "bg-green-600 hover:bg-green-700"
                }`}
                data-testid="toggle-chat-button"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {stats?.chat_enabled ? "Desativar Chat" : "Ativar Chat"}
              </Button>
              <p className="text-xs text-gray-500">
                {stats?.chat_enabled 
                  ? "O chat global está ativo para todos os usuários"
                  : "O chat global está desativado"}
              </p>
            </div>

            {/* Storage Mode */}
            <div className="space-y-2">
              <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Modo de Armazenamento
                  </span>
                </div>
                <p className="text-lg font-bold text-blue-700 mt-1">
                  {stats?.storage_mode === "supabase" ? "☁️ Supabase" : "💾 Local"}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                {stats?.storage_mode === "supabase" 
                  ? "Arquivos armazenados na nuvem (Supabase)"
                  : "Arquivos armazenados localmente no servidor"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="glass border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{fontFamily: 'Manrope'}}>
            <Shield className="w-5 h-5" />
            Informações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Estatísticas Gerais</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de Usuários:</span>
                  <span className="font-semibold">{stats?.total_users || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de Arquivos:</span>
                  <span className="font-semibold">{stats?.total_files || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Armazenamento Total:</span>
                  <span className="font-semibold">{stats?.total_storage_mb || 0} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Armazenamento (GB):</span>
                  <span className="font-semibold">
                    {((stats?.total_storage_mb || 0) / 1024).toFixed(2)} GB
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Configurações Ativas</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Chat Global:</span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    stats?.chat_enabled 
                      ? "bg-green-100 text-green-700" 
                      : "bg-red-100 text-red-700"
                  }`}>
                    {stats?.chat_enabled ? "Ativado" : "Desativado"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Storage Mode:</span>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
                    {stats?.storage_mode === "supabase" ? "Supabase" : "Local"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Login Google:</span>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                    Em Manutenção
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="mt-6 pt-6 border-t">
            <Button
              onClick={loadData}
              variant="outline"
              className="w-full"
              data-testid="refresh-stats-button"
            >
              🔄 Atualizar Estatísticas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
