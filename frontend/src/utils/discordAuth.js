// src/utils/discordAuth.js

// Suas credenciais Discord
const DISCORD_CLIENT_ID = '1462810121318043721';

// URL de redirecionamento (automática: local ou produção)
const REDIRECT_URI = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/auth/discord/callback'
  : 'https://biblioteca-sigma-gilt.vercel.app/auth/discord/callback';

// URL de autorização do Discord
export const getDiscordAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: 'identify email'
  });
  
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
};

// Redireciona para login do Discord
export const loginWithDiscord = () => {
  window.location.href = getDiscordAuthUrl();
};

// Pega o token da URL (após redirect do Discord)
export const getTokenFromUrl = () => {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
};

// Busca dados do usuário no Discord
export const getDiscordUser = async (accessToken) => {
  try {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) throw new Error('Erro ao buscar usuário');
    
    const data = await response.json();
    
    return {
      id: data.id,
      username: data.username,
      discriminator: data.discriminator,
      avatar: data.avatar 
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(data.discriminator) % 5}.png`,
      email: data.email,
      verified: data.verified
    };
  } catch (error) {
    console.error('Erro ao buscar usuário Discord:', error);
    return null;
  }
};
