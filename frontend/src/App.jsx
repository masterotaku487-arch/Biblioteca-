import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useState, useEffect, createContext, useContext } from 'react';
import { auth } from './services/api';

// ============================================================================
// PAGES IMPORTS
// ============================================================================
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SharedFiles from './pages/SharedFiles';
import Teams from './pages/Teams';
import UpgradePage from './pages/UpgradePage';
import Settings from './pages/Settings';
import GoogleCallback from './pages/GoogleCallback'; // 🆕 NOVO
import PaymentSuccess from './pages/PaymentSuccess'; // 🆕 NOVO
import PaymentFailure from './pages/PaymentFailure'; // 🆕 NOVO
import PaymentPending from './pages/PaymentPending'; // 🆕 NOVO
import Trash from './pages/Trash'; // 🆕 NOVO (Premium)
import BugReport from './pages/BugReport'; // 🆕 NOVO
import AdminPanel from './pages/AdminPanel'; // 🆕 NOVO (Admin)
import NotFound from './pages/NotFound'; // 🆕 NOVO

// ============================================================================
// CONTEXTS
// ============================================================================

// 🆕 NOVO: Context de Autenticação
export const AuthContext = createContext(null);

// 🆕 NOVO: Context de Notificações
export const NotificationContext = createContext(null);

// Hook personalizado para usar o AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Hook personalizado para usar NotificationContext
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0); // 🆕 NOVO: Contador de notificações

  // ============================================================================
  // AUTENTICAÇÃO
  // ============================================================================

  useEffect(() => {
    checkAuth();
  }, []);

  // 🆕 MELHORADO: Verificar autenticação e buscar notificações
  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    
    // Verificar se tem token na URL (Google OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      localStorage.setItem('token', urlToken);
      window.history.replaceState({}, document.title, '/');
    }
    
    const finalToken = urlToken || token;
    
    if (finalToken) {
      try {
        const response = await auth.getMe();
        setUser(response.data);
        
        // 🆕 NOVO: Buscar contador de notificações não lidas
        await fetchUnreadCount();
      } catch (error) {
        console.error('Auth error:', error);
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  };

  // 🆕 NOVO: Buscar contador de notificações
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  // 🆕 NOVO: Refresh do usuário (após upgrade, etc)
  const refreshUser = async () => {
    try {
      const response = await auth.getMe();
      setUser(response.data);
      await fetchUnreadCount();
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  // 🆕 NOVO: Logout
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setUnreadCount(0);
    window.location.href = '/login';
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Carregando Biblioteca...
          </p>
        </div>
      </div>
    );
  }
  // ============================================================================
  // ROUTE GUARDS (PROTEÇÃO DE ROTAS)
  // ============================================================================

  // 🆕 NOVO: Componente para proteger rotas que precisam de autenticação
  const ProtectedRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  // 🆕 NOVO: Componente para proteger rotas Premium
  const PremiumRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    
    if (user.plan !== 'premium' && user.role !== 'admin') {
      return <Navigate to="/upgrade" replace />;
    }
    
    return children;
  };

  // 🆕 NOVO: Componente para proteger rotas Admin
  const AdminRoute = ({ children }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    
    if (user.role !== 'admin') {
      return <Navigate to="/" replace />;
    }
    
    return children;
  };

  // 🆕 NOVO: Componente para redirecionar usuários logados
  const GuestRoute = ({ children }) => {
    if (user) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  // ============================================================================
  // CONTEXT VALUES
  // ============================================================================

  // 🆕 NOVO: Valores do AuthContext
  const authContextValue = {
    user,
    setUser,
    refreshUser,
    logout,
    isAuthenticated: !!user,
    isPremium: user?.plan === 'premium' || user?.role === 'admin',
    isAdmin: user?.role === 'admin'
  };

  // 🆕 NOVO: Valores do NotificationContext
  const notificationContextValue = {
    unreadCount,
    setUnreadCount,
    refreshUnreadCount: fetchUnreadCount
  };
  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <AuthContext.Provider value={authContextValue}>
      <NotificationContext.Provider value={notificationContextValue}>
        <BrowserRouter>
          {/* 🆕 MELHORADO: Toaster com mais opções */}
          <Toaster 
            position="top-right" 
            richColors 
            expand={true}
            duration={4000}
            closeButton
          />
          
          <Routes>
            {/* ============================================ */}
            {/* ROTAS PÚBLICAS (Apenas para não autenticados) */}
            {/* ============================================ */}
            <Route 
              path="/login" 
              element={
                <GuestRoute>
                  <Login onLogin={setUser} />
                </GuestRoute>
              } 
            />
            
            <Route 
              path="/register" 
              element={
                <GuestRoute>
                  <Register onRegister={setUser} />
                </GuestRoute>
              } 
            />

            {/* 🆕 NOVO: Google OAuth Callback */}
            <Route 
              path="/auth/google/callback" 
              element={<GoogleCallback onLogin={setUser} />} 
            />

            {/* ============================================ */}
            {/* ROTAS PROTEGIDAS (Necessita autenticação) */}
            {/* ============================================ */}
            
            {/* Dashboard Principal */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Dashboard user={user} setUser={setUser} refreshUser={refreshUser} />
                </ProtectedRoute>
              } 
            />

            {/* Arquivos Compartilhados */}
            <Route 
              path="/shared" 
              element={
                <ProtectedRoute>
                  <SharedFiles user={user} />
                </ProtectedRoute>
              } 
            />

            {/* Times (Disponível para todos, mas criar é Premium) */}
            <Route 
              path="/teams" 
              element={
                <ProtectedRoute>
                  <Teams user={user} />
                </ProtectedRoute>
              } 
            />

            {/* Upgrade para Premium */}
            <Route 
              path="/upgrade" 
              element={
                <ProtectedRoute>
                  <Upgrade user={user} refreshUser={refreshUser} />
                </ProtectedRoute>
              } 
            />

            {/* Configurações */}
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings user={user} setUser={setUser} logout={logout} />
                </ProtectedRoute>
              } 
            />

            {/* 🆕 NOVO: Reportar Bug */}
            <Route 
              path="/bug-report" 
              element={
                <ProtectedRoute>
                  <BugReport user={user} />
                </ProtectedRoute>
              } 
            />

            {/* ============================================ */}
            {/* ROTAS PREMIUM (Necessita plano premium) */}
            {/* ============================================ */}

            {/* 🆕 NOVO: Lixeira (Premium Only) */}
            <Route 
              path="/trash" 
              element={
                <PremiumRoute>
                  <Trash user={user} />
                </PremiumRoute>
              } 
            />

            {/* ============================================ */}
            {/* ROTAS ADMIN (Apenas administradores) */}
            {/* ============================================ */}

            {/* 🆕 NOVO: Painel Admin */}
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminPanel user={user} />
                </AdminRoute>
              } 
            />

            {/* ============================================ */}
            {/* ROTAS DE PAGAMENTO */}
            {/* ============================================ */}

            {/* 🆕 NOVO: Callbacks do Mercado Pago */}
            <Route 
              path="/payment/success" 
              element={
                <ProtectedRoute>
                  <PaymentSuccess refreshUser={refreshUser} />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/payment/failure" 
              element={
                <ProtectedRoute>
                  <PaymentFailure />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/payment/pending" 
              element={
                <ProtectedRoute>
                  <PaymentPending />
                </ProtectedRoute>
              } 
            />

            {/* ============================================ */}
            {/* ROTA 404 */}
            {/* ============================================ */}

            {/* 🆕 NOVO: Página 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </NotificationContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;
