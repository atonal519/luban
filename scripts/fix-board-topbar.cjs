const fs = require('fs');
let b = fs.readFileSync('src/components/board.tsx', 'utf8');

// Find the topbar div by unique marker and replace it
const startMarker = '      {/* Topbar: 左=标题  中=快速新建  右=看板筛选+搜索 */}';
const endMarker = '      <AlertBar items={searchedItems} />';

const startIdx = b.indexOf(startMarker);
const endIdx = b.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('markers not found, start:', startIdx, 'end:', endIdx);
  process.exit(1);
}

const before = b.slice(0, startIdx);
const after = b.slice(endIdx);

const newTopbar = `      {/* Topbar */}
      <div className="h-[52px] min-h-[52px] flex items-center px-5 border-b border-[var(--line)] bg-[var(--bg-1)] gap-2">
        {/* Left: title + count + milestone pills */}
        <span className="text-[15px] font-semibold flex-shrink-0">{boardTitle}</span>
        <span className="font-mono text-[11px] text-[var(--txt-2)] bg-[var(--bg-3)] px-2 py-0.5 rounded flex-shrink-0">
          {searchedItems.length} 个版本
        </span>
        {milestones.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
            {milestones.map((m: any) => {
              const isActive = selectedMilestone === m.id;
              const href = isActive
                ? (stageFilter ? \`/?stage=\${stageFilter}\` : '/')
                : (stageFilter ? \`/?stage=\${stageFilter}&milestone=\${m.id}\` : \`/?milestone=\${m.id}\`);
              return (
                <a key={m.id} href={href}
                  className={\`px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap transition-colors \${
                    isActive
                      ? 'bg-[var(--accent)] text-white font-medium'
                      : 'border border-[var(--line-2)] text-[var(--txt-2)] hover:border-[var(--accent)] hover:text-[var(--txt-0)]'
                  }\`}
                >{m.name}</a>
              );
            })}
          </div>
        )}

        {/* Center: quick create */}
        <div className="flex-1 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] w-[380px] focus-within:border-[var(--accent)] transition-colors">
            <span className="text-[var(--accent)] text-[14px] font-bold flex-shrink-0">+</span>
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={handleQuickCreate}
              placeholder="输入项目名，回车快速新建版本…"
              className="bg-transparent outline-none text-[13px] text-[var(--txt-0)] w-full placeholder:text-[var(--txt-3)]"
            />
          </div>
        </div>

        {/* Right: stage filter tabs + search */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {[
            { code: "", label: "全部" },
            { code: "REQUIREMENT", label: "需求" },
            { code: "DEVELOPMENT", label: "开发" },
            { code: "TEST", label: "测试" },
            { code: "DELIVERY", label: "交付" },
          ].map(tab => (
            <a
              key={tab.code}
              href={tab.code
                ? (selectedMilestone ? \`/?stage=\${tab.code}&milestone=\${selectedMilestone}\` : \`/?stage=\${tab.code}\`)
                : (selectedMilestone ? \`/?milestone=\${selectedMilestone}\` : '/')
              }
              className={\`px-2.5 py-1.5 rounded-md text-[12px] transition-colors \${
                stageFilter === tab.code
                  ? 'bg-[var(--accent)] text-white font-medium'
                  : 'border border-[var(--line-2)] bg-[var(--bg-1)] text-[var(--txt-1)] hover:border-[var(--accent)] hover:text-[var(--txt-0)]'
              }\`}
            >
              {tab.label}
            </a>
          ))}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--line-2)] bg-[var(--bg-1)] text-[12px] w-[200px] ml-1">
            <span className="text-[var(--txt-3)] text-[11px]">⌕</span>
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索版本 / 项目名 / 责任人" className="bg-transparent outline-none text-[12px] text-[var(--txt-0)] w-full placeholder:text-[var(--txt-3)]" />
          </div>
        </div>
      </div>
`;

b = before + newTopbar + after;
fs.writeFileSync('src/components/board.tsx', b);
console.log('board topbar done');
