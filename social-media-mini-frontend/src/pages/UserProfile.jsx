import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import PostItem from "../components/PostItem";
import Navbar from "../components/Navbar";

export default function UserProfile() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        
        // Fetch user profile
        const userRes = await fetch(`/api/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const userData = await userRes.json();
        setUser(userData);

        // Fetch user's posts
        const postsRes = await fetch(`/api/users/${userId}/posts`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const postsData = await postsRes.json();
        setPosts(postsData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  // Socket.io for real-time updates
  useEffect(() => {
    const socket = io("http://localhost:3003");

    socket.on("connect", () => {
      console.log("🔌 UserProfile: Socket.io connected");
    });

    socket.on("post:created", (newPost) => {
      console.log("🆕 UserProfile: New post received", newPost);
      // Only add if it's the viewed user's post
      if (newPost.user._id === userId) {
        setPosts((prevPosts) => {
          const exists = prevPosts.some(p => p._id === newPost._id);
          if (exists) return prevPosts;
          return [newPost, ...prevPosts];
        });
      }
    });

    socket.on("post:liked", ({ postId, likes }) => {
      console.log("👍 UserProfile: Post liked", postId);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, likes } : post
        )
      );
    });

    socket.on("post:unliked", ({ postId, likes }) => {
      console.log("👎 UserProfile: Post unliked", postId);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, likes } : post
        )
      );
    });

    socket.on("comment:added", ({ postId, comment }) => {
      console.log("💬 UserProfile: Comment added", postId);
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
      console.log("↩️ UserProfile: Reply added", postId, commentId);
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
      console.log("🗑️ UserProfile: Comment deleted", postId, commentId);
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
      console.log("🗑️ UserProfile: Reply deleted", postId, commentId, replyId);
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
      console.log("🗑️ UserProfile: Post deleted", postId);
      setPosts((prevPosts) => prevPosts.filter(post => post._id !== postId));
    });

    socket.on("post:updated", (updatedPost) => {
      console.log("✏️ UserProfile: Post updated", updatedPost._id);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    });

    return () => {
      console.log("🔌 UserProfile: Disconnecting Socket.io");
      socket.disconnect();
    };
  }, [userId]);

  if (loading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>;
  }

  if (!user) {
    return <div style={{ padding: "20px", textAlign: "center" }}>User not found</div>;
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "80px 20px 20px 20px" }}>
      {/* Profile Header */}
      <div style={{ 
        backgroundColor: "#f5f5f5", 
        padding: "30px", 
        borderRadius: "8px", 
        marginBottom: "30px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
          {user.profilePic && user.profilePic.trim() !== "" ? (
            <img 
              src={user.profilePic} 
              alt={`${user.firstName} ${user.lastName}`}
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
              {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: "0 0 10px 0" }}>
              {user.firstName} {user.lastName}
            </h1>
            <p style={{ margin: "0", color: "#666" }}>{user.email}</p>
            {user.bio && <p style={{ margin: "10px 0", color: "#555", fontStyle: "italic" }}>{user.bio}</p>}
            <p style={{ margin: "10px 0 0 0", color: "#888" }}>
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </p>
          </div>
        </div>
      </div>

      {/* User's Posts */}
      <div>
        <h2>{user.firstName}'s Posts</h2>
        {posts.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888" }}>No posts yet</p>
        ) : (
          posts.map((post) => (
            <PostItem 
              key={post._id} 
              post={post}
            />
          ))
        )}
      </div>
      </div>
    </div>
  );
}
