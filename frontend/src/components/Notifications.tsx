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

interface NotificationsProps {
  isDarkMode?: boolean;
}

const Notifications = ({ isDarkMode = true }: NotificationsProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [isHovered, setIsHovered] = useState<string | null>(null);

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
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        );
      case "request_approved":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case "request_rejected":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      case "new_message":
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        );
    }
  };

  const colors = {
    bg: isDarkMode ? "#050505" : "#f8f9fa",
    cardBg: isDarkMode ? "rgba(255,255,255,0.03)" : "#ffffff",
    border: isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
    text: isDarkMode ? "#ffffff" : "#111111",
    subtext: isDarkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
    accent: "#bcec15",
    accentSubtle: isDarkMode ? "rgba(188, 236, 21, 0.1)" : "rgba(188, 236, 21, 0.2)",
    join_request: "#3b82f6",
    request_approved: "#bcec15",
    request_rejected: "#ef4444",
    new_message: "#a855f7",
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "join_request": return colors.join_request;
      case "request_approved": return colors.request_approved;
      case "request_rejected": return colors.request_rejected;
      case "new_message": return colors.new_message;
      default: return colors.accent;
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

    if (diffMins < 1) return "JUST NOW";
    if (diffMins < 60) return `${diffMins}M AGO`;
    if (diffHours < 24) return `${diffHours}H AGO`;
    if (diffDays < 7) return `${diffDays}D AGO`;
    return date.toLocaleDateString().toUpperCase();
  };

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px 20px 100px 20px",
        fontFamily: '"Outfit", "Inter", sans-serif',
        color: colors.text,
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          marginBottom: "40px",
          animation: "fadeIn 0.6s ease",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{
              background: colors.accent, color: "#000",
              display: "inline-block",
              padding: "4px 12px", borderRadius: "50px",
              fontSize: "0.65rem", fontWeight: "950", letterSpacing: "1.5px",
              marginBottom: "12px"
            }}>LATEST UPDATES</div>
            <h1 style={{
              margin: 0, fontSize: "2.8rem", fontWeight: "950",
              letterSpacing: "-2px", lineHeight: "1"
            }}>
              NOTIFICATIONS
              {unreadCount > 0 && (
                <span
                  style={{
                    color: colors.accent,
                    fontSize: "1.5rem",
                    verticalAlign: "top",
                    marginLeft: "8px",
                  }}
                >
                  •
                </span>
              )}
            </h1>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              style={{
                padding: "12px 24px",
                background: "transparent",
                color: colors.accent,
                border: `1px solid ${colors.accent}44`,
                borderRadius: "16px",
                fontSize: "0.75rem",
                fontWeight: "900",
                cursor: "pointer",
                letterSpacing: "0.5px",
                transition: "0.3s cubic-bezier(0.23, 1, 0.32, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.accentSubtle;
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              MARK ALL AS READ
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: "flex",
          gap: "8px",
          background: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
          padding: "6px",
          borderRadius: "20px",
          width: "fit-content",
          border: `1px solid ${colors.border}`
        }}>
          {[
            { id: "all", label: "ALL", count: notifications.length },
            { id: "unread", label: "UNREAD", count: unreadCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              style={{
                padding: "10px 24px",
                border: "none",
                borderRadius: "14px",
                backgroundColor: filter === tab.id ? (isDarkMode ? "rgba(255,255,255,0.08)" : "#fff") : "transparent",
                color: filter === tab.id ? colors.text : colors.subtext,
                cursor: "pointer",
                fontWeight: "900",
                fontSize: "0.7rem",
                letterSpacing: "1px",
                transition: "0.3s cubic-bezier(0.23, 1, 0.32, 1)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: filter === tab.id ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {tab.label}
              <span style={{
                fontSize: "0.6rem",
                opacity: filter === tab.id ? 1 : 0.5,
                background: filter === tab.id ? colors.accent : (isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"),
                color: filter === tab.id ? "#000" : colors.text,
                padding: "2px 6px",
                borderRadius: "6px",
                minWidth: "20px"
              }}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredNotifications.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "120px 40px",
            background: colors.cardBg,
            borderRadius: "40px",
            border: `1px dashed ${colors.border}`,
            animation: "fadeIn 0.8s ease",
          }}
        >
          <div style={{
            fontSize: "3rem",
            marginBottom: "24px",
            filter: "grayscale(1) opacity(0.3)",
          }}>🔔</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", fontWeight: "900", letterSpacing: "-0.5px" }}>
            {filter === "unread" ? "NO UNREAD UPDATES" : "CLEAR SKIES"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.9rem", color: colors.subtext, fontWeight: "500" }}>
            {filter === "unread"
              ? "You've caught up with everything!"
              : "We'll let you know when something happens."}
          </p>
        </div>
      )}

      {/* Notification List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {filteredNotifications.map((n, index) => (
          <div
            key={n.id}
            onMouseEnter={() => setIsHovered(n.id)}
            onMouseLeave={() => setIsHovered(null)}
            onClick={() => !n.is_read && markAsRead(n.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              padding: "24px 28px",
              backgroundColor: isHovered === n.id ? (isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)") : colors.cardBg,
              borderRadius: "32px",
              border: `1px solid ${n.is_read ? colors.border : getNotificationColor(n.type) + "44"}`,
              transition: "0.4s cubic-bezier(0.23, 1, 0.32, 1)",
              cursor: n.is_read ? "default" : "pointer",
              position: "relative",
              overflow: "hidden",
              animation: `cardSlideIn 0.5s ease ${index * 0.05}s both`,
              boxShadow: isHovered === n.id && !n.is_read ? `0 10px 30px ${getNotificationColor(n.type)}11` : "none",
              transform: isHovered === n.id ? "scale(1.01) translateY(-2px)" : "none",
            }}
          >
            {/* Left Accent Bar */}
            {!n.is_read && (
              <div style={{
                position: "absolute",
                left: 0, top: "25%", bottom: "25%",
                width: "4px",
                backgroundColor: getNotificationColor(n.type),
                borderRadius: "0 4px 4px 0",
              }} />
            )}

            {/* Icon Wrapper */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: n.is_read ? (isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)") : getNotificationColor(n.type) + "15",
                color: n.is_read ? colors.subtext : getNotificationColor(n.type),
                flexShrink: 0,
                transition: "0.3s",
              }}
            >
              {getNotificationIcon(n.type)}
            </div>

            {/* Content Area */}
            <div style={{ flex: 1 }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "6px"
              }}>
                <span style={{
                  fontSize: "0.6rem",
                  fontWeight: "950",
                  letterSpacing: "1px",
                  color: n.is_read ? colors.subtext : getNotificationColor(n.type),
                }}>
                  {n.type.replace(/_/g, " ").toUpperCase()}
                </span>
                <span style={{
                  fontSize: "0.65rem",
                  fontWeight: "800",
                  color: colors.subtext,
                  letterSpacing: "0.5px"
                }}>
                  {formatTimestamp(n.created_at || n.timestamp)}
                </span>
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: n.is_read ? "500" : "700",
                  lineHeight: "1.4",
                  color: n.is_read ? colors.subtext : colors.text,
                }}
              >
                {n.message}
              </div>
            </div>

            {/* Action Area */}
            {!n.is_read && isHovered === n.id && (
              <div style={{ animation: "fadeIn 0.3s ease", display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(n.id);
                  }}
                  style={{
                    padding: "10px 18px",
                    background: colors.accent,
                    color: "#000",
                    border: "none",
                    borderRadius: "14px",
                    fontSize: "0.7rem",
                    fontWeight: "950",
                    cursor: "pointer",
                    transition: "0.3s",
                  }}
                >
                  DONE
                </button>
              </div>
            )}

            {!n.is_read && isHovered !== n.id && (
              <div style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: getNotificationColor(n.type),
                boxShadow: `0 0 10px ${getNotificationColor(n.type)}`
              }} />
            )}
          </div>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
        
        @keyframes fadeIn { 
          from { opacity: 0; transform: translateY(10px); } 
          to { opacity: 1; transform: translateY(0); } 
        }
        
        @keyframes cardSlideIn { 
          from { opacity: 0; transform: translateX(-10px); } 
          to { opacity: 1; transform: translateX(0); } 
        }

        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};
          borderRadius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${colors.accent};
        }
      `}</style>
    </div>
  );
};

export default Notifications;
