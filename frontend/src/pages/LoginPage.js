import { useState } from "react";
import axios from "axios";
import { API } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Lock, User, LogIn, UserPlus } from "lucide-react";

const LoginPage = ({ onLogin }) => {
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  // Login tradicional
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      toast.success("Login bem-sucedido!");
      onLogin(response.data.access_token, response.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  // Registro tradicional
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/register`, registerData);
      toast.success("Conta criada com sucesso!");
      onLogin(response.data.access_token, response.data.user);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  // Login com Google - NOVA FUNÇÃO
  const handleGoogleLogin = () => {
    const backendUrl = API; // Usa a mesma URL do API
    const googleAuthUrl = `${backendUrl}/auth/google/login`;
    
    const width = 500;
    const height = 600;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const popup = window.open(
      googleAuthUrl, 
      'Google Login', 
      `width=${width},height=${height},left=${left},top=${top}`
    );
    
    const messageListener = (event) => {
      if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
        popup?.close();
        window.removeEventListener('message', messageListener);
        
        // Buscar dados do usuário com o token
        const token = event.data.token;
        axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => {
          toast.success("Login com Google realizado!");
          onLogin(token, res.data);
        })
        .catch(() => {
          toast.error("Erro ao obter dados do usuário");
        });
        
      } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
        popup?.close();
        window.removeEventListener('message', messageListener);
        toast.error('Erro ao fazer login com Google');
      }
    };
    
    window.addEventListener('message', messageListener);
    
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageListener);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-3" style={{fontFamily: 'Manrope'}}>
            Biblioteca Privada
          </h1>
          <p className="text-gray-600 text-base">Sistema seguro de compartilhamento de arquivos</p>
        </div>

        <Card className="glass shadow-xl border-0" data-testid="login-card">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold" style={{fontFamily: 'Manrope'}}>
              Bem-vindo
            </CardTitle>
            <CardDescription>Entre ou crie uma nova conta</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="login-tab">
                  <LogIn className="w-4 h-4 mr-2" />
                  Entrar
                </TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Registrar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                {/* BOTÃO GOOGLE - NOVO */}
                <div className="mb-4">
                  <Button
                    onClick={handleGoogleLogin}
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-3"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="font-medium text-gray-700">Continuar com Google</span>
                  </Button>
                  
                  {/* Divisor "OU" */}
                  <div className="flex items-center my-6">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-4 text-sm text-gray-500 font-medium">OU</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>
                </div>

                {/* Formulário tradicional */}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Usuário</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-username"
                        data-testid="login-username-input"
                        type="text"
                        placeholder="Digite seu usuário"
                        className="pl-10"
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="login-password"
                        data-testid="login-password-input"
                        type="password"
                        placeholder="Digite sua senha"
                        className="pl-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <Button
                    data-testid="login-submit-button"
                    type="submit"
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    disabled={loading}
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                {/* BOTÃO GOOGLE também no registro */}
                <div className="mb-4">
                  <Button
                    onClick={handleGoogleLogin}
                    type="button"
                    variant="outline"
                    className="w-full h-11 border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-3"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className="font-medium text-gray-700">Registrar com Google</span>
                  </Button>
                  
                  {/* Divisor "OU" */}
                  <div className="flex items-center my-6">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-4 text-sm text-gray-500 font-medium">OU</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>
                </div>

                {/* Formulário tradicional */}
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Usuário</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-username"
                        data-testid="register-username-input"
                        type="text"
                        placeholder="Escolha um usuário"
                        className="pl-10"
                        value={registerData.username}
                        onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="register-password"
                        data-testid="register-password-input"
                        type="password"
                        placeholder="Escolha uma senha"
                        className="pl-10"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <Button
                    data-testid="register-submit-button"
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? "Criando conta..." : "Criar Conta"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;