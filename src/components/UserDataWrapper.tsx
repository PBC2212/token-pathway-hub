import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { validateUserDataOwnership } from '@/utils/security';
import { toast } from '@/hooks/use-toast';
import { Shield, AlertTriangle } from 'lucide-react';

interface UserDataWrapperProps {
  children: React.ReactNode;
  data?: any;
  dataOwnerField?: string;
  onSecurityViolation?: () => void;
}

const UserDataWrapper: React.FC<UserDataWrapperProps> = ({
  children,
  data,
  dataOwnerField = 'user_id',
  onSecurityViolation
}) => {
  const { user } = useAuth();
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    if (user && data) {
      const validation = validateUserDataOwnership(user.id, data, dataOwnerField);
      
      if (!validation.isValid) {
        console.error('SECURITY VIOLATION:', validation.error, {
          currentUserId: user.id,
          data: data,
          ownerField: dataOwnerField
        });
        
        setIsSecure(false);
        
        toast({
          title: 'Security Error',
          description: 'Data access violation detected. You can only access your own data.',
          variant: 'destructive'
        });

        if (onSecurityViolation) {
          onSecurityViolation();
        } else {
          // Default: redirect to safe area
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 2000);
        }
      } else {
        setIsSecure(true);
      }
    }
  }, [user, data, dataOwnerField, onSecurityViolation]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Authentication required</p>
        </div>
      </div>
    );
  }

  if (!isSecure) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Data Access Violation</h2>
          <p className="text-muted-foreground mb-4">
            You are trying to access data that doesn't belong to your account. This has been logged for security purposes.
          </p>
          <div className="text-sm text-muted-foreground">
            Redirecting to your dashboard...
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default UserDataWrapper;