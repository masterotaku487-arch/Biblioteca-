// src/pages/DiscordCallback.jsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTokenFromUrl, getDiscordUser } from '@/utils/discordAuth';
import axios from 'axios';

const BACKEND_URL = "https://biblioteca-privada-lfp5.onrender.com";
const API = `${BACKEND_URL}/api`;

function DiscordCallback({ onLogin }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleDiscordAuth = async () => {
      try {
        console.log('🔍 Iniciando autenticação Discord...');
        
        // Pega o token da URL
        const accessToken = getTokenFromUrl();
        
        if (!accessToken) {
          console.error('❌ Token não encontrado na URL');
          navigate('/login');
          return;
        }

        console.log('✅ Token Discord recebido');

        // Busca dados do usuário no Discord
        const discordUser = await getDiscordUser(accessToken);
        
        if (!discordUser) {
          console.error('❌ Erro ao buscar usuário do Discord');
          navigate('/login');
          return;
        }

        console.log('✅ Dados do Discord:', discordUser);

        // Envia para o backend para criar/login
        const response = await axios.post(`${API}/auth/discord`, {
          discordId: discordUser.id,
          email: discordUser.email,
          username: discordUser.username,
          avatar: discordUser.avatar,
          discriminator: discordUser.discriminator
        });

        console.log('✅ Response do backend:', response.data);

        // Salva token e loga o usuário
        const { token, user } = response.data;
        onLogin(token, user);
        
        navigate('/');
      } catch (error) {
        console.error('❌ Erro na autenticação Discord:', error);
        console.error('Detalhes:', error.response?.data);
        navigate('/login');
      }
    };

    handleDiscordAuth();
  }, [navigate, onLogin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="text-center text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">🔄 Autenticando com Discord...</h2>
        <p className="text-purple-200">Aguarde um momento</p>
      </div>
    </div>
  );
}

export default DiscordCallback;
