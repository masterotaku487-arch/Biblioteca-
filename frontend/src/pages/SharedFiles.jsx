import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Share2, 
  Download,
  ArrowLeft,
  User,
  Calendar,
  HardDrive,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  RefreshCw,
  Inbox,
  AlertCircle,
  Eye,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { files as filesAPI } from "@/services/api";

const SharedFiles = ({ user }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadSharedFiles();
  }, []);

  const loadSharedFiles = async () => {
    setLoading(true);
    try {
      const response = await filesAPI.getSharedFiles();
      setFiles(response.data);
    } catch (error) {
      console.error("Error loading shared files:", error);
      toast.error("Erro ao carregar arquivos compartilhados");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleDownload = async (fileId, fileName, hasPassword) => {
    if (hasPassword) {
      const password = window.prompt(`Digite a senha para "${fileName}":`);
      if (!password) {
        toast.error("Senha não fornecida");
        return;
      }

      try {
        await filesAPI.downloadFile(fileId, password);
        toast.success("Download concluído! ✅");
      } catch (error) {
        if (error.response?.status === 401) {
          toast.error("Senha incorreta! 🔒");
        } else {
          toast.error("Erro ao baixar arquivo");
        }
      }
    } else {
      try {
        await filesAPI.downloadFile(fileId);
        toast.success("Download concluído! ✅");
      } catch (error) {
        toast.error("Erro ao baixar arquivo");
      }
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getFileIcon = (fileType) => {
    if (!fileType) return File;
    if (fileType.startsWith('image/')) return ImageIcon;
    if (fileType.startsWith('video/')) return Video;
    if (fileType.startsWith('audio/')) return Music;
    if (fileType.includes('pdf') || fileType.includes('document')) return FileText;
    return File;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filtrar arquivos pela busca
  const filteredFiles = files.filter(file => 
    file.original_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    file.uploaded_by_username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando arquivos compartilhados...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      
      {/* Header */}
      <header className="glass border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            
            {/* Left Side */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Share2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Compartilhados Comigo
                  </h1>
                  <p className="text-sm text-gray-600">
                    {filteredFiles.length} arquivo(s) compartilhado(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              <Button
                onClick={loadSharedFiles}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        
        {/* Info Card */}
        <Card className="glass border-2 border-blue-200 shadow-lg mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">
                  Sobre Arquivos Compartilhados
                </h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <Eye className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Você pode <strong>visualizar e baixar</strong> arquivos compartilhados com você</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Se o arquivo tiver senha, você precisará digitá-la para baixar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <User className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>Você <strong>não pode deletar</strong> arquivos compartilhados, apenas o dono pode</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        {files.length > 0 && (
          <Card className="glass border-0 shadow-lg mb-6">
            <CardContent className="p-4">
              <div className="relative">
                <Input
                  placeholder="Buscar por nome do arquivo ou pessoa que compartilhou..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                <Share2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 mt-2">
                  {filteredFiles.length} resultado(s) encontrado(s)
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {files.length === 0 ? (
          <Card className="glass border-0 shadow-xl">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-6">
                  <Inbox className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Nenhum Arquivo Compartilhado
                </h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Quando alguém compartilhar arquivos com você, eles aparecerão aqui.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => navigate("/")}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar para Dashboard
                  </Button>
                  <Button
                    onClick={() => navigate("/teams")}
                    variant="outline"
                  >
                    Ver Times
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : filteredFiles.length === 0 ? (
          // Search Empty State
          <Card className="glass border-0 shadow-xl">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Share2 className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Nenhum resultado encontrado
                </h3>
                <p className="text-gray-600 mb-4">
                  Tente buscar por outro termo
                </p>
                <Button
                  onClick={() => setSearchQuery("")}
                  variant="outline"
                  size="sm"
                >
                  Limpar busca
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Files Table
          <Card className="glass border-0 shadow-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Arquivos Compartilhados
              </CardTitle>
              <CardDescription>
                Arquivos que outras pessoas compartilharam com você
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Compartilhado por</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFiles.map((file) => {
                      const Icon = getFileIcon(file.file_type);
                      
                      return (
                        <TableRow key={file.id} className="hover:bg-gray-50">
                          
                          {/* File Name */}
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center border-2 border-blue-200">
                                <Icon className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900 truncate">
                                  {file.original_name}
                                </p>
                                {file.has_password && (
                                  <Badge variant="outline" className="mt-1">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Protegido
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Shared By */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                                {file.uploaded_by_username?.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm text-gray-700">
                                {file.uploaded_by_username}
                              </span>
                            </div>
                          </TableCell>

                          {/* File Size */}
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <HardDrive className="w-4 h-4" />
                              {formatFileSize(file.file_size)}
                            </div>
                          </TableCell>

                          {/* Date */}
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Calendar className="w-4 h-4" />
                              {formatDate(file.uploaded_at)}
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Button
                              onClick={() => handleDownload(file.id, file.original_name, file.has_password)}
                              size="sm"
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Baixar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default SharedFiles;
