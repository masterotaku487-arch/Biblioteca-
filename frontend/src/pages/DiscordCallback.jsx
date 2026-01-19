import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Ajustado: caminho relativo para evitar erro de build
import { getTokenFromUrl, getDiscordUser } from '../utils/discordAuth';
import axios from 'axios';

// URL CORRETA do seu servidor no Render
const BACKEND_URL = "https://biblioteca-sigma-gilt.onrender.com";
// Se o seu backend usa o prefixo /api nas rotas, mantenha o /api abaixo
const API = `${BACKEND_URL}/api`;

function DiscordCallback({ onLogin }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleDiscordAuth = async () => {
      try {
        // 1. Extrai o token da URL que o Discord enviou
        const accessToken = getTokenFromUrl();
        
        if (!accessToken) {
          console.error('Token não encontrado');
          navigate('/login');
          return;
        }

        // 2. Busca o perfil do utilizador diretamente no Discord
        const discordUser = await getDiscordUser(accessToken);
        
        if (!discordUser) {
          console.error('Erro ao buscar perfil no Discord');
          navigate('/login');
          return;
        }

        // 3. Envia os dados para o seu servidor Render guardar no Banco de Dados
        // Nota: Certifique-se que o backend tem a rota POST /api/auth/discord ou /auth/discord
        const response = await axios.post(`${BACKEND_URL}/auth/discord`, {
          discordId: discordUser.id,
          email: discordUser.email,
          username: discordUser.username,
          avatar: discordUser.avatar,
          discriminator: discordUser.discriminator
        });

        const { token, user } = response.data;
        
        // 4. Executa a função de login (salva no localStorage/Estado)
        if (onLogin) {
          onLogin(token, user);
        } else {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        }
        
        // 5. Sucesso! Vai para a Home
        navigate('/');
      } catch (error) {
        console.error('❌ Erro no processamento do login:', error);
        navigate('/login');
      }
    };

    handleDiscordAuth();
  }, [navigate, onLogin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-500 mb-4"></div>
      <h2 className="text-xl font-bold">A finalizar autenticação...</h2>
      <p className="text-gray-400">Aguarde enquanto sincronizamos com o servidor.</p>
    </div>
  );
}

export default DiscordCallback;

