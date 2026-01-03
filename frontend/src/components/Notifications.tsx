import { useEffect, useState } from "react";
import {
  collection,
  query,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "../AuthContext";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  reference_id?: string;
  is_read: boolean;
  created_at: any;
  timestamp?: any;
}

const Notifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", user.uid),
      orderBy("created_at", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(
          (d) =>
            ({
              id: d.id,
              ...d.data(),
            } as Notification)
        );
        setNotifications(data);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        // Fallback to show notifications without ordering if index doesn't exist
        const fallbackQ = query(
          collection(db, "notifications"),
          where("user_id", "==", user.uid)
        );
        onSnapshot(fallbackQ, (snapshot) => {
          const data = snapshot.docs.map(
            (d) =>
              ({
                id: d.id,
                ...d.data(),
              } as Notification)
          );
          // Sort manually
          data.sort((a, b) => {
            const timeA = a.created_at?.toMillis?.() || 0;
            const timeB = b.created_at?.toMillis?.() || 0;
            return timeB - timeA;
          });
          setNotifications(data);
        });
      }
    );

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { is_read: true });
    } catch (e) {
      console.error("Error marking as read: ", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter((n) => !n.is_read);
      const promises = unreadNotifications.map((n) =>
        updateDoc(doc(db, "notifications", n.id), { is_read: true })
      );
      await Promise.all(promises);
    } catch (e) {
      console.error("Error marking all as read: ", e);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "join_request":
        return "👤";
      case "request_approved":
        return "✅";
      case "request_rejected":
        return "❌";
      case "new_message":
        return "💬";
      default:
        return "🔔";
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "join_request":
        return "#3b82f6"; // blue
      case "request_approved":
        return "#10b981"; // green
      case "request_rejected":
        return "#ef4444"; // red
      case "new_message":
        return "#8b5cf6"; // purple
      default:
        return "#6b7280"; // gray
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div
      style={{
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          borderBottom: "2px solid #e5e7eb",
          paddingBottom: "10px",
        }}
      >
        <h2 style={{ margin: 0 }}>
          🔔 Notifications{" "}
          {unreadCount > 0 && (
            <span
              style={{
                backgroundColor: "#ef4444",
                color: "white",
                borderRadius: "12px",
                padding: "2px 8px",
                fontSize: "14px",
                marginLeft: "8px",
              }}
            >
              {unreadCount}
            </span>
          )}
        </h2>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "8px 16px",
              border:
                filter === "all" ? "2px solid #3b82f6" : "1px solid #d1d5db",
              borderRadius: "6px",
              backgroundColor: filter === "all" ? "#eff6ff" : "white",
              cursor: "pointer",
              fontWeight: filter === "all" ? "bold" : "normal",
            }}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter("unread")}
            style={{
              padding: "8px 16px",
              border:
                filter === "unread" ? "2px solid #3b82f6" : "1px solid #d1d5db",
              borderRadius: "6px",
              backgroundColor: filter === "unread" ? "#eff6ff" : "white",
              cursor: "pointer",
              fontWeight: filter === "unread" ? "bold" : "normal",
            }}
          >
            Unread ({unreadCount})
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                padding: "8px 16px",
                border: "1px solid #10b981",
                borderRadius: "6px",
                backgroundColor: "#d1fae5",
                cursor: "pointer",
                color: "#065f46",
              }}
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {filteredNotifications.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#6b7280",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
          <p style={{ fontSize: "18px", margin: 0 }}>
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications yet"}
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {filteredNotifications.map((n) => (
          <div
            key={n.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              padding: "16px",
              backgroundColor: n.is_read ? "#f9fafb" : "#ffffff",
              border: `1px solid ${
                n.is_read ? "#e5e7eb" : getNotificationColor(n.type)
              }`,
              borderLeft: `4px solid ${getNotificationColor(n.type)}`,
              borderRadius: "8px",
              boxShadow: n.is_read ? "none" : "0 1px 3px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                fontSize: "28px",
                flexShrink: 0,
              }}
            >
              {getNotificationIcon(n.type)}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontWeight: n.is_read ? "normal" : "bold",
                  marginBottom: "4px",
                  color: "#111827",
                }}
              >
                {n.message}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                {formatTimestamp(n.created_at || n.timestamp)}
              </div>
            </div>
            {!n.is_read && (
              <button
                onClick={() => markAsRead(n.id)}
                style={{
                  padding: "6px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#374151",
                  flexShrink: 0,
                }}
              >
                Mark Read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
