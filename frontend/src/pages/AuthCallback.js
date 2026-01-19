import React, { useEffect } from 'react';
import { getTokenFromUrl, getDiscordUser, saveToken, saveUser } from '../services/discordAuth';

function AuthCallback() {
  useEffect(() => {
    const handleAuth = async () => {
      const token = getTokenFromUrl();
      
      if (token) {
        console.log('✅ Token recebido:', token);
        
        // Salva o token
        saveToken(token);
        
        // Busca dados do usuário
        const user = await getDiscordUser(token);
        
        if (user) {
          console.log('✅ Usuário:', user);
          saveUser(user);
          
          // Redireciona para a página principal
          window.location.href = '/';
        } else {
          alert('Erro ao buscar dados do usuário');
          window.location.href = '/';
        }
      } else {
        console.error('❌ Token não encontrado');
        window.location.href = '/';
      }
    };
    
    handleAuth();
  }, []);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#5865F2'
    }}>
      <div style={{
        textAlign: 'center',
        color: 'white'
      }}>
        <h2>🔄 Autenticando com Discord...</h2>
        <p>Aguarde um momento</p>
      </div>
    </div>
  );
}

export default AuthCallback;
