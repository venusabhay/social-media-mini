import PostItem from "./PostItem";

export default function Feed({ posts, setPosts }) {
  const handleDelete = (postId) => {
    setPosts(posts.filter(post => post._id !== postId));
  };

  const handleUpdate = (updatedPost) => {
    setPosts(posts.map(post => 
      post._id === updatedPost._id ? updatedPost : post
    ));
  };

  if (!posts.length) return <p>No posts yet. Be the first!</p>;

  return (
    <div>
      {posts.map((post) => (
        <PostItem 
          key={post._id} 
          post={post} 
          onDelete={handleDelete} 
          onUpdate={handleUpdate}
        />
      ))}
    </div>
  );
}