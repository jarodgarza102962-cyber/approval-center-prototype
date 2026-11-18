(function () {
    'use strict';

    const detail = document.getElementById('detail-modal');
    const sidebar = document.getElementById('approval-progress-panel');
    sidebar.classList.add('acd-sidebar');
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const chevron = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    function contentArrow(collapsed) {
        return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${collapsed ? 'm9 7 5 5-5 5' : 'm14 7-5 5 5 5'}"/></svg>`;
    }
    let expanded = new Set();
    let returnFocus = null;
    let panelReturnFocus = null;
    let activeRecord = null;
    let panelKind = '';
    let descending = false;
    const relatedViews = [];
    let panelParent = detail;
    let historyTab = 'form';
    let selectedContentRecord = null;

    function contentRecord() { return selectedContentRecord || currentDetailItem; }
    function selectContentRecord(record) {
        selectedContentRecord = record.id === currentDetailItem.id ? null : record;
        toggleContent(false);
        switchDetailTab('content', detail.querySelector('.detail-tab-btn'));
        renderDetailModal();
        document.getElementById('pane-content').scrollTop = 0;
        document.getElementById('pane-log').scrollTop = 0;
        detail.querySelector('.detail-tab-btn').focus({ preventScroll: true });
    }
    function resizeLimits(surface) {
        const sidebarWidth = parseFloat(getComputedStyle(surface).getPropertyValue('--acd-sidebar-width')) || 380;
        return { min: Math.min(window.innerWidth, sidebarWidth + 320), max: window.innerWidth };
    }
    function ensureWidthHandle(surface) {
        const box = surface.querySelector('.detail-modal-box');
        if (!box.querySelector('.acd-width-handle')) {
            const handle = document.createElement('div');
            handle.className = 'acd-width-handle';
            handle.setAttribute('role', 'separator');
            handle.setAttribute('aria-orientation', 'vertical');
            handle.setAttribute('aria-label', '调整表单详情宽度');
            handle.title = '拖拽调整宽度';
            handle.tabIndex = 0;
            box.appendChild(handle);
        }
        const handle = box.querySelector('.acd-width-handle');
        const limits = resizeLimits(surface);
        handle.setAttribute('aria-valuemin', Math.round(limits.min));
        handle.setAttribute('aria-valuemax', Math.round(limits.max));
        handle.setAttribute('aria-valuenow', Math.round(box.getBoundingClientRect().width));
    }
    function setDrawerWidth(surface, width) {
        const limits = resizeLimits(surface);
        surface.style.setProperty('--acd-drawer-width', Math.max(limits.min, Math.min(limits.max, width)) + 'px');
        ensureWidthHandle(surface);
    }
    function installDrawerResize(surface) {
        let drag = null;
        surface.addEventListener('pointerdown', event => {
            const handle = event.target.closest('.acd-width-handle');
            if (!handle || event.button !== 0 || surface.classList.contains('acd-collapsed')) return;
            event.preventDefault();
            drag = { x: event.clientX, width: surface.querySelector('.detail-modal-box').getBoundingClientRect().width, pointerId: event.pointerId };
            surface.setAttribute('data-resizing', '');
            handle.setPointerCapture(event.pointerId);
            handle.focus({ preventScroll: true });
        });
        surface.addEventListener('pointermove', event => {
            if (drag && drag.pointerId === event.pointerId) setDrawerWidth(surface, drag.width + drag.x - event.clientX);
        });
        const finish = event => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            drag = null;
            surface.removeAttribute('data-resizing');
        };
        surface.addEventListener('pointerup', finish);
        surface.addEventListener('pointercancel', finish);
        surface.addEventListener('lostpointercapture', finish);
        surface.addEventListener('keydown', event => {
            if (!event.target.matches('.acd-width-handle')) return;
            const limits = resizeLimits(surface);
            const width = surface.querySelector('.detail-modal-box').getBoundingClientRect().width;
            const step = event.shiftKey ? 40 : 16;
            const next = { ArrowLeft: width + step, ArrowRight: width - step, Home: limits.min, End: limits.max }[event.key];
            if (next === undefined) return;
            event.preventDefault();
            setDrawerWidth(surface, next);
        });
        window.addEventListener('resize', () => {
            if (surface.style.display === 'flex') ensureWidthHandle(surface);
        });
    }
    installDrawerResize(detail);

    // Keep this approval example aligned with the personnel qualification record.
    function referenceRecord(id, title, relation, status, startTime, initiator, source, nodes, fields) {
        return { id, title, relation, status, startTime, initiator, source, fields,
            flowNodes: nodes.map(([name, state, time, users, desc]) => ({ name, key: name, status: state, time, users, desc })),
            approvalDetails: nodes.flatMap(([nodeName, state, time, users, desc, comment, agreed]) =>
                (agreed || (state === 'done' ? users : [])).map(user => ({ nodeName, user, time, comment: comment || '提交表单', action: 'agree', actionName: '同意' }))).filter(d => d.nodeName !== '发起审批') };
    }
    const mainExample = referenceRecord(targetSpecialItem.id, '(组织提取岗) 交接班考核记录表zzz', '主表单', '进行中', '2026-11-16 15:55:30', '李何02', 'pane-ltab-content', [
        ['发起审批', 'done', '2026-11-16 15:55:30', ['李何02']],
        ['分值填写并审核', 'active', '', ['李何02'], '1人 会签']
    ]);
    Object.assign(targetSpecialItem, mainExample, { node: '分值填写并审核', currentNodeKey: '分值填写并审核', isJoint: false,
        preview: '理论考核、工作程序培训考核及仪器操作考核',
        logs: [{ user: '李何02', action: '发起审批', comment: '-', time: mainExample.startTime }] });
    targetSpecialItem.relatedForms = [
        referenceRecord('related-compare', '实验室内部比对记录及分析报告表（理论+实操）', '关联发起', '已通过', '2026-11-16 16:15:00', '李何02', 'sec-view-compare', [
            ['发起审批', 'done', '2026-11-16 16:15:00', ['李何02']],
            ['报告医生审核', 'done', '2026-11-16 16:30:00', ['李建华', '李何01'], '2人 会签', '原测结果与现测结果吻合，比对结论符合要求。'],
            ['技术组长审核', 'done', '2026-11-16 16:45:00', ['李何02', '李何01'], '2人 或签', '同意归档。', ['李何02']]
        ]),
        referenceRecord('related-auth', '授权申请审核表', '关联发起', '进行中', '2026-11-16 16:50:00', '李何02', 'sec-view-auth', [
            ['发起审批', 'done', '2026-11-16 16:50:00', ['李何02']],
            ['技术主管审核', 'done', '2026-11-16 17:00:00', ['王主任', '李何01'], '2人 会签', '考核资料完整，岗位能力符合要求。'],
            ['质量主管审核', 'done', '2026-11-16 17:05:00', ['李何02', '李何01'], '2人 或签', '同意授权申请。', ['李何02']],
            ['科主任审批', 'active', '', ['王主任'], '1人 会签']
        ]),
        referenceRecord('related-handover', '交接班记录表', '关联发起', '未发起', '', '', 'sec-view-record', []),
        referenceRecord('related-training', '人员上岗前技术培训与评估考核表', '手动关联', '已通过', '2026-11-10 09:10:00', '李何01', '', [
            ['发起审批', 'done', '2026-11-10 09:10:00', ['李何01']],
            ['培训效果评估', 'done', '2026-11-10 11:20:00', ['李何01'], '1人 会签', '培训考核合格，同意上岗。']
        ], [['培训项目', '组织提取岗上岗前培训'], ['被培训人', '李何02'], ['培训内容', '操作规程、质量控制及安全要求'], ['考核结果', '合格'], ['评估人', '李何01']])
    ];
    targetSpecialItem.supportsPdf = false;
    DATA.mine[0] = targetSpecialItem;
    DATA.done[0] = { ...structuredClone(targetSpecialItem), id: 'special-reviewed-359', node: '发起人', currentNodeKey: '发起人',
        flowNodes: targetSpecialItem.flowNodes.map((node, index) => ({ ...structuredClone(node), status: index ? 'pending' : 'active', time: '' })) };
    const candidates = [
        { id: 'manual-annual', title: '人员年度能力复评记录', relation: '手动关联', status: '已驳回', startTime: '2026-09-28 09:00:00', initiator: '李何02', fields: [['评估年度', '2026年'], ['评估人', '李何02']], flowNodes: [
            { name: '发起审批', status: 'done', user: '李何02', time: '2026-09-28 09:00:00' },
            { name: '质量主管审核', status: 'rejected', user: '王主任', time: '2026-09-28 10:00:00' }
        ], approvalDetails: [{ nodeName: '质量主管审核', user: '王主任', time: '2026-09-28 10:00:00', comment: '请补充质量控制考核材料。', action: 'reject', actionName: '驳回' }] }
    ];
    candidates.unshift({ ...structuredClone(targetSpecialItem.relatedForms.find(r => r.id === 'related-auth')), id: 'manual-authorization', title: '授权申请审核表zzz', startTime: '2026-11-17 14:38:00', relation: '手动关联' });
    const manualTimes = { '发起审批': '2026-11-17 14:38:00', '技术主管审核': '2026-11-17 15:00:00', '质量主管审核': '2026-11-17 15:05:00' };
    candidates[0].flowNodes.forEach(node => { if (node.time) node.time = manualTimes[node.name]; });
    candidates[0].approvalDetails.forEach(log => { log.time = manualTimes[log.nodeName]; });
    candidates.push(referenceRecord('manual-safety', '实验室安全培训记录表', '手动关联', '已通过', '2026-11-13 09:00:00', '李何01', '', [
        ['发起审批', 'done', '2026-11-13 09:00:00', ['李何01']],
        ['安全负责人审核', 'done', '2026-11-13 11:00:00', ['王主任'], '1人 会签', '已完成安全培训，同意归档。']
    ], [['培训主题', '实验室安全与应急处置'], ['参与人员', '李何02、李何01'], ['考核结果', '合格']]));
    function forms(root = currentDetailItem) { return [{ ...root, relation: '主表单' }, ...(root.relatedForms || [])]; }
    function defaultExpanded(root) {
        const eligible = forms(root).filter(r => ['进行中', '已通过', '已完成'].includes(r.status)).sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));
        return new Set([(eligible[0] || root).id]);
    }
    function statusClass(record) {
        return ['已通过', '已完成'].includes(record.status) ? 'done' : record.status === '进行中' ? 'active' : ['未发起', '已撤回'].includes(record.status) ? 'unstarted' : 'rejected';
    }
    function badge(record) { return `<span class="acd-status ${statusClass(record)}">${esc(record.status)}</span>`; }
    function relationTag(record) { return `<span class="acd-relation-tag">${esc(record.relation)}</span>`; }
    const timelineIcons = {
        user: '<circle cx="12" cy="8" r="3"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        pending: '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
        rejected: '<path d="m6 6 12 12M6 18 18 6"/>',
        waiting: '<circle cx="12" cy="12" r="4"/>'
    };
    function timelineIcon(name, size) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${timelineIcons[name]}</svg>`;
    }
    function timeline(record) {
        const nodes = record.flowNodes || [];
        if (!nodes.length) return '<div class="acd-empty">尚未发起，暂无审批记录</div>';
        return `<ol class="acd-timeline">${nodes.map((node, index) => {
            const decisions = (record.approvalDetails || []).filter(d => d.nodeName === node.name || (node.key && d.nodeName === node.key)).sort((a, b) => a.time.localeCompare(b.time));
            let state = node.status === 'active' ? 'pending' : node.status === 'pending' ? 'waiting' : node.status;
            if (record.status === '已驳回' && decisions.at(-1)?.action === 'reject') state = 'rejected';
            const stateText = { done: '审批通过', pending: '进行中', waiting: '待处理', rejected: '审批拒绝' }[state] || '';
            const names = node.users || (node.user ? [node.user] : []);
            return `<li class="acd-timeline-node ${esc(state)}"><span class="acd-node-mark">${timelineIcon(state === 'done' ? 'check' : state, 12)}</span>
                <div class="acd-node-title"><span>${esc(node.name)}${index && stateText ? ' - ' + stateText : ''}</span>${node.time ? `<time>${esc(node.time)}</time>` : ''}</div>
                ${node.desc ? `<div class="acd-sign-rule">${esc(node.desc)}</div>` : ''}
                <div class="acd-people">${names.map(name => {
                    const decision = decisions.filter(d => d.user === name).at(-1);
                    const result = !index && state === 'done' ? '同意' : decision?.action === 'agree' ? '同意' : decision?.action === 'reject' ? '驳回' : '';
                    return `<span class="acd-person ${result === '同意' ? 'agreed' : result === '驳回' ? 'rejected' : ''}"><span class="acd-person-icon">${timelineIcon('user', 15)}</span>${esc(name)}${index && result ? `（${result}）` : ''}</span>`;
                }).join('')}</div></li>`;
        }).join('')}</ol>`;
    }
    function progressHTML(root, opened, collapsed, editable = true, prefix = 'acd-progress') {
        const list = forms(root);
        return `<button type="button" class="acd-edge-toggle" data-action="content-toggle" aria-expanded="${!collapsed}" aria-label="${collapsed ? '展开' : '收起'}表单内容" title="${collapsed ? '展开' : '收起'}表单内容">${contentArrow(collapsed)}</button><header class="acd-progress-header"><strong>审批进度</strong><span class="acd-count" role="status">已通过 <b>${list.filter(r => statusClass(r) === 'done').length}/${list.length}</b></span>${editable ? '<button type="button" class="acd-text-button acd-link-button" data-action="link" title="关联已有表单">关联已有表单</button>' : ''}</header>
            <div class="acd-progress-list">${list.map(record => `<section class="acd-progress-item ${opened.has(record.id) ? '' : 'collapsed'}" data-record="${esc(record.id)}">
                <div class="acd-progress-heading"><button type="button" class="acd-toggle" data-action="toggle" aria-expanded="${opened.has(record.id)}" aria-controls="${prefix}-${esc(record.id)}" aria-label="${opened.has(record.id) ? '收起' : '展开'}${esc(record.title)}审批进度" title="${opened.has(record.id) ? '收起' : '展开'}审批进度"><span class="acd-form-label">${esc(record.title)}</span><span class="acd-fold">${chevron}</span></button>
                <div class="acd-progress-summary"><div class="acd-summary-info">${badge(record)}${relationTag(record)}</div><div class="acd-item-actions"><button type="button" class="acd-text-button" data-action="${record.status === '未发起' ? 'launch' : 'view'}" ${!editable && record.status === '未发起' ? 'disabled' : ''}>${record.status === '未发起' ? '发起' : '查看'}</button>${editable && record.relation === '手动关联' ? '<button type="button" class="acd-text-button acd-remove" data-action="remove">移除</button>' : ''}</div></div></div>
                <div class="acd-progress-body" id="${prefix}-${esc(record.id)}"><div class="acd-progress-tools"><button type="button" class="acd-text-button" data-action="graph" ${record.status === '未发起' ? 'disabled' : ''}>流程图</button><button type="button" class="acd-text-button" data-action="logs" ${record.status === '未发起' ? 'disabled' : ''}>审批日志</button></div><div class="flow-timeline">${timeline(record)}</div></div>
            </section>`).join('')}</div>`;
    }
    function render() {
        if (!currentDetailItem) return;
        const scrollTop = sidebar.querySelector('.acd-progress-list')?.scrollTop || 0;
        sidebar.innerHTML = progressHTML(currentDetailItem, expanded, detail.classList.contains('acd-collapsed'));
        sidebar.querySelector('.acd-progress-list').scrollTop = scrollTop;
        ensureWidthHandle(detail);
        requestAnimationFrame(() => { if (detail.style.display === 'flex') ensureWidthHandle(detail); });
    }
    function toggleContent(force) {
        const collapsed = typeof force === 'boolean' ? force : !detail.classList.contains('acd-collapsed');
        detail.classList.toggle('acd-collapsed', collapsed);
        const button = sidebar.querySelector('.acd-edge-toggle');
        if (button) {
            button.setAttribute('aria-expanded', String(!collapsed));
            button.title = (collapsed ? '展开' : '收起') + '表单内容';
            button.setAttribute('aria-label', button.title);
            button.innerHTML = contentArrow(collapsed);
        }
    }
    function versionSnapshot(record) {
        const snapshot = structuredClone({ id: record.id, title: record.title, status: record.status, startTime: record.startTime,
            initiator: record.initiator, source: record.source, fields: record.fields, formValues: record.formValues,
            formData: record.formData, editorValues: record.editorValues, flowNodes: record.flowNodes || [], approvalDetails: record.approvalDetails || [] });
        if (!record.source && record.id === currentDetailItem?.id) {
            const clone = document.getElementById('form-content-container').cloneNode(true);
            clone.querySelectorAll('input, textarea, select').forEach(input => {
                input.disabled = true;
                input.removeAttribute('name');
                if (input.tagName === 'TEXTAREA') input.textContent = input.value;
                else if (input.tagName === 'SELECT') [...input.options].forEach(option => option.toggleAttribute('selected', option.selected));
                else { input.setAttribute('value', input.value); input.toggleAttribute('checked', input.checked); }
            });
            clone.querySelectorAll('*').forEach(el => [...el.attributes].forEach(attr => {
                if (attr.name.startsWith('on') || attr.name === 'id') el.removeAttribute(attr.name);
            }));
            snapshot.formHTML = clone.innerHTML;
        }
        return snapshot;
    }
    function operationLogs(record) {
        record.logs ||= [
            ...(record.startTime ? [{ user: record.initiator, time: record.startTime, action: '发起审批' }] : []),
            ...(record.approvalDetails || []).map(log => ({ user: log.user, time: log.time, action: log.actionName }))
        ];
        record.logs.forEach(log => { log.snapshot ||= versionSnapshot(record); });
        return record.logs;
    }
    function renderOperationLogs(tbody, record) {
        tbody.innerHTML = operationLogs(record).map((log, index) => `<tr><td>${esc(log.user)}</td><td>${esc(log.time)}</td><td><button type="button" class="acd-text-button" data-history-index="${index}">查看</button></td></tr>`).join('') || '<tr><td colspan="3" class="acd-empty">暂无操作日志</td></tr>';
    }
    function saveVersion(record) {
        if (!record) return;
        operationLogs(record).push({ user: '李何02', time: formatNowTime(), action: '保存', snapshot: versionSnapshot(record) });
        renderDetailLogs();
    }
    function renderReadonlyForm(container, record) {
        if (window.renderRelatedEditorValues?.(container, record)) return;
        if (renderPersonnelForm(container, record, true)) return;
        if (record.formHTML) { container.innerHTML = record.formHTML; return; }
        const values = record.fields || [['表单名称', record.title], ['发起人', record.initiator], ['发起时间', record.startTime]];
        container.innerHTML = `<dl class="acd-readonly-fields">${values.map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>`;
    }
    const relatedDrawer = document.createElement('div');
    relatedDrawer.id = 'related-form-drawer';
    relatedDrawer.setAttribute('aria-label', '关联表单详情');
    document.body.appendChild(relatedDrawer);
    installDrawerResize(relatedDrawer);
    function renderRelatedView() {
        const state = relatedViews.at(-1);
        const record = state.record;
        relatedDrawer.classList.toggle('acd-collapsed', state.collapsed);
        relatedDrawer.innerHTML = `<section class="modal-box detail-modal-box" role="dialog" aria-modal="true" aria-label="${esc(record.title)}">
            <div class="modal-body detail-modal-body"><div class="detail-panel">
                <header class="detail-form-header"><div class="detail-form-title-row"><span class="detail-form-name" title="${esc(record.title)}">${esc(record.title)}</span><span class="acd-related-status">${badge(record)}</span></div><div class="detail-meta">发起人：${esc(record.initiator)}　发起时间：${esc(record.startTime)}</div><button type="button" class="acd-text-button acd-main-close" data-related-close aria-label="关闭关联表单" title="关闭">×</button></header>
                <div class="acd-workspace"><div class="acd-content"><div class="detail-tabs"><button type="button" class="detail-tab-btn ${state.tab === 'content' ? 'active' : ''}" data-related-tab="content">表单内容</button><button type="button" class="detail-tab-btn ${state.tab === 'log' ? 'active' : ''}" data-related-tab="log">操作日志</button></div>
                    <div class="detail-tab-pane ${state.tab === 'content' ? 'active' : ''}" data-related-pane="content"><div class="acd-related-form"></div></div>
                    <div class="detail-tab-pane ${state.tab === 'log' ? 'active' : ''}" data-related-pane="log"><div class="acd-table-scroll acd-operation-log"><table class="data-table"><thead><tr><th>操作人</th><th>操作时间</th><th>操作</th></tr></thead><tbody></tbody></table></div></div>
                </div><aside class="acd-sidebar" aria-label="审批进度">${progressHTML(record, state.expanded, state.collapsed, false, 'acd-related-progress')}</aside></div>
            </div></div><footer class="modal-footer acd-record-footer"><button type="button" class="btn-default" data-related-close>关闭</button></footer></section>`;
        renderReadonlyForm(relatedDrawer.querySelector('.acd-related-form'), record);
        renderOperationLogs(relatedDrawer.querySelector('tbody'), record);
        relatedDrawer.querySelector('.acd-progress-list').scrollTop = state.scrollTop || 0;
        ensureWidthHandle(relatedDrawer);
    }
    function openRelated(record) {
        const previous = relatedViews.at(-1);
        if (previous) previous.scrollTop = relatedDrawer.querySelector('.acd-progress-list').scrollTop;
        relatedViews.push({ record, expanded: defaultExpanded(record), collapsed: false, tab: 'content', returnFocus: document.activeElement });
        detail.inert = true;
        linkModal.inert = true;
        relatedDrawer.style.display = 'flex';
        renderRelatedView();
        relatedDrawer.querySelector('[data-related-close]').focus({ preventScroll: true });
    }
    function closeRelated() {
        const state = relatedViews.pop();
        if (relatedViews.length) renderRelatedView();
        else {
            relatedDrawer.style.display = 'none';
            linkModal.inert = false;
            detail.inert = linkModal.style.display === 'flex';
        }
        if (state?.returnFocus?.isConnected) state.returnFocus.focus({ preventScroll: true });
        else relatedDrawer.querySelector('[data-related-close]')?.focus({ preventScroll: true });
    }
    relatedDrawer.addEventListener('click', event => {
        const state = relatedViews.at(-1);
        if (!state) return;
        if (event.target.closest('[data-related-close]')) return closeRelated();
        const tab = event.target.closest('[data-related-tab]')?.dataset.relatedTab;
        if (tab) { state.tab = tab; renderRelatedView(); relatedDrawer.querySelector(`[data-related-tab="${tab}"]`).focus(); return; }
        const history = event.target.closest('[data-history-index]');
        if (history) return openHistory(state.record, Number(history.dataset.historyIndex));
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'content-toggle') {
            state.collapsed = !state.collapsed; renderRelatedView(); relatedDrawer.querySelector('.acd-edge-toggle').focus(); return;
        }
        const record = forms(state.record).find(r => r.id === button.closest('[data-record]')?.dataset.record);
        if (!record) return;
        if (action === 'toggle') {
            if (state.expanded.has(record.id)) state.expanded.delete(record.id); else state.expanded.add(record.id);
            state.scrollTop = relatedDrawer.querySelector('.acd-progress-list').scrollTop;
            renderRelatedView(); relatedDrawer.querySelector(`[data-record="${record.id}"] [data-action="toggle"]`).focus({ preventScroll: true });
        } else if (action === 'view') {
            if (record.id !== state.record.id) return openRelated(record);
            state.tab = 'content'; state.collapsed = false; renderRelatedView(); relatedDrawer.querySelector('[data-related-tab="content"]').focus();
        } else if (['graph', 'logs'].includes(action)) openPanel(action, record);
    });
    function openHistory(record, index) {
        const log = operationLogs(record)[index];
        openPanel('history', { ...log.snapshot, operationUser: log.user, operationTime: log.time, historyVersion: index + 1 });
    }
    detail.addEventListener('click', event => {
        const button = event.target.closest('[data-history-index]');
        if (button) openHistory(contentRecord(), Number(button.dataset.historyIndex));
    });
    const linkModal = document.createElement('div');
    linkModal.id = 'approval-link-modal';
    linkModal.innerHTML = `<section class="acd-link-dialog" role="dialog" aria-modal="true" aria-labelledby="acd-link-title"><header class="acd-link-header"><h2 id="acd-link-title">关联电子表单</h2><button type="button" class="acd-panel-close" data-link-close aria-label="关闭" title="关闭">×</button></header>
        <form class="acd-link-filters"><label>标题<input name="title" placeholder="请输入标题"></label><label>审批状态<select name="status"><option value="">请选择</option><option>进行中</option><option>已通过</option><option>已驳回</option></select></label><label>发起人<input name="initiator" placeholder="请输入发起人"></label><label>表单内容<input name="content" placeholder="请输入表单内容"></label><label>发起时间<input name="from" type="date" aria-label="开始日期"><span>至</span><input name="to" type="date" aria-label="结束日期"></label><button type="submit" class="acd-submit">查询</button></form>
        <div class="acd-link-results"><table class="data-table"><thead><tr><th><input type="checkbox" data-link-select-all aria-label="选择当前页全部表单"></th><th>标题</th><th>内容预览</th><th>发起时间</th><th>审批状态</th><th>发起人</th><th>操作</th></tr></thead><tbody></tbody></table></div>
        <footer class="acd-link-footer"><div class="acd-link-pagination"><span class="acd-link-total"></span><select aria-label="每页条数" data-link-page-size><option value="50">50条/页</option><option value="20">20条/页</option><option value="10">10条/页</option></select><button type="button" data-link-page="-1">上一页</button><span class="acd-link-page-number"></span><button type="button" data-link-page="1">下一页</button><label>前往<input type="number" min="1" data-link-jump aria-label="跳转页码">页</label></div><div class="acd-link-confirm"><button type="button" class="acd-submit" data-link-confirm disabled>确定</button><button type="button" class="acd-outline-close" data-link-close>取消</button></div></footer></section>`;
    document.body.appendChild(linkModal);
    let linkReturnFocus = null;
    let linkSelection = new Set();
    let linkFilters = {};
    let linkPage = 1;
    let linkPageSize = 50;
    function filteredCandidates() {
        return candidates.filter(record => {
            const templateText = new DOMParser().parseFromString(window.personnelRecordTemplates?.[record.source] || '', 'text/html').body.textContent;
            const content = (record.fields || []).flat().join(' ') + (record.preview || '') + record.initiator + templateText;
            return (!linkFilters.title || record.title.includes(linkFilters.title)) && (!linkFilters.status || record.status === linkFilters.status)
                && (!linkFilters.initiator || record.initiator.includes(linkFilters.initiator)) && (!linkFilters.content || content.includes(linkFilters.content))
                && (!linkFilters.from || record.startTime.slice(0, 10) >= linkFilters.from) && (!linkFilters.to || record.startTime.slice(0, 10) <= linkFilters.to);
        });
    }
    function renderLinkRows() {
        const filtered = filteredCandidates();
        const pages = Math.max(1, Math.ceil(filtered.length / linkPageSize));
        linkPage = Math.max(1, Math.min(linkPage, pages));
        const rows = filtered.slice((linkPage - 1) * linkPageSize, linkPage * linkPageSize);
        const linkedIds = new Set(forms().map(r => r.id));
        linkModal.querySelector('tbody').innerHTML = rows.map(record => `<tr><td><input type="checkbox" data-link-select="${esc(record.id)}" aria-label="选择${esc(record.title)}" ${linkedIds.has(record.id) ? 'disabled checked' : linkSelection.has(record.id) ? 'checked' : ''}></td><td>${esc(record.title)}</td><td>${esc(record.fields?.map(([key, value]) => key + '：' + value).join('；') || '姓名：' + record.initiator)}</td><td>${esc(record.startTime)}</td><td>${badge(record)}</td><td>${esc(record.initiator)}</td><td><button type="button" class="acd-text-button" data-link-view="${esc(record.id)}">查看</button>${linkedIds.has(record.id) ? '<span class="acd-linked-hint">已关联</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="acd-empty">暂无符合条件的表单</td></tr>';
        linkModal.querySelector('.acd-link-total').textContent = `共 ${filtered.length} 条`;
        linkModal.querySelector('.acd-link-page-number').textContent = linkPage;
        const jump = linkModal.querySelector('[data-link-jump]'); jump.value = linkPage; jump.max = pages;
        linkModal.querySelector('[data-link-page="-1"]').disabled = linkPage === 1;
        linkModal.querySelector('[data-link-page="1"]').disabled = linkPage === pages;
        const available = rows.filter(r => !linkedIds.has(r.id));
        const selected = available.filter(r => linkSelection.has(r.id));
        const selectAll = linkModal.querySelector('[data-link-select-all]');
        selectAll.disabled = !available.length; selectAll.checked = !!available.length && selected.length === available.length; selectAll.indeterminate = selected.length > 0 && selected.length < available.length;
        linkModal.querySelector('[data-link-confirm]').disabled = !linkSelection.size;
    }
    function openLinkModal() {
        linkReturnFocus = document.activeElement;
        linkSelection = new Set(); linkFilters = {}; linkPage = 1;
        linkModal.querySelector('form').reset();
        renderLinkRows(); linkModal.style.display = 'flex'; detail.inert = true;
        linkModal.querySelector('input[name="title"]').focus();
    }
    function closeLinkModal() {
        linkModal.style.display = 'none'; detail.inert = false;
        if (linkReturnFocus?.isConnected) linkReturnFocus.focus({ preventScroll: true });
    }
    linkModal.addEventListener('submit', event => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(event.target));
        if (values.from && values.to && values.from > values.to) { showToast('开始日期不能晚于结束日期', 'error'); return; }
        linkFilters = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])); linkPage = 1; renderLinkRows();
    });
    linkModal.addEventListener('click', event => {
        if (event.target.closest('[data-link-close]')) return closeLinkModal();
        const view = event.target.closest('[data-link-view]');
        if (view) return openRelated(candidates.find(r => r.id === view.dataset.linkView));
        const page = event.target.closest('[data-link-page]');
        if (page) { linkPage += Number(page.dataset.linkPage); renderLinkRows(); }
        if (event.target.closest('[data-link-confirm]')) {
            currentDetailItem.relatedForms ||= [];
            candidates.filter(r => linkSelection.has(r.id) && !forms().some(f => f.id === r.id)).forEach(r => currentDetailItem.relatedForms.push(r));
            closeLinkModal(); render(); showToast('已关联所选表单');
        }
    });
    linkModal.addEventListener('change', event => {
        const target = event.target;
        if (target.matches('[data-link-select]')) {
            if (target.checked) linkSelection.add(target.dataset.linkSelect); else linkSelection.delete(target.dataset.linkSelect);
        } else if (target.matches('[data-link-select-all]')) {
            linkModal.querySelectorAll('[data-link-select]:not(:disabled)').forEach(input => {
                if (target.checked) linkSelection.add(input.dataset.linkSelect); else linkSelection.delete(input.dataset.linkSelect);
            });
        } else if (target.matches('[data-link-page-size]')) { linkPageSize = Number(target.value); linkPage = 1; }
        else if (target.matches('[data-link-jump]')) linkPage = Number(target.value) || 1;
        else return;
        renderLinkRows();
    });
    const overlay = document.createElement('div');
    overlay.id = 'approval-record-drawer';
    overlay.innerHTML = '<section class="acd-panel" role="dialog" aria-modal="true" aria-labelledby="acd-panel-title"><header class="acd-panel-header"><h2 id="acd-panel-title"></h2><span class="acd-header-status"></span><button type="button" class="acd-panel-close" data-action="close" aria-label="关闭" title="关闭">×</button></header><div class="acd-panel-context"></div><div class="acd-panel-body"></div><footer class="acd-panel-footer"><button type="button" class="acd-outline-close" data-action="close">关闭</button></footer></section>';
    document.body.appendChild(overlay);
    function syncLaunchBounds() {
        const workspace = document.querySelector('.main-layout');
        const topbar = document.querySelector('.topbar');
        overlay.style.setProperty('--ace-workspace-left', Math.max(0, workspace?.getBoundingClientRect().left || 0) + 'px');
        overlay.style.setProperty('--ace-workspace-top', Math.max(0, topbar?.getBoundingClientRect().bottom || 0) + 'px');
    }
    window.addEventListener('resize', () => {
        if (overlay.style.display === 'flex' && panelKind === 'launch') syncLaunchBounds();
    });
    const launchEditor = window.createRelatedFormEditor({
        host: overlay, onClose: closePanel, notify: showToast,
        onSubmit(record, values) {
            const now = formatNowTime();
            Object.assign(record, { status: '进行中', startTime: now, initiator: currentDetailItem.initiator,
                editorValues: values, fields: [['专业组', values.group], ['日期', values.date.replace('T', ' ')], ['安全情况', values.safety], ['换岗类型', values.handoverType], ['工作交接记录', values.work], ['其他说明', values.other]],
                flowNodes: [{ key: '发起审批', name: '发起审批', status: 'done', user: currentDetailItem.initiator, time: now }, { key: '接班人审核', name: '接班人审核', status: 'active', user: values.approver, desc: '1人 会签', time: '' }],
                approvalDetails: [], logs: [{ user: currentDetailItem.initiator, action: '发起审批', time: now }] });
            expanded = new Set([record.id]);
            closePanel(); render();
            sidebar.querySelector(`[data-record="${record.id}"] [data-action="view"]`).focus({ preventScroll: true });
            showToast('已发起，等待接班人审核');
        }
    });
    function openPanel(kind, record) {
        panelReturnFocus = document.activeElement;
        panelKind = kind;
        activeRecord = record;
        if (kind === 'launch') { syncLaunchBounds(); launchEditor.open(record, currentDetailItem); }
        descending = false;
        historyTab = 'form';
        panelParent = relatedViews.length ? relatedDrawer : linkModal.style.display === 'flex' ? linkModal : detail;
        overlay.dataset.kind = kind;
        detail.classList.toggle('acd-launch-behind', kind === 'launch');
        overlay.dataset.record = record?.id || '';
        overlay.style.display = 'flex';
        const modal = !['graph', 'logs'].includes(kind);
        panelParent.inert = modal;
        overlay.querySelector('.acd-panel').setAttribute('aria-modal', String(modal));
        renderPanel();
        overlay.querySelector('[data-action="close"]').focus({ preventScroll: true });
    }
    function closePanel() {
        overlay.style.display = 'none';
        detail.classList.remove('acd-launch-behind');
        panelParent.inert = false;
        detail.inert = !!relatedViews.length || linkModal.style.display === 'flex';
        if (panelReturnFocus?.isConnected) panelReturnFocus.focus({ preventScroll: true });
    }
    function cardsHTML(record) {
        const cards = [...(record.approvalDetails || [])].sort((a, b) => a.time.localeCompare(b.time));
        if (descending) cards.reverse();
        return cards.map(c => `<section class="acd-log-record"><h3>${esc(c.nodeName)}</h3><div class="acd-log-fields"><span class="acd-conclusion ${['agree', 'reject', 'return', 'submit'].includes(c.action) ? c.action : ''}">${esc(c.actionName || '处理')}</span><p><span>审批人：</span>${esc(c.user)}</p><p><span>审批时间：</span>${esc(c.time)}</p>${c.targetNode ? `<p><span>退回节点：</span>${esc(c.targetNode)}</p>` : ''}<p><span>审批意见：</span>${esc(c.comment)}</p></div></section>`).join('') || '<div class="acd-empty">暂无已处理的审批记录</div>';
    }
    function graphNode(title, text, type = '') {
        return `<div class="acd-graph-node ${type}"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;
    }
    function graphHTML(record) {
        const connector = '<div class="acd-connector"></div>';
        let html = graphNode('发起人', record.initiator + ' · 提交表单', 'start');
        if (record.source === 'sec-view-auth') {
            html += connector + graphNode('岗位分组', '按人员岗位进入对应审核分支', 'condition') + connector;
            html += '<div class="acd-graph-branches">' + [
                ['技术组条件', '岗位分组包含技术组', '技术主管审核', '王主任、李何01 · 会签'],
                ['诊断组条件', '岗位分组包含诊断组', '诊断组主管审核', '诊断组负责人 · 会签']
            ].map(b => `<div class="acd-graph-branch">${graphNode(b[0], b[1], 'condition')}${connector}${graphNode(b[2], b[3])}${connector}</div>`).join('') + '</div>';
            html += graphNode('质量主管审核', '李何02、李何01 · 或签') + connector + graphNode('科主任审批', '王主任 · 会签');
        } else {
            html += (record.flowNodes || []).slice(1).map(n => connector + graphNode(n.name, (n.users || [n.user]).filter(Boolean).join('、') + (n.desc ? ' · ' + n.desc : ''))).join('');
        }
        return `<div class="acd-graph-canvas"><div class="acd-graph">${html}${connector}${graphNode('结束', '审批完成后归档', 'start')}</div></div>`;
    }
    function renderPersonnelForm(container, record, readonly = false) {
        const template = window.personnelRecordTemplates?.[record.source];
        if (!template || record.fields) return false;
        container.innerHTML = `<div class="acd-personnel-form">${template}</div>`;
        container.querySelectorAll('input, textarea, select').forEach((input, index) => {
            if (record.formValues?.[index] !== undefined) input.value = record.formValues[index];
            input.disabled = readonly || record.status !== '进行中' || ['done', 'cc'].includes(currentTab) || (currentTab === 'mine' && record.currentNodeKey !== '发起人');
            if (!readonly) input.addEventListener('input', () => {
                record.formValues ||= {};
                record.formValues[index] = input.value;
            });
        });
        return true;
    }
    function renderPanel() {
        if (panelKind === 'launch') { launchEditor.render(); return; }
        overlay.querySelector('.acd-panel-footer').innerHTML = '<button type="button" class="acd-outline-close" data-action="close">关闭</button>';
        const title = { logs: '审批日志', graph: '审批流程图', history: '操作详情', launch: '发起表单' }[panelKind];
        overlay.querySelector('h2').textContent = panelKind === 'graph' ? activeRecord.title + ' · ' + title : title;
        overlay.querySelector('.acd-header-status').innerHTML = panelKind === 'graph' ? badge(activeRecord) : '';
        overlay.querySelector('.acd-panel-context').innerHTML = activeRecord && panelKind !== 'graph' ? `<span>${esc(activeRecord.title)}</span>${badge(activeRecord)}${panelKind === 'history' ? `<span class="acd-history-meta">操作人：${esc(activeRecord.operationUser)}　操作时间：${esc(activeRecord.operationTime)}</span>` : ''}` : '';
        const body = overlay.querySelector('.acd-panel-body');
        body.scrollTop = 0;
        if (panelKind === 'logs') {
            body.innerHTML = `<div class="acd-log-toolbar"><span>审批详情</span><div role="group" aria-label="根据审批时间排序"><label><input type="radio" name="acd-log-sort" value="asc" checked>正序</label><label><input type="radio" name="acd-log-sort" value="desc">倒序<span>（根据审批时间排序）</span></label></div></div><div class="acd-log-list" tabindex="0" role="region" aria-label="审批记录">${cardsHTML(activeRecord)}</div>`;
        } else if (panelKind === 'graph') {
            body.innerHTML = graphHTML(activeRecord);
            body.scrollLeft = Math.max(0, (body.scrollWidth - body.clientWidth) / 2);
        } else if (panelKind === 'history') {
            body.innerHTML = `<div class="acd-history-tabs" role="tablist" aria-label="历史版本详情"><button type="button" role="tab" aria-selected="${historyTab === 'form'}" data-history-tab="form">表单内容</button><button type="button" role="tab" aria-selected="${historyTab === 'process'}" data-history-tab="process">审批流程</button></div><div class="acd-history-content" role="tabpanel"></div>`;
            const content = body.querySelector('.acd-history-content');
            if (historyTab === 'form') renderReadonlyForm(content, activeRecord);
            else content.innerHTML = timeline(activeRecord);
        }
    }
    sidebar.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'content-toggle') return toggleContent();
        if (action === 'link') return openLinkModal();
        const record = forms().find(r => r.id === button.closest('[data-record]').dataset.record);
        if (action === 'toggle') {
            if (expanded.has(record.id)) expanded.delete(record.id); else expanded.add(record.id);
            render();
            sidebar.querySelector(`[data-record="${record.id}"] [data-action="toggle"]`).focus({ preventScroll: true });
        } else if (action === 'remove') {
            if (!window.confirm('确定要移除该手动关联的表单吗？移除仅解除关联，不删除原表单及审批记录。')) return;
            currentDetailItem.relatedForms = currentDetailItem.relatedForms.filter(r => r.id !== record.id);
            expanded.delete(record.id);
            if (selectedContentRecord?.id === record.id) selectContentRecord(currentDetailItem);
            render();
            sidebar.querySelector('[data-action="link"]').focus({ preventScroll: true });
            showToast('已移除关联');
        } else if (action === 'view') selectContentRecord(record);
        else openPanel(action, record);
    });
    overlay.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (event.target === overlay || action === 'close') return closePanel();
        const tab = event.target.closest('[data-history-tab]')?.dataset.historyTab;
        if (tab) { historyTab = tab; renderPanel(); overlay.querySelector(`[data-history-tab="${tab}"]`).focus(); }
    });
    overlay.addEventListener('change', event => {
        if (event.target.name !== 'acd-log-sort') return;
        descending = event.target.value === 'desc';
        const list = overlay.querySelector('.acd-log-list');
        list.innerHTML = cardsHTML(activeRecord);
        list.scrollTop = 0;
    });
    document.addEventListener('keydown', event => {
        const panelOpen = overlay.style.display === 'flex';
        const relatedOpen = relatedViews.length > 0;
        const linkOpen = linkModal.style.display === 'flex';
        const returnOpen = document.getElementById('return-modal').style.display !== 'none';
        if (event.key === 'Escape' && !returnOpen && (panelOpen || relatedOpen || linkOpen || detail.style.display === 'flex')) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (panelOpen) closePanel(); else if (relatedOpen) closeRelated(); else if (linkOpen) closeLinkModal(); else closeDetailModal();
        } else if (event.key === 'Tab' && !(panelOpen && ['graph', 'logs'].includes(panelKind)) && (panelOpen || relatedOpen || linkOpen)) {
            const surface = panelOpen ? overlay : relatedOpen ? relatedDrawer : linkModal;
            const targets = [...surface.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length);
            if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0].focus(); }
        }
    }, true);
    window.approvalDetail = {
        render, toggleContent, renderPersonnelForm, renderOperationLogs, renderReadonlyForm, saveVersion, contentRecord,
        isRelatedContent() { return selectedContentRecord !== null; },
        open(item) {
            selectedContentRecord = null;
            detail.classList.remove('acd-launch-behind');
            overlay.style.display = 'none'; relatedDrawer.style.display = 'none'; linkModal.style.display = 'none';
            relatedViews.length = 0; relatedDrawer.inert = false; linkModal.inert = false; detail.inert = false;
            returnFocus = document.activeElement;
            expanded = defaultExpanded(item);
            const list = sidebar.querySelector('.acd-progress-list');
            if (list) list.scrollTop = 0;
            toggleContent(false);
        },
        close() {
            selectedContentRecord = null;
            detail.classList.remove('acd-launch-behind');
            overlay.style.display = 'none'; relatedDrawer.style.display = 'none'; linkModal.style.display = 'none';
            relatedViews.length = 0; relatedDrawer.inert = false; linkModal.inert = false; detail.inert = false;
            if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        }
    };
}());
