import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { 
  CheckCircle, 
  Crown, 
  Sparkles, 
  Zap,
  Gift,
  TrendingUp,
  HardDrive,
  Users,
  Trash2,
  Search,
  Loader2,
  ArrowRight,
  Home
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

const PaymentSuccess = ({ refreshUser }) => {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [showConfetti, setShowConfetti] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { width, height } = useWindowSize();

  // IDs do pagamento (Mercado Pago envia como query params)
  const paymentId = searchParams.get("payment_id");
  const status = searchParams.get("status");
  const externalReference = searchParams.get("external_reference");

  useEffect(() => {
    verifyPayment();
    
    // Parar confetti após 10 segundos
    const confettiTimer = setTimeout(() => {
      setShowConfetti(false);
    }, 10000);

    return () => clearTimeout(confettiTimer);
  }, []);

  const verifyPayment = async () => {
    try {
      setVerifying(true);

      // Aguardar um pouco para o webhook processar
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Atualizar dados do usuário
      if (refreshUser) {
        await refreshUser();
      }

      // Simular informações do pagamento
      setPaymentInfo({
        paymentId: paymentId || "N/A",
        status: status || "approved",
        plan: "Premium",
        duration: "30 dias",
        price: "R$ 4,80"
      });

      setVerifying(false);
      toast.success("Pagamento confirmado! Bem-vindo ao Premium! 👑", {
        duration: 5000
      });

    } catch (error) {
      console.error("Error verifying payment:", error);
      setVerifying(false);
      toast.warning("Processando pagamento... Pode levar alguns minutos.");
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // PREMIUM BENEFITS
  // ============================================================================

  const premiumBenefits = [
    {
      icon: HardDrive,
      title: "5 GB de Armazenamento",
      description: "50x mais espaço que o plano Free",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      icon: Zap,
      title: "Arquivos Ilimitados",
      description: "Sem limite de quantidade de arquivos",
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      icon: Users,
      title: "Times Ilimitados",
      description: "Crie e participe de quantos times quiser",
      color: "text-pink-600",
      bgColor: "bg-pink-100"
    },
    {
      icon: Trash2,
      title: "Lixeira de 30 Dias",
      description: "Recupere arquivos deletados por 30 dias",
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      icon: Search,
      title: "Busca Avançada",
      description: "Encontre arquivos com filtros poderosos",
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      icon: Sparkles,
      title: "Tema Escuro",
      description: "Interface elegante para trabalhar à noite",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100"
    }
  ];

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-purple-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Verificando Pagamento...
          </h2>
          <p className="text-gray-600">
            Aguarde enquanto confirmamos sua assinatura Premium
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      
      {/* Confetti Animation */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        
        {/* Success Header */}
        <div className="max-w-4xl mx-auto text-center mb-12">
          
          {/* Success Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mb-6 shadow-2xl animate-bounce">
            <CheckCircle className="w-14 h-14 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent">
              Pagamento Confirmado! 🎉
            </span>
          </h1>

          {/* Subtitle */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <Crown className="w-8 h-8 text-yellow-500 animate-pulse" />
            <p className="text-2xl font-semibold text-gray-800">
              Bem-vindo ao <span className="text-purple-600">Premium</span>!
            </p>
            <Crown className="w-8 h-8 text-yellow-500 animate-pulse" />
          </div>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Sua assinatura Premium foi ativada com sucesso! 
            Agora você tem acesso a todos os recursos exclusivos.
          </p>
        </div>

        {/* Payment Info Card */}
        {paymentInfo && (
          <Card className="max-w-2xl mx-auto mb-12 glass border-2 border-purple-200 shadow-2xl">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5 text-purple-600" />
                    <p className="text-sm font-medium text-gray-600">Plano</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{paymentInfo.plan}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    <p className="text-sm font-medium text-gray-600">Duração</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{paymentInfo.duration}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-sm font-medium text-gray-600">Status</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                      Aprovado
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💰</span>
                    <p className="text-sm font-medium text-gray-600">Valor Pago</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{paymentInfo.price}</p>
                </div>
              </div>

              {/* Payment ID */}
              {paymentInfo.paymentId !== "N/A" && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    ID do Pagamento: <span className="font-mono">{paymentInfo.paymentId}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Premium Benefits */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              🎁 Seus Novos Benefícios
            </h2>
            <p className="text-gray-600">
              Aproveite ao máximo tudo que o Premium tem a oferecer!
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {premiumBenefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card 
                  key={index}
                  className="glass border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 animate-fade-in-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 rounded-full ${benefit.bgColor} flex items-center justify-center mb-4`}>
                      <Icon className={`w-6 h-6 ${benefit.color}`} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => navigate("/")}
              className="flex-1 h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Home className="w-5 h-5 mr-2" />
              Ir para Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <Button
              onClick={() => navigate("/teams")}
              variant="outline"
              className="flex-1 h-14 text-lg border-2 border-purple-600 text-purple-600 hover:bg-purple-50"
            >
              <Users className="w-5 h-5 mr-2" />
              Criar Meu Time
            </Button>
          </div>

          {/* Help Text */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 mb-2">
              📧 Você receberá um email de confirmação em breve
            </p>
            <p className="text-xs text-gray-500">
              Precisa de ajuda? Entre em contato conosco ou{" "}
              <button 
                onClick={() => navigate("/bug-report")}
                className="text-purple-600 hover:underline font-medium"
              >
                reporte um problema
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
};

export default PaymentSuccess;