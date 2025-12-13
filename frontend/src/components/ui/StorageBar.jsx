import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  HardDrive, 
  TrendingUp, 
  Crown, 
  Files,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const StorageBar = ({ used, limit, fileCount, plan }) => {
  const navigate = useNavigate();
  
  // ============================================================================
  // CALCULATIONS
  // ============================================================================
  
  // Converter bytes para MB/GB
  const usedMB = (used / (1024 * 1024)).toFixed(2);
  const limitMB = (limit / (1024 * 1024)).toFixed(0);
  const limitGB = (limit / (1024 ** 3)).toFixed(1);
  
  // Calcular porcentagem
  const percentage = Math.min(Math.round((used / limit) * 100), 100);
  
  // Status baseado na porcentagem
  const getStatus = () => {
    if (percentage >= 95) return "critical";
    if (percentage >= 90) return "warning";
    if (percentage >= 70) return "caution";
    return "ok";
  };
  
  const status = getStatus();
  
  // Limites de arquivos
  const fileLimit = plan === "premium" ? "Ilimitado" : "20";
  const fileLimitReached = plan !== "premium" && fileCount >= 20;
  
  // ============================================================================
  // VISUAL CONFIGS
  // ============================================================================
  
  const statusConfig = {
    ok: {
      color: "bg-green-500",
      gradient: "from-green-400 to-emerald-500",
      textColor: "text-green-700",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      icon: CheckCircle,
      message: "Tudo certo!",
      description: "Seu armazenamento está saudável"
    },
    caution: {
      color: "bg-yellow-500",
      gradient: "from-yellow-400 to-orange-500",
      textColor: "text-yellow-700",
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
      icon: TrendingUp,
      message: "Atenção ao uso",
      description: "Considere liberar espaço em breve"
    },
    warning: {
      color: "bg-orange-500",
      gradient: "from-orange-400 to-red-500",
      textColor: "text-orange-700",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      icon: AlertTriangle,
      message: "Espaço quase cheio!",
      description: "Faça upgrade ou delete arquivos"
    },
    critical: {
      color: "bg-red-500",
      gradient: "from-red-500 to-red-700",
      textColor: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: AlertTriangle,
      message: "⚠️ Limite atingido!",
      description: "Não é possível fazer mais uploads"
    }
  };
  
  const currentStatus = statusConfig[status];
  const StatusIcon = currentStatus.icon;
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div 
      className={`rounded-lg border-2 ${currentStatus.borderColor} ${currentStatus.bgColor} p-4 transition-all duration-300 hover:shadow-md`}
      data-testid="storage-bar"
    >
      <div className="space-y-3">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className={`w-5 h-5 ${currentStatus.textColor}`} />
            <h3 className="font-semibold text-gray-900">
              Armazenamento
            </h3>
            {plan === "premium" && (
              <Crown className="w-4 h-4 text-purple-600" />
            )}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <StatusIcon className={`w-5 h-5 ${currentStatus.textColor}`} />
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">{currentStatus.message}</p>
                <p className="text-xs">{currentStatus.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              <span className="font-bold text-gray-900">{usedMB} MB</span> de{" "}
              <span className="font-semibold">
                {plan === "premium" ? `${limitGB} GB` : `${limitMB} MB`}
              </span>
            </span>
            <span 
              className={`font-bold ${currentStatus.textColor}`}
              data-testid="storage-percentage"
            >
              {percentage}%
            </span>
          </div>

          {/* Progress bar customizada */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${currentStatus.gradient} transition-all duration-500 ease-out relative`}
              style={{ width: `${percentage}%` }}
              data-testid="storage-progress"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
            </div>
            
            {/* Marcador de 90% (zona de perigo) */}
            {percentage < 90 && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-orange-400 opacity-50"
                style={{ left: '90%' }}
              />
            )}
          </div>
        </div>

        {/* File Count */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <Files className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">
              <span 
                className={`font-bold ${fileLimitReached ? 'text-red-600' : 'text-gray-900'}`}
                data-testid="file-count"
              >
                {fileCount}
              </span>
              {" / "}
              <span className="font-semibold">{fileLimit}</span> arquivos
            </span>
          </div>

          {/* Warning/Upgrade Button */}
          {plan !== "premium" && (percentage >= 70 || fileLimitReached) && (
            <Button
              size="sm"
              onClick={() => navigate("/upgrade")}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all duration-300 text-xs h-7"
            >
              <Crown className="w-3 h-3 mr-1" />
              Upgrade
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {status === "critical" && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-3 mt-2">
            <p className="text-xs font-semibold text-red-800 mb-1">
              🚨 Não é possível fazer mais uploads!
            </p>
            <p className="text-xs text-red-700 mb-2">
              {plan === "premium" 
                ? "Delete alguns arquivos para liberar espaço"
                : "Faça upgrade para Premium e ganhe 5 GB!"}
            </p>
            {plan !== "premium" && (
              <Button
                size="sm"
                onClick={() => navigate("/upgrade")}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8"
              >
                <Crown className="w-4 h-4 mr-2" />
                Ver Planos Premium
              </Button>
            )}
          </div>
        )}

        {status === "warning" && plan !== "premium" && (
          <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 mt-2">
            <p className="text-xs font-semibold text-orange-800 mb-1">
              ⚠️ Espaço quase esgotado!
            </p>
            <p className="text-xs text-orange-700 mb-2">
              Você está usando {percentage}% do seu espaço. Faça upgrade para 5 GB!
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/upgrade")}
              className="w-full border-orange-400 text-orange-700 hover:bg-orange-50 h-8"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Expandir Armazenamento
            </Button>
          </div>
        )}

        {/* Premium Benefits Teaser (apenas para free users com uso < 70%) */}
        {plan !== "premium" && status === "ok" && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-3 mt-2">
            <div className="flex items-start gap-2">
              <Crown className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-purple-900 mb-1">
                  💎 Quer mais espaço?
                </p>
                <p className="text-xs text-purple-700 mb-2">
                  Premium: <strong>5 GB</strong> + arquivos ilimitados + lixeira de 30 dias
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("/upgrade")}
                  className="w-full border-purple-400 text-purple-700 hover:bg-purple-50 h-7 text-xs"
                >
                  Ver Benefícios Premium →
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageBar;