// src/components/BlueskyPost.jsx
const BlueskyPost = ({ url }) => {
  return (
    <div style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px", marginTop: "8px" }}>
      <div>Bluesky Post URL: {url}</div>
      <div>Comments will render here...</div>
    </div>
  );
};

export default BlueskyPost;