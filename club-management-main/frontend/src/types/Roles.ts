export type Role = 'chairperson' | 'vice_chairman' | 'secretary' | 'event_head' | 'joint_secretary' | 'member' | 'user';

export const PERMISSIONS = {
    chairperson: { canEditProfile: true, canAnalytics: true, canPromote: true, cancreateEvent: true },
    vice_chairman: { canEditProfile: true, canAnalytics: true, canPromote: false, cancreateEvent: true },
    secretary: { canEditProfile: false, canAnalytics: false, canPromote: false, cancreateEvent: true },
    event_head: { canEditProfile: false, canAnalytics: false, canPromote: false, cancreateEvent: true },
    joint_secretary: { canEditProfile: false, canAnalytics: false, canPromote: false, cancreateEvent: false, canViewRegList: true },
    member: { canEditProfile: false, canAnalytics: false, canPromote: false, cancreateEvent: false },
    user: { canEditProfile: false, canAnalytics: false, canPromote: false, cancreateEvent: false },
};

export const hasPermission = (role: string | null, permission: keyof typeof PERMISSIONS['chairperson']) => {
    if (!role) return false;
    const r = role as Role;
    // @ts-ignore
    return PERMISSIONS[r]?.[permission] || false;
};
