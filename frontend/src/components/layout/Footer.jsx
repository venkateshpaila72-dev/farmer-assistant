export function Footer() {
  return (
    <footer className="border-t border-border py-10 text-sm text-ink-soft">
      <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
        <span>Kisan Sahayak — built for farmers, works on any phone.</span>
        <span>&copy; {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}