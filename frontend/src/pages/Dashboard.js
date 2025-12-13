import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import FileLibrary from "@/components/FileLibrary";
import ChatPanel from "@/components/ChatPanel";
import AdminPanel from "@/components/AdminPanel";
import UserPanel from "@/components/UserPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LogOut, Files, MessageCircle, Shield, User, Crown } from "lucide-react";

const Dashboard = ({ user, onLogout }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(false);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    loadFiles();
    checkChatEnabled();
  }, []);

  const checkChatEnabled = async () => {
    try {
      const response = await axios.get(`${API}/chat/enabled`);
      setChatEnabled(response.data.enabled);
    } catch (error) {
      console.error("Error checking chat status");
    }
  };

  const loadFiles = async () => {
    try {
      const response = await axios.get(`${API}/files`);
      setFiles(response.data);
    } catch (error) {
      toast.error("Erro ao carregar arquivos");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (uploadedFiles, passwords) => {
    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      const password = passwords[i];
      const formData = new FormData();
      formData.append("file", file);
      if (password) {
        formData.append("password", password);
      }

      try {
        await axios.post(`${API}/files/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        successCount++;
      } catch (error) {
        errorCount++;
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} arquivo(s) enviado(s) com sucesso!`);
      loadFiles();
    }

    setUploading(false);
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await axios.delete(`${API}/files/${fileId}`);
      toast.success("Arquivo deletado com sucesso!");
      loadFiles();
    } catch (error) {
      toast.error("Erro ao deletar arquivo");
    }
  };

  // Show chat tab only if enabled or user is admin
  const showChatTab = chatEnabled || isAdmin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <header className="glass border-b border-white/30 sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {isAdmin ? (
              // Admin special avatar with glow and crown
              <div className="relative" data-testid="admin-avatar">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-full blur-md opacity-75 animate-pulse"></div>
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-xl shadow-2xl border-2 border-yellow-300">
                  <Crown className="w-8 h-8 text-white drop-shadow-lg" />
                </div>
              </div>
            ) : (
              // Regular user avatar
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg shadow-lg" data-testid="user-avatar">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 
                  className={`text-xl font-bold ${
                    isAdmin 
                      ? "bg-gradient-to-r from-yellow-500 via-amber-600 to-orange-600 bg-clip-text text-transparent"
                      : "text-gray-900"
                  }`} 
                  style={{fontFamily: 'Manrope'}} 
                  data-testid="dashboard-title"
                >
                  {user?.username}
                </h1>
                {isAdmin && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-2 border-yellow-300 shadow-lg animate-pulse" data-testid="admin-badge">
                    <Crown className="w-3 h-3 mr-1" />
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {isAdmin ? "Administrador do Sistema" : "Biblioteca Privada"}
              </p>
            </div>
          </div>
          <Button
            data-testid="logout-button"
            variant="outline"
            onClick={onLogout}
            className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="glass mb-6">
            <TabsTrigger value="files" className="flex items-center gap-2" data-testid="files-tab">
              <Files className="w-4 h-4" />
              Meus Arquivos
            </TabsTrigger>
            {showChatTab && (
              <TabsTrigger value="chat" className="flex items-center gap-2" data-testid="chat-tab">
                <MessageCircle className="w-4 h-4" />
                Chat
              </TabsTrigger>
            )}
            {isAdmin ? (
              <TabsTrigger value="admin" className="flex items-center gap-2" data-testid="admin-tab">
                <Shield className="w-4 h-4" />
                Painel Admin
              </TabsTrigger>
            ) : (
              <TabsTrigger value="profile" className="flex items-center gap-2" data-testid="profile-tab">
                <User className="w-4 h-4" />
                Meu Painel
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="files" data-testid="files-content">
            <FileLibrary
              files={files}
              loading={loading}
              uploading={uploading}
              onUpload={handleUpload}
              onDelete={isAdmin ? handleDeleteFile : null}
              isAdmin={isAdmin}
            />
          </TabsContent>

          {showChatTab && (
            <TabsContent value="chat" data-testid="chat-content">
              <ChatPanel user={user} chatEnabled={chatEnabled} onChatToggle={checkChatEnabled} />
            </TabsContent>
          )}

          {isAdmin ? (
            <TabsContent value="admin" data-testid="admin-content">
              <AdminPanel onChatToggle={checkChatEnabled} />
            </TabsContent>
          ) : (
            <TabsContent value="profile" data-testid="profile-content">
              <UserPanel user={user} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-sm text-gray-500" data-testid="footer">
        <p>Site desenvolvido por <span className="font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Masterotaku</span></p>
      </footer>
    </div>
  );
};

export default Dashboard;
{/* ================================================ */}
      {/* MAIN CONTENT */}
      {/* ================================================ */}
      <main className="container mx-auto px-4 py-8">
        
        {/* 🆕 NOVO: Warning se próximo do limite (Free users) */}
        {!isPremium && !isAdmin && isNearLimit && (
          <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500 rounded-lg shadow-md">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-1">
                  ⚠️ Armazenamento Quase Cheio!
                </h3>
                <p className="text-sm text-orange-700 mb-3">
                  Você está usando {storagePercentage}% do seu espaço. 
                  Faça upgrade para Premium e ganhe 5 GB de armazenamento!
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate("/upgrade")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Ver Planos Premium
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================ */}
        {/* TABS */}
        {/* ================================================ */}
        <Tabs defaultValue="files" className="w-full">
          
          {/* Tab List */}
          <TabsList className="glass mb-6 p-1 shadow-lg">
            <TabsTrigger 
              value="files" 
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all" 
              data-testid="files-tab"
            >
              <Files className="w-4 h-4" />
              <span className="hidden sm:inline">Meus Arquivos</span>
              <span className="sm:hidden">Arquivos</span>
              {stats?.total_files > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stats.total_files}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger 
              value="shared" 
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all" 
              data-testid="shared-tab"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Compartilhados</span>
              <span className="sm:hidden">Shared</span>
            </TabsTrigger>

            {/* 🆕 Teams Tab */}
            <TabsTrigger 
              value="teams" 
              className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all" 
              data-testid="teams-tab"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Times</span>
              <span className="sm:hidden">Teams</span>
              {!isPremium && !isAdmin && (
                <Crown className="w-3 h-3 text-yellow-500" />
              )}
            </TabsTrigger>

            {/* Chat Tab (se habilitado) */}
            {showChatTab && (
              <TabsTrigger 
                value="chat" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all" 
                data-testid="chat-tab"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Chat</span>
              </TabsTrigger>
            )}

            {/* Admin/User Panel Tab */}
            {isAdmin ? (
              <TabsTrigger 
                value="admin" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all" 
                data-testid="admin-tab"
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Painel Admin</span>
                <span className="sm:hidden">Admin</span>
              </TabsTrigger>
            ) : (
              <TabsTrigger 
                value="profile" 
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-md transition-all" 
                data-testid="profile-tab"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Meu Perfil</span>
                <span className="sm:hidden">Perfil</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* ================================================ */}
          {/* TAB CONTENTS */}
          {/* ================================================ */}

          {/* Meus Arquivos */}
          <TabsContent value="files" data-testid="files-content" className="mt-0">
            <FileLibrary
              files={files}
              loading={loading}
              uploading={uploading}
              onUpload={handleUpload}
              onDelete={handleDeleteFile}
              onDownload={handleDownloadFile}
              onShare={handleShareFile}
              isAdmin={isAdmin}
              isPremium={isPremium}
              user={user}
              stats={stats}
            />
          </TabsContent>

          {/* 🆕 NOVO: Arquivos Compartilhados */}
          <TabsContent value="shared" data-testid="shared-content" className="mt-0">
            <SharedFiles user={user} />
          </TabsContent>

          {/* 🆕 Times */}
          <TabsContent value="teams" data-testid="teams-content" className="mt-0">
            <Teams user={user} isPremium={isPremium} isAdmin={isAdmin} />
          </TabsContent>

          {/* Chat */}
          {showChatTab && (
            <TabsContent value="chat" data-testid="chat-content" className="mt-0">
              <ChatPanel 
                user={user} 
                chatEnabled={chatEnabled} 
                onChatToggle={checkChatEnabled}
                isAdmin={isAdmin}
              />
            </TabsContent>
          )}

          {/* Admin Panel */}
          {isAdmin ? (
            <TabsContent value="admin" data-testid="admin-content" className="mt-0">
              <AdminPanel 
                onChatToggle={checkChatEnabled}
                refreshData={loadInitialData}
              />
            </TabsContent>
          ) : (
            <TabsContent value="profile" data-testid="profile-content" className="mt-0">
              <UserPanel 
                user={user} 
                stats={stats}
                refreshStats={loadUserStats}
                isPremium={isPremium}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* ================================================ */}
      {/* FOOTER */}
      {/* ================================================ */}
      <footer className="mt-auto py-8 border-t border-white/20 backdrop-blur-sm" data-testid="footer">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Copyright */}
            <div className="text-center md:text-left">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                © {new Date().getFullYear()} Biblioteca Privada
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Desenvolvido com 💜 por{" "}
                <span className="font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Masterotaku
                </span>
              </p>
            </div>

            {/* Links */}
            <div className="flex items-center gap-4 text-sm">
              <button
                onClick={() => navigate("/bug-report")}
                className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
              >
                <Bug className="w-4 h-4" />
                Reportar Bug
              </button>
              
              {!isPremium && !isAdmin && (
                <button
                  onClick={() => navigate("/upgrade")}
                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors flex items-center gap-1"
                >
                  <Crown className="w-4 h-4" />
                  Seja Premium
                </button>
              )}

              <button
                onClick={() => navigate("/settings")}
                className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
              >
                <SettingsIcon className="w-4 h-4" />
                Configurações
              </button>
            </div>

            {/* Version */}
            <div className="text-xs text-gray-400 dark:text-gray-600">
              v2.0.0
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
