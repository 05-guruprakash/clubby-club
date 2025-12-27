# CLUBBY CLUB - Club Management System

A comprehensive web application for university club management, fostering community engagement through events, real-time chat, and robust membership systems.

  ![Status](https://img.shields.io/badge/Status-Active-success)
  ![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Firebase-orange)

## 🚀 Features

### 🏛️ Club Hub
- **Dynamic Membership**: Join and leave clubs instantly with robust data persistence.
- **Role Management**: Chairpersons can approve requests and promote members (Moderator, Secretary, etc.).
- **Member Directory**: Real-time list of active members with profile cards.
- **Gallery & Achievements**: Showcase club milestones and photos.

### 📅 Event Management
- **Official Feed**: Centralized stream for all club events and announcements.
- **Event creation**: Admin tools to publish new events.

### 💬 Community & Chat
- **Real-time Messaging**: Dedicated chat rooms for each club.
- **Team Collaboration**: Create temporary teams for events and chat privately.

---

## 🛠️ Technical Highlights (Recent Updates)

This project features advanced resilience patterns to ensure a smooth user experience even with intermittent network or backend permission issues:

- **🛡️ Hybrid Persistence**: Club memberships are saved continuously to both Local Storage and Firestore. This ensures that even if the backend fails, the user's "Joined" status is preserved in their browser.
- **❤️ Self-Healing Membership**: The application detects "Ghost Users" (users who are members locally but missing from the cloud) and automatically repairs their database records in the background on page load.
- **🔍 Dual-Query Member Lists**: To fix visibility issues, the member directory fetches data from two sources simultaneously: the Club's subcollection and the global User Profiles. This ensures no member is ever "invisible."
- **⚡ "Nuclear" Exit Strategy**: Leaving a club triggers a comprehensive cleanup that removes the user from the Member List, User Profile, and Global Roles, and atomically decrements the Member Count to maintain perfect synchronization.
- **📊 Real-Time Counters**: Member counts are dynamic and reflect the actual number of active participants, correcting potential database skew automatically.

---

## 💻 Tech Stack

- **Frontend**: React.js (Vite), TypeScript
- **Styling**: Modern Glassmorphism (Custom CSS / Inline Styles)
- **Backend**: Node.js, Express
- **Database & Auth**: Google Firebase (Firestore, Authentication)

---

## ⚙️ Installation & Setup

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/05-guruprakash/clubby-club.git
    cd clubby-club
    ```

2.  **Install Dependencies**
    ```bash
    # Install backend dependencies
    npm install

    # Install frontend dependencies
    cd frontend
    npm install
    cd ..
    ```

3.  **Configure Firebase**
    - Place your `serviceAccountKey.json` in the root directory.
    - Update `frontend/src/firebaseConfig.ts` with your client-side keys.

4.  **Run the Application**
    ```bash
    npm run dev
    ```
    This will concurrently start:
    - **Backend Server**: `http://localhost:3001`
    - **Frontend Client**: `http://localhost:5173`

---

## 📂 Project Structure

```text
club-management-main/
├── src/                  # Backend Express Server
├── frontend/             # React Frontend Application
│   ├── src/components/   # feature components (Clubs, Feed, Chat)
│   └── src/firebaseConfig.ts
├── firestore.rules       # Database Security Rules
├── serviceAccountKey.json # Admin SDK Credentials
└── package.json          # Root scripts
```

---

*Verified and Tested on Windows Environment (Node v22).*
