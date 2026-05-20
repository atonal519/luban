"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { Sidebar } from "./sidebar";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLogin = pathname === "/login";

  const [modules, setModules] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);

  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedFocus, setSelectedFocus] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    Promise.all([
      fetch("/api/options").then(r => r.json()),
      fetch("/api/filter-prefs").then(r => r.json()),
      fetch("/api/tags").then(r => r.json()),
    ]).then(([opts, prefs, tagList]) => {
      setModules(opts.modules || []);
      setPriorities(opts.priorities || []);
      setTags(tagList || []);
      setSelectedModules(prefs.modules || []);
      setSelectedTags(prefs.tags || []);
      setSelectedPriorities(prefs.priorities || []);
      setSelectedFocus(prefs.focus || []);
    });
  }, [isLogin]);

  function buildParams(overrides: Record<string, string[]>) {
    const params = new URLSearchParams(searchParams.toString());
    const all = {
      modules: selectedModules,
      tags: selectedTags,
      priorities: selectedPriorities,
      focus: selectedFocus ? [selectedFocus] : [],
      ...overrides,
    };
    for (const [k, v] of Object.entries(all)) {
      if (v.length > 0) params.set(k, v.join(","));
      else params.delete(k);
    }
    return params;
  }

  function saveAndNavigate(key: string, values: string[]) {
    fetch("/api/filter-prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filterKey: key, values }),
    });
    const params = buildParams({ [key]: values });
    router.replace(`${pathname}?${params.toString()}`);
  }

  const handleModuleChange = useCallback((ids: string[]) => {
    setSelectedModules(ids);
    saveAndNavigate("modules", ids);
  }, [selectedModules, selectedTags, selectedPriorities, selectedFocus, pathname, router, searchParams]);

  const handleTagChange = useCallback((ids: string[]) => {
    setSelectedTags(ids);
    saveAndNavigate("tags", ids);
  }, [selectedModules, selectedTags, selectedPriorities, selectedFocus, pathname, router, searchParams]);

  const handlePriorityChange = useCallback((ids: string[]) => {
    setSelectedPriorities(ids);
    saveAndNavigate("priorities", ids);
  }, [selectedModules, selectedTags, selectedPriorities, selectedFocus, pathname, router, searchParams]);

  const handleFocusChange = useCallback((val: string[]) => {
    setSelectedFocus(val);
    saveAndNavigate("focus", val);
  }, [selectedModules, selectedTags, selectedPriorities, selectedFocus, pathname, router, searchParams]);


  if (isLogin) return <>{children}</>;

  return (
    <div className="flex h-full">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        modules={modules}
        tags={tags}
        priorities={priorities}
        selectedModules={selectedModules}
        selectedTags={selectedTags}
        selectedPriorities={selectedPriorities}
        selectedFocus={selectedFocus}
        onModuleChange={handleModuleChange}
        onTagChange={handleTagChange}
        onPriorityChange={handlePriorityChange}
        onFocusChange={handleFocusChange}
      />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}
