import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Plus, Trash2, UserPlus, LogOut, Pencil, Square, Circle, Type, Eraser, Undo, Redo, Download, Palette, MousePointer } from "lucide-react";
import { toast } from "sonner";

const TeamsPanel = ({ user, onTeamsUpdate }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [newMemberUsername, setNewMemberUsername] = useState("");

  // Canvas states
  const [tool, setTool] = useState("pencil"); // pencil, rectangle, circle, text, eraser, select
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [elements, setElements] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState(null);
  const [users, setUsers] = useState({}); // Online users and their cursors
  
  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    loadTeams();
  }, []);

  // WebSocket connection for real-time collaboration
  useEffect(() => {
    if (showCanvasModal && selectedTeam) {
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [showCanvasModal, selectedTeam]);

  const connectWebSocket = () => {
    // Replace with your actual WebSocket server URL
    const ws = new WebSocket(`ws://localhost:8000/ws/canvas/${selectedTeam.id}`);
    
    ws.onopen = () => {
      console.log("Connected to canvas WebSocket");
      ws.send(JSON.stringify({
        type: "join",
        user: user.username,
        teamId: selectedTeam.id
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch(data.type) {
        case "draw":
          setElements(prev => [...prev, data.element]);
          break;
        case "cursor":
          setUsers(prev => ({
            ...prev,
            [data.user]: { x: data.x, y: data.y, color: data.color }
          }));
          break;
        case "clear":
          setElements([]);
          break;
        case "undo":
          // Handle undo from other users
          setElements(data.elements);
          break;
        case "user_joined":
          toast.info(`${data.user} entrou no canvas`);
          break;
        case "user_left":
          setUsers(prev => {
            const newUsers = {...prev};
            delete newUsers[data.user];
            return newUsers;
          });
          toast.info(`${data.user} saiu do canvas`);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast.error("Erro na conexão colaborativa");
    };

    wsRef.current = ws;
  };

  const loadTeams = async () => {
    try {
      const response = await axios.get(`${API}/teams`);
      setTeams(response.data);
      if (onTeamsUpdate) onTeamsUpdate(response.data);
    } catch (error) {
      toast.error("Erro ao carregar times");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/teams`, newTeam);
      toast.success("Time criado com sucesso!");
      setNewTeam({ name: "", description: "" });
      setShowCreateModal(false);
      loadTeams();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao criar time");
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/teams/${selectedTeam.id}/members`, { username: newMemberUsername });
      toast.success(`${newMemberUsername} adicionado ao time!`);
      setNewMemberUsername("");
      setShowAddMemberModal(false);
      loadTeams();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao adicionar membro");
    }
  };

  const handleRemoveMember = async (teamId, username) => {
    if (!confirm(`Remover ${username} do time?`)) return;
    try {
      await axios.delete(`${API}/teams/${teamId}/members/${username}`);
      toast.success("Membro removido do time!");
      loadTeams();
    } catch (error) {
      toast.error("Erro ao remover membro");
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm("Deletar este time? Todos os arquivos do time serão removidos.")) return;
    try {
      await axios.delete(`${API}/teams/${teamId}`);
      toast.success("Time deletado com sucesso!");
      loadTeams();
    } catch (error) {
      toast.error("Erro ao deletar time");
    }
  };

  // Canvas functions
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);

    if (tool === "pencil") {
      setCurrentElement({
        type: "pencil",
        points: [{ x, y }],
        color,
        lineWidth,
        user: user.username
      });
    } else if (tool === "rectangle" || tool === "circle") {
      setCurrentElement({
        type: tool,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        color,
        lineWidth,
        user: user.username
      });
    } else if (tool === "text") {
      const text = prompt("Digite o texto:");
      if (text) {
        const newElement = {
          type: "text",
          x,
          y,
          text,
          color,
          fontSize: 20,
          user: user.username
        };
        addElement(newElement);
      }
    }
  };

  const draw = (e) => {
    if (!isDrawing) {
      // Send cursor position for other users to see
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        wsRef.current.send(JSON.stringify({
          type: "cursor",
          user: user.username,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          color: color
        }));
      }
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "pencil") {
      setCurrentElement(prev => ({
        ...prev,
        points: [...prev.points, { x, y }]
      }));
    } else if (tool === "rectangle" || tool === "circle") {
      setCurrentElement(prev => ({
        ...prev,
        endX: x,
        endY: y
      }));
    }
  };

  const stopDrawing = () => {
    if (isDrawing && currentElement) {
      addElement(currentElement);
      setCurrentElement(null);
    }
    setIsDrawing(false);
  };

  const addElement = (element) => {
    const newElements = [...elements, element];
    setElements(newElements);
    setHistory([...history.slice(0, historyStep + 1), newElements]);
    setHistoryStep(historyStep + 1);

    // Send to other users
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "draw",
        element
      }));
    }
  };

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1;
      setHistoryStep(newStep);
      setElements(history[newStep] || []);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "undo",
          elements: history[newStep] || []
        }));
      }
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1;
      setHistoryStep(newStep);
      setElements(history[newStep]);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "undo",
          elements: history[newStep]
        }));
      }
    }
  };

  const clearCanvas = () => {
    if (confirm("Limpar todo o canvas?")) {
      setElements([]);
      setHistory([[...]]);
      setHistoryStep(0);
      
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "clear"
        }));
      }
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `${selectedTeam.name}-canvas.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Render canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    [...elements, currentElement].filter(Boolean).forEach(element => {
      ctx.strokeStyle = element.color;
      ctx.fillStyle = element.color;
      ctx.lineWidth = element.lineWidth || 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (element.type === "pencil") {
        ctx.beginPath();
        element.points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      } else if (element.type === "rectangle") {
        ctx.strokeRect(
          element.startX,
          element.startY,
          element.endX - element.startX,
          element.endY - element.startY
        );
      } else if (element.type === "circle") {
        const radius = Math.sqrt(
          Math.pow(element.endX - element.startX, 2) +
          Math.pow(element.endY - element.startY, 2)
        );
        ctx.beginPath();
        ctx.arc(element.startX, element.startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (element.type === "text") {
        ctx.font = `${element.fontSize}px Arial`;
        ctx.fillText(element.text, element.x, element.y);
      }
    });

    // Draw other users' cursors
    Object.entries(users).forEach(([username, cursor]) => {
      if (username !== user.username) {
        ctx.fillStyle = cursor.color;
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 5, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw username label
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.fillText(username, cursor.x + 10, cursor.y - 10);
      }
    });
  }, [elements, currentElement, users]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="glass border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{fontFamily: 'Manrope'}}>
                Meus Times
              </h2>
              <p className="text-gray-600">Colabore com outras pessoas compartilhando arquivos e editando juntos</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Criar Time
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teams List */}
      {teams.length === 0 ? (
        <Card className="glass border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">Você ainda não faz parte de nenhum time</p>
            <Button onClick={() => setShowCreateModal(true)} className="mt-4 bg-purple-600 hover:bg-purple-700">
              Criar Primeiro Time
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <Card key={team.id} className="glass border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    <span style={{fontFamily: 'Manrope'}}>{team.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowCanvasModal(true);
                      }}
                      className="text-purple-600 hover:text-purple-700"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Canvas
                    </Button>
                    {team.created_by === user.username && (
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteTeam(team.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardTitle>
                {team.description && (
                  <p className="text-sm text-gray-600 mt-2">{team.description}</p>
                )}
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Membros ({team.members.length})</span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowAddMemberModal(true);
                      }}
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {team.members.map((member) => (
                      <div key={member} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold">
                            {member.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">{member}</span>
                          {team.created_by === member && (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Criador</span>
                          )}
                        </div>
                        {team.created_by === user.username && member !== user.username && (
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(team.id, member)}>
                            <LogOut className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                        {member === user.username && team.created_by !== user.username && (
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(team.id, member)}>
                            <LogOut className="w-3 h-3 text-gray-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Time</DialogTitle>
            <DialogDescription>
              Crie um time para colaborar e compartilhar arquivos com outras pessoas
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Nome do Time *</Label>
              <Input
                id="team-name"
                placeholder="Ex: Projeto Escola"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">Descrição (Opcional)</Label>
              <Input
                id="team-description"
                placeholder="Para que serve este time?"
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                Criar Time
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Member Modal */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
            <DialogDescription>
              Digite o nome de usuário da pessoa que deseja adicionar ao time {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-username">Nome de Usuário</Label>
              <Input
                id="member-username"
                placeholder="Digite o username"
                value={newMemberUsername}
                onChange={(e) => setNewMemberUsername(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddMemberModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Canvas Modal */}
      <Dialog open={showCanvasModal} onOpenChange={setShowCanvasModal}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Canvas Colaborativo - {selectedTeam?.name}</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  <span>{Object.keys(users).length + 1} online</span>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-full gap-4">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg flex-wrap">
              {/* Tools */}
              <div className="flex gap-1 border-r pr-2">
                <Button
                  size="sm"
                  variant={tool === "select" ? "default" : "outline"}
                  onClick={() => setTool("select")}
                  title="Selecionar"
                >
                  <MousePointer className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={tool === "pencil" ? "default" : "outline"}
                  onClick={() => setTool("pencil")}
                  title="Pincel"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={tool === "rectangle" ? "default" : "outline"}
                  onClick={() => setTool("rectangle")}
                  title="Retângulo"
                >
                  <Square className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={tool === "circle" ? "default" : "outline"}
                  onClick={() => setTool("circle")}
                  title="Círculo"
                >
                  <Circle className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={tool === "text" ? "default" : "outline"}
                  onClick={() => setTool("text")}
                  title="Texto"
                >
                  <Type className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant={tool === "eraser" ? "default" : "outline"}
                  onClick={() => setTool("eraser")}
                  title="Apagador"
                >
                  <Eraser className="w-4 h-4" />
                </Button>
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-2 border-r pr-2">
                <Palette className="w-4 h-4 text-gray-500" />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-8 rounded cursor-pointer"
                />
                <div className="flex gap-1">
                  {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'].map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded border-2 border-gray-300 hover:border-gray-500"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Line width */}
              <div className="flex items-center gap-2 border-r pr-2">
                <span className="text-sm text-gray-600">Espessura:</span>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-gray-600 w-8">{lineWidth}px</span>
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={undo}
                  disabled={historyStep === 0}
                  title="Desfazer"
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={redo}
                  disabled={historyStep >= history.length - 1}
                  title="Refazer"
                >
                  <Redo className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={clearCanvas}
                  title="Limpar"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadCanvas}
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-auto border rounded-lg bg-white">
              <canvas
                ref={canvasRef}
                width={1200}
                height={800}
                className="cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>

            {/* Online users */}
            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <span className="text-sm font-medium">Online:</span>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 px-2 py-1 bg-white rounded text-sm">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium">{user.username} (você)</span>
                </div>
                {Object.entries(users).map(([username, userData]) => (
                  <div key={username} className="flex items-center gap-1 px-2 py-1 bg-white rounded text-sm">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: userData.color }}
                    />
                    <span>{username}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamsPanel;
