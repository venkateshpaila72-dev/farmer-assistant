import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";

export function AuthLayout({ children, maxWidth = "max-w-md" }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <div className="px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2.5 font-display font-bold text-lg text-ink">
          <span className="w-7 h-7 rounded-[8px] bg-primary flex items-center justify-center text-white shrink-0">
            <Sprout size={15} />
          </span>
          Kisan Sahayak
        </Link>
      </div>
      <div className={`flex-1 flex items-center justify-center px-6 pb-16 w-full`}>
        <div className={`w-full ${maxWidth}`}>{children}</div>
      </div>
    </div>
  );
}