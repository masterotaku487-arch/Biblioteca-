import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { 
  Radio, Users, Save, Download, Eye, 
  AlertCircle, CheckCircle, Loader2, WifiOff 
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { API } from '@/App';

// Função para gerar cores únicas para cada usuário
const getUserColor = (username) => {
  const colors = [
    'from-red-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-purple-500 to-indigo-500',
    'from-pink-500 to-rose-500',
  ];
  const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const LiveEditor = ({ file, team, user, onClose }) => {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [activeUsers, setActiveUsers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [cursors, setCursors] = useState({});
  
  const wsRef = useRef(null);
  const textareaRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Carregar conteúdo do arquivo
  useEffect(() => {
    loadFileContent();
  }, [file.id]);

  // Conectar ao WebSocket
  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [file.id, team.id, user.username]);

  const loadFileContent = async () => {
    try {
      const response = await axios.get(`${API}/files/${file.id}/preview`);
      
      if (response.data.type === 'text') {
        setContent(response.data.content);
        setOriginalContent(response.data.content);
      } else if (response.data.type === 'base64') {
        // Para arquivos não-texto, mostrar preview
        setContent(`[Arquivo binário - ${file.file_type}]\nTamanho: ${(file.file_size / 1024).toFixed(2)} KB\n\nEdição de arquivos binários não suportada no modo Live.`);
        setOriginalContent(content);
      }
    } catch (error) {
      console.error('Erro ao carregar arquivo:', error);
      toast.error('Erro ao carregar conteúdo do arquivo');
    }
  };

  const connectWebSocket = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = API.replace('http://', '').replace('https://', '');
    // ✅ CORREÇÃO: Adicionar /api no caminho do WebSocket
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/live/${team.id}/${file.id}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket conectado');
        setConnected(true);
        
        // Enviar mensagem de entrada
        wsRef.current.send(JSON.stringify({
          type: 'join',
          username: user.username,
          team_id: team.id,
          file_id: file.id
        }));
        
        toast.success('Conectado à sessão Live!');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Erro WebSocket:', error);
        setConnected(false);
        toast.error('Erro na conexão Live');
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket desconectado');
        setConnected(false);
        
        // Tentar reconectar após 3 segundos
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Tentando reconectar...');
          connectWebSocket();
        }, 3000);
      };
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      setConnected(false);
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'user_joined':
        setActiveUsers(prev => {
          if (!prev.find(u => u.username === data.username)) {
            return [...prev, { username: data.username, color: getUserColor(data.username) }];
          }
          return prev;
        });
        toast.info(`${data.username} entrou na sessão`, { duration: 2000 });
        break;
        
      case 'user_left':
        setActiveUsers(prev => prev.filter(u => u.username !== data.username));
        toast.info(`${data.username} saiu da sessão`, { duration: 2000 });
        break;
        
      case 'users_list':
        setActiveUsers(data.users.map(username => ({
          username,
          color: getUserColor(username)
        })));
        break;
        
      case 'content_update':
        if (data.username !== user.username) {
          setContent(data.content);
          setUnsavedChanges(false);
          toast.info(`${data.username} atualizou o conteúdo`, { duration: 2000 });
        }
        break;
        
      case 'cursor_position':
        if (data.username !== user.username) {
          setCursors(prev => ({
            ...prev,
            [data.username]: {
              position: data.position,
              color: getUserColor(data.username)
            }
          }));
        }
        break;
        
      case 'file_saved':
        setLastSaved(new Date());
        setUnsavedChanges(false);
        toast.success('Arquivo salvo com sucesso!');
        break;
        
      case 'error':
        toast.error(data.message || 'Erro na sessão Live');
        break;
        
      default:
        console.log('Mensagem WebSocket não tratada:', data);
    }
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setUnsavedChanges(true);
    
    // Enviar atualização via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'content_update',
        username: user.username,
        content: newContent,
        team_id: team.id,
        file_id: file.id
      }));
    }
    
    // Auto-save após 2 segundos de inatividade
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
  };

  const handleCursorMove = useCallback((e) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const cursorPosition = e.target.selectionStart;
      
      wsRef.current.send(JSON.stringify({
        type: 'cursor_position',
        username: user.username,
        position: cursorPosition,
        team_id: team.id,
        file_id: file.id
      }));
    }
  }, [user.username, team.id, file.id]);

  const handleSave = async () => {
    if (!unsavedChanges) return;
    
    setSaving(true);
    try {
      // Aqui você implementaria a lógica de salvar o arquivo
      // Por enquanto, vamos simular um salvamento
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Notificar via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'file_saved',
          username: user.username,
          team_id: team.id,
          file_id: file.id
        }));
      }
      
      setOriginalContent(content);
      setLastSaved(new Date());
      setUnsavedChanges(false);
      toast.success('Arquivo salvo!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar arquivo');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      window.open(`${API}/files/${file.id}/download`, '_blank');
      toast.success('Download iniciado!');
    } catch (error) {
      toast.error('Erro ao fazer download');
    }
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Editor Principal */}
      <div className="flex-1 flex flex-col">
        {/* Barra de Status */}
        <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Badge 
              variant={connected ? "default" : "destructive"} 
              className={connected ? "bg-green-500" : ""}
            >
              {connected ? (
                <>
                  <Radio className="w-3 h-3 mr-1 animate-pulse" />
                  Conectado
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Desconectado
                </>
              )}
            </Badge>
            
            {unsavedChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                <AlertCircle className="w-3 h-3 mr-1" />
                Alterações não salvas
              </Badge>
            )}
            
            {lastSaved && !unsavedChanges && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="w-3 h-3 mr-1" />
                Salvo {lastSaved.toLocaleTimeString()}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={saving || !unsavedChanges}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
        
        {/* Área de Edição */}
        <div className="flex-1 p-4 overflow-hidden">
          <div className="h-full relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onSelect={handleCursorMove}
              onClick={handleCursorMove}
              className="w-full h-full font-mono text-sm resize-none border-2 border-purple-200 focus:border-purple-500 rounded-lg p-4"
              placeholder="Comece a editar..."
              spellCheck={false}
            />
            
            {/* Indicadores de Cursor de outros usuários */}
            {Object.entries(cursors).map(([username, cursor]) => (
              <div
                key={username}
                className="absolute pointer-events-none"
                style={{
                  top: `${Math.floor(cursor.position / 80) * 20}px`,
                  left: `${(cursor.position % 80) * 8}px`,
                }}
              >
                <div className={`w-0.5 h-5 bg-gradient-to-b ${cursor.color} animate-pulse`} />
                <div className={`text-xs text-white px-2 py-1 rounded bg-gradient-to-r ${cursor.color} whitespace-nowrap`}>
                  {username}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Sidebar de Usuários Ativos */}
      <div className="w-72 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Usuários Ativos
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {activeUsers.length} {activeUsers.length === 1 ? 'pessoa' : 'pessoas'} editando
          </p>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {activeUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aguardando usuários...</p>
              </div>
            ) : (
              activeUsers.map((activeUser) => (
                <div
                  key={activeUser.username}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className={`bg-gradient-to-br ${activeUser.color} text-white font-bold`}>
                      {activeUser.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{activeUser.username}</p>
                    {activeUser.username === user.username && (
                      <Badge className="mt-1 bg-purple-100 text-purple-700 text-xs">
                        Você
                      </Badge>
                    )}
                  </div>
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${activeUser.color} animate-pulse`} />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t bg-gray-50">
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Time:</span>
              <span className="font-medium">{team.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Arquivo:</span>
              <span className="font-medium truncate max-w-[150px]" title={file.original_name}>
                {file.original_name}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tamanho:</span>
              <span className="font-medium">{(file.file_size / 1024).toFixed(2)} KB</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveEditor;
