import React from 'react';

function UpgradePage() {
  const handleUpgrade = (plan) => {
    // Por enquanto, apenas alert
    // Depois vamos integrar Mercado Pago
    alert(`Upgrade para ${plan} - Em breve!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Faça Upgrade para Premium 👑
          </h1>
          <p className="text-gray-600 text-lg">
            Desbloqueie todo o potencial da sua biblioteca privada
          </p>
        </div>

        {/* Planos */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* FREE */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-200">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Free</h3>
              <div className="text-4xl font-bold text-gray-600 mb-2">
                R$ 0<span className="text-lg">/mês</span>
              </div>
              <p className="text-sm text-gray-500">Para sempre grátis</p>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-gray-700">100 MB de storage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-gray-700">Máximo 20 arquivos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-gray-700">Upload e download</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-gray-700">Senha em arquivos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-1">✓</span>
                <span className="text-gray-700">Compartilhamento básico</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">✗</span>
                <span className="text-gray-400">Times de trabalho</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">✗</span>
                <span className="text-gray-400">Lixeira</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">✗</span>
                <span className="text-gray-400">Tema escuro</span>
              </li>
            </ul>
            
            <button 
              disabled 
              className="w-full bg-gray-300 text-gray-600 py-3 rounded-lg font-semibold cursor-not-allowed"
            >
              Plano Atual
            </button>
          </div>

          {/* PREMIUM */}
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-2xl shadow-2xl p-8 transform md:scale-105 border-4 border-purple-400">
            <div className="text-center mb-4">
              <span className="bg-yellow-400 text-purple-900 px-4 py-1 rounded-full text-sm font-bold inline-block">
                ⭐ MAIS POPULAR
              </span>
            </div>
            
            <div className="text-center mb-6">
              <h3 className="text-3xl font-bold mb-2">Premium 👑</h3>
              <div className="text-5xl font-bold mb-2">
                R$ 4,90<span className="text-xl">/mês</span>
              </div>
              <p className="text-purple-100 text-sm">ou R$ 49,90/ano (economize 17%)</p>
            </div>
            
            <ul className="space-y-3 mb-8">
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>5 GB de storage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Arquivos ilimitados</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Times de trabalho em grupo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Lixeira (recuperar por 30 dias)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Busca avançada</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Pastas e categorias</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Visualizador de arquivos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Tema escuro</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Notificações</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-300 mt-1">✓</span>
                <span>Suporte prioritário</span>
              </li>
            </ul>
            
            <button 
              onClick={() => handleUpgrade('monthly')}
              className="w-full bg-white text-purple-600 py-4 rounded-lg font-bold text-lg hover:scale-105 transition-transform shadow-lg mb-3"
            >
              Assinar por R$ 4,90/mês
            </button>
            
            <button 
              onClick={() => handleUpgrade('yearly')}
              className="w-full bg-purple-800 text-white py-3 rounded-lg font-semibold hover:bg-purple-900 transition"
            >
              Assinar por R$ 49,90/ano (economize R$ 9)
            </button>
            
            <p className="text-center text-sm mt-4 text-purple-100">
              🎁 7 dias grátis para testar
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-center">Perguntas Frequentes</h2>
          
          <div className="space-y-4">
            <details className="border-b border-gray-200 pb-4">
              <summary className="font-semibold cursor-pointer text-gray-800 hover:text-purple-600">
                Posso cancelar a qualquer momento?
              </summary>
              <p className="mt-2 text-gray-600">
                Sim! Você pode cancelar quando quiser, sem taxas ou multas.
              </p>
            </details>
            
            <details className="border-b border-gray-200 pb-4">
              <summary className="font-semibold cursor-pointer text-gray-800 hover:text-purple-600">
                Meus arquivos ficam salvos se eu cancelar?
              </summary>
              <p className="mt-2 text-gray-600">
                Sim, seus arquivos continuam salvos. Você volta para o plano Free com limite de 100 MB.
              </p>
            </details>
            
            <details className="border-b border-gray-200 pb-4">
              <summary className="font-semibold cursor-pointer text-gray-800 hover:text-purple-600">
                Como funciona o pagamento?
              </summary>
              <p className="mt-2 text-gray-600">
                Aceitamos cartão de crédito, PIX e boleto via Mercado Pago. 100% seguro!
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpgradePage;