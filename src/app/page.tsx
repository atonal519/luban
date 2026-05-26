import { prisma } from "@/lib/prisma";
import { Board } from "@/components/board";

// Build nested children include up to maxDepth levels
function buildChildrenInclude(depth: number): any {
  if (depth === 0) return { include: { status: true, owner: true, priority: true, nature: true, modules: { include: { module: true } } }, orderBy: { order: "asc" } };
  return {
    include: {
      status: true, owner: true, priority: true, nature: true,
      modules: { include: { module: true } },
      approvals: { where: { scope: "NODE" }, include: { events: { include: { actor: true }, orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "asc" }, take: 1 },
      children: buildChildrenInclude(depth - 1),
    },
    orderBy: { order: "asc" },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; modules?: string; tags?: string; priorities?: string; focus?: string; milestone?: string }>;
}) {
  const { stage, modules: modulesParam, tags: tagsParam, priorities: prioritiesParam, focus, milestone } = await searchParams;
  const selectedModuleIds = modulesParam ? modulesParam.split(",").filter(Boolean) : [];
  const selectedTagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  const selectedPriorityIds = prioritiesParam ? prioritiesParam.split(",").filter(Boolean) : [];

  // Fetch tags first so we can expand RR selection to include FEs
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

  // Expand selectedTagIds: if a parent RR is selected, also include its FE children
  let expandedTagIds = selectedTagIds;
  if (selectedTagIds.length > 0) {
    const childIds = tags.filter((t: any) => t.parentId && selectedTagIds.includes(t.parentId)).map((t: any) => t.id);
    expandedTagIds = [...selectedTagIds, ...childIds];
  }

  const [items, statuses, stageGroups, milestones] = await Promise.all([
    prisma.item.findMany({
      where: {
        parentId: null,
        ...(selectedModuleIds.length > 0 ? { modules: { some: { moduleId: { in: selectedModuleIds } } } } : {}),
        ...(expandedTagIds.length > 0 ? { tagId: { in: expandedTagIds } } : {}),
        ...(selectedPriorityIds.length > 0 ? { priorityId: { in: selectedPriorityIds } } : {}),
        ...(focus ? { focus: { in: focus.split(",").filter(Boolean) } } : {}),
        ...(milestone ? { milestoneId: milestone } : {}),
      },
      include: {
        nature: true,
        status: true,
        owner: true,
        priority: true,
        tag: true,
        milestone: true,
        modules: { include: { module: true } },
        approvals: {
          where: { scope: "STAGE_GATE" },
          include: { events: { include: { actor: true }, orderBy: { createdAt: "asc" } } },
        },
        children: buildChildrenInclude(4),
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
    prisma.milestone.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

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
      milestones={JSON.parse(JSON.stringify(milestones))}
      selectedMilestone={milestone || ""}
    />
  );
}
