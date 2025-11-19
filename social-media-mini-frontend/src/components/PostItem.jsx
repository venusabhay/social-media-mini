import { useState, useEffect } from "react";

export default function PostItem({ post, onDelete, onUpdate }) {
  const [likes, setLikes] = useState(post.likes?.length || 0);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(post.text);
  const [editMediaUrl, setEditMediaUrl] = useState(post.image || post.youtubeUrl || "");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

  // Sync with post prop changes (for real-time updates)
  useEffect(() => {
    setLikes(post.likes?.length || 0);
    setComments(post.comments || []);
  }, [post.likes, post.comments]);

  // Get current user ID from localStorage
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  
  // Normalize IDs for comparison - convert both to strings
  const currentUserId = currentUser.id || currentUser._id;
  const postUserId = post.user?._id || post.user?.id;
  const isOwnPost = currentUserId && postUserId && currentUserId.toString() === postUserId.toString();

  const handleLike = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/like`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setLikes(data.likes);
      }
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  const handleUnlike = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/unlike`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setLikes(data.likes);
      }
    } catch (err) {
      console.error("Error unliking post:", err);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: commentText }),
      });

      const data = await res.json();
      if (res.ok) {
        setComments([...comments, data]);
        setCommentText("");
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Call the onDelete callback to remove post from UI
        if (onDelete) {
          onDelete(post._id);
        }
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete post");
      }
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Error deleting post");
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(post.text);
    setEditMediaUrl(post.image || post.youtubeUrl || "");
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) {
      alert("Post text cannot be empty");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      
      // Determine if URL is YouTube or image
      const isYouTube = editMediaUrl && (
        editMediaUrl.includes('youtube.com') || 
        editMediaUrl.includes('youtu.be')
      );
      
      const payload = {
        text: editText,
        image: isYouTube ? "" : editMediaUrl,
        youtubeUrl: isYouTube ? editMediaUrl : ""
      };
      
      const res = await fetch(`/api/posts/${post._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        // Update the post in the parent component
        if (onUpdate) {
          onUpdate(data);
        }
        setIsEditing(false);
      } else {
        alert(data.message || "Failed to update post");
      }
    } catch (err) {
      console.error("Error updating post:", err);
      alert("Error updating post");
    }
  };

  const handleReply = async (commentId, e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      const token = localStorage.getItem("token");
      console.log("Posting reply to comment:", commentId);
      const res = await fetch(`/api/posts/${post._id}/comments/${commentId}/replies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: replyText }),
      });

      const data = await res.json();
      console.log("Reply response:", data);
      if (res.ok) {
        // Update the comment with the new reply
        setComments(comments.map(comment => 
          comment._id === commentId 
            ? { ...comment, replies: [...(comment.replies || []), data] }
            : comment
        ));
        setReplyText("");
        setReplyingTo(null);
      } else {
        console.error("Failed to add reply:", data);
        alert(data.message || "Failed to add reply");
      }
    } catch (err) {
      console.error("Error adding reply:", err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Remove the comment from the local state
        setComments(comments.filter(comment => comment._id !== commentId));
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete comment");
      }
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert("Error deleting comment");
    }
  };

  const handleDeleteReply = async (commentId, replyId) => {
    if (!window.confirm("Are you sure you want to delete this reply?")) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/comments/${commentId}/replies/${replyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Remove the reply from the local state
        setComments(comments.map(comment => 
          comment._id === commentId 
            ? { ...comment, replies: comment.replies.filter(reply => reply._id !== replyId) }
            : comment
        ));
      } else {
        const data = await res.json();
        alert(data.message || "Failed to delete reply");
      }
    } catch (err) {
      console.error("Error deleting reply:", err);
      alert("Error deleting reply");
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: "15px", marginBottom: "15px", borderRadius: "8px" }}>
      <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {post.user?.profilePic && post.user.profilePic.trim() !== "" ? (
            <img 
              src={post.user.profilePic} 
              alt={`${post.user.firstName} ${post.user.lastName}`}
              style={{ 
                width: "40px", 
                height: "40px", 
                borderRadius: "50%", 
                objectFit: "cover" 
              }}
            />
          ) : (
            <div style={{ 
              width: "40px", 
              height: "40px", 
              borderRadius: "50%", 
              backgroundColor: "#4267B2", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              color: "white",
              fontSize: "16px",
              fontWeight: "bold"
            }}>
              {post.user?.firstName?.charAt(0)}{post.user?.lastName?.charAt(0)}
            </div>
          )}
          <div>
            <strong>{post.user?.firstName} {post.user?.lastName}</strong>
            <span style={{ color: "#888", fontSize: "12px", marginLeft: "10px" }}>
              {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        {isOwnPost && !isEditing && (
          <div style={{ display: "flex", gap: "5px" }}>
            <button 
              onClick={handleEdit}
              style={{ 
                padding: "5px 10px", 
                backgroundColor: "#007bff", 
                color: "white", 
                border: "none", 
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              ✏️ Edit
            </button>
            <button 
              onClick={handleDelete}
              style={{ 
                padding: "5px 10px", 
                backgroundColor: "#dc3545", 
                color: "white", 
                border: "none", 
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div style={{ marginBottom: "10px" }}>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "10px", 
              marginBottom: "10px", 
              borderRadius: "4px", 
              border: "1px solid #ccc",
              minHeight: "80px"
            }}
          />
          <input
            type="text"
            value={editMediaUrl}
            onChange={(e) => setEditMediaUrl(e.target.value)}
            placeholder="Media URL (image or YouTube video)"
            style={{ 
              width: "100%", 
              padding: "8px", 
              marginBottom: "10px", 
              borderRadius: "4px", 
              border: "1px solid #ccc"
            }}
          />
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              onClick={handleSaveEdit}
              style={{ 
                padding: "8px 15px", 
                backgroundColor: "#28a745", 
                color: "white", 
                border: "none", 
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Save
            </button>
            <button 
              onClick={handleCancelEdit}
              style={{ 
                padding: "8px 15px", 
                backgroundColor: "#6c757d", 
                color: "white", 
                border: "none", 
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p>{post.text}</p>
          {post.image && <img src={post.image} alt="Post" style={{ maxWidth: "100%", borderRadius: "8px" }} />}
          {post.youtubeUrl && (
            <div style={{ marginTop: "10px", position: "relative" }}>
              <iframe
                width="100%"
                height="315"
                src={post.youtubeUrl}
                title="YouTube video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ 
                  borderRadius: "8px", 
                  maxWidth: "560px",
                  border: "none"
                }}
              ></iframe>
              <div style={{ marginTop: "5px", fontSize: "12px" }}>
                <a 
                  href={post.youtubeUrl.replace('/embed/', '/watch?v=')} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: "#065fd4", textDecoration: "none" }}
                >
                  🔗 Open in YouTube
                </a>
              </div>
            </div>
          )}
        </>
      )}
      
      <div style={{ marginTop: "10px", display: "flex", gap: "10px" }}>
        <button onClick={handleLike} style={{ padding: "5px 15px" }}>👍 Like ({likes})</button>
        <button onClick={handleUnlike} style={{ padding: "5px 15px" }}>Unlike</button>
        <button onClick={() => setShowComments(!showComments)} style={{ padding: "5px 15px" }}>
          💬 Comments ({comments.length})
        </button>
      </div>

      {showComments && (
        <div style={{ marginTop: "15px" }}>
          <form onSubmit={handleComment} style={{ marginBottom: "10px" }}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              style={{ width: "70%", padding: "8px", marginRight: "10px" }}
            />
            <button type="submit" style={{ padding: "8px 15px" }}>Post</button>
          </form>

          <div>
            {comments.map((comment, idx) => {
              const commentUserId = comment.user?._id || comment.user?.id;
              const isOwnComment = commentUserId && currentUserId && commentUserId.toString() === currentUserId.toString();
              
              return (
              <div key={comment._id || idx} style={{ padding: "8px", backgroundColor: "#f5f5f5", marginBottom: "5px", borderRadius: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div style={{ flex: 1, display: "flex", gap: "8px" }}>
                    {comment.user?.profilePic ? (
                      <img 
                        src={comment.user.profilePic} 
                        alt={`${comment.user.firstName} ${comment.user.lastName}`}
                        style={{ 
                          width: "32px", 
                          height: "32px", 
                          borderRadius: "50%", 
                          objectFit: "cover",
                          marginTop: "2px"
                        }}
                      />
                    ) : (
                      <div style={{ 
                        width: "32px", 
                        height: "32px", 
                        borderRadius: "50%", 
                        backgroundColor: "#4267B2", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: "bold",
                        marginTop: "2px",
                        flexShrink: 0
                      }}>
                        {comment.user?.firstName?.charAt(0)}{comment.user?.lastName?.charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <strong>{comment.user?.firstName} {comment.user?.lastName}</strong>
                      <p style={{ margin: "5px 0 0 0" }}>{comment.text}</p>
                    </div>
                  </div>
                  {isOwnComment && (
                    <button
                      onClick={() => handleDeleteComment(comment._id)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "11px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer"
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
                
                {/* Reply button */}
                <button
                  onClick={() => {
                    console.log("Reply button clicked for comment:", comment._id);
                    console.log("Current replyingTo state:", replyingTo);
                    setReplyingTo(replyingTo === comment._id ? null : comment._id);
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: "12px",
                    backgroundColor: "transparent",
                    border: "none",
                    color: "#4267B2",
                    cursor: "pointer",
                    marginTop: "5px"
                  }}
                >
                  💬 Reply {comment.replies?.length > 0 && `(${comment.replies.length})`}
                </button>

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div style={{ marginLeft: "20px", marginTop: "10px" }}>
                    {comment.replies.map((reply, replyIdx) => {
                      const replyUserId = reply.user?._id || reply.user?.id;
                      const isOwnReply = replyUserId && currentUserId && replyUserId.toString() === currentUserId.toString();
                      
                      console.log('Reply ownership check:', {
                        replyUserId,
                        currentUserId,
                        replyUserIdStr: replyUserId?.toString(),
                        currentUserIdStr: currentUserId?.toString(),
                        isOwnReply,
                        replyUser: reply.user
                      });
                      
                      return (
                        <div key={reply._id || replyIdx} style={{ padding: "6px", backgroundColor: "#e8e8e8", marginBottom: "5px", borderRadius: "4px", fontSize: "14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <div style={{ flex: 1 }}>
                              <strong>{reply.user?.firstName} {reply.user?.lastName}</strong>
                              <p style={{ margin: "3px 0 0 0" }}>{reply.text}</p>
                            </div>
                            {isOwnReply && (
                              <button
                                onClick={() => handleDeleteReply(comment._id, reply._id)}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  backgroundColor: "#dc3545",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "3px",
                                  cursor: "pointer"
                                }}
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply form */}
                {replyingTo === comment._id && (
                  <form onSubmit={(e) => handleReply(comment._id, e)} style={{ marginTop: "10px", marginLeft: "20px" }}>
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      style={{ width: "60%", padding: "6px", marginRight: "10px", fontSize: "14px" }}
                    />
                    <button type="submit" style={{ padding: "6px 12px", fontSize: "14px" }}>Reply</button>
                    <button 
                      type="button" 
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText("");
                      }}
                      style={{ padding: "6px 12px", fontSize: "14px", marginLeft: "5px" }}
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
  );
}
