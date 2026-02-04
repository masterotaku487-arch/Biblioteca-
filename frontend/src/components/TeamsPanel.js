import { useState, useEffect } from "react";
import axios from "axios";
import { API } from "@/App";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Plus, Trash2, UserPlus, LogOut } from "lucide-react";
import { toast } from "sonner";

const TeamsPanel = ({ user, onTeamsUpdate }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: "", description: "" });
  const [newMemberUsername, setNewMemberUsername] = useState("");

  useEffect(() => {
    loadTeams();
  }, []);

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
              <p className="text-gray-600">Colabore com outras pessoas compartilhando arquivos</p>
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
                  {team.created_by === user.username && (
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteTeam(team.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
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
    </div>
  );
};

export default TeamsPanel;
