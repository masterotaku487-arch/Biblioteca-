import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BookOpen, Home, Share2, Users, Crown, Settings, LogOut, Bug } from 'lucide-react';
import { useState } from 'react';
import BugReportModal from './BugReportModal';

export default function Navbar({ user, setUser }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [bugModalOpen, setBugModalOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Meus Arquivos', icon: Home },
    { path: '/shared', label: 'Compartilhados', icon: Share2 },
    { path: '/teams', label: 'Times', icon: Users, premium: true },
  ];

  return (
    <>
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 font-semibold">
                <BookOpen className="w-6 h-6 text-primary" />
                <span className="text-lg">Biblioteca</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link key={item.path} to={item.path}>
                    <Button
                      variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                      size="sm"
                      className="relative"
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.label}
                      {item.premium && user.plan !== 'premium' && (
                        <Crown className="w-3 h-3 ml-1 text-yellow-500" />
                      )}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user.plan === 'premium' ? (
                <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium">
                  <Crown className="w-3 h-3" />
                  PREMIUM
                </div>
              ) : (
                <Link to="/upgrade">
                  <Button size="sm" className="hidden sm:flex">
                    <Crown className="w-4 h-4 mr-1" />
                    Upgrade
                  </Button>
                </Link>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        Plano {user.plan === 'premium' ? 'Premium' : 'Free'}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBugModalOpen(true)}>
                    <Bug className="mr-2 h-4 w-4" />
                    Reportar Bug
                  </DropdownMenuItem>
                  {user.plan !== 'premium' && (
                    <DropdownMenuItem onClick={() => navigate('/upgrade')}>
                      <Crown className="mr-2 h-4 w-4" />
                      Fazer Upgrade
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      <BugReportModal
        open={bugModalOpen}
        onClose={() => setBugModalOpen(false)}
        user={user}
      />
    </>
  );
}