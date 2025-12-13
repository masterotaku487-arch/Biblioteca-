import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Trash2, 
  RotateCcw,
  Trash,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  File,
  Calendar,
  HardDrive,
  RefreshCw,
  ArrowLeft,
  Crown,
  Timer,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { trash as trashAPI } from "@/services/api";

const Trash = ({ user }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);
  const navigate = useNavigate();

  // Verificar se usuário é premium
  const isPremium = user?.plan === "premium" || user?.role === "admin";

  useEffect(() => {
    if (!isPremium) {
      toast.error("Lixeira disponível apenas para Premium", {
        action: {
          label: "Fazer Upgrade",
          onClick: () => navigate("/upgrade")
        }
      });
      navigate("/");
      return;
    }

    loadTrash();
  }, [isPremium]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadTrash = async () => {
    setLoading(true);
    try {
      const response = await trashAPI.getTrash();
      setFiles(response.data);
    } catch (error) {
      console.error("Error loading trash:", error);
      toast.error("Erro ao carregar lixeira");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleRestore = async (fileId, fileName) => {
    try {
      await trashAPI.restoreFile(fileId);
      toast.success(`"${fileName}" restaurado com sucesso! ♻️`);
      setFiles(files.filter(f => f.id !== fileId));
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Erro ao restaurar arquivo";
      toast.error(errorMsg);
    }
  };

  const handlePermanentDelete = async (fileId, fileName) => {
    if (!window.confirm(
      `⚠️ ATENÇÃO: Deletar "${fileName}" permanentemente?\n\n` +
      `Esta ação NÃO pode ser desfeita!\n\n` +
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
      await trashAPI.permanentDelete(fileId);
      toast.success(`"${fileName}" deletado permanentemente`);
      setFiles(files.filter(f => f.id !== fileId));
      setSelectedFiles(selectedFiles.filter(id => id !== fileId));
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Erro ao deletar arquivo";
      toast.error(errorMsg);
    }
  };

  const handleEmptyTrash = async () => {
    setEmptyingTrash(true);
    try {
      await trashAPI.emptyTrash();
      toast.success("Lixeira esvaziada com sucesso! 🗑️");
      setFiles([]);
      setSelectedFiles([]);
      setShowEmptyDialog(false);
    } catch (error) {
      toast.error("Erro ao esvaziar lixeira");
    } finally {
      setEmptyingTrash(false);
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedFiles.length === 0) {
      toast.warning("Selecione arquivos para restaurar");
      return;
    }

    const restorePromises = selectedFiles.map(fileId => {
      const file = files.find(f => f.id === fileId);
      return trashAPI.restoreFile(fileId);
    });

    try {
      await Promise.all(restorePromises);
      toast.success(`${selectedFiles.length} arquivo(s) restaurado(s)! ♻️`);
      setFiles(files.filter(f => !selectedFiles.includes(f.id)));
      setSelectedFiles([]);
    } catch (error) {
      toast.error("Erro ao restaurar alguns arquivos");
      loadTrash(); // Recarregar para sincronizar
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) {
      toast.warning("Selecione arquivos para deletar");
      return;
    }

    if (!window.confirm(
      `⚠️ Deletar ${selectedFiles.length} arquivo(s) permanentemente?\n\n` +
      `Esta ação NÃO pode ser desfeita!\n\n` +
      `Digite "DELETAR" para confirmar`
    )) {
      return;
    }

    const confirmation = window.prompt('Digite "DELETAR" para confirmar:');
    if (confirmation !== "DELETAR") {
      toast.error("Operação cancelada");
      return;
    }

    const deletePromises = selectedFiles.map(fileId => 
      trashAPI.permanentDelete(fileId)
    );

    try {
      await Promise.all(deletePromises);
      toast.success(`${selectedFiles.length} arquivo(s) deletado(s) permanentemente`);
      setFiles(files.filter(f => !selectedFiles.includes(f.id)));
      setSelectedFiles([]);
    } catch (error) {
      toast.error("Erro ao deletar alguns arquivos");
      loadTrash();
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const toggleSelectFile = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map(f => f.id));
    }
  };

  const getFileIcon = (fileType) => {
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

  const getDaysRemaining = (deletedAt) => {
    const deleted = new Date(deletedAt);
    const expiresAt = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
    return Math.max(0, daysLeft);
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-gray-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando lixeira...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100">
      
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
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-600 to-slate-700 flex items-center justify-center shadow-lg">
                  <Trash2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    Lixeira
                    <Crown className="w-5 h-5 text-purple-600" />
                  </h1>
                  <p className="text-sm text-gray-600">
                    {files.length} arquivo(s) • Exclusivo Premium
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {files.length > 0 && (
                <>
                  <Button
                    onClick={() => setShowEmptyDialog(true)}
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Trash className="w-4 h-4" />
                    Esvaziar Lixeira
                  </Button>

                  <Button
                    onClick={loadTrash}
                    variant="outline"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </>
              )}
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
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 mb-2">
                  Como funciona a Lixeira Premium?
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Arquivos deletados ficam aqui por <strong>30 dias</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Você pode <strong>restaurar</strong> arquivos a qualquer momento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Após 30 dias, arquivos são <strong>deletados automaticamente</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span>Deleção permanente <strong>não pode ser desfeita</strong></span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        {files.length === 0 ? (
          <Card className="glass border-0 shadow-xl">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Lixeira Vazia! 🎉
                </h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Não há arquivos deletados no momento. Quando você deletar arquivos, eles aparecerão aqui.
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar para Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Bulk Actions */}
            {files.length > 0 && (
              <Card className="glass border-0 shadow-lg mb-6">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    
                    {/* Select All */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedFiles.length === files.length}
                          onCheckedChange={toggleSelectAll}
                          id="select-all"
                        />
                        <label 
                          htmlFor="select-all"
                          className="text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          Selecionar todos
                        </label>
                      </div>
                      {selectedFiles.length > 0 && (
                        <Badge variant="secondary">
                          {selectedFiles.length} selecionado(s)
                        </Badge>
                      )}
                    </div>

                    {/* Bulk Actions Buttons */}
                    {selectedFiles.length > 0 && (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleRestoreSelected}
                          size="sm"
                          variant="outline"
                          className="border-green-600 text-green-600 hover:bg-green-50"
                        >
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Restaurar ({selectedFiles.length})
                        </Button>
                        <Button
                          onClick={handleDeleteSelected}
                          size="sm"
                          variant="destructive"
                        >
                          <Trash className="w-4 h-4 mr-1" />
                          Deletar Permanentemente ({selectedFiles.length})
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Files List */}
            <div className="grid grid-cols-1 gap-4">
              {files.map((file) => {
                const Icon = getFileIcon(file.file_type);
                const daysLeft = getDaysRemaining(file.deleted_at);
                const isUrgent = daysLeft <= 7;

                return (
                  <Card 
                    key={file.id}
                    className={`glass border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
                      selectedFiles.includes(file.id) ? 'ring-2 ring-purple-600' : ''
                    } ${isUrgent ? 'border-l-4 border-l-red-500' : ''}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        
                        {/* Checkbox */}
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={() => toggleSelectFile(file.id)}
                        />

                        {/* Icon */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-slate-100 flex items-center justify-center border-2 border-gray-200">
                          <Icon className="w-6 h-6 text-gray-600" />
                        </div>

                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate mb-1">
                            {file.original_name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(file.file_size)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Deletado em {formatDate(file.deleted_at)}
                            </span>
                            <span className={`flex items-center gap-1 ${isUrgent ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                              <Timer className="w-3 h-3" />
                              {daysLeft} dia(s) restante(s)
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleRestore(file.id, file.original_name)}
                            size="sm"
                            variant="outline"
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Restaurar
                          </Button>
                          <Button
                            onClick={() => handlePermanentDelete(file.id, file.original_name)}
                            size="sm"
                            variant="destructive"
                          >
                            <Trash className="w-4 h-4 mr-1" />
                            Deletar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* Empty Trash Dialog */}
      <AlertDialog open={showEmptyDialog} onOpenChange={setShowEmptyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Esvaziar Lixeira?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a <strong>deletar permanentemente {files.length} arquivo(s)</strong>.
              </p>
              <p className="text-red-600 font-semibold">
                ⚠️ Esta ação NÃO pode ser desfeita!
              </p>
              <p className="text-sm">
                Todos os arquivos na lixeira serão deletados permanentemente e não poderão ser recuperados.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emptyingTrash}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              disabled={emptyingTrash}
              className="bg-red-600 hover:bg-red-700"
            >
              {emptyingTrash ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Esvaziando...
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4 mr-2" />
                  Esvaziar Lixeira
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Trash;
✅ TRASH.JSX COMPLETO!
🗑️ FEATURES IMPLEMENTADAS:
1. Funcionalidades Principais:
✅ Listar arquivos deletados (últimos 30 dias)
✅ Restaurar arquivo individual
✅ Deletar permanentemente individual
✅ Seleção múltipla (checkbox)
✅ Restaurar múltiplos arquivos
✅ Deletar múltiplos permanentemente
✅ Esvaziar lixeira (todos de uma vez)
2. Proteção Premium:
✅ Verifica se usuário é premium/admin
✅ Redireciona para /upgrade se free
✅ Badge "Exclusivo Premium"
3. Informações dos Arquivos:
✅ Nome, tipo, tamanho
✅ Data de deleção
✅ Dias restantes até deleção automática
✅ Alerta visual quando <7 dias (borda vermelha)
4. Segurança:
✅ Confirmação dupla para deletar permanentemente
✅ Digite "DELETAR" para confirmar
✅ Dialog de confirmação para esvaziar lixeira
✅ Avisos claros sobre ações irreversíveis
5. UX:
✅ Empty state elegante (lixeira vazia)
✅ Loading states
✅ Ícones por tipo de arquivo
✅ Badge de urgência (dias restantes)
✅ Checkbox "Selecionar todos"
✅ Bulk actions (ações em lote)
✅ Card informativo (como funciona)
6. Visual:
✅ Design clean (tema cinza/slate)
✅ Hover effects
✅ Ring ao selecionar arquivo
✅ Borda vermelha para arquivos urgentes
✅ Responsivo
📦 DEPENDÊNCIAS:
bash
# Instalar componentes (se não tiver)
npx shadcn-ui@latest add alert-dialog
npx shadcn-ui@latest add checkbox
```

---

### **🎨 VISUAL:**
```
┌────────────────────────────────────────────┐
│ [← Voltar]  🗑️ Lixeira 👑                 │
│              3 arquivo(s) • Exclusivo Premium│
│                          [Esvaziar] [🔄]   │
├────────────────────────────────────────────┤
│ ℹ️ Como funciona a Lixeira Premium?       │
│ ✓ Arquivos ficam 30 dias                  │
│ ✓ Pode restaurar a qualquer momento       │
│ ✓ Após 30 dias, deletados automaticamente │
│ ⚠️ Deleção permanente não pode ser desfeita│
├────────────────────────────────────────────┤
│ □ Selecionar todos    [2 selecionado(s)]  │
│         [Restaurar (2)] [Deletar (2)]     │
├────────────────────────────────────────────┤
│ ▌□ 📄 relatorio.pdf                       │
│    💾 2.5 MB • Del: 12/dez • ⏱️ 2 dias   │
│              [♻️ Restaurar] [🗑️ Deletar]  │
├────────────────────────────────────────────┤
│ ▌☑ 📄 backup.zip                          │
│    💾 15 MB • Del: 05/dez • ⏱️ 5 dias    │
│              [♻️ Restaurar] [🗑️ Deletar]  │
├────────────────────────────────────────────┤
│ □ 🖼️ foto.jpg                             │
│   💾 800 KB • Del: 15/nov • ⏱️ 26 dias   │
│              [♻️ Restaurar] [🗑️ Deletar]  │
└────────────────────────────────────────────┘
Faltam 2 páginas:

🐛 BugReport.jsx (Reportar bugs)
🚫 NotFound.jsx (Página 404)
Vamos para BugReport.jsx? 🚀🐛








Claude é uma IA e pode cometer err