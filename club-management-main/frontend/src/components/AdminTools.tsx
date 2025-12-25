import { useState } from 'react';
import { collection, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const AdminTools = () => {
    const [targetUserId, setTargetUserId] = useState('');
    const [targetTeamId, setTargetTeamId] = useState('');

    // In a real app, you would probably have a list of pending requests to select from.
    // For this basic skeleton, we'll manually input IDs or just mock the concept of "selection".
    // Better yet, let's just make a simple input for "Member Request ID" (which is actually a doc ID in teams/{id}/members)

    const handleApproveMember = async () => {
        if (!targetTeamId || !targetUserId) return;
        try {
            // Looking for the specific member document in the subcollection
            // Since we don't have the doc ID of the member request directly easily without listing them,
            // we'll assume we know it or query for it.
            // Let's simplified this: Input Team ID and User ID. Query for the pending request.

            const q = query(
                collection(db, `teams/${targetTeamId}/members`),
                where('userId', '==', targetUserId),
                where('status', '==', 'pending')
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                alert('No pending request found for this user in this team.');
                return;
            }

            // Approve all matching (should be one)
            snapshot.forEach(async (d) => {
                await updateDoc(doc(db, `teams/${targetTeamId}/members`, d.id), {
                    status: 'approved'
                });
            });
            alert('Member approved!');
        } catch (e) {
            console.error("Error approving member: ", e);
        }
    };

    const handlePromoteMember = async () => {
        if (!targetUserId) return;
        try {
            await updateDoc(doc(db, 'users', targetUserId), {
                role: 'event_head' // Promoting to event_head for example
            });
            alert('Member promoted to event_head!');
        } catch (e) {
            console.error("Error promoting member: ", e);
        }
    };

    return (
        <div style={{ border: '2px solid red', padding: '10px', marginTop: '20px' }}>
            <h3>Admin Tools (Restricted)</h3>

            <div style={{ marginBottom: '10px' }}>
                <h4>Approve Member Request</h4>
                <input placeholder="Team ID" value={targetTeamId} onChange={e => setTargetTeamId(e.target.value)} />
                <input placeholder="User ID" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} />
                <button onClick={handleApproveMember}>Approve</button>
            </div>

            <div>
                <h4>Promote Member</h4>
                <input placeholder="User ID to Promote" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} />
                <button onClick={handlePromoteMember}>Promote to Event Head</button>
            </div>
        </div>
    );
};

export default AdminTools;
