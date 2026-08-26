import { Link, useNavigate } from "react-router-dom";
import { ServerCrash, ArrowLeft, LogIn } from "lucide-react";

export default function ServerError() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-full bg-primary-tint text-primary flex items-center justify-center mb-5">
        <ServerCrash size={28} />
      </div>
      <h1 className="font-display text-3xl font-bold text-ink">Something went wrong on our server</h1>
      <p className="text-ink-soft mt-2 max-w-sm">
        That's on us, not you. Please try again in a moment.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-sm bg-white border border-ink/10 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-bg transition-all duration-200 ease-out-expo active:scale-[0.97] hover:-translate-y-px"
        >
          <ArrowLeft size={16} /> Go back
        </button>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-sm bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-all duration-200 ease-out-expo active:scale-[0.97] hover:-translate-y-px"
        >
          <LogIn size={16} /> Go to login
        </Link>
      </div>
    </div>
  );
}