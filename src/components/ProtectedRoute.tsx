import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'student';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Still loading auth state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User authenticated but profile not yet loaded - wait for it
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Account deactivated
  if (!profile.is_active) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive">Account Deactivated</h1>
          <p className="mt-2 text-muted-foreground">Please contact the administrator.</p>
        </div>
      </div>
    );
  }

  // Check role requirement
  if (requiredRole && profile.role !== requiredRole) {
    // Redirect to appropriate dashboard based on actual role
    if (profile.role === 'admin') {
      return <Navigate to="/admin" replace />;
    }
    if (profile.role === 'student') {
      return <Navigate to="/student" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
