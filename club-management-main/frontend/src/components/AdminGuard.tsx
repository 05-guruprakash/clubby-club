import { type FC, type ReactNode } from 'react';
import { useRole } from '../hooks/useRole';

const AdminGuard: FC<{ children: ReactNode }> = ({ children }) => {
    const role = useRole();
    const allowedRoles = ['chairman', 'vice_chairman', 'event_head'];

    if (role && allowedRoles.includes(role)) {
        return <>{children}</>;
    }

    return null; // Render nothing if not authorized
};

export default AdminGuard;
