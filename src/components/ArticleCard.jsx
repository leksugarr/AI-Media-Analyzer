export default function AticleCard({ title, content }) {
  return (
    <div className="p-4 bg-gray-800/50 backdrop-blur-md rounded-lg border border-gray-700">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <p>{content}</p>
    </div>
  );
}
