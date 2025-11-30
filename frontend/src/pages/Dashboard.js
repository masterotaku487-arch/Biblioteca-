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
