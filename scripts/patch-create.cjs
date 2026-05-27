const fs = require('fs');
let lines = fs.readFileSync('src/components/create-modal.tsx', 'utf8').split('\n');

// 1. Add customFields state and fetch
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const [moduleIds, setModuleIds] = useState<string[]>([]);')) {
    lines.splice(i + 1, 0, '  const [customFields, setCustomFields] = useState<any[]>([]);');
    lines.splice(i + 2, 0, '  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});');
    break;
  }
}

// 2. Fetch customFields in useEffect
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('fetch("/api/options")')) {
    const indent = lines[i].match(/^(\s*)/)[1];
    // Add customFields fetch after options fetch
    lines.splice(i + 5, 0,
      `${indent}  fetch("/api/settings/customFields")`,
      `${indent}    .then((r) => r.json())`,
      `${indent}    .then(setCustomFields)`,
      `${indent}    .catch(() => {});`,
    );
    break;
  }
}

// 3. Add customFieldValues to POST body
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('moduleIds,') && lines[i].includes('JSON.stringify')) {
    // Add customFieldValues after moduleIds
    lines.splice(i, 1,
      '          moduleIds,',
      '          customFieldValues: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,',
    );
    break;
  }
}

// 4. Add custom field inputs before error display (after 研发模块 section)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* Error */}') || (lines[i].includes('{error') && lines[i].includes('error &&'))) {
    // Insert custom fields section before error
    const customFieldsSection = [
      '          {/* 自定义字段 */}',
      '          {customFields.length > 0 && (',
      '            <div className="border-t border-[var(--line)] pt-3 mt-1">',
      '              <span className="text-[11px] text-[var(--txt-3)] block mb-2">自定义字段</span>',
      '              {customFields.map((cf) => (',
      '                <div key={cf.id} className="mb-2">',
      '                  <label className="text-[11px] text-[var(--txt-2)] block mb-1">{cf.name}</label>',
      '                  {cf.type === "select" ? (',
      '                    <select',
      '                      value={customFieldValues[cf.id] || ""}',
      '                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}',
      '                      className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"',
      '                    >',
      '                      <option value="">选择{cf.name}</option>',
      '                      {((): any[] => { try { return JSON.parse(cf.options || "[]"); } catch { return []; } })().map((opt: string) => (',
      '                        <option key={opt} value={opt}>{opt}</option>',
      '                      ))}',
      '                    </select>',
      '                  ) : (',
      '                    <input',
      '                      type="text"',
      '                      value={customFieldValues[cf.id] || ""}',
      '                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}',
      '                      className="w-full px-3 py-2 rounded-lg border border-[var(--line-2)] bg-[var(--bg-2)] text-[13px] text-[var(--txt-0)] outline-none focus:border-[var(--accent)]"',
      '                      placeholder={`输入${cf.name}`}',
      '                    />',
      '                  )}',
      '                </div>',
      '              ))}',
      '            </div>',
      '          )}',
      '',
    ];
    lines.splice(i, 0, ...customFieldsSection);
    break;
  }
}

fs.writeFileSync('src/components/create-modal.tsx', lines.join('\n'));
console.log('Done');
