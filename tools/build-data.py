"""Build a traceable, browser-local preview dataset from the supplied snapshot.

Source rows are immutable. Corrections are explicit overlays, never edits to the
uploaded workbook. This script does not create approvals or actual timestamps.
"""
import hashlib
import copy
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

WEEK = '1019周测试计划'
PRODUCTION = {'单车': '单车预期', '编组': '编组预期', '灰度': '灰度预期', '上线': '全车预期'}
STAGES = {'开发': 1, '自测': 2, '提测': 2, '实验室': 3, '完成测试': 3, '单车': 4, '编组': 5, '灰度': 6, '上线': 8, '全车': 8, '中止': 9, '方案': 10}


def title(value):
    text = re.sub(r'^FE\s*[:：]\s*', '', str(value or '').strip(), flags=re.I)
    return re.split(r'\n\s*story\s*[:：]', text, maxsplit=1, flags=re.I)[0].strip()


def key(value):
    return re.sub(r'\s+', '', re.sub(r'[—–-]+', '-', title(value).lstrip('★☆'))).casefold()


def uid(value, prefix):
    return prefix + hashlib.sha256(value.encode()).hexdigest()[:12]


def split(value):
    return [s.strip() for s in re.split('[,，、]', value or '') if s.strip()]


def unique(values):
    return list(dict.fromkeys(v for v in values if v not in [None, '']))


def split_progress(text, snapshot_date, confirmed_date=''):
    text = str(text or '').strip()
    if not text:
        return []
    labels = list(re.finditer(r'(?<!\d)(\d{4})\s*[:：]', text))
    if not labels:
        if not confirmed_date:
            raise ValueError('当前进度未标更新日期')
        return [(date.fromisoformat(confirmed_date).isoformat(), text)]
    year = date.fromisoformat(snapshot_date).year
    parts = []
    for i, match in enumerate(labels):
        token = match.group(1)
        updated = date(year, int(token[:2]), int(token[2:])).isoformat()
        start = 0 if i == 0 else match.start()
        end = labels[i + 1].start() if i + 1 < len(labels) else len(text)
        parts.append((updated, text[start:end].strip()))
    return parts


def followup_title(value):
    text = str(value or '').strip().replace('\\n', '\n')
    match = re.search(r'(?:^|\n)\s*FE\s*[:：]\s*([^\n]+)', text, re.I)
    name = match.group(1).strip() if match else title(text)
    return re.sub(r'^(?:【hotfix】|\[hotfix\]|hotfix\s*[:：])\s*', '【hotfix】', name, flags=re.I)


def followup_date(value, snapshot_date):
    value = str(value or '').strip()
    if not value:
        return ''
    match = re.fullmatch(r'(\d{1,2})月(\d{1,2})日', value)
    if match:
        return date(int(snapshot_date[:4]), int(match[1]), int(match[2])).isoformat()
    return date.fromisoformat(value[:10]).isoformat()


