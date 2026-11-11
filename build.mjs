import { build } from 'esbuild';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = name => readFileSync(resolve(root, 'src/fe-board', name), 'utf8');
const defaultData = JSON.parse(readFileSync(resolve(root, 'data/empty.json'), 'utf8'));
// Real datasets belong in the ignored local file, never in the public source.
const dataPath = process.env.LUBAN_DATA_FILE
  ? resolve(root, process.env.LUBAN_DATA_FILE)
  : resolve(root, existsSync(resolve(root, 'data/local.json')) ? 'data/local.json' : 'data/empty.json');
const data = { ...defaultData, ...JSON.parse(readFileSync(dataPath, 'utf8')) };
for (const key of ['records', 'modules', 'topics', 'sourceRows', 'sheets']) {
  if (!Array.isArray(data[key])) throw new Error(`Dataset field ${key} must be an array`);
}
if (typeof data.id !== 'string' || !data.id) throw new Error('Dataset id is required');
const markdown = await build({
  absWorkingDir: root, entryPoints: ['src/fe-board/ui/markdown.js'],
  bundle: true, write: false, format: 'iife', target: ['es2022'], minify: true,
});
const styles = ['styles.css', 'workbook.css', 'views.css', 'workspace.css', 'journal.css', 'navigation.css', 'ui/select.css', 'ui/date-input.css', 'planning.css', 'fe-groups.css', 'planning-batch.css', 'workflow.css', 'intake/styles.css', 'intake/rat-resources.css', 'ui/rich-text.css', 'ui/source-evidence.css', 'intake/resource-refine.css', 'intake/workspace.css', 'reporting/styles.css'];
const scripts = ['intake/model.js', 'intake/rat-model.js', 'intake/workspace-model.js', 'ui/check-dropdown.js', 'ui/rich-text.js', 'ui/attachment-store.js', 'ui/source-evidence.js', 'intake/resource-ui.js', 'intake/ui.js', 'ui/select.js', 'ui/date-input.js', 'date-links.js', 'workflow-model.js', 'stage-cell-model.js', 'package-dates.js', 'workflow-ui.js', 'planning-model.js', 'planning-batch-model.js', 'pm-directory.js', 'planning-ui.js', 'planning-batch-ui.js', 'snapshot-sync.js', 'daily-model.js', 'reporting/model.js', 'reporting/ui.js', 'release-model.js', 'grouping-model.js', 'view-model.js', 'fe-view-fields.js', 'view-ui.js', 'daily-ui.js', 'source-ui.js', 'app.js'];
const inlineScript = source => '<script>' + source.replaceAll('</script', '<\\/script') + '</script>';
let html = read('index.html')
  .replace('<link rel="stylesheet" href="./styles.css">', () => '<style>' + styles.map(read).join('\n') + '</style>')
  .replace('<script defer src="./app.js"></script>', '');
const json = JSON.stringify(data).replaceAll('<', '\\u003c');
html = html.replace('</body>', () => inlineScript('window.LUBAN_DATASET=' + json + ';')
  + inlineScript(markdown.outputFiles[0].text) + scripts.map(name => inlineScript(read(name))).join('') + '</body>');
// Every build starts fresh so an old export cannot survive a clean-data build.
rmSync(resolve(root, 'dist'), { recursive: true, force: true });
mkdirSync(resolve(root, 'dist/fe-board'), { recursive: true });
writeFileSync(resolve(root, 'dist/fe-board/index.html'), html);
writeFileSync(resolve(root, 'dist/index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>鲁班</title><body><a href="/fe-board/">进入鲁班</a><script>location.replace('/fe-board/'+location.hash);</script></body></html>`);
console.log('Built dist/fe-board/');
