# 🔔 Notification Features Documentation

## Overview

This document describes the comprehensive notification system implemented in the Clubby-Club application. The system provides real-time notifications to users for various events including join requests, approvals/rejections, and chat messages.

## Features Implemented

### 1. **Admin Notifications for Join Requests** 👤

When a user requests to join a club that requires approval:

- All admins and chairpersons of the club receive a notification
- Notification includes the requester's name and club name
- Stored in the database and optionally sent via push notification

**Example:** _"John Doe has requested to join Tech Club"_

### 2. **User Notifications for Request Status** ✅❌

When an admin approves or rejects a join request:

- The requesting user receives a notification
- Different messages for approval vs rejection
- Helps users track their membership requests

**Example (Approved):** _"Your request to join Tech Club has been approved!"_  
**Example (Rejected):** _"Your request to join Tech Club has been rejected."_

### 3. **Chat Message Notifications** 💬

When a new message is sent in a club, team, or event chat:

- All active members of that community receive a notification
- The sender does NOT receive a notification
- Notification includes sender name and message preview (first 100 characters)
- Works for clubs, teams, and events

**Example:** _"John Doe: Hey everyone, meeting tomorrow at 5pm!"_

## Technical Implementation

### Backend Components

#### 1. Enhanced Notification Service

**File:** `src/services/notification.service.js`

New functions added:

- `notifyAdminsOfJoinRequest(clubId, clubName, userId, userName)` - Notifies all admins when someone requests to join
- `notifyRequestApproval(userId, clubId, clubName, isApproved)` - Notifies user of approval/rejection
- `notifyMembersOfNewMessage(communityId, communityType, senderId, senderName, messageText)` - Notifies members of new messages

#### 2. Updated Club Routes

**File:** `src/routes/clubs.routes.js`

Modified endpoints:

- `POST /:id/join` - Now triggers admin notifications when approval is required
- `POST /:id/approve` - Now notifies the user of approval
- `POST /:id/reject` - Now notifies the user of rejection

#### 3. Firebase Functions

**File:** `functions/triggers/on_message_create.js`

Enhanced to:

- Support different community types (clubs, teams, events)
- Fetch appropriate members based on community type
- Create database notifications for all members
- Send push notifications using FCM (Firebase Cloud Messaging)

### Frontend Components

#### Enhanced Notifications Component

**File:** `frontend/src/components/Notifications.tsx`

Features:

- **Real-time updates** using Firestore listeners
- **Filter options**: View all notifications or only unread
- **Unread counter** in the header
- **Mark as read** functionality (individual or all)
- **Visual indicators**:
  - Different icons for each notification type (👤✅❌💬)
  - Color-coded borders
  - Bold text for unread notifications
  - Subtle styling for read notifications
- **Timestamp formatting** (e.g., "5m ago", "2h ago", "3d ago")
- **User-specific** - Only shows notifications for the logged-in user

## Database Schema

### Notifications Collection

```javascript
{
  user_id: string,           // ID of the user receiving the notification
  type: string,              // 'join_request', 'request_approved', 'request_rejected', 'new_message'
  message: string,           // Human-readable notification message
  reference_id: string,      // ID of the related club/team/event
  is_read: boolean,          // Whether the notification has been read
  created_at: Timestamp,     // When the notification was created
  timestamp: Timestamp       // Server timestamp (optional, for ordering)
}
```

### FCM Tokens Collection (for push notifications)

```javascript
{
  token: string; // Firebase Cloud Messaging token for the device
}
```

## How to Use

### For Users:

1. **Viewing Notifications:**

   - Click the "Notifications" button in the navigation
   - See all your notifications with unread count
   - Filter by "All" or "Unread"

2. **Managing Notifications:**

   - Click "Mark Read" on individual notifications
   - Click "Mark All Read" to clear all unread notifications

3. **Notification Types:**
   - **Join Request (Blue 👤):** Someone wants to join a club you manage
   - **Request Approved (Green ✅):** Your join request was accepted
   - **Request Rejected (Red ❌):** Your join request was declined
   - **New Message (Purple 💬):** New chat message in your club/team/event

### For Developers:

#### Adding a New Notification Type:

1. **Update the notification service:**

```javascript
// src/services/notification.service.js
const notifyNewFeature = async (userId, details) => {
  await notifyUser(userId, {
    type: "new_feature_type",
    message: "Your custom message",
    reference_id: details.referenceId,
  });
};
```

2. **Call it from your route:**

```javascript
const { notifyNewFeature } = require("../services/notification.service");

// In your endpoint
await notifyNewFeature(userId, { referenceId: someId });
```

3. **Update frontend icon/color mapping:**

```typescript
// frontend/src/components/Notifications.tsx
const getNotificationIcon = (type: string) => {
  switch (type) {
    case "new_feature_type":
      return "🎉";
    // ... other cases
  }
};
```

## Configuration

### Firebase Setup Required:

1. **Firestore Indexes:**
   Add to `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "user_id", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    }
  ]
}
```

2. **Firebase Cloud Messaging (Optional for push notifications):**
   - Enable FCM in Firebase Console
   - Configure service worker for web push
   - Store FCM tokens in `fcm_tokens` collection

## Testing

### Test Scenarios:

1. **Join Request Notification:**

   - Have User A request to join a club with `requiresApproval: true`
   - Check that admin receives notification
   - Verify notification appears in admin's notification panel

2. **Approval/Rejection Notification:**

   - Admin approves/rejects the request
   - Check that User A receives appropriate notification
   - Verify correct icon and message

3. **Chat Message Notification:**
   - User A sends a message in club chat
   - Verify all other members receive notification
   - Verify User A does NOT receive their own notification
   - Check message preview is correct

## Troubleshooting

### Notifications not appearing:

1. Check Firestore rules allow read/write to `notifications` collection
2. Verify user is logged in (`user.uid` exists)
3. Check browser console for errors
4. Ensure Firebase indexes are deployed

### Push notifications not working:

1. Verify FCM is enabled in Firebase Console
2. Check that FCM tokens are being stored correctly
3. Ensure service worker is registered
4. Check device permissions for notifications

### Performance Issues:

1. Implement pagination for notifications (load 20 at a time)
2. Add automatic cleanup for old read notifications (>30 days)
3. Use Firestore query limits

## Future Enhancements

Potential improvements:

- [ ] Notification preferences (allow users to mute certain types)
- [ ] Email notifications for important events
- [ ] In-app notification bell with dropdown preview
- [ ] Notification sound effects
- [ ] Deep linking from notifications to relevant pages
- [ ] Notification grouping (e.g., "5 new messages in Tech Club")
- [ ] Desktop notifications via browser API

## Security Considerations

- Notifications are user-specific (filtered by `user_id`)
- Only authenticated users can access notifications
- FCM tokens are stored securely per user
- Notification content should not contain sensitive data
- Firestore rules should validate user can only read their own notifications

## Support

For issues or questions about the notification system:

1. Check this documentation
2. Review console logs for errors
3. Verify Firebase configuration
4. Contact the development team

---

**Last Updated:** January 3, 2026  
**Version:** 1.0.0
