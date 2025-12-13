import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { auth } from "@/services/api";

const GoogleCallback = ({ onLogin }) => {
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [message, setMessage] = useState("Processando login com Google...");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    handleGoogleCallback();
  }, []);

  const handleGoogleCallback = async () => {
    try {
      // 1. Verificar se tem token na URL (já processado pelo backend)
      const token = searchParams.get("token");
      const error = searchParams.get("error");

      // 2. Se tem erro na URL
      if (error) {
        setStatus("error");
        setMessage(getErrorMessage(error));
        toast.error("Erro no login com Google");
        
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          navigate("/login");
        }, 3000);
        return;
      }

      // 3. Se tem token (sucesso)
      if (token) {
        // Salvar token no localStorage
        localStorage.setItem("token", token);

        // Buscar dados do usuário
        setMessage("Carregando seus dados...");
        const response = await auth.getMe();
        
        // Atualizar estado do usuário no App
        if (onLogin) {
          onLogin(response.data);
        }

        // Sucesso
        setStatus("success");
        setMessage(`Bem-vindo(a), ${response.data.username}! 🎉`);
        toast.success("Login realizado com sucesso!");

        // Redirecionar para dashboard após 1 segundo
        setTimeout(() => {
          navigate("/");
        }, 1500);
        return;
      }

      // 4. Se não tem token nem erro, verificar se o backend vai processar
      // O Google redireciona primeiro para o backend (/api/auth/google/callback)
      // O backend processa e redireciona para cá com ?token=xxx
      
      // Se chegou aqui sem token nem erro, algo deu errado
      setStatus("error");
      setMessage("Token não encontrado. Tente fazer login novamente.");
      
      setTimeout(() => {
        navigate("/login");
      }, 3000);

    } catch (error) {
      console.error("Google callback error:", error);
      setStatus("error");
      
      // Verificar tipo de erro
      if (error.response?.status === 401) {
        setMessage("Sessão expirada. Faça login novamente.");
      } else if (error.response?.status === 500) {
        setMessage("Erro no servidor. Tente novamente mais tarde.");
      } else {
        setMessage(
          error.response?.data?.detail || 
          "Erro ao processar login. Tente novamente."
        );
      }
      
      toast.error("Erro no login com Google");

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    }
  };

  const getErrorMessage = (errorCode) => {
    const errorMessages = {
      google_auth_failed: "Falha na autenticação com o Google",
      access_denied: "Você negou o acesso ao Google",
      invalid_token: "Token inválido ou expirado",
      server_error: "Erro no servidor",
      user_cancelled: "Login cancelado pelo usuário",
    };

    return errorMessages[errorCode] || "Erro desconhecido no login";
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          
          {/* Icon and Status */}
          <div className="text-center mb-6">
            {status === "loading" && (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 mb-4">
                <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
              </div>
            )}

            {status === "success" && (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 mb-4">
                <div className="animate-bounce">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-100 to-orange-100 mb-4">
                <div className="animate-pulse">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
              </div>
            )}

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {status === "loading" && "Processando..."}
              {status === "success" && "Login Realizado!"}
              {status === "error" && "Ops! Algo deu errado"}
            </h1>

            {/* Message */}
            <p className="text-gray-600 text-sm">
              {message}
            </p>
          </div>

          {/* Progress Bar (apenas quando loading) */}
          {status === "loading" && (
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
              <div 
                className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 animate-loading-bar"
              ></div>
            </div>
          )}

          {/* Success Animation */}
          {status === "success" && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-900">
                  Redirecionando para o dashboard...
                </p>
              </div>
            </div>
          )}

          {/* Error Details */}
          {status === "error" && (
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      Por que isso aconteceu?
                    </p>
                    <ul className="text-xs text-red-700 space-y-1 list-disc list-inside">
                      <li>Você pode ter cancelado o login</li>
                      <li>Permissões do Google não foram concedidas</li>
                      <li>Erro temporário de conexão</li>
                      <li>Sessão expirada</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Manual Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/login")}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg text-sm"
                >
                  Voltar para Login
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-3 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors text-sm"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          )}

          {/* Redirect Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              {status === "loading" && "Aguarde enquanto validamos suas credenciais"}
              {status === "success" && "Você será redirecionado em instantes"}
              {status === "error" && "Você será redirecionado para a página de login"}
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            🔒 Sua privacidade está protegida
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Biblioteca Privada © {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* CSS para animação da barra de loading */}
      <style>{`
        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-loading-bar {
          animation: loading-bar 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default GoogleCallback;
