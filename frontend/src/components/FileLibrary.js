import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API } from "@/App";
import { Upload, Download, Trash2, File, Image, Video, Music, FileText, Search, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const FileLibrary = ({ files, loading, uploading, onUpload, onDelete, isAdmin }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalFile, setPasswordModalFile] = useState(null);
  const [filePassword, setFilePassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const fileInputRef = useRef(null);

  const filteredFiles = files.filter((file) =>
    file.original_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setUploadFiles(selectedFiles);
      setShowPasswordModal(true);
    }
    e.target.value = "";
  };

  const handleUploadWithPasswords = () => {
    const passwords = uploadFiles.map((_, index) => {
      const input = document.getElementById(`file-password-${index}`);
      return input ? input.value : "";
    });
    onUpload(uploadFiles, passwords);
    setUploadFiles([]);
    setShowPasswordModal(false);
  };

  const handleDownload = async (file) => {
    // If file has password and user is not admin, ask for password first
    if (file.has_password && !isAdmin) {
      setPasswordModalFile(file);
      return;
    }

    // Download directly
    await downloadFile(file);
  };

  const verifyAndDownload = async () => {
    if (!passwordModalFile) return;

    setVerifying(true);
    try {
      // Verify password
      const response = await axios.post(`${API}/files/${passwordModalFile.id}/verify-password`, {
        password: filePassword
      });

      if (response.data.valid) {
        await downloadFile(passwordModalFile);
        setPasswordModalFile(null);
        setFilePassword("");
      } else {
        toast.error("Senha incorreta!");
      }
    } catch (error) {
      toast.error("Erro ao verificar senha");
    } finally {
      setVerifying(false);
    }
  };

  const downloadFile = async (file) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API}/files/${file.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Download concluído!");
    } catch (error) {
      toast.error("Erro ao fazer download");
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith("image/")) return <Image className="w-8 h-8 text-pink-500" />;
    if (fileType.startsWith("video/")) return <Video className="w-8 h-8 text-purple-500" />;
    if (fileType.startsWith("audio/")) return <Music className="w-8 h-8 text-blue-500" />;
    if (fileType.includes("text") || fileType.includes("pdf")) return <FileText className="w-8 h-8 text-green-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="glass border-0 shadow-lg" data-testid="upload-section">
        <CardContent className="p-6">
          <div
            className="file-upload-area border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-purple-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-area"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700 mb-2">Clique para fazer upload</p>
            <p className="text-sm text-gray-500">Ou arraste e solte seus arquivos aqui</p>
            <p className="text-xs text-gray-400 mt-2">Arquivos privados - apenas você e o admin podem ver</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="file-input"
            />
          </div>
          {uploading && (
            <div className="mt-4 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" data-testid="upload-spinner"></div>
              <p className="mt-2 text-sm text-gray-600">Enviando arquivos...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Modal for Upload */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent data-testid="upload-password-modal">
          <DialogHeader>
            <DialogTitle>Proteger Arquivos com Senha (Opcional)</DialogTitle>
            <DialogDescription>
              Adicione senhas aos seus arquivos para maior segurança. Deixe em branco para não proteger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {uploadFiles.map((file, index) => (
              <div key={index} className="space-y-2">
                <Label htmlFor={`file-password-${index}`} className="text-sm font-medium">
                  {file.name}
                </Label>
                <Input
                  id={`file-password-${index}`}
                  type="password"
                  placeholder="Senha (opcional)"
                  data-testid={`file-password-input-${index}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadFiles([]);
              setShowPasswordModal(false);
            }}>
              Cancelar
            </Button>
            <Button onClick={handleUploadWithPasswords} data-testid="confirm-upload-button">
              Fazer Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Modal for Download */}
      <Dialog open={passwordModalFile !== null} onOpenChange={() => {
        setPasswordModalFile(null);
        setFilePassword("");
      }}>
        <DialogContent data-testid="download-password-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-purple-600" />
              Arquivo Protegido
            </DialogTitle>
            <DialogDescription>
              Este arquivo está protegido com senha. Digite a senha para baixar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">{passwordModalFile?.original_name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="download-password">Senha</Label>
              <Input
                id="download-password"
                type="password"
                placeholder="Digite a senha"
                value={filePassword}
                onChange={(e) => setFilePassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && verifyAndDownload()}
                data-testid="download-password-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setPasswordModalFile(null);
              setFilePassword("");
            }}>
              Cancelar
            </Button>
            <Button onClick={verifyAndDownload} disabled={verifying || !filePassword} data-testid="verify-password-button">
              {verifying ? "Verificando..." : "Baixar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            data-testid="search-input"
            type="text"
            placeholder="Buscar arquivos..."
            className="pl-10 glass border-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="text-sm text-gray-600" data-testid="file-count">
          {filteredFiles.length} arquivo(s)
        </div>
      </div>

      {/* Files Grid */}
      {loading ? (
        <div className="flex justify-center py-12" data-testid="loading-spinner">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card className="glass border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <File className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500" data-testid="no-files-message">
              {searchQuery ? "Nenhum arquivo encontrado" : "Nenhum arquivo na sua biblioteca"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="files-grid">
          {filteredFiles.map((file) => (
            <Card key={file.id} className="glass border-0 shadow-lg hover:shadow-xl transition-shadow" data-testid={`file-card-${file.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col items-center text-center mb-4">
                  <div className="relative">
                    {getFileIcon(file.file_type)}
                    {file.has_password && (
                      <Lock className="w-3 h-3 text-purple-600 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <h3 className="mt-3 font-medium text-sm text-gray-900 break-all line-clamp-2" data-testid={`file-name-${file.id}`}>
                    {file.original_name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1" data-testid={`file-size-${file.id}`}>{formatFileSize(file.file_size)}</p>
                  <p className="text-xs text-gray-400 mt-1" data-testid={`file-uploader-${file.id}`}>por {file.uploaded_by}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid={`download-button-${file.id}`}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleDownload(file)}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Baixar
                  </Button>
                  {isAdmin && onDelete && (
                    <Button
                      data-testid={`delete-button-${file.id}`}
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(file.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileLibrary;
