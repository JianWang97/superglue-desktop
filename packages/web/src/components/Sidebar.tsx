"use client";

import { Book, GitBranch, History, Layout, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConfigDialog } from "./ConfigDialog";
import { useConfigUpdate } from "@/src/app/config-context";
import { useSidebar } from "@/src/app/sidebar-context";
import { Button } from "./ui/button";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "./ui/tooltip";

const navItems = [
  { icon: Layout, label: "Configurations", href: "/" },
  // { icon: History, label: "Runs", href: "/runs" },
  // { icon: PlayCircle, label: "Playground", href: "/playground" },
  { icon: GitBranch, label: 'Workflows', href: '/workflows' },
  // { icon: Book, label: "Documentation", href: "https://docs.superglue.cloud", target: "_blank" },
  /*  { icon: AlertCircle, label: 'Error Monitoring', href: '/analytics' },
  { icon: Shield, label: 'Access Control', href: '/access-control' },
  { icon: Code, label: 'SDK Generation', href: '/sdk' },
  { icon: Layout, label: 'Documentation', href: '/docs' }, */
];

export function Sidebar() {
  const pathname = usePathname();
  const updateConfig = useConfigUpdate();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const handleConfigUpdate = (newConfig: { superglueEndpoint: string; superglueApiKey: string }) => {
    updateConfig(newConfig);
  };  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} ${isCollapsed ? 'min-w-16' : 'min-w-64'} flex-shrink-0 bg-white dark:bg-gray-900 border-r dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out relative`}>
      <div className="p-6">
        <div className="relative mx-auto">
          {isCollapsed ? (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
          ) : (
            <>
              <img src="/logo.svg" alt="superglue Logo" className="max-w-full h-[50px] w-[200px] ml-auto mr-auto" />
              <div className="text-center text-sm text-gray-300 dark:text-gray-300 mt-2">Data Integration Agent</div>
            </>
          )}
        </div>
      </div>      <nav className="flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center ${isCollapsed ? 'px-3 justify-center' : 'px-6'} py-3 text-sm transition-all duration-200 ${
                isActive
                  ? "bg-gray-100 dark:bg-secondary text-gray-900 dark:text-white border-r-2 border-gray-900 dark:border-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-secondary"
              }`}
            >
              <Icon className={`h-4 w-4 ${isCollapsed ? '' : 'mr-3'}`} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );

          if (isCollapsed) {
            return (
              <TooltipProvider key={item.href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }

          return linkContent;
        })}      </nav>
        <div className={`${isCollapsed ? 'p-2' : 'p-4'} border-t dark:border-gray-800 space-y-2`}>
        {/* 切换按钮 */}
        <div className="flex justify-center">
          {isCollapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  展开侧边栏
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {/* 配置按钮 */}
        {isCollapsed ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center">
                  <ConfigDialog onConfigUpdate={handleConfigUpdate} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                配置
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <ConfigDialog onConfigUpdate={handleConfigUpdate} />
        )}
      </div>
    </div>
  );
}
