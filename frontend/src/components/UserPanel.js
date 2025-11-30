import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Files, HardDrive, Calendar, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const UserPanel = ({ user }) => {
  const [userStats, setUserStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const response = await axios.get(`${API}/user/stats`);
      setUserStats(response.data);
    } catch (error) {
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12" data-testid="user-panel-loading">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      <Card className="glass border-0 shadow-lg" data-testid="user-profile-card">
        <CardContent className="p-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-4xl shadow-lg">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{fontFamily: 'Manrope'}} data-testid="user-profile-name">
                {user?.username}
              </h2>
              <p className="text-gray-600 flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Usuário
              </p>
              <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Membro desde {new Date(user?.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass border-0 shadow-lg" data-testid="user-stats-files">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Files className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Meus Arquivos</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="user-total-files">{userStats?.total_files || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-0 shadow-lg" data-testid="user-stats-storage">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-pink-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Armazenamento Usado</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="user-storage">{userStats?.total_storage_mb || 0} MB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Info */}
      <Card className="glass border-0 shadow-lg">
        <CardHeader>
          <CardTitle style={{fontFamily: 'Manrope'}}>Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Nome de Usuário</span>
              <span className="font-semibold text-gray-900">{user?.username}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Tipo de Conta</span>
              <span className="font-semibold text-gray-900">Usuário Padrão</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-gray-600">Privacidade</span>
              <span className="font-semibold text-green-600">Arquivos Privados</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600">Total de Arquivos</span>
              <span className="font-semibold text-gray-900">{userStats?.total_files || 0}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserPanel;
