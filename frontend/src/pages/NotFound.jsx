import { Link } from "react-router-dom";
import { Sprout, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-full bg-primary-tint text-primary flex items-center justify-center mb-5">
        <Sprout size={28} />
      </div>
      <h1 className="font-display text-3xl font-bold text-ink">404</h1>
      <p className="text-ink-soft mt-2 max-w-sm">
        This page doesn't exist, or it's moved somewhere else.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-sm bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-all duration-200 ease-out-expo active:scale-[0.97] hover:-translate-y-px"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>
    </div>
  );
}