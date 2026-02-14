import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  // Estados principais
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  
  // Estados de modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showTeamDetailsModal, setShowTeamDetailsModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLiveEditorModal, setShowLiveEditorModal] = useState(false);
  
  // Estados de formulários
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  
  // Estados de Live Editing
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
      
      // Adicionar dados enriquecidos aos times
      const enrichedTeams = await Promise.all(
        teamsRes.data.map(async (team) => {
          try {
            // Buscar arquivos do time
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
    // Verificar se o usuário é membro do time
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
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Mail className="w-5 h-5" />
              Convites Pendentes ({invites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div 
                  key={invite.id} 
                  className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-blue-100"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{invite.team_name}</p>
                    <p className="text-sm text-gray-600">
                      Convidado por <span className="font-medium">{invite.inviter_username}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleRespondInvite(invite.id, 'accept')}
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
      <Card className="glass border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Manrope' }}>
                <Users className="inline w-8 h-8 mr-3 text-purple-600" />
                Meus Times
              </h2>
              <p className="text-gray-600">
                Colabore em tempo real e compartilhe arquivos com sua equipe
              </p>
            </div>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Time
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Times */}
      {teams.length === 0 ? (
        <Card className="glass border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <Users className="w-20 h-20 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum time ainda</h3>
            <p className="text-gray-500 mb-6">Crie seu primeiro time para começar a colaborar</p>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
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
              className="glass border-0 shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer group"
              onClick={() => openTeamDetails(team)}
            >
              <CardHeader className="border-b border-gray-100 bg-gradient-to-br from-purple-50 to-pink-50">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-lg font-bold" style={{ fontFamily: 'Manrope' }}>
                        {team.name}
                      </span>
                      {team.created_by === user?.username && (
                        <Badge className="ml-2 bg-purple-100 text-purple-700 text-xs">
                          Owner
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardTitle>
                {team.description && (
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{team.description}</p>
                )}
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Badge variant="outline" className="flex-1 justify-center">
                      <Users className="w-3 h-3 mr-1" />
                      {team.members?.length || 0} membros
                    </Badge>
                    <Badge variant="outline" className="flex-1 justify-center">
                      <FolderOpen className="w-3 h-3 mr-1" />
                      {team.files?.length || 0} arquivos
                    </Badge>
                  </div>
                  
                  {/* Preview de membros */}
                  <div className="flex -space-x-2 overflow-hidden">
                    {team.members?.slice(0, 5).map((member, idx) => (
                      <div
                        key={idx}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow"
                        title={member}
                      >
                        {member.charAt(0).toUpperCase()}
                      </div>
                    ))}
                    {team.members?.length > 5 && (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold border-2 border-white">
                        +{team.members.length - 5}
                      </div>
                    )}
                  </div>
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
            <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'Manrope' }}>
              Criar Novo Time
            </DialogTitle>
            <DialogDescription>
              Crie um time para colaborar e compartilhar arquivos em tempo real
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Nome do Time *</Label>
              <Input
                id="team-name"
                placeholder="Ex: Projeto Inovação 2026"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                required
                className="border-purple-200 focus:border-purple-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">Descrição (Opcional)</Label>
              <Input
                id="team-description"
                placeholder="Para que serve este time?"
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                className="border-purple-200 focus:border-purple-500"
              />
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Time
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Membro */}
      <Dialog open={showAddMemberModal} onOpenChange={setShowAddMemberModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'Manrope' }}>
              Adicionar Membro
            </DialogTitle>
            <DialogDescription>
              Digite o username da pessoa para adicionar ao time <strong>{selectedTeam?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-username">Nome de Usuário</Label>
              <Input
                id="member-username"
                placeholder="username123"
                value={newMemberUsername}
                onChange={(e) => setNewMemberUsername(e.target.value)}
                required
                className="border-purple-200 focus:border-purple-500"
              />
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowAddMemberModal(false)}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes do Time */}
      <Dialog open={showTeamDetailsModal} onOpenChange={setShowTeamDetailsModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3" style={{ fontFamily: 'Manrope' }}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white">
                <Users className="w-5 h-5" />
              </div>
              {selectedTeam?.name}
            </DialogTitle>
            {selectedTeam?.description && (
              <DialogDescription className="text-base">
                {selectedTeam.description}
              </DialogDescription>
            )}
          </DialogHeader>

          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="members">
                <Users className="w-4 h-4 mr-2" />
                Membros
              </TabsTrigger>
              <TabsTrigger value="files">
                <FolderOpen className="w-4 h-4 mr-2" />
                Arquivos
              </TabsTrigger>
            </TabsList>

            {/* Tab: Membros */}
            <TabsContent value="members" className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {selectedTeam?.members?.length || 0} membros neste time
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowAddMemberModal(true);
                    setShowTeamDetailsModal(false);
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar
                </Button>
              </div>

              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-2">
                  {selectedTeam?.members?.map((member) => (
                    <div
                      key={member}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold shadow">
                          {member.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member}</p>
                          {selectedTeam?.created_by === member && (
                            <Badge className="mt-1 bg-purple-100 text-purple-700 text-xs">
                              Criador do Time
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selectedTeam?.created_by === user?.username && member !== user?.username && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMember(selectedTeam.id, member)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>
                      )}
                      {member === user?.username && selectedTeam?.created_by !== user?.username && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMember(selectedTeam.id, member)}
                          className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
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
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {teamFiles.length} arquivos compartilhados
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowUploadModal(true);
                    setShowTeamDetailsModal(false);
                  }}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>

              <ScrollArea className="h-[300px] rounded-md border p-4">
                {teamFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                    <FolderOpen className="w-16 h-16 mb-3 text-gray-300" />
                    <p>Nenhum arquivo compartilhado ainda</p>
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
                              Por {file.uploaded_by} • {(file.file_size / 1024 / 1024).toFixed(2)} MB
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

      {/* Modal: Upload de Arquivo */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'Manrope' }}>
              Upload de Arquivo
            </DialogTitle>
            <DialogDescription>
              Envie um arquivo para o time <strong>{selectedTeam?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadFile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Selecione o arquivo</Label>
              <Input
                id="file-upload"
                type="file"
                onChange={(e) => setUploadFile(e.target.files[0])}
                required
                className="border-purple-200 focus:border-purple-500"
              />
              {uploadFile && (
                <p className="text-sm text-gray-600">
                  Arquivo selecionado: <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
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
              <Button
                type="submit"
                disabled={uploadLoading}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
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
