import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import Feed from "../components/Feed";
import NewPost from "../components/NewPost";
import Navbar from "../components/Navbar";

export default function FeedPage() {
  const [posts, setPosts] = useState([]);

  // Fetch posts from backend on component mount
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/posts", {
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });
        const data = await res.json();
        setPosts(data);
      } catch (err) {
        console.error("Error fetching posts:", err);
      }
    };
    fetchPosts();

    // Refresh posts when page becomes visible (e.g., coming back from profile page)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("🔄 Page visible, refreshing posts...");
        fetchPosts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup visibility listener
    const cleanupVisibility = () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    // Connect to Socket.io
    const socket = io("http://localhost:3003");

    socket.on("connect", () => {
      console.log("✅ Connected to Socket.io server");
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from Socket.io server");
    });

    // Listen for new posts
    socket.on("post:created", (newPost) => {
      console.log("🆕 New post received:", newPost);
      setPosts((prevPosts) => {
        // Check if post already exists to avoid duplicates
        const exists = prevPosts.some(p => p._id === newPost._id);
        if (exists) return prevPosts;
        return [newPost, ...prevPosts];
      });
    });

    // Listen for post likes
    socket.on("post:liked", ({ postId, likes }) => {
      console.log("👍 Post liked:", postId, likes);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, likes } : post
        )
      );
    });

    // Listen for post unlikes
    socket.on("post:unliked", ({ postId, likes }) => {
      console.log("👎 Post unliked:", postId, likes);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId ? { ...post, likes } : post
        )
      );
    });

    // Listen for new comments
    socket.on("comment:added", ({ postId, comment }) => {
      console.log("💬 Comment added:", postId, comment);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId
            ? { ...post, comments: [...post.comments, comment] }
            : post
        )
      );
    });

    // Listen for new replies
    socket.on("reply:added", ({ postId, commentId, reply }) => {
      console.log("↩️ Reply added:", postId, commentId, reply);
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
      console.log("🗑️ Comment deleted:", postId, commentId);
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
      console.log("🗑️ Reply deleted:", postId, commentId, replyId);
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
      console.log("🗑️ Post deleted:", postId);
      setPosts((prevPosts) => prevPosts.filter(post => post._id !== postId));
    });

    socket.on("post:updated", (updatedPost) => {
      console.log("✏️ Post updated:", updatedPost._id);
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === updatedPost._id ? updatedPost : post
        )
      );
    });

    // Cleanup on unmount
    return () => {
      console.log("🔌 Disconnecting Socket.io");
      socket.disconnect();
      cleanupVisibility();
    };
  }, []);

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "80px 20px 20px 20px" }}>
        {/* Pass setPosts to allow NewPost to update feed immediately */}
        <NewPost setPosts={setPosts} />
        <Feed posts={posts} setPosts={setPosts} />
      </div>
    </div>
  );
}