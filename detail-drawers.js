(function () {
    'use strict';

    const detail = document.getElementById('detail-modal');
    const sidebar = document.getElementById('approval-progress-panel');
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
    const candidates = [
        { id: 'manual-annual', title: '人员年度能力复评记录', relation: '手动关联', status: '已驳回', startTime: '2026-09-28 09:00:00', initiator: '李何02', fields: [['评估年度', '2026年'], ['评估人', '李何02']], flowNodes: [
            { name: '发起审批', status: 'done', user: '李何02', time: '2026-09-28 09:00:00' },
            { name: '质量主管审核', status: 'rejected', user: '王主任', time: '2026-09-28 10:00:00' }
        ], approvalDetails: [{ nodeName: '质量主管审核', user: '王主任', time: '2026-09-28 10:00:00', comment: '请补充质量控制考核材料。', action: 'reject', actionName: '驳回' }] }
    ];
    function forms() { return [{ ...currentDetailItem, relation: '主表单' }, ...(currentDetailItem.relatedForms || [])]; }
    function statusClass(record) {
        return ['已通过', '已完成'].includes(record.status) ? 'done' : record.status === '进行中' ? 'active' : record.status === '未发起' ? 'unstarted' : 'rejected';
    }
    function badge(record) { return `<span class="acd-status ${statusClass(record)}">${esc(record.status)}</span>`; }
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
    function render() {
        if (!currentDetailItem) return;
        const scrollTop = sidebar.querySelector('.acd-progress-list')?.scrollTop || 0;
        const list = forms();
        const collapsed = detail.classList.contains('acd-collapsed');
        sidebar.innerHTML = `<button type="button" class="acd-edge-toggle" data-action="content-toggle" aria-expanded="${!collapsed}" aria-label="${collapsed ? '展开' : '收起'}表单内容" title="${collapsed ? '展开' : '收起'}表单内容">${contentArrow(collapsed)}</button><header class="acd-progress-header"><strong>审批进度</strong><span class="acd-count" role="status">已通过 <b>${list.filter(r => statusClass(r) === 'done').length}/${list.length}</b></span><button type="button" class="acd-text-button acd-link-button" data-action="link" title="关联已有表单">关联已有表单</button></header>
            <div class="acd-progress-list">${list.map((record, index) => `<section class="acd-progress-item ${expanded.has(record.id) ? '' : 'collapsed'}" data-record="${esc(record.id)}">
                <div class="acd-progress-heading"><button type="button" class="acd-toggle" data-action="toggle" aria-expanded="${expanded.has(record.id)}" aria-controls="acd-progress-${esc(record.id)}" aria-label="${expanded.has(record.id) ? '收起' : '展开'}${esc(record.title)}审批进度" title="${expanded.has(record.id) ? '收起' : '展开'}审批进度"><span class="acd-form-label">${index + 1}. ${esc(record.title)} ${badge(record)}</span><span class="acd-fold">${chevron}</span></button>
                <span class="acd-relation">${esc(record.relation)}</span><div class="acd-item-actions"><button type="button" class="acd-text-button" data-action="${record.status === '未发起' ? 'launch' : 'view'}">${record.status === '未发起' ? '发起' : '查看'}</button>${record.relation === '手动关联' ? '<button type="button" class="acd-text-button acd-remove" data-action="remove">移除</button>' : ''}</div></div>
                <div class="acd-progress-body" id="acd-progress-${esc(record.id)}"><div class="acd-progress-tools"><button type="button" class="acd-text-button" data-action="graph" ${record.status === '未发起' ? 'disabled' : ''}>流程图</button><button type="button" class="acd-text-button" data-action="logs" ${record.status === '未发起' ? 'disabled' : ''}>审批日志</button></div><div class="flow-timeline">${timeline(record)}</div></div>
            </section>`).join('')}</div>`;
        sidebar.querySelector('.acd-progress-list').scrollTop = scrollTop;
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
    const overlay = document.createElement('div');
    overlay.id = 'approval-record-drawer';
    overlay.innerHTML = '<section class="acd-panel" role="dialog" aria-modal="true" aria-labelledby="acd-panel-title"><header class="acd-panel-header"><h2 id="acd-panel-title"></h2><span class="acd-header-status"></span><button type="button" class="acd-panel-close" data-action="close" aria-label="关闭" title="关闭">×</button></header><div class="acd-panel-context"></div><div class="acd-panel-body"></div><footer class="acd-panel-footer"><button type="button" class="acd-outline-close" data-action="close">关闭</button></footer></section>';
    document.body.appendChild(overlay);
    function openPanel(kind, record) {
        panelReturnFocus = document.activeElement;
        panelKind = kind;
        activeRecord = record;
        descending = false;
        overlay.dataset.kind = kind;
        overlay.dataset.record = record?.id || '';
        overlay.style.display = 'flex';
        const modal = !['graph', 'logs'].includes(kind);
        detail.inert = modal;
        overlay.querySelector('.acd-panel').setAttribute('aria-modal', String(modal));
        renderPanel();
        overlay.querySelector('[data-action="close"]').focus({ preventScroll: true });
    }
    function closePanel() {
        overlay.style.display = 'none';
        detail.inert = false;
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
        if (record.id === 'related-auth') {
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
            input.disabled = readonly || record.status !== '进行中';
            if (!readonly) input.addEventListener('input', () => {
                record.formValues ||= {};
                record.formValues[index] = input.value;
            });
        });
        return true;
    }
    function renderPanel() {
        const title = { logs: '审批日志', graph: '审批流程图', view: '表单详情', launch: '发起表单', link: '关联已有表单' }[panelKind];
        overlay.querySelector('h2').textContent = panelKind === 'graph' ? activeRecord.title + ' · ' + title : title;
        overlay.querySelector('.acd-header-status').innerHTML = panelKind === 'graph' ? badge(activeRecord) : '';
        overlay.querySelector('.acd-panel-context').innerHTML = activeRecord && panelKind !== 'graph' ? `<span>${esc(activeRecord.title)}</span>${badge(activeRecord)}` : '';
        const body = overlay.querySelector('.acd-panel-body');
        body.scrollTop = 0;
        if (panelKind === 'logs') {
            body.innerHTML = `<div class="acd-log-toolbar"><span>审批详情</span><div role="group" aria-label="根据审批时间排序"><label><input type="radio" name="acd-log-sort" value="asc" checked>正序</label><label><input type="radio" name="acd-log-sort" value="desc">倒序<span>（根据审批时间排序）</span></label></div></div><div class="acd-log-list" tabindex="0" role="region" aria-label="审批记录">${cardsHTML(activeRecord)}</div>`;
        } else if (panelKind === 'graph') {
            body.innerHTML = graphHTML(activeRecord);
            body.scrollLeft = Math.max(0, (body.scrollWidth - body.clientWidth) / 2);
        } else if (panelKind === 'view') {
            if (!renderPersonnelForm(body, activeRecord, true)) body.innerHTML = `<dl class="acd-readonly-fields">${[['表单名称', activeRecord.title], ['发起人', activeRecord.initiator], ['发起时间', activeRecord.startTime], ...(activeRecord.fields || [])].map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>`;
        } else if (panelKind === 'launch') {
            body.innerHTML = `<form id="acd-launch-form"><label>交班人<input name="from" value="${esc(currentDetailItem.initiator)}" required></label><label>接班人<input name="to" required></label><label>交接日期<input name="date" type="date" required></label><label>交接内容<textarea name="content" required></textarea></label><div class="acd-panel-actions"><button type="button" class="acd-text-button" data-action="close">取消</button><button type="submit" class="acd-submit">提交发起</button></div></form>`;
        } else if (panelKind === 'link') {
            body.innerHTML = `<form id="acd-link-form">${candidates.map(r => { const linked = forms().some(f => f.id === r.id); return `<label class="acd-candidate"><input type="checkbox" name="record" value="${esc(r.id)}" ${linked ? 'disabled checked' : ''}><span>${esc(r.title)}<small>${esc(r.status)} · ${esc(r.initiator)} · ${esc(r.startTime)}${linked ? ' · 已关联' : ''}</small></span></label>`; }).join('')}<p class="acd-error" role="alert"></p><div class="acd-panel-actions"><button type="button" class="acd-text-button" data-action="close">取消</button><button type="submit" class="acd-submit">确定关联</button></div></form>`;
        }
    }
    sidebar.addEventListener('click', event => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        if (action === 'content-toggle') return toggleContent();
        if (action === 'link') return openPanel('link', null);
        const record = forms().find(r => r.id === button.closest('[data-record]').dataset.record);
        if (action === 'toggle') {
            if (expanded.has(record.id)) expanded.delete(record.id); else expanded.add(record.id);
            render();
            sidebar.querySelector(`[data-record="${record.id}"] [data-action="toggle"]`).focus({ preventScroll: true });
        } else if (action === 'remove') {
            if (!window.confirm('确定要移除该手动关联的表单吗？移除仅解除关联，不删除原表单及审批记录。')) return;
            currentDetailItem.relatedForms = currentDetailItem.relatedForms.filter(r => r.id !== record.id);
            expanded.delete(record.id);
            render();
            sidebar.querySelector('[data-action="link"]').focus({ preventScroll: true });
            showToast('已移除关联');
        } else if (action === 'view' && record.id === currentDetailItem.id) {
            toggleContent(false);
            const tab = detail.querySelector('.detail-tab-btn');
            switchDetailTab('content', tab);
            tab.focus({ preventScroll: true });
        } else openPanel(action, record);
    });
    overlay.addEventListener('click', event => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (event.target === overlay || action === 'close') return closePanel();
    });
    overlay.addEventListener('change', event => {
        if (event.target.name !== 'acd-log-sort') return;
        descending = event.target.value === 'desc';
        const list = overlay.querySelector('.acd-log-list');
        list.innerHTML = cardsHTML(activeRecord);
        list.scrollTop = 0;
    });
    overlay.addEventListener('submit', event => {
        event.preventDefault();
        const values = new FormData(event.target);
        if (event.target.id === 'acd-launch-form') {
            const now = formatNowTime();
            Object.assign(activeRecord, { status: '进行中', startTime: now, initiator: values.get('from'), fields: [['交班人', values.get('from')], ['接班人', values.get('to')], ['交接日期', values.get('date')], ['交接内容', values.get('content')]], flowNodes: [{ name: '发起审批', status: 'done', user: values.get('from'), time: now }, { name: '接班人审核', status: 'active', user: values.get('to'), time: '' }], approvalDetails: [] });
            expanded = new Set([activeRecord.id]);
            closePanel(); render();
            sidebar.querySelector(`[data-record="${activeRecord.id}"] [data-action="view"]`).focus({ preventScroll: true });
            showToast('已发起，等待接班人审核');
        } else if (event.target.id === 'acd-link-form') {
            const ids = values.getAll('record');
            if (!ids.length) { overlay.querySelector('.acd-error').textContent = '请选择尚未关联的表单'; return; }
            currentDetailItem.relatedForms ||= [];
            candidates.filter(r => ids.includes(r.id) && !forms().some(f => f.id === r.id)).forEach(r => currentDetailItem.relatedForms.push(r));
            closePanel(); render();
            sidebar.querySelector('[data-action="link"]').focus({ preventScroll: true });
            showToast('已关联所选表单');
        }
    });
    document.addEventListener('keydown', event => {
        const panelOpen = overlay.style.display === 'flex';
        const returnOpen = document.getElementById('return-modal').style.display !== 'none';
        if (event.key === 'Escape' && !returnOpen && (panelOpen || detail.style.display === 'flex')) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (panelOpen) closePanel(); else closeDetailModal();
        } else if (event.key === 'Tab' && panelOpen && !['graph', 'logs'].includes(panelKind)) {
            const targets = [...overlay.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, [tabindex="0"]')].filter(el => el.getClientRects().length);
            if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0].focus(); }
        }
    }, true);
    window.approvalDetail = {
        render, toggleContent, renderPersonnelForm,
        open(item) {
            overlay.style.display = 'none'; detail.inert = false;
            returnFocus = document.activeElement;
            const eligible = [{ ...item, relation: '主表单' }, ...(item.relatedForms || [])].filter(r => ['进行中', '已通过', '已完成'].includes(r.status)).sort((a, b) => b.startTime.localeCompare(a.startTime));
            expanded = new Set([(eligible[0] || item).id]);
            toggleContent(false);
        },
        close() {
            overlay.style.display = 'none'; detail.inert = false;
            if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        }
    };
}());
