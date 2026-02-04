import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FilePreview = ({ file, open, onClose }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && file) {
      loadPreview();
    }
  }, [open, file]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/files/${file.id}/preview`);
      setPreview(response.data);
    } catch (error) {
      toast.error("Erro ao carregar preview");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API}/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
        </div>
      );
    }

    if (!preview) return null;

    // Text preview
    if (preview.type === "text") {
      return (
        <div className="bg-gray-50 p-6 rounded-lg max-h-96 overflow-y-auto">
          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">{preview.content}</pre>
        </div>
      );
    }

    // Image preview
    if (preview.type === "base64" && preview.mime_type?.startsWith("image/")) {
      return (
        <div className="flex justify-center bg-gray-50 p-4 rounded-lg">
          <img
            src={`data:${preview.mime_type};base64,${preview.content}`}
            alt={file.original_name}
            className="max-w-full max-h-96 object-contain rounded"
          />
        </div>
      );
    }

    // PDF/Video stream
    if (preview.type === "stream") {
      const token = localStorage.getItem("token");
      const streamUrl = `${API}/files/${file.id}/stream?token=${token}`;

      if (file.file_type?.includes("pdf")) {
        return (
          <iframe
            src={streamUrl}
            className="w-full h-96 rounded-lg border"
            title={file.original_name}
          />
        );
      }

      if (file.file_type?.startsWith("video/")) {
        return (
          <video controls className="w-full max-h-96 rounded-lg">
            <source src={streamUrl} type={file.file_type} />
            Seu navegador não suporta o elemento de vídeo.
          </video>
        );
      }

      if (file.file_type?.startsWith("audio/")) {
        return (
          <div className="flex justify-center p-8">
            <audio controls className="w-full">
              <source src={streamUrl} type={file.file_type} />
              Seu navegador não suporta o elemento de áudio.
            </audio>
          </div>
        );
      }
    }

    return (
      <div className="text-center p-8 text-gray-500">
        <p>Preview não disponível para este tipo de arquivo</p>
        <Button onClick={handleDownload} className="mt-4 bg-purple-600 hover:bg-purple-700">
          <Download className="w-4 h-4 mr-2" />
          Baixar Arquivo
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h3 className="text-lg font-semibold" style={{fontFamily: 'Manrope'}}>{file?.original_name}</h3>
              <p className="text-sm text-gray-500">por {file?.uploaded_by}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownload} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-1" />
                Baixar
              </Button>
              <Button onClick={onClose} size="sm" variant="ghost">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Preview Content */}
          <div className="min-h-64">
            {renderPreview()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreview;
