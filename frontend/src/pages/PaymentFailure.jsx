import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  XCircle, 
  AlertCircle,
  CreditCard,
  RefreshCw,
  Home,
  HelpCircle,
  ArrowRight,
  Phone,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const PaymentFailure = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parâmetros do Mercado Pago
  const paymentId = searchParams.get("payment_id");
  const status = searchParams.get("status");
  const statusDetail = searchParams.get("status_detail");

  // ============================================================================
  // ERROR MESSAGES
  // ============================================================================

  const getErrorInfo = () => {
    const errorMap = {
      cc_rejected_bad_filled_card_number: {
        title: "Número do cartão incorreto",
        description: "Verifique o número do cartão e tente novamente",
        icon: "💳"
      },
      cc_rejected_bad_filled_date: {
        title: "Data de validade incorreta",
        description: "Confira a data de vencimento do cartão",
        icon: "📅"
      },
      cc_rejected_bad_filled_security_code: {
        title: "Código de segurança incorreto",
        description: "Verifique o CVV (código de 3 dígitos) no verso do cartão",
        icon: "🔐"
      },
      cc_rejected_call_for_authorize: {
        title: "Cartão precisa de autorização",
        description: "Entre em contato com seu banco para autorizar o pagamento",
        icon: "📞"
      },
      cc_rejected_insufficient_amount: {
        title: "Saldo insuficiente",
        description: "O cartão não possui saldo suficiente",
        icon: "💰"
      },
      cc_rejected_max_attempts: {
        title: "Tentativas excedidas",
        description: "Você atingiu o limite de tentativas. Tente novamente mais tarde",
        icon: "⚠️"
      },
      cc_rejected_other_reason: {
        title: "Pagamento recusado",
        description: "O pagamento foi recusado. Entre em contato com seu banco",
        icon: "❌"
      },
      rejected_by_bank: {
        title: "Recusado pelo banco",
        description: "Seu banco recusou a transação. Entre em contato com eles",
        icon: "🏦"
      },
      rejected_by_regulations: {
        title: "Bloqueado por regulamentações",
        description: "Pagamento bloqueado por questões regulatórias",
        icon: "⚖️"
      }
    };

    return errorMap[statusDetail] || {
      title: "Pagamento não processado",
      description: "Não foi possível processar seu pagamento",
      icon: "❌"
    };
  };

  const errorInfo = getErrorInfo();

  // ============================================================================
  // FAQ
  // ============================================================================

  const faqs = [
    {
      question: "Por que meu pagamento foi recusado?",
      answer: "Os pagamentos podem ser recusados por diversos motivos: saldo insuficiente, dados incorretos, limite de crédito atingido, ou bloqueio do banco. Verifique as informações e tente novamente."
    },
    {
      question: "Meu dinheiro foi debitado mesmo assim?",
      answer: "Não se preocupe! Se o pagamento foi recusado, nenhum valor foi cobrado. Caso veja alguma cobrança, ela será estornada automaticamente em até 7 dias úteis."
    },
    {
      question: "Posso tentar outro método de pagamento?",
      answer: "Sim! Você pode tentar com outro cartão, usar PIX (aprovação instantânea) ou boleto bancário."
    },
    {
      question: "Quanto tempo devo esperar para tentar novamente?",
      answer: "Você pode tentar imediatamente com outro cartão. Se for o mesmo cartão, aguarde pelo menos 1 hora ou entre em contato com seu banco."
    },
    {
      question: "O que fazer se o problema persistir?",
      answer: "Entre em contato com seu banco para verificar se há algum bloqueio. Você também pode nos contatar através do suporte para ajuda adicional."
    }
  ];

  // ============================================================================
  // COMMON REASONS
  // ============================================================================

  const commonReasons = [
    {
      icon: CreditCard,
      title: "Dados incorretos",
      description: "Número do cartão, CVV ou validade incorretos",
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      icon: AlertCircle,
      title: "Saldo insuficiente",
      description: "Cartão sem limite ou saldo disponível",
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      icon: Phone,
      title: "Autorização necessária",
      description: "Banco bloqueou a transação por segurança",
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      icon: HelpCircle,
      title: "Limite de tentativas",
      description: "Muitas tentativas em pouco tempo",
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    }
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-pink-50 relative overflow-hidden">
      
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-red-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        
        {/* Error Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          
          {/* Error Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-red-400 to-orange-500 mb-6 shadow-2xl animate-pulse">
            <XCircle className="w-14 h-14 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {errorInfo.icon} Pagamento Não Concluído
          </h1>

          {/* Error Message */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-l-4 border-red-500">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {errorInfo.title}
            </h2>
            <p className="text-gray-600">
              {errorInfo.description}
            </p>
          </div>

          <p className="text-lg text-gray-600">
            Não se preocupe! Nenhum valor foi cobrado.
          </p>
        </div>

        {/* Payment Info (se disponível) */}
        {paymentId && (
          <Card className="max-w-2xl mx-auto mb-12 glass border-2 border-red-200 shadow-xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Status do Pagamento</p>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                      Recusado
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-1">ID da Tentativa</p>
                  <p className="text-sm font-mono text-gray-700">{paymentId}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Common Reasons */}
        <div className="max-w-6xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Motivos Comuns
            </h2>
            <p className="text-gray-600">
              Veja os motivos mais comuns para pagamentos recusados
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {commonReasons.map((reason, index) => {
              const Icon = reason.icon;
              return (
                <Card 
                  key={index}
                  className="glass border-0 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <CardContent className="p-6 text-center">
                    <div className={`w-12 h-12 rounded-full ${reason.bgColor} flex items-center justify-center mx-auto mb-4`}>
                      <Icon className={`w-6 h-6 ${reason.color}`} />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">
                      {reason.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {reason.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Perguntas Frequentes
            </h2>
            <p className="text-gray-600">
              Tire suas dúvidas sobre pagamentos recusados
            </p>
          </div>

          <Card className="glass border-0 shadow-xl">
            <CardContent className="p-6">
              <Accordion type="single" collapsible className="w-full">
                {faqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left hover:text-purple-600">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-gray-600">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* CTA Buttons */}
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => navigate("/upgrade")}
              className="flex-1 h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Tentar Novamente
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>

            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="flex-1 h-14 text-lg border-2 border-gray-300 hover:bg-gray-50"
            >
              <Home className="w-5 h-5 mr-2" />
              Voltar para Início
            </Button>
          </div>

          {/* Support Info */}
          <div className="mt-8 text-center space-y-4">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center justify-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Precisa de Ajuda?
              </h3>
              <p className="text-sm text-blue-800 mb-4">
                Nossa equipe está pronta para ajudar você
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a 
                  href="mailto:masterotaku487@gmail.com"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  masterotaku487@gmail.com
                </a>
                <button
                  onClick={() => navigate("/bug-report")}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border-2 border-blue-600 text-blue-600 rounded-lg font-medium transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                  Reportar Problema
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              💡 <strong>Dica:</strong> Tente usar PIX para aprovação instantânea!
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

export default PaymentFailure;