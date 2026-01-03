const express = require("express");
const { verifyToken } = require("../middleware/auth");
const { admin, db } = require("../config/firebase");
const { getDownloadURL } = require("firebase-admin/storage");

const router = express.Router();

/**
 * Update User Profile
 * Handles text updates and optional base64 photo upload
 */
router.post("/update", verifyToken, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { full_name, phone, username, photoBase64, photoType } = req.body;

        console.log(`[USER:UPDATE] Starting profile update for ${uid}`);

        let photoURL = req.body.photoURL;

        // If a new photo is provided as base64
        if (photoBase64 && photoBase64.length > 0) {
            console.log(`[USER:UPDATE] Processing new photo (len: ${photoBase64.length})`);

            let uploaded = false;
            // List of potential bucket names to try
            const bucketsToTry = [
                admin.storage().bucket(), // Default from config
                admin.storage().bucket("gdg-7327.appspot.com"),
                admin.storage().bucket("gdg-7327.firebasestorage.app")
            ];

            for (const bucket of bucketsToTry) {
                if (uploaded) break;
                try {
                    const filename = `avatars/${uid}_${Date.now()}`;
                    const file = bucket.file(filename);
                    const buffer = Buffer.from(photoBase64, 'base64');

                    await file.save(buffer, {
                        metadata: {
                            contentType: photoType || 'image/jpeg',
                            cacheControl: 'public, max-age=31536000'
                        }
                    });

                    photoURL = await getDownloadURL(file);
                    uploaded = true;
                    console.log(`[USER:UPDATE] Uploaded to Storage: ${photoURL}`);
                } catch (err) {
                    // console.warn(`Bucket ${bucket.name} failed: ${err.message}`);
                }
            }

            // Fallback: If cloud storage is not configured/enabled, store as Data URI
            if (!uploaded) {
                console.warn(`[USER:UPDATE] Cloud Storage not active. Falling back to Data URI storage.`);
                photoURL = `data:${photoType || 'image/jpeg'};base64,${photoBase64}`;
            }
        }

        // Update Firestore
        const userRef = db.collection("users").doc(uid);
        const updateData = {
            full_name: full_name || "",
            phone: phone || "",
            username: username || "",
            photoURL: photoURL || "",
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        };

        try {
            await userRef.update(updateData);
        } catch (dbErr) {
            await userRef.set(updateData, { merge: true });
        }

        console.log(`[USER:UPDATE] Profile for ${uid} synced.`);
        res.json({
            message: "Profile updated successfully",
            photoURL: photoURL
        });
    } catch (err) {
        console.error("🔥 [USER:UPDATE] ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
