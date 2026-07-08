export function EmptyState({ title, description, action }) {
  return (
    <div className="text-center py-12 text-ink-soft">
      <p className="font-display text-lg text-ink mb-1">{title}</p>
      {description && <p className="text-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}