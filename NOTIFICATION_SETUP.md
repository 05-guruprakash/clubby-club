# 🚀 Notification System - Setup & Deployment Guide

## Quick Start

### 1. Deploy Firestore Indexes

The notification system requires specific Firestore indexes for optimal performance.

```bash
# Deploy the indexes
firebase deploy --only firestore:indexes
```

This will create indexes for:

- Querying notifications by user_id and created_at
- Filtering notifications by user_id, is_read status, and created_at
- Querying messages by communityId and createdAt

**Note:** Index creation can take a few minutes to complete. You'll receive an email when they're ready.

### 2. Deploy Firebase Functions (Optional but Recommended)

For automatic chat message notifications:

```bash
# Navigate to functions directory
cd functions

# Install dependencies (if not done already)
npm install

# Deploy functions
firebase deploy --only functions
```

This deploys the `onMessageCreate` trigger that automatically notifies members when new chat messages are sent.

### 3. Restart Your Application

After deploying indexes and functions:

```bash
# From the project root
npm run dev
```

## Testing the Notification System

### Test 1: Join Request Notifications

1. **Create a club with approval required:**

   - Log in as User A (admin)
   - Create a club
   - Set `requiresApproval: true`

2. **Request to join:**

   - Log in as User B
   - Navigate to the club
   - Click "Join Club"

3. **Verify:**
   - Log in as User A
   - Click "Notifications" in the navigation
   - Should see: "User B has requested to join [Club Name]"

### Test 2: Approval/Rejection Notifications

1. **Approve the request:**

   - As User A (admin), approve User B's request

2. **Verify:**

   - Log in as User B
   - Click "Notifications"
   - Should see: "Your request to join [Club Name] has been approved!"

3. **Test rejection:**
   - Have another user (User C) request to join
   - Reject the request as admin
   - User C should see: "Your request to join [Club Name] has been rejected."

### Test 3: Chat Message Notifications

1. **Set up:**

   - Create a club with at least 3 members (User A, B, C)

2. **Send a message:**

   - As User A, send a message in the club chat

3. **Verify:**
   - Log in as User B
   - Click "Notifications"
   - Should see: "User A: [Message preview]"
   - User A should NOT receive a notification (sender doesn't get notified)

## Firebase Console Verification

### Check Notifications Collection

1. Go to Firebase Console → Firestore Database
2. Look for the `notifications` collection
3. Each document should have:
   ```
   {
     user_id: "...",
     type: "join_request" | "request_approved" | "request_rejected" | "new_message",
     message: "...",
     reference_id: "...",
     is_read: false,
     created_at: Timestamp
   }
   ```

### Check Indexes Status

1. Go to Firebase Console → Firestore Database → Indexes
2. Verify all three indexes are in "Enabled" status:
   - notifications: (user_id, created_at)
   - notifications: (user_id, is_read, created_at)
   - community_messages: (communityId, createdAt)

### Check Functions Logs

1. Go to Firebase Console → Functions
2. Click on `onMessageCreate`
3. View logs to see:
   ```
   📨 New message in club [id] from [name]
   ✅ Created X notification records
   ✅ Sent push notifications to X members
   ```

## Troubleshooting

### Issue: "Index creation required" error

**Solution:**

- Click the link in the error message to create the index automatically
- OR wait for the deployed indexes to become active (can take 5-10 minutes)

### Issue: Notifications not appearing

**Checklist:**

1. ✅ User is logged in
2. ✅ Firestore indexes are enabled
3. ✅ Browser console shows no errors
4. ✅ Check Firestore Database for notification documents

**Debug steps:**

```javascript
// In browser console
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { auth } from "./firebaseConfig";

// Check current user
console.log("Current user:", auth.currentUser?.uid);

// Manually query notifications
const q = query(
  collection(db, "notifications"),
  where("user_id", "==", auth.currentUser.uid)
);
const snapshot = await getDocs(q);
console.log(
  "Notifications:",
  snapshot.docs.map((d) => d.data())
);
```

### Issue: Firebase Functions not triggering

**Checklist:**

1. ✅ Functions are deployed: `firebase deploy --only functions`
2. ✅ Check Functions logs in Firebase Console
3. ✅ Verify trigger path matches: `community_messages/{id}`

**Debug steps:**

```bash
# Check deployed functions
firebase functions:list

# View function logs
firebase functions:log --only onMessageCreate
```

### Issue: Performance issues with many notifications

**Solutions:**

1. Implement pagination:

```typescript
// Limit to 20 most recent
const q = query(
  collection(db, "notifications"),
  where("user_id", "==", user.uid),
  orderBy("created_at", "desc"),
  limit(20)
);
```

2. Add cleanup for old notifications:

```javascript
// Delete read notifications older than 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const oldNotifications = await db
  .collection("notifications")
  .where("is_read", "==", true)
  .where("created_at", "<", thirtyDaysAgo)
  .get();

const batch = db.batch();
oldNotifications.forEach((doc) => batch.delete(doc.ref));
await batch.commit();
```

## Production Checklist

Before deploying to production:

- [ ] All Firestore indexes are enabled
- [ ] Firebase Functions are deployed
- [ ] Notification types are tested (join request, approval, rejection, messages)
- [ ] Real-time updates work correctly
- [ ] Mark as read functionality works
- [ ] Filter (all/unread) works
- [ ] Firestore security rules are reviewed
- [ ] FCM tokens collection is set up (if using push notifications)
- [ ] Service worker is configured (if using push notifications)
- [ ] Performance tested with many notifications
- [ ] Error handling is in place
- [ ] Logging is configured for debugging

## Monitoring

### Key Metrics to Track

1. **Notification Delivery Rate**

   - How many notifications are created vs delivered
   - Track via Cloud Functions logs

2. **Read Rate**

   - Percentage of notifications marked as read
   - Query Firestore for analytics

3. **Function Performance**

   - Execution time of `onMessageCreate`
   - View in Firebase Console → Functions → onMessageCreate → Metrics

4. **Database Operations**
   - Read/write operations on notifications collection
   - Monitor costs in Firebase Console

### Setting Up Alerts

```javascript
// Example: Alert if too many notifications fail
if (failedNotifications > 10) {
  console.error("HIGH NOTIFICATION FAILURE RATE", {
    failed: failedNotifications,
    total: totalNotifications,
  });
  // Send alert email or Slack message
}
```

## Cost Optimization

### Database Reads

- Each user opening notifications = 1 read per notification
- Use pagination to reduce reads
- Cache notifications on client side

### Database Writes

- Each notification = 1 write
- Batch notifications when possible
- Delete old notifications regularly

### Function Invocations

- Each message = 1 function call
- Monitor in Firebase Console
- Set spending limits if needed

## Next Steps

After successful deployment:

1. **Monitor for 24 hours** - Check for any errors or issues
2. **Gather user feedback** - Are notifications helpful?
3. **Optimize performance** - Implement pagination if needed
4. **Add new features** - Email notifications, preferences, etc.
5. **Document edge cases** - Update this guide with learnings

## Support Resources

- [Firebase Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- Project documentation: `NOTIFICATION_FEATURES.md`

---

**Need Help?**  
Contact the development team or check the Firebase Console logs for detailed error messages.
