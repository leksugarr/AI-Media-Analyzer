export default function ArticleCard({ children, className }) {
  return (
    <div
      className={`p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}
