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
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    // Load modules + saved prefs
    Promise.all([
      fetch("/api/options").then(r => r.json()),
      fetch("/api/filter-prefs").then(r => r.json()),
    ]).then(([opts, prefs]) => {
      setModules(opts.modules || []);
      const saved: string[] = prefs.modules || [];
      setSelectedModules(saved);
      setPrefsLoaded(true);
    });
  }, [isLogin]);

  // Sync selectedModules → URL + save prefs
  const handleModuleChange = useCallback(async (ids: string[]) => {
    setSelectedModules(ids);
    // Save to server
    fetch("/api/filter-prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filterKey: "modules", values: ids }),
    });
    // Update URL param
    const params = new URLSearchParams(searchParams.toString());
    if (ids.length > 0) {
      params.set("modules", ids.join(","));
    } else {
      params.delete("modules");
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  if (isLogin) return <>{children}</>;

  return (
    <div className="flex h-full">
      <Sidebar
        modules={modules}
        selectedModules={selectedModules}
        onModuleChange={handleModuleChange}
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
