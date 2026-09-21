import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Server, X, Menu, Cpu, ChevronDown, ChevronRight,
  Building2, Sparkles, Trash2,
} from "lucide-react";
import { useState } from "react";

function XPIncLogo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <img
        src="/xp-logo.png"
        alt="XP"
        className="h-9 w-9 object-contain rounded-lg"
        style={{ imageRendering: 'auto' }}
      />
      <span
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 700,
          fontSize: '13px',
          color: 'rgba(255,255,255,0.55)',
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        Monitor VRF
      </span>
    </div>
  );
}

type LeafLink = { href: string; label: string; icon: React.ElementType; matchPrefix?: boolean };
type GroupLink = { label: string; icon: React.ElementType; basePath: string; children: LeafLink[] };

const dashboardLink: LeafLink = { href: "/", label: "Painel", icon: LayoutDashboard };

const systemsGroup: GroupLink = {
  label: "Sistemas VRF",
  icon: Server,
  basePath: "/systems",
  children: [
    { href: "/systems?category=escritorios_xp", label: "Escritorios XP", icon: Building2 },
    { href: "/systems?category=espacos_xp", label: "Espacos XP", icon: Sparkles },
    { href: "/systems/trash", label: "Lixeira", icon: Trash2 },
  ],
};

function isChildActive(child: LeafLink, location: string, search: string): boolean {
  const [path, query] = child.href.split("?");
  if (path === "/systems/trash") return location === "/systems/trash";
  if (location !== "/systems") return false;
  if (!query) return !search.includes("category=");
  const params = new URLSearchParams(search);
  const targetParams = new URLSearchParams(query);
  for (const [k, v] of targetParams.entries()) {
    if (params.get(k) !== v) return false;
  }
  return true;
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const groupActive = location.startsWith(systemsGroup.basePath);
  const [open, setOpen] = useState(groupActive);
  const dashActive = location === dashboardLink.href;

  return (
    <nav className="flex-1 py-5 px-3 space-y-0.5 overflow-y-auto">
      <div className="px-3 py-1.5 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/30">Menu</p>
      </div>

      {/* Painel */}
      <Link href={dashboardLink.href} onClick={onNavigate}>
        <div
          className={cn(
            "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group relative",
            dashActive
              ? "bg-[rgba(255,98,0,0.12)] text-white"
              : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground/90"
          )}
        >
          {dashActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ background: '#FF6200' }} />
          )}
          <dashboardLink.icon
            className={cn("w-4 h-4 mr-3 transition-colors shrink-0", dashActive ? "text-[#FF6200]" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60")}
          />
          {dashboardLink.label}
          {dashActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#FF6200]" />}
        </div>
      </Link>

      {/* Sistemas VRF (collapsible) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
          groupActive
            ? "text-white"
            : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground/90"
        )}
      >
        <systemsGroup.icon
          className={cn("w-4 h-4 mr-3 transition-colors shrink-0", groupActive ? "text-[#FF6200]" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60")}
        />
        <span className="flex-1 text-left">{systemsGroup.label}</span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-sidebar-foreground/30" /> : <ChevronRight className="w-3.5 h-3.5 text-sidebar-foreground/30" />}
      </button>

      {open && (
        <div className="mt-0.5 ml-4 pl-3 border-l border-sidebar-border/50 space-y-0.5">
          {systemsGroup.children.map((child) => {
            const active = isChildActive(child, location, search);
            return (
              <Link key={child.href} href={child.href} onClick={onNavigate}>
                <div
                  className={cn(
                    "flex items-center px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer group relative",
                    active
                      ? "bg-[rgba(255,98,0,0.10)] text-white"
                      : "text-sidebar-foreground/45 hover:bg-sidebar-accent hover:text-sidebar-foreground/85"
                  )}
                >
                  <child.icon
                    className={cn("w-3.5 h-3.5 mr-2.5 transition-colors shrink-0", active ? "text-[#FF6200]" : "text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60")}
                  />
                  {child.label}
                  {active && <div className="ml-auto w-1 h-1 rounded-full bg-[#FF6200]" />}
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
