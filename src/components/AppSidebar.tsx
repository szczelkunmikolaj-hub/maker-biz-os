import {
  LayoutDashboard, FolderKanban, Columns3, Receipt, Calculator, Settings, BookTemplate, Upload, Calendar, Package, Database, Truck, ExternalLink, LogOut, FlaskConical, Globe,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import { isAdmin } from "@/lib/admin";
import { HelpTip } from "@/components/HelpTip";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { supabase, supabaseConfigured } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const LANGUAGES = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "pl", flag: "🇵🇱", label: "Polski" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "pt", flag: "🇧🇷", label: "Português" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isDemoMode, toggleDemoMode } = useDemo();
  const { t } = useTranslation();

  const allItems = [
    { title: t('nav.dashboard'), url: "/", icon: LayoutDashboard, hint: t('helpTips.dashboard') },
    { title: t('nav.projects'), url: "/projects", icon: FolderKanban, hint: t('helpTips.projects') },
    { title: t('nav.customerOrders'), url: "/customer-orders", icon: Truck, adminOnly: true },
    { title: t('nav.kanban'), url: "/kanban", icon: Columns3, hint: t('helpTips.kanban') },
    { title: t('nav.calendar'), url: "/calendar", icon: Calendar, hint: t('helpTips.calendar') },
    { title: t('nav.expenses'), url: "/expenses", icon: Receipt, hint: t('helpTips.expenses') },
    { title: t('nav.filament'), url: "/filament", icon: Package, hint: t('helpTips.filament') },
    { title: t('nav.templates'), url: "/templates", icon: BookTemplate },
    { title: t('nav.importQueue'), url: "/import", icon: Upload },
    { title: t('nav.quote'), url: "/quote", icon: Calculator },
    { title: t('nav.data'), url: "/data", icon: Database },
    { title: t('nav.settings'), url: "/settings", icon: Settings },
  ];

  const items = allItems.filter(item => !item.adminOnly || isAdmin(user?.email));

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('pt_language', lang);
    if (supabaseConfigured && user) {
      supabase.from('profiles').update({ language: lang }).eq('user_id', user.id).then(() => {});
    }
  };

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
            </div>
            <span className="font-bold text-lg text-sidebar-foreground" style={{ fontFamily: 'Space Grotesk' }}>PrintTrack</span>
          </div>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
            <span className="text-sidebar-primary-foreground font-bold text-sm" style={{ fontFamily: 'Space Grotesk' }}>PT</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title} className="relative">
                  <SidebarMenuButton asChild>
                    {item.external ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-sidebar-accent flex items-center gap-2"
                        title={item.title}
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && (
                          <>
                            <span className="flex-1">{item.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </>
                        )}
                      </a>
                    ) : (
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    )}
                  </SidebarMenuButton>
                  {!collapsed && item.hint && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                      <HelpTip text={item.hint} side="right" />
                    </span>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 border-t">
        {!collapsed && user && (
          <div className="px-2 py-1.5 text-xs text-sidebar-foreground/70 truncate">{user.email}</div>
        )}
        <SidebarMenu>
          {/* Language switcher */}
          <SidebarMenuItem>
            {!collapsed ? (
              <div className="flex items-center gap-2 px-2 py-1">
                <Globe className="h-4 w-4 text-sidebar-foreground/70 shrink-0" />
                <Select value={i18n.language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus:ring-0 flex-1">
                    <SelectValue>
                      <span>{currentLang.flag} {currentLang.label}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code} className="text-xs">
                        {lang.flag} {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <SidebarMenuButton
                onClick={() => {
                  const idx = LANGUAGES.findIndex(l => l.code === i18n.language);
                  const next = LANGUAGES[(idx + 1) % LANGUAGES.length];
                  handleLanguageChange(next.code);
                }}
                className="hover:bg-sidebar-accent"
                title={t('language.label')}
              >
                <Globe className="h-4 w-4" />
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleDemoMode}
              className={`hover:bg-sidebar-accent ${isDemoMode ? 'text-yellow-600 dark:text-yellow-400' : ''}`}
              title={t('nav.demoMode')}
            >
              <FlaskConical className="h-4 w-4" />
              {!collapsed && (
                <>
                  <span className="flex-1">{t('nav.demoMode')}</span>
                  <Switch
                    checked={isDemoMode}
                    className="h-4 w-7 pointer-events-none [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-3"
                    tabIndex={-1}
                  />
                </>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => signOut()} className="hover:bg-sidebar-accent" title={t('nav.signOut')}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>{t('nav.signOut')}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
