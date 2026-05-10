import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Server, X, Menu, Cpu } from "lucide-react";
import { useState } from "react";

function XPIncLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'linear-gradient(135deg, #FF6200 0%, #FF8C42 100%)' }}>
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M4 4L10 12L4 20H7.5L12 13.8L16.5 20H20L14 12L20 4H16.5L12 10.2L7.5 4H4Z" fill="white"/>
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-black text-white text-base tracking-tight" style={{ letterSpacing: '-0.03em' }}>XP</span>
        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Inc.</span>
      </div>
    </div>
  );
}

const links = [
  { href: "/", label: "Painel", icon: LayoutDashboard },
  { href: "/systems", label: "Sistemas VRF", icon: Server },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  return (
    <nav className="flex-1 py-5 px-3 space-y-0.5 overflow-y-auto">
      <div className="px-3 py-1.5 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/30">Menu</p>
      </div>
      {links.map((link) => {
        const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
        return (
          <Link key={link.href} href={link.href} onClick={onNavigate}>
            <div
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group relative",
                isActive
                  ? "bg-[rgba(255,98,0,0.12)] text-white"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground/90"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: '#FF6200' }} />
              )}
              <link.icon
                className={cn("w-4 h-4 mr-3 transition-colors shrink-0", isActive ? "text-[#FF6200]" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60")}
              />
              {link.label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF6200]" />
              )}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="p-4 border-t border-sidebar-border">
      <div className="flex items-center gap-3 px-2">
        <div className="w-7 h-7 rounded-md bg-muted/20 flex items-center justify-center">
          <Cpu className="w-3.5 h-3.5 text-muted-foreground/60" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-sidebar-foreground/50">Monitor VRF</p>
          <p className="text-[10px] text-sidebar-foreground/25">v1.0.0</p>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b flex items-center justify-between px-4"
        style={{ background: 'hsl(225 17% 6%)', borderColor: 'hsl(220 13% 11%)' }}>
        <XPIncLogo />
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-72 flex flex-col transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: 'hsl(225 17% 6%)', borderRight: '1px solid hsl(220 13% 11%)' }}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b shrink-0"
          style={{ borderColor: 'hsl(220 13% 11%)' }}>
          <XPIncLogo />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <NavLinks onNavigate={() => setMobileOpen(false)} />
        <SidebarFooter />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 h-screen flex-col shrink-0"
        style={{ background: 'hsl(225 17% 6%)', borderRight: '1px solid hsl(220 13% 11%)' }}>
        <div className="h-16 flex items-center px-5 border-b shrink-0"
          style={{ borderColor: 'hsl(220 13% 11%)' }}>
          <XPIncLogo />
        </div>
        <NavLinks />
        <SidebarFooter />
      </aside>
    </>
  );
}
