import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sprout, Menu, X } from "lucide-react";
import { cn } from "../../utils/cn";
import { Button } from "../ui/Button";
import { MobileMenu } from "./MobileMenu";

const links = [
  { href: "#features", label: "What it does" },
  { href: "#dashboard", label: "Your farm, at a glance" },
  { href: "#trust", label: "Farmers using it" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 bg-bg/95 border-b border-border transition-shadow duration-300 ease-out-expo",
        scrolled && "shadow-sm"
      )}
    >
      <div className="max-w-6xl mx-auto px-6 h-[68px] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 font-display font-bold text-xl text-ink">
          <span className="w-8 h-8 rounded-[9px] bg-primary flex items-center justify-center text-white shrink-0">
            <Sprout size={18} />
          </span>
          Kisan Sahayak
        </Link>

        <div className="hidden md:flex items-center gap-7 text-[15px] font-medium text-ink-soft">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-ink transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="hidden md:block">
            <Button variant="ghost">Log in</Button>
          </Link>
          <Link to="/register" className="hidden sm:block">
            <Button variant="primary">Get started</Button>
          </Link>
          <button
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 text-ink"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} links={links} />
    </nav>
  );
}