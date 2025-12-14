import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Users, 
  Plus,
  Crown,
  Mail,
  UserPlus,
  UserMinus,
  Trash2,
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  Files,
  ArrowLeft,
  Settings,
  RefreshCw,
  AlertCircle,
  Info,
  Search,
  ChevronRight,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { teams as teamsAPI } from "@/services/api";

const Teams = ({ user, isPremium, isAdmin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myTeams, setMyTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetails, setTeamDetails] = useState(null);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Form states
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [inviteUsername, setInviteUsername] = useState("");

  const canCreateTeams = isPremium || isAdmin;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    loadAllData();
  }, []);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [teamsRes, invitesRes] = await Promise.all([
        teamsAPI.getMyTeams(),
        teamsAPI.getMyInvites()
      ]);
      
      setMyTeams(teamsRes.data);
      setInvites(invitesRes.data);
    } catch (error) {
      console.error("Error loading teams:", error);
      toast.error("Erro ao carregar times");
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetails = async (teamId) => {
    try {
      const [teamRes, membersRes, filesRes] = await Promise.all([
        teamsAPI.getTeam(teamId),
        teamsAPI.getTeamMembers(teamId),
        teamsAPI.getTeamFiles(teamId)
      ]);

      setTeamDetails({
        ...teamRes.data,
        members: membersRes.data,
        files: filesRes.data
      });
    } catch (error) {
      console.error("Error loading team details:", error);
      toast.error("Erro ao carregar detalhes do time");
    }
  };

  // ============================================================================
  // HANDLERS - CREATE TEAM
  // ============================================================================

  const handleCreateTeam = async () => {
    if (!canCreateTeams) {
      toast.error("Criar times é exclusivo para Premium", {
        action: {
          label: "Fazer Upgrade",
          onClick: () => navigate("/upgrade")
        }
      });
      return;
    }

    if (!createForm.name.trim()) {
      toast.error("Digite um nome para o time");
      return;
    }

    try {
      await teamsAPI.createTeam(createForm.name, createForm.description);
      toast.success(`Time "${createForm.name}" criado com sucesso! 🎉`);
      setCreateDialogOpen(false);
      setCreateForm({ name: "", description: "" });
      await loadAllData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Erro ao criar time";
      toast.error(errorMsg);
    }
  };

  // ============================================================================
  // HANDLERS - INVITES
  // ============================================================================

  const handleInviteMember = async () => {
    if (!inviteUsername.trim()) {
      toast.error("Digite um username");
      return;
    }

    try {
      await teamsAPI.inviteToTeam(selectedTeam.id, inviteUsername);
      toast.success(`Convite enviado para ${inviteUsername}! 📨`);
      setInviteDialogOpen(false);
      setInviteUsername("");
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Erro ao enviar convite";
      toast.error(errorMsg);
    }
  };

  const handleAcceptInvite = async (inviteId, teamName) => {
    try {
      await teamsAPI.acceptInvite(inviteId);
      toast.success(`Você entrou no time "${teamName}"! 🎉`);
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao aceitar convite");
    }
  };

  const handleRejectInvite = async (inviteId) => {
    try {
      await teamsAPI.rejectInvite(inviteId);
      toast.success("Convite rejeitado");
      await loadAllData();
    } catch (error) {
      toast.error("Erro ao rejeitar convite");
    }
  };

  // ============================================================================
  // HANDLERS - TEAM MANAGEMENT
  // ============================================================================

  const handleLeaveTeam = async (teamId, teamName) => {
    if (!window.confirm(`Sair do time "${teamName}"?`)) return;

    try {
      await teamsAPI.leaveTeam(teamId);
      toast.success(`Você saiu do time "${teamName}"`);
      await loadAllData();
      setDetailsDialogOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao sair do time");
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(
      `⚠️ DELETAR o time "${teamName}"?\n\n` +
      `Todos os membros serão removidos.\n` +
      `Os arquivos permanecerão com seus donos.\n\n` +
      `Esta ação NÃO pode ser desfeita!`
    )) return;

    try {
      await teamsAPI.deleteTeam(teamId);
      toast.success(`Time "${teamName}" deletado`);
      await loadAllData();
      setDetailsDialogOpen(false);
    } catch (error) {
      toast.error("Erro ao deletar time");
    }
  };

  const handleRemoveMember = async (teamId, userId, username) => {
    if (!window.confirm(`Remover ${username} do time?`)) return;

    try {
      await teamsAPI.removeMember(teamId, userId);
      toast.success(`${username} removido do time`);
      await loadTeamDetails(teamId);
    } catch (error) {
      toast.error("Erro ao remover membro");
    }
  };

  const handleViewTeamDetails = async (team) => {
    setSelectedTeam(team);
    await loadTeamDetails(team.id);
    setDetailsDialogOpen(true);
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const isTeamOwner = (team) => {
    return team.owner_id === user?.id;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Carregando times...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      
      {/* Header */}
      <header className="glass border-b border-gray-200 sticky top-0 z-50 shadow-sm backdrop-blur-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            
            {/* Left Side */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    Times
                    {canCreateTeams && <Crown className="w-5 h-5 text-purple-600" />}
                  </h1>
                  <p className="text-sm text-gray-600">
                    {myTeams.length} time(s) • {invites.length} convite(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {canCreateTeams ? (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Time
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Time</DialogTitle>
                      <DialogDescription>
                        Crie um time para colaborar com outras pessoas
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="team-name">Nome do Time *</Label>
                        <Input
                          id="team-name"
                          placeholder="Ex: Marketing, Desenvolvedores, etc"
                          value={createForm.name}
                          onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                          maxLength={50}
                        />
                      </div>
                      <div>
                        <Label htmlFor="team-desc">Descrição (Opcional)</Label>
                        <Textarea
                          id="team-desc"
                          placeholder="Descreva o propósito do time..."
                          value={createForm.description}
                          onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateTeam}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Time
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button
                  onClick={() => navigate("/upgrade")}
                  className="bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade para Criar Times
                </Button>
              )}

              <Button
                onClick={loadAllData}
                variant="outline"
                size="icon"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        
        {/* Info Card (para Free users) */}
        {!canCreateTeams && (
          <Card className="glass border-2 border-purple-200 shadow-lg mb-8">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Crown className="w-5 h-5 text-purple-600" />
                    Criar Times é Premium!
                  </h3>
                  <p className="text-sm text-gray-700 mb-3">
                    Você pode <strong>participar</strong> de times se alguém te convidar,
                    mas para <strong>criar</strong> times ilimitados você precisa do Premium.
                  </p>
                  <Button
                    onClick={() => navigate("/upgrade")}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Crown className="w-4 h-4 mr-2" />
                    Ver Planos Premium
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="my-teams" className="w-full">
          <TabsList className="glass mb-6">
            <TabsTrigger value="my-teams" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Meus Times ({myTeams.length})
            </TabsTrigger>
            <TabsTrigger value="invites" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Convites ({invites.length})
              {invites.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {invites.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* MY TEAMS TAB */}
          <TabsContent value="my-teams">
            {myTeams.length === 0 ? (
              <Card className="glass border-0 shadow-xl">
                <CardContent className="p-12 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-slate-100 flex items-center justify-center mx-auto mb-6">
                    <Users className="w-12 h-12 text-gray-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Nenhum time ainda
                  </h2>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {canCreateTeams
                      ? "Crie seu primeiro time para colaborar com outras pessoas!"
                      : "Você será notificado quando alguém te convidar para um time."}
                  </p>
                  {canCreateTeams && (
                    <Button
                      onClick={() => setCreateDialogOpen(true)}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Criar Primeiro Time
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myTeams.map((team) => (
                  <Card 
                    key={team.id}
                    className="glass border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
                    onClick={() => handleViewTeamDetails(team)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-purple-600 transition-colors">
                            {team.name}
                          </h3>
                          {team.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                              {team.description}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                      </div>

                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>{team.members?.length || 0} membro(s)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Files className="w-4 h-4" />
                          <span>{team.files?.length || 0} arquivo(s)</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                        {isTeamOwner(team) ? (
                          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                            <Crown className="w-3 h-3 mr-1" />
                            Dono
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Membro
                          </Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(team.created_at)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* INVITES TAB */}
          <TabsContent value="invites">
            {invites.length === 0 ? (
              <Card className="glass border-0 shadow-xl">
                <CardContent className="p-12 text-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mx-auto mb-6">
                    <Mail className="w-12 h-12 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-3">
                    Nenhum convite pendente
                  </h2>
                  <p className="text-gray-600 max-w-md mx-auto">
                    Quando alguém te convidar para um time, os convites aparecerão aqui.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {invites.map((invite) => (
                  <Card key={invite.id} className="glass border-2 border-blue-200 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Mail className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-gray-900 text-lg">
                              {invite.team_name}
                            </h3>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            <strong>{invite.inviter_username}</strong> convidou você para este time
                          </p>
                          <p className="text-xs text-gray-500">
                            Enviado em {formatDate(invite.created_at)}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleAcceptInvite(invite.id, invite.team_name)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aceitar
                          </Button>
                          <Button
                            onClick={() => handleRejectInvite(invite.id)}
                            size="sm"
                            variant="destructive"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* TEAM DETAILS DIALOG */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Users className="w-6 h-6" />
              {selectedTeam?.name}
            </DialogTitle>
            {selectedTeam?.description && (
              <DialogDescription className="text-base">
                {selectedTeam.description}
              </DialogDescription>
            )}
          </DialogHeader>

          {teamDetails && (
            <div className="space-y-6 py-4">
              
              {/* Members Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Membros ({teamDetails.members?.length || 0})
                  </h3>
                  {isTeamOwner(selectedTeam) && (
                    <Button
                      onClick={() => setInviteDialogOpen(true)}
                      size="sm"
                      variant="outline"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Convidar
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {teamDetails.members?.map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                          {member.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {member.username}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {member.plan}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {member.is_owner ? (
                          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                            <Crown className="w-3 h-3 mr-1" />
                            Dono
                          </Badge>
                        ) : (
                          <>
                            {isTeamOwner(selectedTeam) && (
                              <Button
                                onClick={() => handleRemoveMember(selectedTeam.id, member.id, member.username)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <UserMinus className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Files Section */}
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <Files className="w-5 h-5" />
                  Arquivos do Time ({teamDetails.files?.length || 0})
                </h3>

                {teamDetails.files?.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Nenhum arquivo compartilhado ainda
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teamDetails.files?.map((file) => (
                      <div 
                        key={file.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{file.original_name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.file_size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                        <Button size="sm" variant="ghost">
                          Ver Arquivo
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200 flex gap-2">
                {isTeamOwner(selectedTeam) ? (
                  <Button
                    onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deletar Time
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleLeaveTeam(selectedTeam.id, selectedTeam.name)}
                    variant="outline"
                    className="flex-1"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair do Time
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* INVITE MEMBER DIALOG */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Digite o username da pessoa que deseja convidar
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="invite-username">Username</Label>
            <Input
              id="invite-username"
              placeholder="Digite o username..."
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInviteMember}>
              <Mail className="w-4 h-4 mr-2" />
              Enviar Convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Teams;