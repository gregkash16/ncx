export default function TestIframe() {
  return (
    <iframe
      src="http://localhost:3000/secret/nhl/goal"
      width="100%"
      height="900"
      style={{ border: 0 }}
      allow="autoplay"
    />
  );
}