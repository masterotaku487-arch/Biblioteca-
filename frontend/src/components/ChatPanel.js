import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Send, MessageCircle, Crown, Trash2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

const ChatPanel = ({ user, chatEnabled, onChatToggle }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [ws, setWs] = useState(null);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (chatEnabled || isAdmin) {
      loadMessages();
      connectWebSocket();
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [chatEnabled]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    try {
      const response = await axios.get(`${API}/chat/messages`);
      setMessages(response.data);
    } catch (error) {
      if (error.response?.status !== 403) {
        toast.error("Erro ao carregar mensagens");
      }
    }
  };

  const connectWebSocket = () => {
    const wsUrl = API.replace("https://", "wss://").replace("http://", "ws://");
    const websocket = new WebSocket(`${wsUrl}/ws/chat`);

    websocket.onopen = () => {
      setConnected(true);
      if (isAdmin || chatEnabled) {
        toast.success("Chat conectado!");
      }
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Handle message deletion
      if (data.type === "message_deleted") {
        setMessages(prev => prev.filter(msg => msg.id !== data.message_id));
        return;
      }
      
      // Add new message
      setMessages((prev) => [...prev, data]);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnected(false);
    };

    websocket.onclose = () => {
      setConnected(false);
      // Reconnect after 3 seconds if chat is enabled
      if (chatEnabled || isAdmin) {
        setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    setWs(websocket);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !ws || !connected) return;

    const messageData = {
      username: user.username,
      message: newMessage.trim(),
      role: user.role
    };

    ws.send(JSON.stringify(messageData));
    setNewMessage("");
  };

  const handleToggleChat = async (enabled) => {
    try {
      await axios.post(`${API}/admin/chat/toggle`, { enabled });
      toast.success(enabled ? "Chat ativado!" : "Chat desativado!");
      onChatToggle();
    } catch (error) {
      toast.error("Erro ao alterar status do chat");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(`${API}/admin/chat/messages/${messageId}`);
      toast.success("Mensagem deletada!");
    } catch (error) {
      toast.error("Erro ao deletar mensagem");
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // Show blocked message for non-admin users when chat is disabled
  if (!chatEnabled && !isAdmin) {
    return (
      <Card className="glass border-0 shadow-lg max-w-4xl mx-auto" data-testid="chat-blocked">
        <CardContent className="p-12 text-center">
          <Lock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Chat Desabilitado</h3>
          <p className="text-gray-500">O chat está temporariamente desabilitado pelo administrador.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-0 shadow-lg max-w-4xl mx-auto" data-testid="chat-panel">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{fontFamily: 'Manrope'}}>
            <MessageCircle className="w-5 h-5" />
            Chat Geral
            {connected ? (
              <span className="ml-2 flex items-center text-sm font-normal text-green-600" data-testid="chat-status-connected">
                <span className="w-2 h-2 bg-green-600 rounded-full mr-2 animate-pulse"></span>
                Conectado
              </span>
            ) : (
              <span className="ml-2 flex items-center text-sm font-normal text-red-600" data-testid="chat-status-disconnected">
                <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
                Desconectado
              </span>
            )}
          </CardTitle>
          {isAdmin && (
            <div className="flex items-center gap-2" data-testid="admin-chat-controls">
              <Label htmlFor="chat-toggle" className="text-sm">
                {chatEnabled ? <Unlock className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-red-600" />}
              </Label>
              <Switch
                id="chat-toggle"
                checked={chatEnabled}
                onCheckedChange={handleToggleChat}
                data-testid="chat-toggle-switch"
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[500px] p-4" data-testid="chat-messages">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageCircle className="w-16 h-16 mb-4" />
              <p data-testid="no-messages">Nenhuma mensagem ainda. Seja o primeiro a conversar!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, index) => {
                const isOwnMessage = msg.username === user.username;
                const isAdminMessage = msg.role === "admin";
                
                return (
                  <div
                    key={index}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} animate-fade-in group`}
                    data-testid={`chat-message-${index}`}
                  >
                    <div className="flex items-start gap-2 max-w-[70%]">
                      <div
                        className={`rounded-lg px-4 py-2 ${
                          isOwnMessage
                            ? "bg-purple-600 text-white"
                            : "bg-white shadow-md text-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          {isAdminMessage && (
                            <Crown className="w-4 h-4 text-yellow-500" data-testid={`admin-crown-${index}`} />
                          )}
                          <p 
                            className={`text-xs font-bold ${
                              isAdminMessage ? (isOwnMessage ? "text-yellow-200" : "text-red-600") : ""
                            }`} 
                            data-testid={`message-username-${index}`}
                          >
                            {msg.username}
                          </p>
                        </div>
                        <p className="text-sm break-words" data-testid={`message-text-${index}`}>{msg.message}</p>
                        <p className="text-xs opacity-75 mt-1" data-testid={`message-time-${index}`}>{formatTime(msg.timestamp)}</p>
                      </div>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteMessage(msg.id)}
                          data-testid={`delete-message-${index}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <form onSubmit={sendMessage} className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <Input
              data-testid="chat-input"
              type="text"
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={!connected || (!chatEnabled && !isAdmin)}
              className="flex-1"
            />
            <Button
              data-testid="send-message-button"
              type="submit"
              disabled={!connected || !newMessage.trim() || (!chatEnabled && !isAdmin)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ChatPanel;
