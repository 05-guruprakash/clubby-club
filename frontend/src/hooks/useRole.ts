import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth } from '../AuthContext';

export const useRole = () => {
    const { user } = useAuth();
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            const fetchRole = async () => {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setRole(docSnap.data().role);
                } else {
                    console.log("No such document!");
                }
            };
            fetchRole();
        } else {
            setRole(null);
        }
    }, [user]);

    return role;
};
