// User Roles
export const ROLES = {
    CHAIRMAN: 'chairman',
    VICE_CHAIRMAN: 'vice_chairman',
    SECRETARY: 'secretary',
    EVENT_HEAD: 'event_head',
    TEAM_HEAD: 'team_head',
    JOINT_SECRETARY: 'joint_secretary',
    MEMBER: 'member',
    USER: 'user',
};

// Role Permissions
export const PERMISSIONS = {
    [ROLES.CHAIRMAN]: {
        editClub: true,
        createEvent: true,
        manageMembers: true,
        promoteMembers: true,
        viewAnalytics: true,
        postInCommunity: true,
        viewParticipants: true,
        addGallery: true,
    },
    [ROLES.VICE_CHAIRMAN]: {
        editClub: true,
        createEvent: true,
        manageMembers: true,
        promoteMembers: false,
        viewAnalytics: true,
        postInCommunity: true,
        viewParticipants: true,
        addGallery: true,
    },
    [ROLES.SECRETARY]: {
        editClub: false,
        createEvent: true,
        manageMembers: false,
        promoteMembers: false,
        viewAnalytics: true,
        postInCommunity: true,
        viewParticipants: true,
        addGallery: true,
    },
    [ROLES.EVENT_HEAD]: {
        editClub: false,
        createEvent: false,
        manageMembers: false,
        promoteMembers: false,
        viewAnalytics: false,
        postInCommunity: true,
        viewParticipants: false,
        addGallery: false,
    },
    [ROLES.TEAM_HEAD]: {
        editClub: false,
        createEvent: false,
        manageMembers: false,
        promoteMembers: false,
        viewAnalytics: false,
        postInCommunity: true,
        viewParticipants: false,
        addGallery: false,
    },
    [ROLES.JOINT_SECRETARY]: {
        editClub: false,
        createEvent: false,
        manageMembers: false,
        promoteMembers: false,
        viewAnalytics: false,
        postInCommunity: true,
        viewParticipants: false,
        addGallery: false,
    },
    [ROLES.MEMBER]: {
        editClub: false,
        createEvent: false,
        manageMembers: false,
        promoteMembers: false,
        viewAnalytics: false,
        postInCommunity: false,
        viewParticipants: false,
        addGallery: false,
    },
    [ROLES.USER]: {
        editClub: false,
        createEvent: false,
        manageMembers: false,
        promoteMembers: false,
        viewAnalytics: false,
        postInCommunity: false,
        viewParticipants: false,
        addGallery: false,
    },
};

// Role Colors for UI
export const ROLE_COLORS = {
    [ROLES.CHAIRMAN]: '#FFD700', // Gold
    [ROLES.VICE_CHAIRMAN]: '#C0C0C0', // Silver
    [ROLES.SECRETARY]: '#2563eb', // Blue
    [ROLES.EVENT_HEAD]: '#10b981', // Green
    [ROLES.TEAM_HEAD]: '#10b981', // Green
    [ROLES.JOINT_SECRETARY]: '#7c3aed', // Purple
    [ROLES.MEMBER]: '#6b7280', // Gray
    [ROLES.USER]: '#6b7280', // Gray
};

// Role Display Names
export const ROLE_NAMES = {
    [ROLES.CHAIRMAN]: 'Chairman',
    [ROLES.VICE_CHAIRMAN]: 'Vice Chairman',
    [ROLES.SECRETARY]: 'Secretary',
    [ROLES.EVENT_HEAD]: 'Event Head',
    [ROLES.TEAM_HEAD]: 'Team Head',
    [ROLES.JOINT_SECRETARY]: 'Joint Secretary',
    [ROLES.MEMBER]: 'Member',
    [ROLES.USER]: 'User',
};

// Check if user has permission
export const hasPermission = (userRole, permission) => {
    return PERMISSIONS[userRole]?.[permission] || false;
};

// Get user role in a specific club
export const getUserRoleInClub = (user, clubId) => {
    if (!user || !user.roles) return ROLES.USER;
    return user.roles[clubId] || ROLES.USER;
};

// Event Status
export const EVENT_STATUS = {
    OPEN: 'open',
    CLOSED: 'closed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

// Team Status
export const TEAM_STATUS = {
    FORMING: 'forming',
    FULL: 'full',
    REGISTERED: 'registered',
};

// Notification Types
export const NOTIFICATION_TYPES = {
    TEAM_JOIN_REQUEST: 'team_join_request',
    TEAM_JOIN_APPROVED: 'team_join_approved',
    TEAM_JOIN_REJECTED: 'team_join_rejected',
    CLUB_APPLICATION_APPROVED: 'club_application_approved',
    CLUB_APPLICATION_REJECTED: 'club_application_rejected',
    EVENT_UPDATE: 'event_update',
    ROLE_CHANGED: 'role_changed',
    NEW_POST: 'new_post',
    POST_COMMENT: 'post_comment',
    EVENT_REMINDER: 'event_reminder',
};

// Post Types
export const POST_TYPES = {
    EVENT: 'event',
    ANNOUNCEMENT: 'announcement',
    GENERAL: 'general',
};

// Community Types
export const COMMUNITY_TYPES = {
    CLUB: 'club',
    EVENT: 'event',
    TEAM: 'team',
};

// Departments
export const DEPARTMENTS = [
    'Computer Science',
    'Information Technology',
    'Electronics and Communication',
    'Electrical and Electronics',
    'Mechanical',
    'Civil',
    'Automobile',
    'Production',
    'Aerospace',
];

// Years
export const YEARS = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year',
];

// Storage Paths
export const STORAGE_PATHS = {
    PROFILE_PICTURES: 'profile-pictures',
    CLUB_LOGOS: 'club-logos',
    EVENT_BANNERS: 'event-banners',
    TEAM_PHOTOS: 'team-photos',
    GALLERY: 'gallery',
    POST_IMAGES: 'post-images',
};
