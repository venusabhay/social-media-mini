import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Debounced search function
  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Please login to search users");
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          navigate("/login");
          return;
        }
        throw new Error("Failed to search users");
      }

      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (err) {
      console.error("Error searching users:", err);
      setError("Error searching users. Please try again.");
      setLoading(false);
    }
  }, [navigate]);

  // Debounce effect for live search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        performSearch(query);
      } else if (query.length === 0) {
        setResults([]);
        setSearched(false);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (query.trim()) {
      performSearch(query);
    }
  };

  const viewUserProfile = (userId) => {
    navigate(`/user/${userId}`);
  };

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "80px 20px 20px 20px" }}>
        <h2>Search Users</h2>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "10px", marginTop: "20px", marginBottom: "20px" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            style={{ 
              flex: 1, 
              padding: "12px", 
              fontSize: "16px", 
              borderRadius: "4px", 
              border: "1px solid #ccc" 
            }}
          />
          <button 
            type="submit"
            style={{ 
              padding: "12px 24px", 
              backgroundColor: "#4267B2", 
              color: "white", 
              border: "none", 
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px"
            }}
          >
            🔍 Search
          </button>
        </form>

      {loading && <p style={{ textAlign: "center" }}>Searching...</p>}

      {error && <p style={{ textAlign: "center", color: "red" }}>{error}</p>}

      {!loading && searched && !error && (
        <div>
          {results.length === 0 ? (
            <p style={{ textAlign: "center", color: "#888" }}>No users found</p>
          ) : (
            <div>
              <h3>{results.length} {results.length === 1 ? "user" : "users"} found</h3>
              {results.map((user) => (
                <div
                  key={user._id}
                  style={{
                    border: "1px solid #ddd",
                    padding: "15px",
                    marginBottom: "10px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    backgroundColor: "#fff"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "15px", flex: 1 }}>
                    {user.profilePic && user.profilePic.trim() !== "" ? (
                      <img 
                        src={user.profilePic} 
                        alt={`${user.firstName} ${user.lastName}`}
                        style={{ 
                          width: "60px", 
                          height: "60px", 
                          borderRadius: "50%", 
                          objectFit: "cover" 
                        }}
                      />
                    ) : (
                      <div style={{ 
                        width: "60px", 
                        height: "60px", 
                        borderRadius: "50%", 
                        backgroundColor: "#4267B2", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        color: "white",
                        fontSize: "24px",
                        fontWeight: "bold",
                        flexShrink: 0
                      }}>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 style={{ margin: "0 0 5px 0" }}>
                        {user.firstName} {user.lastName}
                      </h4>
                      <p style={{ margin: "0", color: "#666", fontSize: "14px" }}>{user.email}</p>
                      {user.bio && (
                        <p style={{ margin: "5px 0 0 0", color: "#888", fontSize: "14px", fontStyle: "italic" }}>
                          {user.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => viewUserProfile(user._id)}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: "#4267B2",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer"
                    }}
                  >
                    View Profile
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
