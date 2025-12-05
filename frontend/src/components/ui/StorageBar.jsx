import React from 'react';

function StorageBar({ user }) {
  const usedMB = (user.storage_used / 1_000_000).toFixed(2);
  const limitMB = (user.storage_limit / 1_000_000).toFixed(0);
  const percentage = (user.storage_used / user.storage_limit) * 100;
  
  const getColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-md border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold text-gray-700">💾 Storage usado</span>
        <span className={`text-sm font-bold ${getTextColor()}`}>
          {usedMB} / {limitMB} MB
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`${getColor()} h-3 rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        {user.file_count || 0} arquivo(s) • {user.plan === 'free' ? '20 máx' : 'Ilimitado'}
      </div>
      
      {user.plan === 'free' && percentage > 70 && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 font-medium">
            ⚠️ Você está chegando no limite! 
            <a href="/upgrade" className="underline ml-1 hover:text-amber-900">
              Faça upgrade para 5 GB
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

export default StorageBar;