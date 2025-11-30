import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, HardDrive, Trash2, Files, Download, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const AdminPanel = ({ onChatToggle }) => {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/users`),
        axios.get(`${API}/admin/stats`),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Tem certeza que deseja deletar o usuário ${username}?`)) {
      return;
    }

    try {
      await axios.delete(`${API}/admin/users/${userId}`);
      toast.success("Usuário deletado com sucesso!");
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao deletar usuário");
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API}/admin/download-all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_completo_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Backup baixado com sucesso!");
    } catch (error) {
      toast.error("Erro ao baixar arquivos");
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSourceCode = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API}/admin/download-source-code`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codigo_fonte_site.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Código-fonte baixado com sucesso!");
    } catch (error) {
      toast.error("Erro ao baixar código-fonte");
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
                <p className="text-2xl font-bold text-gray-900" data-testid="total-users">{stats?.total_users || 0}</p>
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
                <p className="text-2xl font-bold text-gray-900" data-testid="total-files">{stats?.total_files || 0}</p>
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
                <p className="text-2xl font-bold text-gray-900" data-testid="total-storage">{stats?.total_storage_mb || 0} MB</p>
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
            <div className="space-y-2">
              <Button
                onClick={handleDownloadAll}
                disabled={downloading}
                className="w-full bg-purple-600 hover:bg-purple-700"
                data-testid="download-all-button"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloading ? "Baixando..." : "Baixar Todos os Arquivos"}
              </Button>
              <p className="text-xs text-gray-500">
                Backup de todos os arquivos dos usuários organizados por pasta.
              </p>
            </div>
            
            <div className="space-y-2">
              <Button
                onClick={handleDownloadSourceCode}
                className="w-full bg-blue-600 hover:bg-blue-700"
                data-testid="download-source-code-button"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar Código-Fonte do Site
              </Button>
              <p className="text-xs text-gray-500">
                Download completo do código-fonte (frontend + backend).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="glass border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{fontFamily: 'Manrope'}}>
            <Users className="w-5 h-5" />
            Gerenciar Usuários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table data-testid="users-table">
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                  <TableCell className="font-medium" data-testid={`user-username-${user.id}`}>{user.username}</TableCell>
                  <TableCell>
                    {user.role === "admin" ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800" data-testid={`user-role-${user.id}`}>
                        <Shield className="w-3 h-3 mr-1" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800" data-testid={`user-role-${user.id}`}>
                        Usuário
                      </span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`user-created-${user.id}`}>
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== "admin" && (
                      <Button
                        data-testid={`delete-user-button-${user.id}`}
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteUser(user.id, user.username)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Deletar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
