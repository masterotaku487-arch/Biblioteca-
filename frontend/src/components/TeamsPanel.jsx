import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Users, Plus, Mail, Trash2, UserPlus, LogOut, 
  FolderOpen, File, Play, X, Eye, Download,
  Radio, StopCircle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import LiveEditor from './LiveEditor';

const TeamsPanel = ({ user }) => {
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showTeamDetailsModal, setShowTeamDetailsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLiveEditorModal, setShowLiveEditorModal] = useState(false);
  
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [teamFiles, setTeamFiles] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsRes, invitesRes] = await Promise.all([
        axios.get(`${API}/teams`),
        axios.get(`${API}/teams/invites`)
      ]);
      
      const enrichedTeams = await Promise.all(
        teamsRes.data.map(async (team) => {
          try {
            const filesRes = await axios.get(`${API}/files`);
            const teamFiles = filesRes.data.filter(f => f.team_id === team.id);
            return {
              ...team,
              files: teamFiles,
              member_usernames: team.members
            };
          } catch (error) {
            return {
              ...team,
              files: [],
              member_usernames: team.members
            };
          }
        })
      );
      
      setTeams(enrichedTeams);
      setInvites(invitesRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar times e convites');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeam.name.trim()) {
      toast.error('Nome do time é obrigatório');
      return;
    }
    
    try {
      await axios.post(`${API}/teams`, newTeam);
      toast.success('Time criado com sucesso!');
      setNewTeam({ name: '', description: '' });
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao criar time');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberUsername.trim()) {
      toast.error('Username é obrigatório');
      return;
    }
    
    try {
      await axios.post(`${API}/teams/${selectedTeam.id}/members`, { 
        username: newMemberUsername.trim() 
      });
      toast.success(`${newMemberUsername} adicionado ao time!`);
      setNewMemberUsername('');
      setShowAddMemberModal(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async (teamId, username) => {
    if (!confirm(`Tem certeza que deseja remover ${username} do time?`)) return;
    
    try {
      await axios.delete(`${API}/teams/${teamId}/members/${username}`);
      toast.success('Membro removido com sucesso!');
      loadData();
    } catch (error) {
      toast.error('Erro ao remover membro');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Deletar este time? Esta ação não pode ser desfeita.')) return;
    
    try {
      await axios.delete(`${API}/teams/${teamId}`);
      toast.success('Time deletado com sucesso!');
      setShowTeamDetailsModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao deletar time');
    }
  };

  const handleRespondInvite = async (inviteId, action) => {
    try {
      await axios.post(`${API}/teams/invites/${inviteId}/respond`, { action });
      toast.success(action === 'accept' ? 'Convite aceito!' : 'Convite recusado');
      loadData();
    } catch (error) {
      toast.error('Erro ao responder convite');
    }
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Selecione um arquivo');
      return;
    }
    
    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('team_id', selectedTeam.id);
    
    try {
      await axios.post(`${API}/files/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Arquivo enviado com sucesso!');
      setUploadFile(null);
      setShowUploadModal(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao fazer upload');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleStartLiveSession = async (file, team) => {
    if (!team.members.includes(user.username)) {
      toast.error('Você não tem permissão para editar este arquivo');
      return;
    }
    
    setSelectedFile(file);
    setSelectedTeam(team);
    setShowLiveEditorModal(true);
    toast.success('Sessão Live iniciada!');
  };

  const openTeamDetails = (team) => {
    setSelectedTeam(team);
    setTeamFiles(team.files || []);
    setShowTeamDetailsModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando times...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Convites Pendentes */}
      {invites.length > 0 && (
        <Card className="glass border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Convites Pendentes ({invites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm"
                >
                  <div>
                    <p className="font-medium">{invite.team_name}</p>
                    <p className="text-sm text-gray-600">
                      Convite de {invite.inviter_username}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRespondInvite(invite.id, 'accept')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Aceitar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRespondInvite(invite.id, 'reject')}
                    >
                      Recusar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header e Botão Criar Time */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Meus Times</h2>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Criar Time
        </Button>
      </div>

      {/* Lista de Times */}
      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">Você ainda não faz parte de nenhum time</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Time
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card
              key={team.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => openTeamDetails(team)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{team.name}</span>
                  {team.created_by === user?.username && (
                    <Badge className="bg-purple-100 text-purple-700">Admin</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{team.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {team.members?.length || 0} membros
                  </span>
                  <span className="text-gray-600">
                    {team.files?.length || 0} arquivos
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Criar Time */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Criar Novo Time</DialogTitle>
            <DialogDescription>
              Crie um time para colaborar com outros usuários
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Nome do Time</Label>
              <Input
                id="team-name"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="Digite o nome do time"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">Descrição</Label>
              <Input
                id="team-description"
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar Time</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Live Editor */}
      <Dialog open={showLiveEditorModal} onOpenChange={setShowLiveEditorModal}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Editor ao Vivo - {selectedFile?.original_name}</DialogTitle>
            <DialogDescription>
              Editando arquivo {selectedFile?.original_name} no time {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="font-bold text-lg">Sessão Live - {selectedFile?.original_name}</h3>
                  <p className="text-sm text-purple-100">
                    Time: {selectedTeam?.name} • {selectedTeam?.members?.length} membros online
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLiveEditorModal(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedFile && selectedTeam && (
                <LiveEditor
                  file={selectedFile}
                  team={selectedTeam}
                  user={user}
                  onClose={() => setShowLiveEditorModal(false)}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamsPanel;
