import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Theme Store
export const useThemeStore = create(
    persist(
        (set) => ({
            theme: 'dark',
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
            setTheme: (theme) => set({ theme }),
        }),
        {
            name: 'theme-storage',
        }
    )
);

// Auth Store
export const useAuthStore = create((set) => ({
    user: null,
    loading: true,
    setUser: (user) => set({ user, loading: false }),
    setLoading: (loading) => set({ loading }),
    logout: () => set({ user: null }),
}));

// Notification Store
export const useNotificationStore = create((set) => ({
    notifications: [],
    unreadCount: 0,
    setNotifications: (notifications) => {
        const unread = notifications.filter(n => !n.read).length;
        set({ notifications, unreadCount: unread });
    },
    markAsRead: (notificationId) => set((state) => ({
        notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
    })),
    addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
    })),
}));

// Modal Store
export const useModalStore = create((set) => ({
    modals: {
        eventDetails: { isOpen: false, data: null },
        teamRegistration: { isOpen: false, data: null },
        createTeam: { isOpen: false, data: null },
        joinTeam: { isOpen: false, data: null },
        clubDetails: { isOpen: false, data: null },
        editProfile: { isOpen: false, data: null },
        createPost: { isOpen: false, data: null },
    },
    openModal: (modalName, data = null) => set((state) => ({
        modals: {
            ...state.modals,
            [modalName]: { isOpen: true, data },
        },
    })),
    closeModal: (modalName) => set((state) => ({
        modals: {
            ...state.modals,
            [modalName]: { isOpen: false, data: null },
        },
    })),
    closeAllModals: () => set((state) => ({
        modals: Object.keys(state.modals).reduce((acc, key) => ({
            ...acc,
            [key]: { isOpen: false, data: null },
        }), {}),
    })),
}));
