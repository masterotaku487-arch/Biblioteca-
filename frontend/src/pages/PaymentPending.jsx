import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Clock, 
  QrCode,
  Copy,
  CheckCircle,
  AlertCircle,
  Home,
  RefreshCw,
  Smartphone,
  CreditCard,
  Zap,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { payments } from "@/services/api";

const PaymentPending = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [countdown, setCountdown] = useState(30); // Countdown para próxima verificação

  // Parâmetros do Mercado Pago
  const paymentId = searchParams.get("payment_id");
  const paymentType = searchParams.get("payment_type_id"); // pix, boleto, etc
  const externalReference = searchParams.get("external_reference");

  // ============================================================================
  // AUTO CHECK PAYMENT
  // ============================================================================

  useEffect(() => {
    // Verificar status a cada 30 segundos
    const checkInterval = setInterval(() => {
      checkPaymentStatus();
    }, 30000);

    // Countdown visual
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);

    // Verificar imediatamente ao carregar
    checkPaymentStatus();

    return () => {
      clearInterval(checkInterval);
      clearInterval(countdownInterval);
    };
  }, [paymentId]);

  // ============================================================================
  // CHECK PAYMENT STATUS
  // ============================================================================

  const checkPaymentStatus = async () => {
    if (!paymentId) return;

    setChecking(true);
    try {
      const response = await payments.checkStatus(paymentId);
      const status = response.data.status;

      if (status === "approved") {
        setPaymentStatus("approved");
        toast.success("Pagamento confirmado! Redirecionando...", {
          duration: 3000
        });
        setTimeout(() => {
          navigate("/payment/success");
        }, 2000);
      } else if (status === "rejected") {
        setPaymentStatus("rejected");
        toast.error("Pagamento recusado");
        setTimeout(() => {
          navigate("/payment/failure");
        }, 2000);
      } else {
        setPaymentStatus("pending");
      }
    } catch (error) {
      console.error("Error checking payment:", error);
    } finally {
      setChecking(false);
      setCountdown(30); // Reset countdown
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getPaymentTypeInfo = () => {
    if (paymentType === "pix") {
      return {
        icon: Smartphone,
        title: "Pagamento via PIX",
        description: "Aguardando confirmação do pagamento",
        color: "text-green-600",
        bgColor: "bg-green-100",
        instructions: [
          "Abra o app do seu banco",
          "Entre em Pix e escaneie o QR Code",
          "Ou copie e cole o código PIX",
          "Confirme o pagamento",
          "A aprovação é instantânea!"
        ]
      };
    } else if (paymentType === "boleto" || paymentType === "ticket") {
      return {
        icon: CreditCard,
        title: "Pagamento via Boleto",
        description: "Aguardando confirmação do pagamento",
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        instructions: [
          "Pague o boleto em qualquer banco",
          "Também pode pagar pela internet banking",
          "Ou em casas lotéricas",
          "A confirmação leva até 2 dias úteis",
          "Você receberá um email quando for aprovado"
        ]
      };
    } else {
      return {
        icon: Clock,
        title: "Pagamento Pendente",
        description: "Aguardando confirmação do pagamento",
        color: "text-orange-600",
        bgColor: "bg-orange-100",
        instructions: [
          "Complete o pagamento para ativar o Premium",
          "A confirmação pode levar alguns minutos",
          "Você receberá um email quando for aprovado"
        ]
      };
    }
  };

  const paymentInfo = getPaymentTypeInfo();
  const PaymentIcon = paymentInfo.icon;

  const handleCopyCode = () => {
    // Aqui você copiaria o código PIX real que viria do backend
    // Por enquanto é simulado
    navigator.clipboard.writeText("00020126360014BR.GOV.BCB.PIX...");
    toast.success("Código PIX copiado! ✓");
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50 relative overflow-hidden">
      
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-amber-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        
        {/* Pending Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          
          {/* Pending Icon */}
          <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${paymentInfo.bgColor} mb-6 shadow-2xl animate-pulse`}>
            <PaymentIcon className={`w-14 h-14 ${paymentInfo.color}`} />
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            ⏳ {paymentInfo.title}
          </h1>

          <p className="text-lg text-gray-600 mb-6">
            {paymentInfo.description}
          </p>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 border-2 border-orange-300 rounded-full">
            <Clock className="w-5 h-5 text-orange-600 animate-spin" />
            <span className="text-sm font-semibold text-orange-900">
              Aguardando Pagamento
            </span>
          </div>
        </div>

        {/* Auto-check Info */}
        <Card className="max-w-2xl mx-auto mb-8 glass border-2 border-blue-200 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <RefreshCw className={`w-6 h-6 text-blue-600 ${checking ? 'animate-spin' : ''}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">
                  Verificação Automática Ativada
                </p>
                <p className="text-sm text-gray-600">
                  Estamos verificando o status do pagamento automaticamente. 
                  Próxima verificação em <span className="font-bold text-blue-600">{countdown}s</span>
                </p>
              </div>
              <Button
                onClick={checkPaymentStatus}
                disabled={checking}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
              >
                {checking ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Verificar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment Instructions */}
        <div className="max-w-3xl mx-auto mb-12">
          <Card className="glass border-0 shadow-xl">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Como Concluir o Pagamento
                </h2>
                <p className="text-gray-600">
                  Siga os passos abaixo para ativar seu Premium
                </p>
              </div>

              <div className="space-y-4">
                {paymentInfo.instructions.map((instruction, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-4 p-4 bg-white rounded-lg border-2 border-gray-100 hover:border-purple-200 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold shadow-md">
                      {index + 1}
                    </div>
                    <p className="text-gray-700 pt-1">
                      {instruction}
                    </p>
                  </div>
                ))}
              </div>

              {/* PIX QR Code Section */}
              {paymentType === "pix" && (
                <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border-2 border-green-200">
                  <div className="text-center mb-4">
                    <h3 className="font-bold text-green-900 mb-2 flex items-center justify-center gap-2">
                      <QrCode className="w-5 h-5" />
                      Código PIX
                    </h3>
                    <p className="text-sm text-green-700">
                      Escaneie o QR Code ou copie o código abaixo
                    </p>
                  </div>

                  {/* QR Code Placeholder */}
                  <div className="bg-white rounded-xl p-6 mb-4 flex items-center justify-center">
                    <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center border-4 border-gray-200">
                      <QrCode className="w-24 h-24 text-gray-400" />
                    </div>
                  </div>

                  {/* Copy Code Button */}
                  <Button
                    onClick={handleCopyCode}
                    className="w-full bg-green-600 hover:bg-green-700 h-12"
                  >
                    <Copy className="w-5 h-5 mr-2" />
                    Copiar Código PIX
                  </Button>

                  <p className="text-xs text-center text-green-700 mt-3">
                    <Zap className="w-3 h-3 inline mr-1" />
                    Aprovação instantânea após pagamento!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Important Info */}
        <div className="max-w-3xl mx-auto mb-12">
          <Card className="glass border-2 border-amber-200 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Info className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    Informações Importantes
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Você receberá um email assim que o pagamento for confirmado</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>O Premium será ativado automaticamente após aprovação</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>Você pode fechar esta página, vamos te notificar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <span>
                        {paymentType === "pix" 
                          ? "PIX expira em 30 minutos"
                          : "Boleto expira em 3 dias úteis"}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Details */}
        {paymentId && (
          <Card className="max-w-2xl mx-auto mb-12 glass border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Plano</p>
                  <p className="font-bold text-gray-900">Premium - 30 dias</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Valor</p>
                  <p className="font-bold text-gray-900">R$ 4,80</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Método</p>
                  <p className="font-bold text-gray-900 capitalize">
                    {paymentType === "pix" ? "PIX" : paymentType === "boleto" ? "Boleto" : "Outro"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status</p>
                  <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold">
                    <Clock className="w-3 h-3 mr-1" />
                    Pendente
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  ID da Transação: <span className="font-mono">{paymentId}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA Buttons */}
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => navigate("/")}
              className="flex-1 h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Home className="w-5 h-5 mr-2" />
              Voltar para Dashboard
            </Button>

            <Button
              onClick={() => navigate("/upgrade")}
              variant="outline"
              className="flex-1 h-14 text-lg border-2 border-gray-300 hover:bg-gray-50"
            >
              Ver Outros Métodos
            </Button>
          </div>

          <p className="text-center text-sm text-gray-600 mt-6">
            💡 Esta página continua verificando o pagamento automaticamente
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
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
      `}</style>
    </div>
  );
};

export default PaymentPending;


