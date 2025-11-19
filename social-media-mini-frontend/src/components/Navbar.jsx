import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar({ onEditProfile }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Check if we're on the feed page
  const isFeedPage = location.pathname === "/feed";
  const isProfilePage = location.pathname === "/profile";

  return (
    <nav style={{
      backgroundColor: "#4267B2",
      padding: "15px 20px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "white",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    }}>
      <h2 style={{ margin: 0, cursor: "pointer" }} onClick={() => navigate("/feed")}>
        Social Media Mini
      </h2>
      <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
        {!isFeedPage && (
          <button 
            onClick={() => navigate("/feed")}
            style={{ 
              padding: "8px 16px", 
              cursor: "pointer",
              backgroundColor: "white",
              color: "#4267B2",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold"
            }}
          >
            🏠 Home
          </button>
        )}
        <button 
          onClick={() => navigate("/search")}
          style={{ 
            padding: "8px 16px", 
            cursor: "pointer",
            backgroundColor: "white",
            color: "#4267B2",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold"
          }}
        >
          🔍 Search
        </button>
        <button 
          onClick={() => navigate("/profile")}
          style={{ 
            padding: "8px 16px", 
            cursor: "pointer",
            backgroundColor: "white",
            color: "#4267B2",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold"
          }}
        >
          👤 Profile
        </button>
        {isProfilePage && onEditProfile && (
          <button 
            onClick={onEditProfile}
            style={{ 
              padding: "8px 16px", 
              cursor: "pointer",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontWeight: "bold"
            }}
          >
            ✏️ Edit Profile
          </button>
        )}
        <button 
          onClick={handleLogout}
          style={{ 
            padding: "8px 16px", 
            cursor: "pointer",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontWeight: "bold"
          }}
        >
          🚪 Logout
        </button>
      </div>
    </nav>
  );
}
