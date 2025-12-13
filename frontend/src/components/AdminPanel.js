import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Shield, 
  Users, 
  HardDrive, 
  Trash2, 
  Files, 
  Download, 
  MessageCircle,
  Crown,
  TrendingUp,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  UserPlus,
  UserMinus,
  Calendar,
  DollarSign,
  Bug,
  BarChart3,
  RefreshCw,
  Search,
  Filter
} from "lucide-react";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// API Service
import { admin as adminAPI, chat as chatAPI } from "@/services/api";

const AdminPanel = ({ onChatToggle, refreshData }) => {
  // ============================================================================
  // STATE
  // ============================================================================
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  
  // Dialog states
  const [selectedUser, setSelectedUser] = useState(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradeDays, setUpgradeDays] = useState(30);

  const navigate = useNavigate();

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  useEffect(() => {
    loadAllData();
  }, []);

  // Auto-refresh a cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllData(true); // silent refresh
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    
    try {
      const [usersRes, statsRes, bugsRes] = await Promise.all([
        adminAPI.getAllUsers(),
        adminAPI.getStats(),
        adminAPI.getBugReports()
      ]);
      
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setBugs(bugsRes.data);
      
      if (!silent) {
        toast.success("Dados carregados! ✅");
      }
    } catch (error) {
      console.error("Error loading admin data:", error);
      toast.error("Erro ao carregar dados administrativos");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS - USER MANAGEMENT
  // ============================================================================

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(
      `⚠️ ATENÇÃO: Deletar o usuário "${username}"?\n\n` +
      `Isso irá:\n` +
      `• Deletar TODOS os arquivos do usuário\n` +
      `• Remover de todos os times\n` +
      `• Deletar todos os compartilhamentos\n` +
      `• Esta ação NÃO pode ser desfeita!\n\n` +
      `Digite "DELETAR" para confirmar`
    )) {
      return;
    }

    const confirmation = window.prompt('Digite "DELETAR" para confirmar:');
    if (confirmation !== "DELETAR") {
      toast.error("Operação cancelada");
      return;
    }

    try {
      await adminAPI.deleteUser(userId);
      toast.success(`Usuário ${username} deletado com sucesso!`);
      await loadAllData();
      if (refreshData) refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao deletar usuário");
    }
  };

  const handleUpgradeUser = async () => {
    if (!selectedUser) return;

    try {
      await adminAPI.upgradeUser(selectedUser.id, upgradeDays);
      toast.success(
        `${selectedUser.username} foi promovido para Premium por ${upgradeDays} dias! 👑`
      );
      setUpgradeDialogOpen(false);
      setSelectedUser(null);
      await loadAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao fazer upgrade");
    }
  };

  const handleDowngradeUser = async (userId, username) => {
    if (!window.confirm(`Remover Premium de ${username}?`)) {
      return;
    }

    try {
      await adminAPI.downgradeUser(userId);
      toast.success(`${username} foi movido para plano Free`);
      await loadAllData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao fazer downgrade");
    }
  };

  // ============================================================================
  // HANDLERS - DOWNLOADS
  // ============================================================================

  const handleDownloadAllFiles = async () => {
    setDownloading(true);
    try {
      toast.loading("Preparando backup completo...", { id: "backup" });
      
      const response = await adminAPI.downloadAllFiles();
      
      // Criar blob e fazer download
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_completo_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Backup baixado com sucesso! 📦", { id: "backup" });
    } catch (error) {
      toast.error("Erro ao baixar arquivos", { id: "backup" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSourceCode = async () => {
    try {
      toast.loading("Preparando código-fonte...", { id: "source" });
      
      const response = await adminAPI.downloadSourceCode();
      
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codigo_fonte_biblioteca.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Código-fonte baixado! 💻", { id: "source" });
    } catch (error) {
      toast.error("Erro ao baixar código-fonte", { id: "source" });
    }
  };

  // ============================================================================
  // HANDLERS - CHAT
  // ============================================================================

  const handleToggleChat = async () => {
    try {
      const newStatus = !stats?.chat_enabled;
      await chatAPI.toggleChat(newStatus);
      toast.success(`Chat ${newStatus ? "ativado" : "desativado"}! 💬`);
      await loadAllData();
      if (onChatToggle) onChatToggle();
    } catch (error) {
      toast.error("Erro ao alterar status do chat");
    }
  };

  // ============================================================================
  // HANDLERS - BUGS
  // ============================================================================

  const handleResolveBug = async (bugId, title) => {
    try {
      await adminAPI.resolveBug(bugId);
      toast.success(`Bug "${title}" marcado como resolvido! ✅`);
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao resolver bug");
    }
  };

  const handleDeleteBug = async (bugId) => {
    if (!window.confirm("Deletar este bug report?")) return;

    try {
      await adminAPI.deleteBug(bugId);
      toast.success("Bug report deletado");
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao deletar bug");
    }
  };

  // ============================================================================
  // FILTERS
  // ============================================================================

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesPlan = planFilter === "all" || user.plan === planFilter;
    
    return matchesSearch && matchesRole && matchesPlan;
  });
  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="flex justify-center py-12" data-testid="admin-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando painel administrativo...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      
      {/* ================================================ */}
      {/* HEADER */}
      {/* ================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-yellow-500" />
            Painel Administrativo
          </h2>
          <p className="text-gray-500 mt-1">
            Gerenciar usuários, estatísticas e configurações do sistema
          </p>
        </div>
        <Button
          onClick={() => loadAllData()}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      {/* ================================================ */}
      {/* TABS */}
      {/* ================================================ */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Usuários ({filteredUsers.length})
          </TabsTrigger>
          <TabsTrigger value="bugs" className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Bugs ({bugs.filter(b => b.status === 'pending').length})
            {bugs.filter(b => b.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {bugs.filter(b => b.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ================================================ */}
        {/* TAB: OVERVIEW */}
        {/* ================================================ */}
        <TabsContent value="overview" className="space-y-6">
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Users */}
            <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow" data-testid="stats-users">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total de Usuários</p>
                    <p className="text-3xl font-bold text-gray-900" data-testid="total-users">
                      {stats?.users?.total || 0}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        Free: {stats?.users?.free || 0}
                      </Badge>
                      <Badge className="text-xs bg-purple-600">
                        Premium: {stats?.users?.premium || 0}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Files */}
            <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow" data-testid="stats-files">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Files className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Total de Arquivos</p>
                    <p className="text-3xl font-bold text-gray-900" data-testid="total-files">
                      {stats?.files?.active || 0}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        Ativos: {stats?.files?.active || 0}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        Lixeira: {stats?.files?.deleted || 0}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage */}
            <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow" data-testid="stats-storage">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                    <HardDrive className="w-6 h-6 text-pink-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Armazenamento</p>
                    <p className="text-3xl font-bold text-gray-900" data-testid="total-storage">
                      {stats?.storage?.total_gb?.toFixed(2) || 0} GB
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats?.storage?.total_mb?.toFixed(0) || 0} MB usados
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chat Status */}
            <Card className="glass border-0 shadow-lg hover:shadow-xl transition-shadow" data-testid="stats-chat">
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
                    <p className="text-sm text-gray-600 font-medium">Status do Chat</p>
                    <p className="text-2xl font-bold text-gray-900" data-testid="chat-status">
                      {stats?.chat_enabled ? "Ativado" : "Desativado"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleToggleChat}
                      className="mt-2"
                    >
                      {stats?.chat_enabled ? "Desativar" : "Ativar"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Admin Actions */}
          <Card className="glass border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-yellow-500" />
                Ações Administrativas
              </CardTitle>
              <CardDescription>
                Ferramentas e utilitários para gerenciar o sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Download All Files */}
                <div className="space-y-2">
                  <Button
                    onClick={handleDownloadAllFiles}
                    disabled={downloading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    data-testid="download-all-button"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {downloading ? "Baixando..." : "Backup Completo"}
                  </Button>
                  <p className="text-xs text-gray-500">
                    Baixar todos os arquivos organizados por usuário
                  </p>
                </div>
                
                {/* Download Source Code */}
                <div className="space-y-2">
                  <Button
                    onClick={handleDownloadSourceCode}
                    className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    data-testid="download-source-code-button"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Código-Fonte
                  </Button>
                  <p className="text-xs text-gray-500">
                    Download do código completo (frontend + backend)
                  </p>
                </div>

                {/* View Bug Reports */}
                <div className="space-y-2">
                  <Button
                    onClick={() => setActiveTab("bugs")}
                    variant="outline"
                    className="w-full"
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    Ver Bug Reports
                    {bugs.filter(b => b.status === 'pending').length > 0 && (
                      <Badge variant="destructive" className="ml-2">
                        {bugs.filter(b => b.status === 'pending').length}
                      </Badge>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500">
                    Gerenciar relatórios de bugs dos usuários
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Compartilhamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.shares || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Total de compartilhamentos ativos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Times
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.teams || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Times criados no sistema</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  Bugs Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats?.pending_bugs || 0}</p>
                <p className="text-xs text-gray-500 mt-1">Aguardando resolução</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* ================================================ */}
        {/* TAB: USERS */}
        {/* ================================================ */}
        <TabsContent value="users" className="space-y-6">
          
          {/* Filters and Search */}
          <Card className="glass border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por username ou email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Role Filter */}
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filtrar por cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os cargos</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                  </SelectContent>
                </Select>

                {/* Plan Filter */}
                <Select value={planFilter} onValueChange={setPlanFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filtrar por plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os planos</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results Count */}
              <div className="mt-4 text-sm text-gray-600">
                Mostrando <span className="font-semibold">{filteredUsers.length}</span> de{" "}
                <span className="font-semibold">{users.length}</span> usuários
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="glass border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Gerenciar Usuários
              </CardTitle>
              <CardDescription>
                Visualizar, editar e gerenciar contas de usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table data-testid="users-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Arquivos</TableHead>
                      <TableHead>Storage</TableHead>
                      <TableHead>Data de Criação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                          
                          {/* Username */}
                          <TableCell className="font-medium" data-testid={`user-username-${user.id}`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                                user.role === 'admin' 
                                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                                  : user.plan === 'premium'
                                    ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                              }`}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <span>{user.username}</span>
                            </div>
                          </TableCell>

                          {/* Email */}
                          <TableCell className="text-sm text-gray-600">
                            {user.email || (
                              <span className="text-gray-400 italic">Sem email</span>
                            )}
                          </TableCell>

                          {/* Plan */}
                          <TableCell>
                            {user.plan === "premium" ? (
                              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                                <Crown className="w-3 h-3 mr-1" />
                                Premium
                              </Badge>
                            ) : (
                              <Badge variant="outline">Free</Badge>
                            )}
                          </TableCell>

                          {/* Role */}
                          <TableCell>
                            {user.role === "admin" ? (
                              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500" data-testid={`user-role-${user.id}`}>
                                <Shield className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary" data-testid={`user-role-${user.id}`}>
                                Usuário
                              </Badge>
                            )}
                          </TableCell>

                          {/* Files Count */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Files className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">{user.file_count || 0}</span>
                            </div>
                          </TableCell>

                          {/* Storage Used */}
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <HardDrive className="w-4 h-4 text-gray-400" />
                              <span className="text-sm">
                                {((user.storage_used || 0) / (1024 * 1024)).toFixed(1)} MB
                              </span>
                            </div>
                          </TableCell>

                          {/* Created At */}
                          <TableCell className="text-sm text-gray-600" data-testid={`user-created-${user.id}`}>
                            {new Date(user.created_at).toLocaleDateString("pt-BR", {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            {user.role !== "admin" ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    data-testid={`user-actions-${user.id}`}
                                  >
                                    Ações
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Gerenciar Usuário</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  
                                  {/* View Details */}
                                  <DropdownMenuItem 
                                    onClick={() => navigate(`/admin/user/${user.id}`)}
                                  >
                                    <Activity className="w-4 h-4 mr-2" />
                                    Ver Detalhes
                                  </DropdownMenuItem>

                                  {/* Upgrade/Downgrade */}
                                  {user.plan === "free" ? (
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setUpgradeDialogOpen(true);
                                      }}
                                    >
                                      <UserPlus className="w-4 h-4 mr-2 text-purple-600" />
                                      Fazer Upgrade
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem 
                                      onClick={() => handleDowngradeUser(user.id, user.username)}
                                    >
                                      <UserMinus className="w-4 h-4 mr-2 text-orange-600" />
                                      Fazer Downgrade
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator />

                                  {/* Delete */}
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUser(user.id, user.username)}
                                    className="text-red-600 focus:text-red-600"
                                    data-testid={`delete-user-button-${user.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Deletar Usuário
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Protegido
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================ */}
        {/* TAB: BUGS */}
        {/* ================================================ */}
        <TabsContent value="bugs" className="space-y-6">
          
          <Card className="glass border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" />
                Relatórios de Bugs
              </CardTitle>
              <CardDescription>
                Gerenciar e resolver bugs reportados pelos usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bugs.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-700">
                    Nenhum bug reportado! 🎉
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Todos os bugs foram resolvidos ou não há reportes ainda
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bugs.map((bug) => (
                    <Card 
                      key={bug.id} 
                      className={`border-l-4 ${
                        bug.status === 'pending' 
                          ? 'border-l-red-500 bg-red-50/50'
                          : bug.status === 'analyzing'
                            ? 'border-l-yellow-500 bg-yellow-50/50'
                            : 'border-l-green-500 bg-green-50/50'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          
                          {/* Bug Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge 
                                variant={bug.status === 'pending' ? 'destructive' : bug.status === 'resolved' ? 'success' : 'warning'}
                              >
                                {bug.status === 'pending' && <AlertCircle className="w-3 h-3 mr-1" />}
                                {bug.status === 'resolved' && <CheckCircle className="w-3 h-3 mr-1" />}
                                {bug.status === 'pending' ? 'Pendente' : bug.status === 'resolved' ? 'Resolvido' : 'Analisando'}
                              </Badge>
                              <Badge variant="outline">{bug.category}</Badge>
                            </div>

                            <h4 className="font-semibold text-gray-900 mb-1">
                              {bug.title}
                            </h4>
                            
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {bug.description}
                            </p>

                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {bug.username}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(bug.created_at).toLocaleDateString("pt-BR")}
                              </span>
                              {bug.email && (
                                <span className="flex items-center gap-1">
                                  📧 {bug.email}
                                </span>
                              )}
                            </div>

                            {/* Browser Info */}
                            {bug.browser_info && (
                              <details className="mt-3">
                                <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                  Ver informações técnicas
                                </summary>
                                <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-x-auto">
                                  {JSON.stringify(bug.browser_info, null, 2)}
                                </pre>
                              </details>
                            )}

                            {/* Steps to Reproduce */}
                            {bug.steps_to_reproduce && (
                              <div className="mt-3 text-sm">
                                <p className="font-medium text-gray-700">Passos para reproduzir:</p>
                                <p className="text-gray-600 mt-1">{bug.steps_to_reproduce}</p>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2">
                            {bug.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() => handleResolveBug(bug.id, bug.title)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Resolver
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteBug(bug.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Deletar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================================================ */}
      {/* UPGRADE USER DIALOG */}
      {/* ================================================ */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-600" />
              Fazer Upgrade para Premium
            </DialogTitle>
            <DialogDescription>
              Promover <span className="font-semibold">{selectedUser?.username}</span> para Premium
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Duração do Premium (dias)
              </label>
              <Input
                type="number"
                min="1"
                max="365"
                value={upgradeDays}
                onChange={(e) => setUpgradeDays(parseInt(e.target.value) || 30)}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                O usuário terá acesso Premium por {upgradeDays} dias
              </p>
            </div>

            {/* Quick Options */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUpgradeDays(7)}
              >
                7 dias
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUpgradeDays(30)}
              >
                30 dias
              </Button>
              <Button
                size="sm"
   variant="outline"
                onClick={() => setUpgradeDays(90)}
              >
                90 dias
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUpgradeDays(365)}
              >
                1 ano
              </Button>
            </div>

            <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-900">
                <strong>Benefícios Premium:</strong>
              </p>
              <ul className="text-xs text-purple-800 mt-2 space-y-1 list-disc list-inside">
                <li>5 GB de armazenamento</li>
                <li>Arquivos ilimitados</li>
                <li>Criar e participar de times</li>
                <li>Lixeira de 30 dias</li>
                <li>Busca avançada</li>
                <li>Tema escuro</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUpgradeDialogOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleUpgradeUser}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Crown className="w-4 h-4 mr-2" />
              Confirmar Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;