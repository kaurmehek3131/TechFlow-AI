import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Sparkles, BookMarked, User, GraduationCap, Compass, BarChart3, Trophy, Users, Bot } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";

const baseItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["teacher", "student"] as const },
  { title: "Explore", url: "/explore", icon: Compass, roles: ["teacher", "student"] as const },
  { title: "Generate Lesson", url: "/generate", icon: Sparkles, roles: ["teacher"] as const },
  { title: "My Library", url: "/library", icon: BookMarked, roles: ["teacher"] as const },
  { title: "My Progress", url: "/progress", icon: Trophy, roles: ["student"] as const },
  { title: "AI Tutor", url: "/tutor", icon: Bot, roles: ["student"] as const },
  { title: "Class Progress", url: "/class-progress", icon: Users, roles: ["teacher"] as const },
  { title: "Analytics", url: "/analytics", icon: BarChart3, roles: ["teacher"] as const },
  { title: "Profile", url: "/profile", icon: User, roles: ["teacher", "student"] as const },
];

const titleKeys: Record<string, string> = {
  "Dashboard": "dashboard",
  "Explore": "explore",
  "Generate Lesson": "generateLesson",
  "My Library": "myLibrary",
  "My Progress": "myProgress",
  "AI Tutor": "aiTutor",
  "Class Progress": "classProgress",
  "Analytics": "analytics",
  "Profile": "profile"
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { role } = useAuth();
  const { t } = useLanguage();
  const effectiveRole = role ?? "teacher";
  const items = baseItems.filter((i) => i.roles.includes(effectiveRole as never));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          {!collapsed && <span className="font-semibold tracking-tight">TechFlow AI</span>}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("explore")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={path === item.url || path.startsWith(item.url + "/")}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{t(titleKeys[item.title] || item.title)}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