def build_followup(raw, decisions, previous, previous_updates):
    names = {'1130项目跟进', '测试计划'}
    if len(raw['sheets']) != 2 or {s['name'] for s in raw['sheets']} != names:
        raise ValueError('本次只接受指定的两张底表')
    original_rows, sheet_meta, tables = [], [], {}
    for sheet in raw['sheets']:
        headers = {c['column']: c['value'] for c in sheet['cells'] if c['row'] == 1}
        grouped = defaultdict(dict)
        for c in sheet['cells']:
            if c['row'] > 1:
                grouped[c['row']][headers[c['column']]] = c['value']
        sheet_meta.append({'name': sheet['name'], 'headers': list(headers.values())})
        tables[sheet['name']] = []
        for number, values in sorted(grouped.items()):
            if not any(str(v or '').strip() for v in values.values()):
                continue
            row = {'id': uid(sheet['name'] + ':' + str(number), 'row-'), 'sheet': sheet['name'], 'row': number, 'values': {h: values.get(h, '') for h in headers.values()}}
            original_rows.append(row)
            tables[sheet['name']].append(row)
    aliases = {key(a): key(b) for a, b in decisions.get('aliases', {}).items()}
    row_key = lambda r: aliases.get(key(followup_title(r['values'].get('FE'))), key(followup_title(r['values'].get('FE'))))
    project = tables['1130项目跟进']
    projects, tests = defaultdict(list), defaultdict(list)
    for row in project:
        if followup_title(row['values'].get('FE')):
            projects[row_key(row)].append(row)
    for row in tables['测试计划']:
        if followup_title(row['values'].get('FE')):
            tests[row_key(row)].append(row)
    overrides = decisions.get('records', {})
    normalized = {sheet['name']: [] for sheet in raw['sheets']}
    completed, completed_versions, baselines = set(), set(), {}
    iso = lambda v: followup_date(v, raw['source']['snapshotDate'])
    plans = [('测试', '提测实际', '提测预期', '提测日期'), ('单车', '单车实际', '单车预期', '单车预期'), ('编组', '编组实际', '编组预期', '编组预期'), ('灰度', '灰度实际', '灰度预期', '灰度预期'), ('上线', '全车实际', '全车预期', '全车预期')]
    for k, prs in projects.items():
        rid = uid(k, 'item-')
        matching = [r for r in tests.get(k, []) if r['values'].get('状态') or r['values'].get('版本号')]
        statuses = unique(r['values'].get('状态') for r in prs + matching)
        status = overrides.get(rid, {}).get('sourceStatus')
        if not status and len(statuses) > 1:
            raise ValueError('两表状态冲突：' + followup_title(prs[0]['values']['FE']) + '：' + '、'.join(statuses))
        status = status or (statuses[0] if statuses else '')
        if status == '全车':
            completed.add(rid)
            completed_versions.update(r['values'].get('版本号') for r in prs + matching if r['values'].get('版本号'))
            continue
        baselines[rid] = {}
        for phase, current_col, baseline_col, test_col in plans:
            current = unique(iso(r['values'].get(current_col)) for r in prs)
            test_values = unique(iso(r['values'].get(test_col)) for r in matching)
            original = unique(iso(r['values'].get(baseline_col)) for r in prs)
            if len(current) > 1 or len(test_values) > 1 or current and test_values and current != test_values or len(original) > 1:
                raise ValueError('两表排期冲突：' + followup_title(prs[0]['values']['FE']) + '：' + phase)
            baselines[rid][phase] = original[0] if original else ''
        display = followup_title(prs[0]['values']['FE'])
        for row in prs:
            v = copy.deepcopy(row['values'])
            v.update(FE='FE：' + display, 状态=status, 当前进度=v.get('进度', ''))
            for _, current_col, _, target in plans:
                v[target] = iso(row['values'].get(current_col))
            for field in ['测试责任人', '质量负责人', '优先级', '数字指标']:
                vals = unique(r['values'].get(field) for r in matching)
                if len(vals) > 1:
                    raise ValueError('测试信息冲突：' + display + '：' + field)
                v[field] = vals[0] if vals else ''
            normalized['1130项目跟进'].append((row['row'], v))
        for row in matching:
            v = copy.deepcopy(row['values'])
            v.update(对应版本='FE：' + display, 当前进度=status)
            normalized['测试计划'].append((row['row'], v))
    projection = {'source': {**raw['source']}, 'sheets': []}
    projection['source'].pop('schema', None)
    for name, rows in normalized.items():
        headers = unique(h for _, v in rows for h in v)
        cells = [{'row': 1, 'column': i + 1, 'value': h} for i, h in enumerate(headers)]
        cells += [{'row': number, 'column': i + 1, 'value': values.get(h, '')} for number, values in rows for i, h in enumerate(headers)]
        projection['sheets'].append({'name': name, 'cells': cells})
    data = build(projection, decisions, previous, [])
    for r in data['records']:
        r['period'] = raw['source']['snapshotDate'][:7]
        r['baselinePlans'] = baselines[r['id']]
        r['productionDates'] = {name: {'expectedEnd': '', 'actualStart': '', 'actualEnd': ''} for name in PRODUCTION}
        r['sourceActualDates'], r['sourceDateNotes'] = {}, []
        milestones = [('提测', 2, r['phaseDates']['testing']['expectedStart'], 'phase.testing.actualStart')]
        milestones += [(name, stage, r['productionPlans'][name], 'production.' + code + '.actualStart') for name, stage, code in [('单车', 4, 'single'), ('编组', 5, 'group'), ('灰度', 6, 'gray')]]
        for name, stage, day, path in milestones:
            if not day or not stage <= r['stage'] <= 8:
                continue
            if day > raw['source']['snapshotDate']:
                r['sourceDateNotes'].append({'phase': name, 'date': day, 'text': '当前状态已到达，但日期晚于资料日期；暂保留为计划'})
                continue
            r['sourceActualDates'][path] = day
            if name == '提测':
                r['phaseDates']['testing']['actualStart'] = day
            else:
                r['productionDates'][name]['actualStart'] = day
            r.setdefault('dateLinks', {})[path] = {'mode': 'source-fact'}
        details = unique(ref['values'].get('FE') for ref in original_rows if ref['id'] in r['sourceRefs'] and re.search(r'story\s*[:：]', str(ref['values'].get('FE') or ''), re.I))
        if details:
            r['description'] = '\n\n'.join(details).replace('\\n', '\n')
    ids = {r['id'] for r in data['records']}
    completed.update(r['id'] for r in previous if r.get('sourceStatus') == '全车' and r['id'] not in ids)
    versions = {r['version'] for r in data['records'] if r['version']}
    completed_versions.update(r.get('version') for r in previous if r.get('sourceStatus') == '全车' and r.get('version') and r['version'] not in versions)
    prior = [copy.deepcopy(x) for x in previous_updates or [] if x.get('type') == 'fe' and x.get('key') in ids]
    keyed = {(x['type'], x['key'], x['date']): x for x in prior}
    keyed.update({(x['type'], x['key'], x['date']): x for x in data['dailyUpdates']})
    data.update(source=copy.deepcopy(raw['source']), sourceRows=original_rows, sheets=sheet_meta, dailyUpdates=list(keyed.values()))
    used_refs = {ref for r in data['records'] for ref in r['sourceRefs']}
    data['unassigned'] = [r for r in original_rows if r['id'] not in used_refs and uid(row_key(r), 'item-') not in completed]
    data['refresh'].update(removeCompleted=True, completedIds=sorted(completed), completedVersions=sorted(completed_versions - versions), replaceImportedProgress=True)
    if decisions.get('restoreFromBackup'):
        data['refresh']['restoreFromBackup'] = copy.deepcopy(decisions['restoreFromBackup'])
    data['importSummary'] = {'selectedSheets': sorted(names), 'projectRows': len(project), 'testRows': len(tables['测试计划']), 'referenceOnlyRows': len(data['unassigned']), 'completedIds': sorted(completed)}
    return data


