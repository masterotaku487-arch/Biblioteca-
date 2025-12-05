import React, { useState } from 'react';

function PremiumFeature({ feature, children, user }) {
  const [showModal, setShowModal] = useState(false);
  const isPremium = user?.plan === 'premium';

  if (isPremium) {
    return children;
  }

  return (
    <>
      <div className="relative">
        {/* Conteúdo desfocado */}
        <div className="blur-sm pointer-events-none opacity-50 select-none">
          {children}
        </div>
        
        {/* Overlay Premium */}
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-lg">
          <div className="text-center p-6 bg-white rounded-xl shadow-2xl max-w-sm">
            <div className="text-5xl mb-3">👑</div>
            <h3 className="font-bold text-xl mb-2 text-gray-800">{feature}</h3>
            <p className="text-gray-600 mb-4 text-sm">Exclusivo para Premium</p>
            <button 
              onClick={() => setShowModal(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-3 rounded-lg font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              Fazer Upgrade - R$ 4,90/mês
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Upgrade */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">👑</div>
              <h2 className="text-3xl font-bold mb-2">Upgrade para Premium</h2>
              <p className="text-gray-600 mb-6">
                Desbloqueie todas as funcionalidades!
              </p>
              
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 mb-6">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  R$ 4,90<span className="text-lg">/mês</span>
                </div>
                <div className="text-sm text-gray-600">ou R$ 49,90/ano (economize 17%)</div>
              </div>
              
              <ul className="text-left space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> 5 GB de storage
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Arquivos ilimitados
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Times de trabalho
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Lixeira (30 dias)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Busca avançada
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span> Tema escuro
                </li>
              </ul>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => window.location.href = '/upgrade'}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:scale-105 transition-transform shadow-lg"
                >
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PremiumFeature;