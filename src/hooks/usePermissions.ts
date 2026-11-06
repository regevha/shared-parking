import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/enums';

/** Role of the signed-in user (defaults to plain user when signed out) and role flags. */
export function usePermissions() {
  const { user } = useAuth();
  const role = (user?.role ?? UserRole.USER) as UserRole;
  return {
    role,
    isOwner: role === UserRole.OWNER,
    isManager: role === UserRole.MANAGER,
  };
}
