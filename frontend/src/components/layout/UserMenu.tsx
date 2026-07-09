import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/leadMeta';
import { cn } from '@/lib/utils';

export function UserMenu({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-3 rounded-md text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          variant === 'full' ? 'w-full p-2 hover:bg-muted' : 'p-0.5',
        )}
      >
        <Avatar>
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        {variant === 'full' && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[user.role]}</p>
          </div>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings/profile')}>
          <UserRound /> My profile
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onSelect={() => navigate('/settings/organization')}>
            <Building2 /> Organization
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={handleLogout}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
