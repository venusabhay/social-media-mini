import { useState } from "react";

export default function NewPost({ setPosts }) {
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [message, setMessage] = useState("");
  const [uploadMethod, setUploadMethod] = useState("url");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setMessage("Please select an image file");
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage("Image size must be less than 5MB");
        return;
      }
      
      setSelectedFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setMediaUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    try {
      const token = localStorage.getItem("token");
      
      // Determine if URL is YouTube or image
      const isYouTube = mediaUrl && (
        mediaUrl.includes('youtube.com') || 
        mediaUrl.includes('youtu.be')
      );
      
      const payload = {
        text,
        image: isYouTube ? "" : mediaUrl,
        youtubeUrl: isYouTube ? mediaUrl : ""
      };
      
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const newPost = await res.json();

      if (res.ok) {
        // Don't add post locally - let Socket.io handle it for real-time consistency
        setText("");
        setMediaUrl("");
        setImagePreview("");
        setSelectedFile(null);
        setMessage("Post created ✅");
        setTimeout(() => setMessage(""), 2000);
      } else {
        setMessage(newPost.message || "Failed to create post ❌");
      }
    } catch (err) {
      console.error(err);
      setMessage("Server error ❌");
    }
  };

  return (
    <div style={{ marginBottom: "20px", backgroundColor: "#f9f9f9", padding: "15px", borderRadius: "8px" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column" }}>
        <textarea
          placeholder="What's on your mind?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ 
            padding: "10px", 
            marginBottom: "10px", 
            borderRadius: "4px", 
            border: "1px solid #ccc",
            minHeight: "80px",
            fontSize: "16px"
          }}
        />
        
        {/* Media upload section */}
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold", fontSize: "14px" }}>
            Add Media (Optional)
          </label>
          
          {/* Toggle buttons */}
          <div style={{ marginBottom: "10px", display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                setUploadMethod("file");
                setMediaUrl("");
                setImagePreview("");
                setSelectedFile(null);
              }}
              style={{
                padding: "6px 12px",
                backgroundColor: uploadMethod === "file" ? "#4267B2" : "#e0e0e0",
                color: uploadMethod === "file" ? "white" : "#333",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px"
              }}
            >
              📁 Upload Image
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMethod("url");
                setSelectedFile(null);
                setImagePreview("");
              }}
              style={{
                padding: "6px 12px",
                backgroundColor: uploadMethod === "url" ? "#4267B2" : "#e0e0e0",
                color: uploadMethod === "url" ? "white" : "#333",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "13px"
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
                  padding: "8px",
                  fontSize: "14px",
                  border: "2px dashed #4267B2",
                  borderRadius: "4px",
                  cursor: "pointer",
                  backgroundColor: "white"
                }}
              />
              {imagePreview && (
                <div style={{ marginTop: "10px" }}>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    style={{ 
                      maxWidth: "100%", 
                      maxHeight: "200px", 
                      borderRadius: "8px",
                      border: "1px solid #ddd"
                    }} 
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreview("");
                      setMediaUrl("");
                    }}
                    style={{
                      marginTop: "5px",
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
                Max file size: 5MB
              </small>
            </div>
          ) : (
            <input
              type="text"
              placeholder="Image URL or YouTube video link"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              style={{ 
                width: "100%",
                padding: "10px", 
                borderRadius: "4px", 
                border: "1px solid #ccc",
                fontSize: "14px"
              }}
            />
          )}
        </div>
        
        <button
          type="submit"
          style={{ 
            padding: "12px", 
            backgroundColor: "#4CAF50", 
            color: "white", 
            border: "none", 
            borderRadius: "4px", 
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold"
          }}
        >
          📝 Post
        </button>
      </form>
      {message && (
        <p style={{ 
          color: message.includes("✅") ? "green" : "red",
          marginTop: "10px",
          marginBottom: "0"
        }}>
          {message}
        </p>
      )}
    </div>
  );
}