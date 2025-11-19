export default function SummaryBox({ summary }) {
  return (
    <div className="p-4 bg-green-700/20 backdrop-blur-md rounded-lg border border-green-500">
      <h3 className="font-semibold mb-2">Summary:</h3>
      <p>{summary}</p>
    </div>
  );
}
