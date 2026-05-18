import { prisma } from "@/lib/prisma";
import { Board } from "@/components/board";

// Build nested children include up to maxDepth levels
function buildChildrenInclude(depth: number): any {
  if (depth === 0) return { include: { status: true, owner: true, priority: true, nature: true, modules: { include: { module: true } } }, orderBy: { order: "asc" } };
  return {
    include: {
      status: true, owner: true, priority: true, nature: true,
      modules: { include: { module: true } },
      approval: { include: { events: { include: { actor: true }, orderBy: { createdAt: "asc" } } } },
      children: buildChildrenInclude(depth - 1),
    },
    orderBy: { order: "asc" },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; modules?: string }>;
}) {
  const { stage, modules: modulesParam } = await searchParams;
  const selectedModuleIds = modulesParam ? modulesParam.split(",").filter(Boolean) : [];

  const [items, statuses, stageGroups, tags] = await Promise.all([
    prisma.item.findMany({
      where: {
        parentId: null,
        ...(selectedModuleIds.length > 0 ? {
          modules: { some: { moduleId: { in: selectedModuleIds } } }
        } : {}),
      },
      include: {
        nature: true,
        status: true,
        owner: true,
        priority: true,
        tag: true,
        modules: { include: { module: true } },
        children: buildChildrenInclude(4), // up to depth 5
        dailyLogs: {
          include: { author: true },
          orderBy: { logDate: "desc" },
          take: 5,
        },
        alerts: {
          where: { dismissedAt: null },
          orderBy: { createdAt: "desc" },
        },
        rejections: {
          include: { rejectedBy: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.statusDef.findMany({ orderBy: { order: "asc" } }),
    prisma.stageGroup.findMany({ orderBy: { order: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Build dynamic stage group map from DB
  const stageGroupMap: Record<string, string> = {};
  for (const s of statuses) {
    stageGroupMap[s.code] = s.stageGroup;
  }

  const stageGroupsList = stageGroups.map(g => ({ code: g.code, label: g.label }));

  return (
    <Board
      items={JSON.parse(JSON.stringify(items))}
      stageFilter={stage || ""}
      stageGroupMap={stageGroupMap}
      stageGroups={stageGroupsList}
      tags={JSON.parse(JSON.stringify(tags))}
    />
  );
}
