import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Server, X, Menu } from "lucide-react";
import { useState } from "react";

function XPLogo() {
  return (
    <svg viewBox="0 0 80 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
      <text x="0" y="22" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="900" fill="white" letterSpacing="-1">XP</text>
      <text x="38" y="22" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="500" fill="rgba(255,255,255,0.65)" letterSpacing="1">INC.</text>
    </svg>
  );
}

const links = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/systems", label: "Sistemas VRF", icon: Server },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
      {links.map((link) => {
        const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
        return (
          <Link key={link.href} href={link.href} onClick={onNavigate}>
            <div
              className={cn(
                "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer group",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <link.icon className={cn("w-5 h-5 mr-3", isActive ? "text-amber-400" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70")} />
              {link.label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <XPLogo />
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-sidebar-border shrink-0">
          <XPLogo />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <NavLinks onNavigate={() => setMobileOpen(false)} />
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40 px-3">Monitor VRF v1.0</p>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 border-r border-sidebar-border bg-sidebar h-screen flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
          <XPLogo />
        </div>
        <NavLinks />
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/40 px-3">Monitor VRF v1.0</p>
        </div>
      </aside>
    </>
  );
}
