import { Link } from "react-router-dom";
import { Sprout } from "lucide-react";
import { FarmScene } from "../components/illustrations/FarmScene";

export function AuthLayout({ children, maxWidth = "max-w-md" }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg">
      {/* Illustrated side panel — hidden on small screens so the form stays
          front and center on mobile, where there's no room to spare. */}
      <div className="hidden md:block md:w-[42%] lg:w-[38%] relative overflow-hidden">
        <FarmScene variant="panel" className="absolute inset-0 w-full h-full" />
        <div className="relative h-full flex flex-col justify-between p-8">
          <Link to="/" className="inline-flex items-center gap-2.5 font-display font-bold text-lg text-ink">
            <span className="w-7 h-7 rounded-[8px] bg-primary flex items-center justify-center text-white shrink-0">
              <Sprout size={15} />
            </span>
            Kisan Sahayak
          </Link>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="px-6 py-6 md:hidden">
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
    </div>
  );
}