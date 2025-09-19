// CRITICAL SECURITY MODULE - Data Breach Prevention
// This module prevents any cross-user data contamination

export interface SecurityValidationResult {
  isValid: boolean;
  error?: string;
}

// Validate that user can only see their own data
export function validateUserDataOwnership(
  currentUserId: string,
  data: any,
  dataOwnerField: string = 'user_id'
): SecurityValidationResult {
  if (!currentUserId) {
    return { isValid: false, error: 'No authenticated user' };
  }

  if (!data) {
    return { isValid: true }; // Empty data is safe
  }

  // Handle arrays of data
  if (Array.isArray(data)) {
    const invalidItems = data.filter(item => 
      item[dataOwnerField] && item[dataOwnerField] !== currentUserId
    );
    
    if (invalidItems.length > 0) {
      console.error('SECURITY BREACH DETECTED:', {
        currentUserId,
        invalidItems: invalidItems.map(item => ({ 
          itemId: item.id, 
          ownerId: item[dataOwnerField] 
        }))
      });
      return { 
        isValid: false, 
        error: `Data contains ${invalidItems.length} items not belonging to current user` 
      };
    }
    return { isValid: true };
  }

  // Handle single data object
  if (data[dataOwnerField] && data[dataOwnerField] !== currentUserId) {
    console.error('SECURITY BREACH DETECTED:', {
      currentUserId,
      dataOwnerId: data[dataOwnerField],
      dataId: data.id
    });
    return { 
      isValid: false, 
      error: 'Data does not belong to current user' 
    };
  }

  return { isValid: true };
}

// Filter data to only include current user's items
export function filterUserData<T extends Record<string, any>>(
  currentUserId: string,
  data: T[],
  dataOwnerField: string = 'user_id'
): T[] {
  if (!currentUserId || !Array.isArray(data)) {
    return [];
  }

  const filteredData = data.filter(item => 
    item[dataOwnerField] === currentUserId
  );

  // Log any filtered items for security monitoring
  const filteredCount = data.length - filteredData.length;
  if (filteredCount > 0) {
    console.warn('SECURITY: Filtered out', filteredCount, 'items not belonging to user', currentUserId);
  }

  return filteredData;
}

// Validate admin access
export function validateAdminAccess(userRole: string | undefined): SecurityValidationResult {
  if (userRole !== 'admin') {
    console.error('SECURITY: Non-admin attempted admin access:', userRole);
    return { isValid: false, error: 'Admin access required' };
  }
  return { isValid: true };
}

// Sanitize data to remove PII from non-owners
export function sanitizeDataForDisplay<T extends Record<string, any>>(
  data: T[], 
  currentUserId: string,
  isAdmin: boolean = false
): T[] {
  return data.map(item => {
    // Admins see sanitized version, users see only their own data
    if (item.user_id !== currentUserId && !isAdmin) {
      // This should never happen with proper filtering, but failsafe
      console.error('CRITICAL SECURITY ERROR: User seeing others data', {
        currentUserId,
        itemUserId: item.user_id
      });
      return null;
    }

    if (item.user_id !== currentUserId && isAdmin) {
      // Admin sees sanitized version
      return {
        ...item,
        user_email: 'Protected for Privacy',
        user_name: 'Protected for Privacy',
        user_address: item.user_address?.slice(0, 6) + '...' || 'Protected'
      } as T;
    }

    // User sees their own data
    return item;
  }).filter(Boolean) as T[];
}