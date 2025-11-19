import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import PostItem from "../components/PostItem";
import Navbar from "../components/Navbar";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    bio: "",
    profilePic: ""
  });
  const [updateMessage, setUpdateMessage] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMethod, setUploadMethod] = useState("url");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        // Fetch user profile
        const userRes = await fetch("/api/users/me", {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });
        
        if (!userRes.ok) {
          if (userRes.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            navigate("/login");
            return;
          }
          throw new Error("Failed to fetch user profile");
        }
        
        const userData = await userRes.json();
        setUser(userData);
        setFormData({
          firstName: userData.firstName,
          lastName: userData.lastName,
          bio: userData.bio || "",
          profilePic: userData.profilePic || ""
        });
        setImagePreview(userData.profilePic || "");

        // Fetch user's posts
        const postsRes = await fetch("/api/users/me/posts", {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });
        
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          // Ensure postsData is an array
          setPosts(Array.isArray(postsData) ? postsData : []);
        } else {
          console.error("Failed to fetch posts:", postsRes.status);
          setPosts([]);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setLoading(false);
      }
    };

    fetchProfile();

    // Refresh profile when editing is complete
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isEditing) {
        console.log("🔄 Profile page visible, refreshing...");
        fetchProfile();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, isEditing]);

  // Socket.io for real-time updates
  useEffect(() => {
    if (!user) return;

    const socket = io("http://localhost:3003");

    socket.on("connect", () => {
      console.log("🔌 Profile: Socket.io connected");
    });

    socket.on("post:created", (newPost) => {
      console.log("🆕 Profile: New post received", newPost);
      // Only add if it's the current user's post
      if (newPost.user._id === user._id) {
        setPosts((prevPosts) => {
          const exists = prevPosts.some(p => p._id === newPost._id);
          if (exists) return prevPosts;
          return [newPost, ...prevPosts];
        });
      }
    });

    socket.on("post:liked", ({ postId, likes }) => {
      console.log("👍 Profile: Post liked", postId);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, likes } : post
        )
      );
    });

    socket.on("post:unliked", ({ postId, likes }) => {
      console.log("👎 Profile: Post unliked", postId);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, likes } : post
        )
      );
    });

    socket.on("comment:added", ({ postId, comment }) => {
      console.log("💬 Profile: Comment added", postId);
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post._id === postId) {
            return {
              ...post,
              comments: [...post.comments, comment]
            };
          }
          return post;
        })
      );
    });

    socket.on("reply:added", ({ postId, commentId, reply }) => {
      console.log("↩️ Profile: Reply added", postId, commentId);
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post._id === postId) {
            const updatedComments = post.comments.map((comment) => {
              if (comment._id === commentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), reply]
                };
              }
              return comment;
            });
            return { ...post, comments: updatedComments };
          }
          return post;
        })
      );
    });

    socket.on("comment:deleted", ({ postId, commentId }) => {
      console.log("🗑️ Profile: Comment deleted", postId, commentId);
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post._id === postId) {
            return {
              ...post,
              comments: post.comments.filter((comment) => comment._id !== commentId)
            };
          }
          return post;
        })
      );
    });

    socket.on("reply:deleted", ({ postId, commentId, replyId }) => {
      console.log("🗑️ Profile: Reply deleted", postId, commentId, replyId);
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post._id === postId) {
            const updatedComments = post.comments.map((comment) => {
              if (comment._id === commentId) {
                return {
                  ...comment,
                  replies: comment.replies.filter((reply) => reply._id !== replyId)
                };
              }
              return comment;
            });
            return { ...post, comments: updatedComments };
          }
          return post;
        })
      );
    });

    socket.on("post:deleted", ({ postId }) => {
      console.log("🗑️ Profile: Post deleted", postId);
      setPosts((prevPosts) => prevPosts.filter(post => post._id !== postId));
    });

    socket.on("post:updated", (updatedPost) => {
      console.log("✏️ Profile: Post updated", updatedPost._id);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    });

    return () => {
      console.log("🔌 Profile: Disconnecting Socket.io");
      socket.disconnect();
    };
  }, [user]);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    setUpdateMessage("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Update image preview if profilePic URL changes
    if (name === 'profilePic') {
      setImagePreview(value);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setUpdateMessage("❌ Please select an image file");
        setTimeout(() => setUpdateMessage(""), 3000);
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setUpdateMessage("❌ Image size must be less than 5MB");
        setTimeout(() => setUpdateMessage(""), 3000);
        return;
      }
      
      setSelectedFile(file);
      setUpdateMessage("✅ Image selected: " + file.name);
      setTimeout(() => setUpdateMessage(""), 3000);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setFormData({
          ...formData,
          profilePic: reader.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdateMessage("");

    try {
      const token = localStorage.getItem("token");
      
      console.log("Updating profile with data:", {
        firstName: formData.firstName,
        lastName: formData.lastName,
        bio: formData.bio,
        profilePicLength: formData.profilePic?.length || 0
      });
      
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setUser(data);
        setFormData({
          firstName: data.firstName,
          lastName: data.lastName,
          bio: data.bio || "",
          profilePic: data.profilePic || ""
        });
        setImagePreview(data.profilePic || "");
        setIsEditing(false);
        setUpdateMessage("✅ Profile updated successfully!");
        setTimeout(() => setUpdateMessage(""), 3000);
        
        // Refresh posts to show updated profile picture
        const postsRes = await fetch("/api/users/me/posts", {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });
        if (postsRes.ok) {
          const postsData = await postsRes.json();
          setPosts(Array.isArray(postsData) ? postsData : []);
        }
      } else {
        setUpdateMessage("❌ " + (data.message || "Update failed"));
      }
    } catch (err) {
      setUpdateMessage("❌ Error updating profile");
      console.error("Update error:", err);
    }
  };

  if (loading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Unable to load profile. Please try again.</div>;
  }

  return (
    <div>
      <Navbar onEditProfile={handleEditToggle} />
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "80px 20px 20px 20px" }}>
      {/* Profile Header */}
      <div style={{ 
        backgroundColor: "#f5f5f5", 
        padding: "30px", 
        borderRadius: "8px", 
        marginBottom: "30px"
      }}>
        {updateMessage && (
          <p style={{ 
            color: updateMessage.includes("success") ? "green" : "red",
            marginBottom: "10px",
            fontWeight: "bold"
          }}>
            {updateMessage}
          </p>
        )}
        
        {!isEditing ? (
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            {user?.profilePic && user.profilePic.trim() !== "" ? (
              <img 
                src={user.profilePic} 
                alt="Profile" 
                style={{ 
                  width: "100px", 
                  height: "100px", 
                  borderRadius: "50%", 
                  objectFit: "cover",
                  border: "3px solid #4267B2"
                }} 
              />
            ) : (
              <div style={{ 
                width: "100px", 
                height: "100px", 
                borderRadius: "50%", 
                backgroundColor: "#4267B2", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "white",
                fontSize: "40px",
                fontWeight: "bold"
              }}>
                {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <h1 style={{ margin: "0 0 10px 0" }}>
                {user?.firstName} {user?.lastName}
              </h1>
              <p style={{ margin: "0", color: "#666" }}>{user?.email}</p>
              {user?.bio && <p style={{ margin: "10px 0", color: "#555", fontStyle: "italic" }}>{user.bio}</p>}
              <p style={{ margin: "10px 0 0 0", color: "#888" }}>
                {posts.length} {posts.length === 1 ? "post" : "posts"}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h2>Edit Profile</h2>
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: "15px", textAlign: "center" }}>
                {imagePreview && imagePreview.trim() !== "" ? (
                  <div>
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      style={{ 
                        width: "120px", 
                        height: "120px", 
                        borderRadius: "50%", 
                        objectFit: "cover",
                        border: "3px solid #4267B2",
                        marginBottom: "10px"
                      }} 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setImagePreview("");
                          setFormData({ ...formData, profilePic: "" });
                          setSelectedFile(null);
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          backgroundColor: "#dc3545",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                      >
                        🗑️ Remove Picture
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    width: "120px", 
                    height: "120px", 
                    borderRadius: "50%", 
                    backgroundColor: "#ddd", 
                    display: "inline-flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    color: "#888",
                    fontSize: "50px",
                    marginBottom: "10px"
                  }}>
                    {formData.firstName?.charAt(0)}{formData.lastName?.charAt(0)}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "10px", fontWeight: "bold" }}>Profile Picture</label>
                
                {/* Upload method toggle */}
                <div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMethod("file");
                      setSelectedFile(null);
                    }}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: uploadMethod === "file" ? "#4267B2" : "#e0e0e0",
                      color: uploadMethod === "file" ? "white" : "#333",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                  >
                    📁 Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadMethod("url");
                      setSelectedFile(null);
                    }}
                    style={{
                      padding: "8px 16px",
                      backgroundColor: uploadMethod === "url" ? "#4267B2" : "#e0e0e0",
                      color: uploadMethod === "url" ? "white" : "#333",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "14px"
                    }}
                  >
                    🔗 Use URL
                  </button>
                </div>

                {uploadMethod === "file" ? (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{
                        width: "100%",
                        padding: "10px",
                        fontSize: "16px",
                        border: "2px dashed #4267B2",
                        borderRadius: "4px",
                        cursor: "pointer",
                        backgroundColor: "white"
                      }}
                    />
                    {selectedFile && (
                      <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "14px", color: "#28a745" }}>✓ {selectedFile.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setImagePreview(user?.profilePic || "");
                            setFormData({ ...formData, profilePic: user?.profilePic || "" });
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: "12px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "3px",
                            cursor: "pointer"
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "5px" }}>
                      Max file size: 5MB. Supported formats: JPG, PNG, GIF, WebP
                    </small>
                  </div>
                ) : (
                  <div>
                    <input
                      type="url"
                      name="profilePic"
                      value={formData.profilePic}
                      onChange={handleChange}
                      style={{ width: "100%", padding: "10px", fontSize: "16px" }}
                      placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                    />
                    <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "5px" }}>
                      Tip: Use image hosting services like Imgur, Cloudinary, or direct image URLs
                    </small>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  style={{ width: "100%", padding: "10px", fontSize: "16px" }}
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  style={{ width: "100%", padding: "10px", fontSize: "16px" }}
                />
              </div>
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  rows="3"
                  style={{ width: "100%", padding: "10px", fontSize: "16px" }}
                  placeholder="Tell us about yourself..."
                />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" style={{ padding: "10px 20px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
                  Save Changes
                </button>
                <button type="button" onClick={handleEditToggle} style={{ padding: "10px 20px", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* User's Posts */}
      <div>
        <h2>My Posts</h2>
        {posts.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888" }}>No posts yet. Go to the feed to create your first post!</p>
        ) : (
          posts.map((post) => (
            <PostItem 
              key={post._id} 
              post={post} 
              onDelete={(postId) => setPosts(posts.filter(p => p._id !== postId))}
              onUpdate={(updatedPost) => setPosts(posts.map(p => 
                p._id === updatedPost._id ? updatedPost : p
              ))}
            />
          ))
        )}
      </div>
      </div>
    </div>
  );
}