def build(raw, decisions=None, previous=None, previous_updates=None):
    decisions = decisions or {}
    previous = previous or []
    if raw['source'].get('schema') == 'november-followup':
        return build_followup(raw, decisions, previous, previous_updates)
    weekly_sheet = raw['source'].get('weeklySheet', WEEK)
    snapshot_date = raw['source'].get('snapshotDate', '2026-10-20')
    revision = hashlib.sha256(json.dumps([raw['source']['sha256'], decisions], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    aliases = {key(a): key(b) for a, b in decisions.get('aliases', {}).items()}
    source_rows, sheets = [], []
    for sheet in raw['sheets']:
        headers = {c['column']: c['value'] for c in sheet['cells'] if c['row'] == 1}
        grouped = defaultdict(dict)
        for c in sheet['cells']:
            if c['row'] > 1:
                grouped[c['row']][headers[c['column']]] = c['value']
        sheets.append({'name': sheet['name'], 'headers': list(headers.values())})
        for number, values in sorted(grouped.items()):
            if not any(str(v or '').strip() for v in values.values()):
                continue
            source_rows.append({'id': uid(sheet['name'] + ':' + str(number), 'row-'), 'sheet': sheet['name'], 'row': number, 'values': {h: values.get(h, '') for h in headers.values()}})

    records, groups, row_to_key, unassigned, review = [], defaultdict(list), {}, [], []
    daily_updates = []
    for row in source_rows:
        v = row['values']
        if v.get('父记录'):
            continue
        name = v.get('FE') if row['sheet'] == weekly_sheet else v.get('对应版本')
        if not name:
            unassigned.append(row)
            continue
        k = aliases.get(key(name), key(name))
        if not k:
            unassigned.append(row)
            continue
        groups[k].append(row)
        row_to_key[row['id']] = k

    def note(kind, message, refs, record_id=''):
        review.append({'id': uid(kind + message + '|'.join(refs), 'review-'), 'type': kind, 'message': message, 'sourceRefs': refs, 'recordId': record_id})

    parent_map = defaultdict(set)
    for row in source_rows:
        if row['id'] in row_to_key and row['values'].get('修复问题'):
            parent_map[(row['sheet'], row['values']['修复问题'])].add(row_to_key[row['id']])
    children = defaultdict(list)
    for row in source_rows:
        parent = row['values'].get('父记录')
        if not parent:
            continue
        options = parent_map.get((row['sheet'], parent), set())
        if len(options) == 1:
            children[next(iter(options))].append(row)
        else:
            note('parent', '阶段明细归属待核对：' + parent, [row['id']])

    for k, refs in groups.items():
        all_weekly = [r for r in refs if r['sheet'] == weekly_sheet]
        record_id = uid(k, 'item-')
        preferred = decisions.get('records', {}).get(record_id, {}).get('preferredSource', {})
        selected_rows = [r for r in all_weekly if r['sheet'] == preferred.get('sheet') and r['row'] == preferred.get('row')]
        weekly = selected_rows or all_weekly
        masters = [r for r in refs if r['sheet'] != weekly_sheet]
        priority = weekly + masters
        original_name = next((r['values'].get('FE') or r['values'].get('对应版本') for r in priority), '')
        name = title(original_name)
        related = refs + children[k]

        def value(fields, preferred=priority):
            vals = unique(r['values'].get(f, '') for r in preferred for f in fields)
            return vals[0] if len(vals) == 1 else ''

        status_rows = weekly or masters
        statuses = unique(r['values'].get('状态') or r['values'].get('当前进度') for r in status_rows)
        status = statuses[0] if len(statuses) == 1 else ''
        if len(statuses) > 1:
            note('status', name + '：当前状态有不同值：' + '、'.join(statuses), [r['id'] for r in status_rows], record_id)
        plans = {}
        for stage, column in PRODUCTION.items():
            vals = unique(r['values'].get(column) for r in weekly)
            plans[stage] = vals[0] if len(vals) == 1 else ''
            if len(vals) > 1:
                note('date', name + '：' + column + '有不同值：' + '、'.join(vals), [r['id'] for r in weekly], record_id)
        phase_dates = {p: dict(expectedStart='', expectedEnd='', actualStart='', actualEnd='') for p in ['demand', 'development', 'testing', 'production']}
        for phase, child_name in [('development', '开发'), ('testing', '测试')]:
            for field, source_field in [('expectedStart', '开始时间'), ('expectedEnd', '结束时间')]:
                vals = unique(r['values'].get(source_field) for r in children[k] if r['values'].get('修复问题') == child_name)
                if len(vals) == 1:
                    phase_dates[phase][field] = vals[0]
                elif len(vals) > 1:
                    note('date', name + '：' + child_name + source_field + '有多个计划，保留原表待核对', [r['id'] for r in children[k]], record_id)
        test_date = value(['提测日期'], weekly)
        if test_date:
            phase_dates['testing']['expectedStart'] = test_date
        phase_dates['production']['expectedStart'] = plans['单车']
        phase_dates['production']['expectedEnd'] = plans['上线']
        module_rows = weekly if raw['source'].get('refreshMode') == 'base-fields' and any(r['values'].get('模块') for r in weekly) else priority
        modules = unique(m for r in module_rows for m in split(r['values'].get('模块')))
        issues = unique(r['values'].get('修复问题') or r['values'].get('项目名称') for r in refs)
        issues = [i for i in issues if i != '未命名记录']
        known_fe = bool(masters) or bool(re.match(r'^FE\s*[:：]', str(original_name), re.I)) or name in raw['source'].get('feTitles', [])
        kind = 'fe' if known_fe else 'content'
        if '\n' in name and re.search(r'感知：|定位：', name):
            kind = 'unclassified'
            note('identity', '一格含多项名称，暂不拆分：' + name, [r['id'] for r in refs], record_id)
        owner = value(['负责人'], weekly) or value(['责任人'], masters)
        version = value(['版本号'], weekly) if weekly else value(['版本号'], masters)
        r = {'id': record_id, 'code': '', 'title': name, 'kind': kind, 'topic': value(['专项'], masters), 'modules': modules, 'leadModule': modules[0] if len(modules) == 1 else '', 'pm': '', 'owner': owner, 'testOwner': value(['测试责任人'], weekly), 'priority': value(['优先级'], weekly) or value(['优先级'], masters), 'risk': '有' if any(x['values'].get('风险') == '有' for x in masters) else '', 'metric': value(['数字指标'], weekly), 'okrO': '', 'okrKR': '', 'sourceStatus': status, 'stage': STAGES.get(status, 11), 'entered': '', 'updated': '', 'period': '', 'launchDate': plans['上线'], 'version': version, 'productionPlans': plans, 'phaseDates': phase_dates, 'description': '\n\n'.join(unique(x['values'].get('任务描述') for x in masters)), 'issues': issues, 'notes': unique(x['values'].get('备注') for x in masters), 'changes': unique(x['values'].get('变更管理') for x in masters), 'expectation': value(['预期'], weekly), 'sourceRefs': [x['id'] for x in related], 'history': [], 'documents': [], 'rollbacks': [], 'gate': {'pending': False, 'rd': False, 'qa': False, 'round': 1, 'rejection': ''}}
        r['qualityOwner'] = value(['质量负责人'], weekly)
        r['sourceRevision'] = revision
        progress_rows = [row for row in all_weekly if row['values'].get('当前进度')] if raw['source'].get('importProgress', True) else []
        multiple_versions = len(unique(row['values'].get('版本号') for row in all_weekly)) > 1
        progress = defaultdict(lambda: {'texts': [], 'refs': [], 'dateSources': []})
        for row in progress_rows:
            confirmed_date = decisions.get('progressDates', {}).get(row['sheet'] + ':' + str(row['row']), '')
            try:
                parts = split_progress(row['values']['当前进度'], snapshot_date, confirmed_date)
            except ValueError:
                note('progress-date', name + '：当前进度的更新日期待确认，原文保留在原表记录', [row['id']], record_id)
                continue
            for updated, text in parts:
                if multiple_versions:
                    text = '【' + str(row['values'].get('版本号') or '原表未填包号') + '】\n' + text
                progress[updated]['texts'].append(text)
                progress[updated]['refs'].append(row['id'])
                progress[updated]['dateSources'].append('user-confirmed' if confirmed_date else 'source-text')
        for updated, content in progress.items():
            daily_updates.append({'id': uid(raw['source']['sha256'] + record_id + updated, 'import-'), 'type': 'fe', 'key': record_id, 'date': updated, 'actorId': 'workbook:' + raw['source']['sha256'], 'actor': '原表导入', 'text': '\n\n'.join(unique(content['texts'])), 'condition': None, 'at': raw['source'].get('importedAt', ''), 'origin': 'workbook', 'sourceRefs': unique(content['refs']), 'sourceHash': raw['source']['sha256'], 'dateSources': unique(content['dateSources'])})
        urls = set()
        for ref in related:
            for raw_value in ref['values'].values():
                for url in re.findall(r'https?://[^\s]+', str(raw_value or '')):
                    if url not in urls:
                        urls.add(url)
                        r['documents'].append({'id': uid(url, 'doc-'), 'name': '原表关联链接（未分类）', 'url': url})
        if masters and weekly:
            old_status = unique(x['values'].get('当前进度') for x in masters)
            if any(v != status for v in old_status):
                note('source', name + '：当前状态采用周测试计划“' + status + '”，排期原值另存于原表记录', [x['id'] for x in refs], record_id)
        records.append(r)

    for r in records:
        correction = decisions.get('records', {}).get(r['id'], {})
        if 'owner' in correction:
            r['owner'] = correction['owner']
        for phase, dates in correction.get('phaseDates', {}).items():
            if phase in r['phaseDates']:
                for field in ['expectedStart', 'expectedEnd']:
                    if field in dates:
                        r['phaseDates'][phase][field] = dates[field]
        for phase, chosen in correction.get('plans', {}).items():
            r['productionPlans'][phase] = chosen
            if phase == '上线':
                r['launchDate'] = chosen
                r['phaseDates']['production']['expectedEnd'] = chosen
            if phase == '单车':
                r['phaseDates']['production']['expectedStart'] = chosen
        if 'stage' in correction:
            r['stage'] = correction['stage']
            r['sourceStatus'] = correction.get('statusLabel', r['sourceStatus'])

    package_groups = defaultdict(list)
    for r in records:
        if r['version']:
            package_groups[r['version']].append(r)
    packages = []
    for version, members in package_groups.items():
        conflicts = []
        plans = {}
        for stage in PRODUCTION:
            values = defaultdict(list)
            for r in members:
                if r['productionPlans'][stage]:
                    values[r['productionPlans'][stage]].append(r['id'])
            plans[stage] = next(iter(values)) if len(values) == 1 else ''
            if len(values) > 1:
                conflicts.append({'field': stage + '日期', 'values': dict(values)})
        stages = set(r['stage'] for r in members)
        production_started = any(4 <= s <= 8 for s in stages)
        stage = next(iter(stages)) if len(stages) == 1 and next(iter(stages)) <= 8 else None
        if production_started and len(stages) > 1:
            conflicts.append({'field': '当前阶段', 'values': {str(s): [r['id'] for r in members if r['stage'] == s] for s in stages}})
        overlay = decisions.get('packages', {}).get(version, {})
        for phase, chosen in overlay.get('plans', {}).items():
            plans[phase] = chosen
            conflicts = [c for c in conflicts if c['field'] != phase + '日期']
            for r in members:
                r['productionPlans'][phase] = chosen
                if phase == '上线':
                    r['launchDate'] = chosen
                    r['phaseDates']['production']['expectedEnd'] = chosen
                if phase == '单车':
                    r['phaseDates']['production']['expectedStart'] = chosen
        if 'stage' in overlay:
            stage = overlay['stage']
            conflicts = [c for c in conflicts if c['field'] != '当前阶段']
            for r in members:
                r['stage'] = stage
                r['sourceStatus'] = overlay.get('statusLabel', '')
        if conflicts:
            note('package', version + '：同版本记录有差异，需要确认后再整包推进', [ref for r in members for ref in r['sourceRefs']])
        packages.append({'id': uid(version, 'package-'), 'version': version, 'memberIds': [r['id'] for r in members], 'stage': stage, 'preproduction': all(r['stage'] < 4 for r in members), 'plans': plans, 'conflicts': conflicts, 'resolutions': overlay, 'extraSourceRefs': [r['id'] for r in unassigned if r['values'].get('版本号') == version]})

    active_ids = {r['id'] for r in records}
    history = {}
    for entry in previous_updates or []:
        if entry.get('type') != 'fe' or entry.get('key') not in active_ids or entry.get('origin') != 'workbook':
            continue
        try:
            parts = split_progress(entry.get('text'), entry['date'])
        except ValueError:
            continue  # An old import-date assumption is not evidence of an update date.
        for updated, text in parts:
            history[(entry['key'], updated)] = {**entry, 'id': uid(entry.get('sourceHash', '') + entry['key'] + updated, 'import-'), 'date': updated, 'text': text, 'dateSources': ['source-text']}
    for entry in daily_updates:
        history[(entry['key'], entry['date'])] = entry
    daily_updates = list(history.values())
    if not raw['source'].get('importProgress', True):
        daily_updates = copy.deepcopy(previous_updates or [])
        prior = {r['id']: r for r in previous}
        for r in records:
            r['notes'] = copy.deepcopy(prior.get(r['id'], {}).get('notes', []))
    archived = []  # Old test contents remain only in the source snapshot and browser backup.
    return {'id': raw['source'].get('datasetId', 'luban-import'), 'name': raw['source'].get('name', '鲁班导入'), 'snapshotDate': snapshot_date, 'sourceRevision': revision, 'dailyUpdates': daily_updates, 'archivedRecords': archived, 'refresh': {'baseline': previous, 'sheet': weekly_sheet, 'preserveProgress': bool(raw['source'].get('preserveProgress')), 'mode': raw['source'].get('refreshMode', '')}, 'source': raw['source'], 'sheets': sheets, 'sourceRows': source_rows, 'records': records, 'packages': packages, 'unassigned': unassigned, 'reviewItems': review, 'decisions': decisions, 'modules': unique(m for r in records for m in r['modules']), 'topics': unique(r['topic'] for r in records)}


if __name__ == '__main__':
    raw = json.loads(Path(sys.argv[1]).read_text())
    decisions = json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv) > 3 else {}
    previous = json.loads(Path(sys.argv[4]).read_text()) if len(sys.argv) > 4 else {}
    data = build(raw, decisions, previous.get('records', []), previous.get('dailyUpdates', []))
    Path(sys.argv[2]).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'records': len(data['records']), 'FE': sum(r['kind'] == 'fe' for r in data['records']), 'source_rows': len(data['sourceRows']), 'packages': len(data['packages']), 'unassigned': len(data['unassigned'])}, ensure_ascii=False))
