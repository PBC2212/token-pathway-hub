import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { validateUserDataOwnership, validateAdminAccess } from '@/utils/security';
import { toast } from '@/hooks/use-toast';
import { Shield, AlertTriangle } from 'lucide-react';

interface SecurityBoundaryProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  onSecurityViolation?: () => void;
}

interface UserProfile {
  user_id: string;
  role: string;
  email: string;
}

const SecurityBoundary: React.FC<SecurityBoundaryProps> = ({
  children,
  requireAdmin = false,
  onSecurityViolation
}) => {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [securityValid, setSecurityValid] = useState(false);

  useEffect(() => {
    validateSecurity();
  }, [user, session, requireAdmin]);

  const validateSecurity = async () => {
    try {
      setLoading(true);
      
      if (!user || !session) {
        setSecurityValid(false);
        return;
      }

      // SECURITY: Fetch fresh user profile to validate role
      const { data: response, error } = await supabase.functions.invoke('get-user-profile', {
        body: { operation: 'get_profile' },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error || !response.success) {
        console.error('Security validation failed:', error);
        setSecurityValid(false);
        handleSecurityViolation('Profile validation failed');
        return;
      }

      const userProfile = response.profile;
      setProfile(userProfile);

      // SECURITY: Validate user ID matches session
      if (userProfile.user_id !== user.id) {
        console.error('SECURITY BREACH: User ID mismatch', {
          sessionUserId: user.id,
          profileUserId: userProfile.user_id
        });
        setSecurityValid(false);
        handleSecurityViolation('User identity mismatch detected');
        return;
      }

      // SECURITY: Validate admin access if required
      if (requireAdmin) {
        const adminValidation = validateAdminAccess(userProfile.role);
        if (!adminValidation.isValid) {
          console.error('SECURITY: Non-admin accessing admin area', {
            userId: user.id,
            userRole: userProfile.role
          });
          setSecurityValid(false);
          handleSecurityViolation('Admin access required');
          return;
        }
      }

      setSecurityValid(true);
    } catch (error) {
      console.error('Security validation error:', error);
      setSecurityValid(false);
      handleSecurityViolation('Security validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityViolation = (reason: string) => {
    toast({
      title: 'Security Error',
      description: reason,
      variant: 'destructive'
    });
    
    if (onSecurityViolation) {
      onSecurityViolation();
    } else {
      // Default action: redirect to safe area
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Validating security permissions...</p>
        </div>
      </div>
    );
  }

  if (!securityValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Security Validation Failed</h2>
          <p className="text-muted-foreground mb-4">
            Your access permissions could not be validated. You will be redirected to a safe area.
          </p>
          <div className="text-sm text-muted-foreground">
            If you believe this is an error, please sign out and sign back in.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default SecurityBoundary;