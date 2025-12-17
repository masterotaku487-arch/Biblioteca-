import { useEffect } from 'react';

const GoogleCallback = () => {
  useEffect(() => {
    // Pegar token da URL
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      // Sucesso - enviar token para janela pai (popup)
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_SUCCESS', token: token },
          window.location.origin
        );
        
        // Fechar popup após 500ms
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        // Fallback: se não for popup, salvar token e redirecionar
        localStorage.setItem('token', token);
        window.location.href = '/dashboard';
      }
    } else if (error) {
      // Erro - enviar para janela pai
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error: error },
          window.location.origin
        );
        
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        // Fallback: redirecionar para login
        window.location.href = '/login?error=' + error;
      }
    } else {
      // Sem token nem erro - algo deu errado
      if (window.opener) {
        window.opener.postMessage(
          { type: 'GOOGLE_AUTH_ERROR', error: 'No token received' },
          window.location.origin
        );
        
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        window.location.href = '/login?error=authentication_failed';
      }
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f8f9fa',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Spinner de loading */}
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid #e0e0e0',
        borderTop: '4px solid #4285F4',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      
      <p style={{ 
        color: '#666', 
        fontSize: '16px',
        fontWeight: '500'
      }}>
        Processando login com Google...
      </p>
      
      {/* CSS da animação */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default GoogleCallback;