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
  FolderOpen, File, Download, Radio, Loader2, X
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
        (teamsRes.data || []).map(async (team) => {
          try {
            const filesRes = await axios.get(`${API}/files`);
            const teamFiles = (filesRes.data || []).filter(f => f.team_id === team.id);
            return {
              ...team,
              files: teamFiles,
              members: team.members || []
            };
          } catch (error) {
            return {
              ...team,
              files: [],
              members: team.members || []
            };
          }
        })
      );
      
      setTeams(enrichedTeams);
      setInvites(invitesRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar times');
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
      toast.error('Erro ao criar time');
      console.error(error);
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
      toast.success(`Convite enviado para ${newMemberUsername}!`);
      setNewMemberUsername('');
      setShowAddMemberModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao adicionar membro');
      console.error(error);
    }
  };

  const handleRemoveMember = async (teamId, username) => {
    if (!confirm(`Remover ${username} do time?`)) return;
    
    try {
      await axios.delete(`${API}/teams/${teamId}/members/${username}`);
      toast.success('Membro removido!');
      loadData();
    } catch (error) {
      toast.error('Erro ao remover membro');
      console.error(error);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Deletar este time? Esta ação não pode ser desfeita.')) return;
    
    try {
      await axios.delete(`${API}/teams/${teamId}`);
      toast.success('Time deletado!');
      setShowTeamDetailsModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao deletar time');
      console.error(error);
    }
  };

  const handleRespondInvite = async (inviteId, action) => {
    try {
      await axios.post(`${API}/teams/invites/${inviteId}/respond`, { action });
      toast.success(action === 'accept' ? 'Convite aceito!' : 'Convite recusado');
      loadData();
    } catch (error) {
      toast.error('Erro ao responder convite');
      console.error(error);
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
      toast.success('Arquivo enviado!');
      setUploadFile(null);
      setShowUploadModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro no upload');
      console.error(error);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleStartLiveSession = (file, team) => {
    if (!team.members.includes(user.username)) {
      toast.error('Você não tem permissão para editar este arquivo');
      return;
    }
    
    console.log('🚀 Iniciando Live Editor:', { file, team, user });
    setSelectedFile(file);
    setSelectedTeam(team);
    setShowLiveEditorModal(true);
  };

  const openTeamDetails = (team) => {
    console.log('📂 Abrindo time:', team);
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
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Mail className="w-5 h-5" />
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Meus Times</h2>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600"
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
                <p className="text-sm text-gray-600 mb-4">
                  {team.description || 'Sem descrição'}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {team.members.length} membros
                  </span>
                  <span className="text-gray-600">
                    {team.files.length} arquivos
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: Criar Time */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Time</DialogTitle>
            <DialogDescription>
              Crie um time para colaborar com outros usuários
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <Label htmlFor="team-name">Nome do Time</Label>
              <Input
                id="team-name"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="Digite o nome"
                required
              />
            </div>
            <div>
              <Label htmlFor="team-desc">Descrição (opcional)</Label>
              <Input
                id="team-desc"
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder="Descreva o time"
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

      {/* Modal: Detalhes do Time */}
      <Dialog open={showTeamDetailsModal} onOpenChange={setShowTeamDetailsModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedTeam?.name}</DialogTitle>
            <DialogDescription>
              Gerencie membros e arquivos do time
            </DialogDescription>
          </DialogHeader>
          
          {selectedTeam && (
            <Tabs defaultValue="members" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="members">
                  <Users className="w-4 h-4 mr-2" />
                  Membros ({selectedTeam.members.length})
                </TabsTrigger>
                <TabsTrigger value="files">
                  <File className="w-4 h-4 mr-2" />
                  Arquivos ({teamFiles.length})
                </TabsTrigger>
              </TabsList>

              {/* Tab: Membros */}
              <TabsContent value="members" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {selectedTeam.members.length} membros no time
                  </p>
                  {selectedTeam.created_by === user?.username && (
                    <Button size="sm" onClick={() => setShowAddMemberModal(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Adicionar Membro
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[250px] rounded-md border p-4">
                  <div className="space-y-2">
                    {selectedTeam.members.map((member) => (
                      <div
                        key={member}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="font-bold text-purple-600">
                              {member.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{member}</p>
                            {member === selectedTeam.created_by && (
                              <Badge className="text-xs bg-purple-100 text-purple-700">
                                Criador
                              </Badge>
                            )}
                          </div>
                        </div>
                        {selectedTeam.created_by === user?.username && 
                         member !== selectedTeam.created_by && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveMember(selectedTeam.id, member)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <LogOut className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab: Arquivos */}
              <TabsContent value="files" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-600">
                    {teamFiles.length} arquivos compartilhados
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowUploadModal(true);
                      setShowTeamDetailsModal(false);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
                <ScrollArea className="h-[250px] rounded-md border p-4">
                  {teamFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                      <FolderOpen className="w-16 h-16 mb-3" />
                      <p>Nenhum arquivo ainda</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          setShowUploadModal(true);
                          setShowTeamDetailsModal(false);
                        }}
                      >
                        Fazer Upload
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <File className="w-8 h-8 text-purple-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">
                                {file.original_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(file.file_size / 1024).toFixed(2)} KB • Por {file.uploaded_by}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="bg-green-50 hover:bg-green-100 text-green-700"
                              onClick={() => handleStartLiveSession(file, selectedTeam)}
                              title="Iniciar Sessão Live"
                            >
                              <Radio className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(`${API}/files/${file.id}/download`, '_blank')}
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <Separator />
          
          <DialogFooter className="flex justify-between">
            {selectedTeam?.created_by === user?.username && (
              <Button
                variant="destructive"
                onClick={() => handleDeleteTeam(selectedTeam.id)}
                className="mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar Time
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowTeamDetailsModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Membro */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
            <DialogDescription>
              Enviar convite para um usuário
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={newMemberUsername}
                onChange={(e) => setNewMemberUsername(e.target.value)}
                placeholder="Digite o username"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddMemberModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Enviar Convite</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Upload */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Arquivo</DialogTitle>
            <DialogDescription>
              Enviar arquivo para o time {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadFile} className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Selecione o arquivo</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={(e) => setUploadFile(e.target.files[0])}
                required
              />
              {uploadFile && (
                <p className="text-sm text-gray-600 mt-2">
                  {uploadFile.name} ({(uploadFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadLoading}>
                {uploadLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Fazer Upload
                  </>
                )}
              </Button>
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
              Editando {selectedFile?.original_name} no time {selectedTeam?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="font-bold text-lg">
                    Sessão Live - {selectedFile?.original_name}
                  </h3>
                  <p className="text-sm text-purple-100">
                    Time: {selectedTeam?.name} • {selectedTeam?.members?.length} membros
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
