import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Bug, 
  Send,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Code,
  Zap,
  FileQuestion,
  Lightbulb,
  MessageSquare,
  User,
  Mail,
  Chrome,
  Monitor,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { bugs as bugsAPI } from "@/services/api";

const BugReport = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    category: "",
    title: "",
    description: "",
    steps_to_reproduce: "",
    expected_behavior: "",
    actual_behavior: "",
  });

  // Browser info (auto-detect)
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    const language = navigator.language;
    const platform = navigator.platform;

    return {
      userAgent: ua,
      screen: `${screenWidth}x${screenHeight}`,
      language,
      platform,
      timestamp: new Date().toISOString()
    };
  };

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    if (!formData.category) {
      toast.error("Selecione uma categoria");
      return;
    }

    if (!formData.title.trim()) {
      toast.error("Digite um título");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Digite uma descrição");
      return;
    }

    setLoading(true);

    try {
      // Adicionar informações do navegador
      const bugData = {
        ...formData,
        browser_info: getBrowserInfo()
      };

      await bugsAPI.create(bugData);

      setSubmitted(true);
      toast.success("Bug reportado com sucesso! Obrigado! 🙏", {
        duration: 5000
      });

      // Limpar formulário após 2 segundos
      setTimeout(() => {
        setFormData({
          category: "",
          title: "",
          description: "",
          steps_to_reproduce: "",
          expected_behavior: "",
          actual_behavior: "",
        });
      }, 2000);

    } catch (error) {
      console.error("Error submitting bug:", error);
      toast.error("Erro ao enviar relatório. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // CATEGORIES
  // ============================================================================

  const categories = [
    { value: "bug", label: "🐛 Bug / Erro", icon: Bug },
    { value: "crash", label: "💥 Crash / Falha", icon: AlertCircle },
    { value: "performance", label: "⚡ Performance", icon: Zap },
    { value: "ui", label: "🎨 Interface / UI", icon: Monitor },
    { value: "feature", label: "💡 Sugestão de Feature", icon: Lightbulb },
    { value: "other", label: "❓ Outro", icon: FileQuestion }
  ];

  // ============================================================================
  // SUCCESS STATE
  // ============================================================================

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full glass border-2 border-green-200 shadow-2xl">
          <CardContent className="p-12 text-center">
            
            {/* Success Icon */}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mb-6 shadow-2xl animate-bounce">
              <CheckCircle className="w-14 h-14 text-white" />
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Relatório Enviado! 🎉
            </h1>

            <p className="text-lg text-gray-700 mb-8">
              Obrigado por ajudar a melhorar a Biblioteca Privada!
            </p>

            {/* Info */}
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                O que acontece agora?
              </h3>
              <ul className="space-y-2 text-sm text-green-800">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Você receberá um email de confirmação</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Nossa equipe analisará o relatório</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Você será notificado quando for resolvido</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>Pode acompanhar no dashboard (em breve)</span>
                </li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setSubmitted(false)}
                variant="outline"
                className="flex-1"
              >
                Enviar Outro Relatório
              </Button>
              <Button
                onClick={() => navigate("/")}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================================
  // RENDER FORM
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50">
      
      {/* Header */}
      <header className="glass border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            
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
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Bug className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Reportar Bug
                  </h1>
                  <p className="text-sm text-gray-600">
                    Ajude-nos a melhorar a plataforma
                  </p>
                </div>
              </div>
            </div>

            {/* User Info */}
            <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{user?.username}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        
        {/* Info Card */}
        <Card className="glass border-2 border-blue-200 shadow-lg mb-8">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-2">
                  Como fazer um bom relatório de bug?
                </h3>
                <ul className="space-y-1 text-sm text-gray-700">
                  <li>✓ Seja específico e detalhado</li>
                  <li>✓ Descreva os passos para reproduzir o problema</li>
                  <li>✓ Explique o que esperava vs o que aconteceu</li>
                  <li>✓ Inclua screenshots se possível (no email)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="glass border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Relatório de Bug</CardTitle>
            <CardDescription>
              Preencha as informações abaixo. Quanto mais detalhes, melhor!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Category */}
              <div>
                <Label htmlFor="category" className="text-base font-semibold mb-3 block">
                  1. Categoria *
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => handleChange("category", value)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div>
                <Label htmlFor="title" className="text-base font-semibold mb-3 block">
                  2. Título do Problema *
                </Label>
                <Input
                  id="title"
                  placeholder="Ex: Erro ao fazer upload de arquivo PDF"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  maxLength={100}
                  className="h-12"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.title.length}/100 caracteres
                </p>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description" className="text-base font-semibold mb-3 block">
                  3. Descrição Detalhada *
                </Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o problema em detalhes. O que você estava tentando fazer? O que aconteceu?"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={6}
                  maxLength={1000}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.description.length}/1000 caracteres
                </p>
              </div>

              {/* Steps to Reproduce */}
              <div>
                <Label htmlFor="steps" className="text-base font-semibold mb-3 block">
                  4. Passos para Reproduzir (Opcional)
                </Label>
                <Textarea
                  id="steps"
                  placeholder="1. Acesse a página X&#10;2. Clique no botão Y&#10;3. O erro ocorre..."
                  value={formData.steps_to_reproduce}
                  onChange={(e) => handleChange("steps_to_reproduce", e.target.value)}
                  rows={4}
                  className="resize-none font-mono text-sm"
                />
              </div>

              {/* Expected vs Actual */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Expected Behavior */}
                <div>
                  <Label htmlFor="expected" className="text-base font-semibold mb-3 block">
                    5. Comportamento Esperado
                  </Label>
                  <Textarea
                    id="expected"
                    placeholder="O que deveria acontecer?"
                    value={formData.expected_behavior}
                    onChange={(e) => handleChange("expected_behavior", e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Actual Behavior */}
                <div>
                  <Label htmlFor="actual" className="text-base font-semibold mb-3 block">
                    6. Comportamento Atual
                  </Label>
                  <Textarea
                    id="actual"
                    placeholder="O que realmente aconteceu?"
                    value={formData.actual_behavior}
                    onChange={(e) => handleChange("actual_behavior", e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* Browser Info (Auto-detected) */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Chrome className="w-5 h-5 text-gray-600" />
                  <h4 className="font-semibold text-gray-900">
                    Informações Técnicas (Detectadas Automaticamente)
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <span className="font-medium">Navegador:</span>{" "}
                    {navigator.userAgent.includes("Chrome") ? "Chrome" : 
                     navigator.userAgent.includes("Firefox") ? "Firefox" :
                     navigator.userAgent.includes("Safari") ? "Safari" : "Outro"}
                  </div>
                  <div>
                    <span className="font-medium">Plataforma:</span> {navigator.platform}
                  </div>
                  <div>
                    <span className="font-medium">Resolução:</span> {window.screen.width}x{window.screen.height}
                  </div>
                  <div>
                    <span className="font-medium">Idioma:</span> {navigator.language}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-4 pt-6 border-t border-gray-200">
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-14 text-lg bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Enviar Relatório
                    </>
                  )}
                </Button>
              </div>

              {/* Footer Note */}
              <p className="text-xs text-center text-gray-500">
                Seu relatório será enviado para <strong>masterotaku487@gmail.com</strong>
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Additional Help */}
        <Card className="glass border-0 shadow-lg mt-8">
          <CardContent className="p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-600" />
              Precisa de ajuda urgente?
            </h3>
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                Se você encontrou um bug crítico que impede o uso da plataforma, 
                entre em contato diretamente:
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a 
                  href="mailto:masterotaku487@gmail.com"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  masterotaku487@gmail.com
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default BugReport;