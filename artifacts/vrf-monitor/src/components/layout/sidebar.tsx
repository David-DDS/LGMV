import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Server, Settings, Activity } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/systems", label: "VRF Systems", icon: Server },
  ];

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar h-screen flex flex-col hidden md:flex shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <Activity className="w-6 h-6 text-primary mr-3" />
        <span className="font-semibold text-lg text-sidebar-foreground tracking-tight">VRF Monitor</span>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
          return (
            <Link key={link.href} href={link.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer group relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <link.icon className={cn("w-5 h-5 mr-3", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70")} />
                {link.label}
              </div>
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground cursor-pointer rounded-md hover:bg-sidebar-accent/50 transition-colors">
          <Settings className="w-5 h-5 mr-3 text-sidebar-foreground/50" />
          Settings
        </div>
      </div>
    </aside>
  );
}
