import { useNavigate } from "react-router-dom";
import { 
  Home, 
  Search,
  ArrowLeft,
  Compass,
  HelpCircle,
  Frown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const NotFound = () => {
  const navigate = useNavigate();

  // ============================================================================
  // QUICK LINKS
  // ============================================================================

  const quickLinks = [
    {
      icon: Home,
      label: "Dashboard",
      description: "Voltar para a página inicial",
      path: "/",
      color: "from-purple-600 to-pink-600"
    },
    {
      icon: Search,
      label: "Meus Arquivos",
      description: "Acessar seus arquivos",
      path: "/",
      color: "from-blue-600 to-cyan-600"
    },
    {
      icon: Compass,
      label: "Upgrade Premium",
      description: "Ver planos e benefícios",
      path: "/upgrade",
      color: "from-yellow-600 to-orange-600"
    },
    {
      icon: HelpCircle,
      label: "Reportar Bug",
      description: "Encontrou algum problema?",
      path: "/bug-report",
      color: "from-red-600 to-orange-600"
    }
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl w-full">
        
        {/* 404 Section */}
        <div className="text-center mb-12">
          
          {/* 404 Number */}
          <div className="mb-8">
            <h1 className="text-[150px] md:text-[200px] font-black leading-none">
              <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 bg-clip-text text-transparent animate-gradient">
                404
              </span>
            </h1>
          </div>

          {/* Sad Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-400 to-slate-500 mb-6 shadow-xl">
            <Frown className="w-10 h-10 text-white" />
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Página Não Encontrada
          </h2>

          {/* Description */}
          <p className="text-lg text-gray-600 mb-2 max-w-2xl mx-auto">
            Oops! Parece que você se perdeu...
          </p>
          <p className="text-gray-500 mb-8">
            A página que você está procurando não existe ou foi movida.
          </p>

          {/* Back Button */}
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            size="lg"
            className="h-12 px-6 border-2 border-gray-300 hover:bg-gray-50"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Voltar para Página Anterior
          </Button>
        </div>

        {/* Quick Links */}
        <Card className="glass border-0 shadow-2xl">
          <CardContent className="p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
              Links Rápidos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickLinks.map((link, index) => {
                const Icon = link.icon;
                return (
                  <button
                    key={index}
                    onClick={() => navigate(link.path)}
                    className="group flex items-center gap-4 p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-purple-300 transition-all duration-300 hover:shadow-lg text-left"
                  >
                    <div className={`flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br ${link.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1 group-hover:text-purple-600 transition-colors">
                        {link.label}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {link.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Main CTA */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <Button
                onClick={() => navigate("/")}
                className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Home className="w-5 h-5 mr-2" />
                Ir para o Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>
            Precisa de ajuda?{" "}
            <button
              onClick={() => navigate("/bug-report")}
              className="text-purple-600 hover:underline font-medium"
            >
              Entre em contato
            </button>
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

        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
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

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default NotFound;
