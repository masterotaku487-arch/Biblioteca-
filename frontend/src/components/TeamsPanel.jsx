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
              member_usernames: team.members || []
            };
          } catch (error) {
            return {
              ...team,
              files: [],
              member_usernames: team.members || []
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
      toast.success('Time criado!');
      setNewTeam({ name: '', description: '' });
      setShowCreateModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao criar time');
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
      toast.success(`${newMemberUsername} adicionado!`);
      setNewMemberUsername('');
      setShowAddMemberModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async (teamId, username) => {
    if (!confirm(`Remover ${username}?`)) return;
    
    try {
      await axios.delete(`${API}/teams/${teamId}/members/${username}`);
      toast.success('Membro removido!');
      loadData();
    } catch (error) {
      toast.error('Erro ao remover membro');
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Deletar time? Não pode ser desfeito.')) return;
    
    try {
      await axios.delete(`${API}/teams/${teamId}`);
      toast.success('Time deletado!');
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
      await axios.post(`${API}/files/upload`, formData);
      toast.success('Arquivo enviado!');
      setUploadFile(null);
      setShowUploadModal(false);
      loadData();
    } catch (error) {
      toast.error('Erro no upload');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleStartLiveSession = (file, team) => {
    if (!team.members.includes(user.username)) {
      toast.error('Sem permissão');
      return;
    }
    
    setSelectedFile(file);
    setSelectedTeam(team);
    setShowLiveEditorModal(true);
  };

  const openTeamDetails = (team) => {
    setSelectedTeam(team);
    setTeamFiles(team.files || []);
    setShowTeamDetailsModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Convites */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Convites ({invites.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-4 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{invite.team_name}</p>
                    <p className="text-sm text-gray-600">De: {invite.inviter_username}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleRespondInvite(invite.id, 'accept')}>
                      Aceitar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRespondInvite(invite.id, 'reject')}>
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
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Criar Time
        </Button>
      </div>

      {/* Lista de Times */}
      {teams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Users className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-600 mb-4">Nenhum time ainda</p>
            <Button onClick={() => setShowCreateModal(true)}>
              Criar Primeiro Time
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <Card key={team.id} className="cursor-pointer hover:shadow-lg" onClick={() => openTeamDetails(team)}>
              <CardHeader>
                <CardTitle>{team.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{team.description}</p>
                <div className="flex justify-between text-sm">
                  <span>{(team.members || []).length} membros</span>
                  <span>{(team.files || []).length} arquivos</span>
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
            <DialogTitle>Criar Time</DialogTitle>
            <DialogDescription>Novo time para colaboração</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={newTeam.description}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes do Time */}
      <Dialog open={showTeamDetailsModal} onOpenChange={setShowTeamDetailsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTeam?.name}</DialogTitle>
            <DialogDescription>Gerenciar time e arquivos</DialogDescription>
          </DialogHeader>
          
          {selectedTeam && (
            <Tabs defaultValue="members">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="members">Membros</TabsTrigger>
                <TabsTrigger value="files">Arquivos</TabsTrigger>
              </TabsList>

              <TabsContent value="members" className="space-y-4">
                <div className="flex justify-between items-center">
                  <p>{(selectedTeam.members || []).length} membros</p>
                  {selectedTeam.created_by === user?.username && (
                    <Button size="sm" onClick={() => setShowAddMemberModal(true)}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  )}
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {(selectedTeam.members || []).map((member) => (
                      <div key={member} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span>{member}</span>
                        {selectedTeam.created_by === user?.username && member !== selectedTeam.created_by && (
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(selectedTeam.id, member)}>
                            <LogOut className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="files" className="space-y-4">
                <div className="flex justify-between">
                  <p>{teamFiles.length} arquivos</p>
                  <Button size="sm" onClick={() => { setShowUploadModal(true); setShowTeamDetailsModal(false); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
                <ScrollArea className="h-[200px]">
                  {teamFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <FolderOpen className="w-12 h-12 mx-auto mb-2" />
                      <p>Nenhum arquivo</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamFiles.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <File className="w-6 h-6" />
                            <div>
                              <p className="font-medium">{file.original_name}</p>
                              <p className="text-xs text-gray-500">{(file.file_size / 1024).toFixed(2)} KB</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleStartLiveSession(file, selectedTeam)}>
                              <Radio className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => window.open(`${API}/files/${file.id}/download`, '_blank')}>
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
          <DialogFooter>
            {selectedTeam?.created_by === user?.username && (
              <Button variant="destructive" onClick={() => handleDeleteTeam(selectedTeam.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar
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
            <DialogDescription>Enviar convite para usuário</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember}>
            <Label>Username</Label>
            <Input
              value={newMemberUsername}
              onChange={(e) => setNewMemberUsername(e.target.value)}
              placeholder="Digite o username"
              required
            />
            <DialogFooter className="mt-4">
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
            <DialogTitle>Upload</DialogTitle>
            <DialogDescription>Enviar arquivo para {selectedTeam?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUploadFile}>
            <Input type="file" onChange={(e) => setUploadFile(e.target.files[0])} required />
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setShowUploadModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadLoading}>
                {uploadLoading ? 'Enviando...' : 'Upload'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Live Editor */}
      <Dialog open={showLiveEditorModal} onOpenChange={setShowLiveEditorModal}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Live Editor</DialogTitle>
            <DialogDescription>Editando {selectedFile?.original_name}</DialogDescription>
          </DialogHeader>
          <div className="h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 bg-purple-600 text-white">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="font-bold">Live - {selectedFile?.original_name}</h3>
                  <p className="text-sm">{selectedTeam?.name}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowLiveEditorModal(false)} className="text-white">
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
