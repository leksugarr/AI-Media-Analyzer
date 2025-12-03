export default function SummaryBox({ summary }) {
  return (
    <div className="p-4 bg-green-600/20 border border-green-500 rounded-xl backdrop-blur-lg">
      <h2 className="text-lg font-bold mb-2">Summary</h2>
      <p>{summary}</p>
    </div>
  );
}
