import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Initialize auth state listener
export const initAuthListener = (callback) => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // Fetch user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                const userData = {
                    uid: firebaseUser.uid,
                    ...userDoc.data(),
                };
                callback(userData);
            } else {
                callback(null);
            }
        } else {
            callback(null);
        }
    });
};

// Register new user
export const registerUser = async (userData) => {
    try {
        const { email, password, ...profileData } = userData;

        // Create auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Update profile
        await updateProfile(user, {
            displayName: profileData.name,
        });

        // Create user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            ...profileData,
            email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            profilePic: '',
            role: 'user',
            joinedClubs: [],
            followedClubs: [],
            roles: {}, // Club-specific roles
        });

        return user;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
};

// Login with email and password
export const loginWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

// Login with username (convert to email first)
export const loginWithUsername = async (username, password) => {
    // This requires a cloud function or backend API to convert username to email
    // For now, we'll assume username is the email
    return loginWithEmail(username, password);
};

// Setup phone authentication
export const setupRecaptcha = (containerId) => {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible',
            callback: () => {
                // reCAPTCHA solved
            },
        });
    }
    return window.recaptchaVerifier;
};

// Send OTP to phone number
export const sendOTP = async (phoneNumber) => {
    try {
        const appVerifier = setupRecaptcha('recaptcha-container');
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
        return confirmationResult;
    } catch (error) {
        console.error('OTP send error:', error);
        throw error;
    }
};

// Verify OTP
export const verifyOTP = async (confirmationResult, otp) => {
    try {
        const result = await confirmationResult.confirm(otp);
        return result.user;
    } catch (error) {
        console.error('OTP verification error:', error);
        throw error;
    }
};

// Logout
export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        throw error;
    }
};

// Get current user
export const getCurrentUser = () => {
    return auth.currentUser;
};
