(function () {
    'use strict';

    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const groups = ['PCR组', '测序组', '形态学组', '医生'];
    const handoverTypes = ['日常交接班', '换岗交接', '休假交接', '其他'];
    const columns = {
        equipment: [['room', '房间号'], ['name', '仪器名称'], ['quantity', '数量'], ['condition', '是否良好'], ['description', '说明']],
        reagents: [['name', '试剂名称'], ['stock', '试剂库存'], ['condition', '是否足够'], ['description', '说明']]
    };
    const storageKey = 'approval-center-related-form-drafts-v1';
    function valuesFrom(value = {}) {
        const result = {};
        ['group', 'date', 'hazard', 'handoverType', 'work', 'other'].forEach(key => { result[key] = String(value[key] ?? ''); });
        result.safety = ['正常安全', '安全隐患描述', ''].includes(value.safety) ? value.safety : '正常安全';
        result.approver = String(value.approver || '李何01');
        for (const kind of Object.keys(columns)) result[kind] = Array.isArray(value[kind]) ? value[kind].map(row => Object.fromEntries(columns[kind].map(([key]) => [key, String(row?.[key] ?? '')]))) : [];
        return result;
    }
    function radioField(name, options, values, readonly) {
        return options.map(value => `<label class="ace-radio"><input type="radio" name="${readonly ? 'readonly-' : ''}${name}" data-editor-field="${name}" value="${esc(value)}" ${values[name] === value ? 'checked' : ''} ${readonly ? 'disabled' : 'required'}>${esc(value)}</label>`).join('');
    }
    function selectOptions(options, selected) {
        return options.map(option => `<option ${option === selected ? 'selected' : ''}>${esc(option)}</option>`).join('');
    }
    function rowHTML(kind, rows, readonly) {
        const definitions = columns[kind];
        if (!rows.length) return `<tr><td colspan="${definitions.length + (readonly ? 0 : 1)}" class="ace-empty">暂无数据</td></tr>`;
        return rows.map((row, index) => `<tr>${definitions.map(([key, label]) => {
            const attributes = `data-editor-table="${kind}" data-editor-index="${index}" data-editor-column="${key}" aria-label="第${index + 1}行${label}" ${readonly ? 'disabled' : ''}`;
            if (key === 'condition') return `<td><select ${attributes}>${selectOptions(kind === 'equipment' ? ['良好', '异常'] : ['足够', '不足'], row[key])}</select></td>`;
            const numeric = ['quantity', 'stock'].includes(key);
            return `<td><input type="${numeric ? 'number' : 'text'}" ${numeric ? 'min="0" step="any"' : ''} ${kind === 'equipment' && key === 'room' ? 'required' : ''} value="${esc(row[key])}" ${attributes}></td>`;
        }).join('')}${readonly ? '' : `<td><button type="button" class="ace-text ace-remove" data-editor-remove="${kind}" data-editor-index="${index}">删除</button></td>`}</tr>`).join('');
    }
    function detailTable(kind, title, values, readonly) {
        return `<section class="ace-field"><h3>${title}</h3>${readonly ? '' : `<button type="button" class="ace-neutral ace-export" data-editor-export="${kind}">导出Excel</button>`}<div class="ace-table-scroll"><table><thead><tr>${columns[kind].map(([key, label]) => `<th>${kind === 'equipment' && key === 'room' ? '<span class="ace-required">*</span> ' : ''}${label}</th>`).join('')}${readonly ? '' : '<th>操作</th>'}</tr></thead><tbody data-editor-rows="${kind}">${rowHTML(kind, values[kind], readonly)}</tbody></table></div>${readonly ? '' : `<button type="button" class="ace-outline ace-add" data-editor-add="${kind}">新增行</button>`}</section>`;
    }
    function formHTML(values, readonly = false) {
        const disabled = readonly ? 'disabled' : '';
        return `<div class="ace-form-content">
            <section class="ace-field"><h3><span class="ace-required">*</span> 专业组</h3><div class="ace-choice-row">${radioField('group', groups, values, readonly)}${readonly ? '' : '<button type="button" class="ace-text ace-clear" data-editor-clear="group">清空</button>'}</div></section>
            <label class="ace-field ace-block"><span class="ace-label"><span class="ace-required">*</span> 日期：</span><input type="datetime-local" data-editor-field="date" value="${esc(values.date)}" required ${disabled}></label>
            <div class="ace-safety-grid"><section class="ace-field"><h3><span class="ace-required">*</span> 水、电、空调、门窗、防火安全情况安全情况</h3><div class="ace-choice-row">${radioField('safety', ['正常安全', '安全隐患描述'], values, readonly)}${readonly ? '' : '<button type="button" class="ace-text ace-clear" data-editor-clear="safety">清空</button>'}</div></section><label class="ace-field ace-block"><span class="ace-label">水、电、空调、门窗、防火安全情况安全隐患描述</span><textarea data-editor-field="hazard" placeholder="有安全隐患请填写" ${values.safety === '安全隐患描述' ? 'required' : ''} ${disabled}>${esc(values.hazard)}</textarea></label></div>
            ${detailTable('equipment', '仪器设备运行状况', values, readonly)}
            <label class="ace-field ace-block"><span class="ace-label"><span class="ace-required">*</span> 换岗类型：</span><select data-editor-field="handoverType" required ${disabled}><option value="">请选择</option>${selectOptions(handoverTypes, values.handoverType)}</select></label>
            ${detailTable('reagents', '试剂耗材状况', values, readonly)}
            <label class="ace-field ace-block"><span class="ace-label">工作交接记录</span><textarea data-editor-field="work" ${disabled}>${esc(values.work)}</textarea></label>
            <label class="ace-field ace-block"><span class="ace-label">其他说明</span><textarea data-editor-field="other" ${disabled}>${esc(values.other)}</textarea></label>
        </div>`;
    }
    function readDrafts() {
        try {
            const value = JSON.parse(localStorage.getItem(storageKey) || '[]');
            return Array.isArray(value) ? value.filter(draft => draft && typeof draft.key === 'string' && draft.values && typeof draft.values === 'object') : [];
        } catch { return []; }
    }
    function exportTable(kind, rows, title) {
        const ns = 'urn:schemas-microsoft-com:office:spreadsheet';
        const documentXML = document.implementation.createDocument(ns, 'Workbook');
        documentXML.insertBefore(documentXML.createProcessingInstruction('mso-application', 'progid="Excel.Sheet"'), documentXML.documentElement);
        const worksheet = documentXML.createElementNS(ns, 'Worksheet');
        worksheet.setAttributeNS(ns, 'ss:Name', kind === 'equipment' ? '仪器设备运行状况' : '试剂耗材状况');
        const table = documentXML.createElementNS(ns, 'Table');
        const data = [columns[kind].map(([, label]) => label), ...rows.map(row => columns[kind].map(([key]) => row[key]))];
        data.forEach(values => {
            const row = documentXML.createElementNS(ns, 'Row');
            values.forEach(value => {
                const cell = documentXML.createElementNS(ns, 'Cell');
                const data = documentXML.createElementNS(ns, 'Data');
                data.setAttributeNS(ns, 'ss:Type', 'String'); data.textContent = value;
                cell.appendChild(data); row.appendChild(cell);
            });
            table.appendChild(row);
        });
        worksheet.appendChild(table); documentXML.documentElement.appendChild(worksheet);
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(documentXML)], { type: 'application/vnd.ms-excel;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `${title}-${worksheet.getAttributeNS(ns, 'Name')}.xml`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    window.createRelatedFormEditor = function ({ host, onSubmit, onClose, notify }) {
        let record;
        let owner;
        let values;
        let tab = 'form';
        let drafts = [];
        let draftKey;
        let submitting = false;
        function matchingDrafts() { return drafts.filter(draft => draft.key === draftKey); }
        function persistDrafts(next) {
            try { localStorage.setItem(storageKey, JSON.stringify(next)); drafts = next; return true; }
            catch { notify('草稿保存失败，请检查浏览器存储空间', 'error'); return false; }
        }
        function render() {
            host.querySelector('h2').textContent = record.title;
            host.querySelector('.acd-header-status').innerHTML = '';
            host.querySelector('.acd-panel-context').innerHTML = '';
            const body = host.querySelector('.acd-panel-body');
            body.innerHTML = `<div class="ace-tabs" role="tablist" aria-label="发起表单"><button type="button" role="tab" aria-selected="${tab === 'form'}" data-editor-tab="form">表单内容</button><button type="button" role="tab" aria-selected="${tab === 'process'}" data-editor-tab="process">审批流程</button></div><div class="ace-body"></div>`;
            const content = body.querySelector('.ace-body');
            if (tab === 'drafts') {
                content.innerHTML = `<h3 class="ace-draft-title">草稿箱</h3><div class="ace-table-scroll"><table><thead><tr><th>表单名称</th><th>保存时间</th><th>操作</th></tr></thead><tbody>${matchingDrafts().map(draft => `<tr><td>${esc(draft.title)}</td><td>${esc(draft.savedAt)}</td><td><button type="button" class="ace-text" data-editor-resume>继续编辑</button><button type="button" class="ace-text ace-remove" data-editor-delete-draft>删除</button></td></tr>`).join('') || '<tr><td colspan="3" class="ace-empty">暂无草稿</td></tr>'}</tbody></table></div>`;
            } else {
                content.innerHTML = `<form id="acd-launch-form"><div ${tab === 'form' ? '' : 'hidden'}>${formHTML(values)}</div><div class="ace-flow" ${tab === 'process' ? '' : 'hidden'}><section><h3>发起人</h3><p>${esc(owner.initiator)}</p></section><div class="ace-flow-line"></div><section><h3>接班人审核</h3><label><span>审批人</span><select data-editor-field="approver" aria-label="接班人审核审批人" required>${selectOptions(['李何01', '李何02', '王主任'], values.approver)}</select></label></section><div class="ace-flow-line"></div><section><h3>结束</h3></section></div></form>`;
            }
            host.querySelector('.acd-panel-footer').innerHTML = `<button type="button" class="ace-outline ace-draft-button" data-editor-drafts>草稿箱(${matchingDrafts().length})</button><div class="ace-footer-actions"><button type="button" class="ace-primary" data-editor-submit>提交</button><button type="button" class="ace-outline" data-editor-save>保存草稿</button><button type="button" class="ace-neutral" data-editor-cancel>取消</button></div>`;
        }
        function updateValues(event) {
            if (host.dataset.kind !== 'launch') return;
            const input = event.target;
            if (input.dataset.editorField) values[input.dataset.editorField] = input.value;
            if (input.dataset.editorTable) values[input.dataset.editorTable][Number(input.dataset.editorIndex)][input.dataset.editorColumn] = input.value;
            const hazard = host.querySelector('[data-editor-field="hazard"]');
            if (hazard) hazard.required = values.safety === '安全隐患描述';
        }
        host.addEventListener('input', updateValues);
        host.addEventListener('change', updateValues);
        host.addEventListener('click', event => {
            if (host.dataset.kind !== 'launch') return;
            const button = event.target.closest('button');
            if (!button) return;
            if (button.dataset.editorTab) { tab = button.dataset.editorTab; render(); host.querySelector(`[data-editor-tab="${tab}"]`).focus(); }
            else if (button.hasAttribute('data-editor-cancel')) onClose();
            else if (button.hasAttribute('data-editor-drafts')) { tab = 'drafts'; render(); }
            else if (button.hasAttribute('data-editor-resume')) { values = valuesFrom(matchingDrafts()[0].values); tab = 'form'; render(); }
            else if (button.hasAttribute('data-editor-delete-draft')) {
                if (window.confirm('确定删除该草稿吗？') && persistDrafts(drafts.filter(draft => draft.key !== draftKey))) render();
            } else if (button.hasAttribute('data-editor-save')) {
                if (persistDrafts([...drafts.filter(draft => draft.key !== draftKey), { key: draftKey, title: record.title, savedAt: formatNowTime(), values: structuredClone(values) }])) {
                    host.querySelector('[data-editor-drafts]').textContent = '草稿箱(1)'; notify('草稿已保存');
                }
            } else if (button.hasAttribute('data-editor-submit')) {
                tab = 'form'; render();
                const form = host.querySelector('#acd-launch-form');
                if (form.reportValidity()) form.requestSubmit();
            } else if (button.dataset.editorClear) {
                values[button.dataset.editorClear] = ''; render();
            } else if (button.dataset.editorAdd || button.dataset.editorRemove) {
                const kind = button.dataset.editorAdd || button.dataset.editorRemove;
                if (button.dataset.editorAdd) values[kind].push(Object.fromEntries(columns[kind].map(([key]) => [key, key === 'condition' ? kind === 'equipment' ? '良好' : '足够' : ''])));
                else values[kind].splice(Number(button.dataset.editorIndex), 1);
                host.querySelector(`[data-editor-rows="${kind}"]`).innerHTML = rowHTML(kind, values[kind], false);
                if (button.dataset.editorAdd) host.querySelector(`[data-editor-rows="${kind}"] tr:last-child input`).focus();
            } else if (button.dataset.editorExport) exportTable(button.dataset.editorExport, values[button.dataset.editorExport], record.title);
        });
        host.addEventListener('submit', event => {
            if (host.dataset.kind !== 'launch' || event.target.id !== 'acd-launch-form') return;
            event.preventDefault();
            if (submitting || !event.target.reportValidity()) return;
            submitting = true;
            if (matchingDrafts().length) persistDrafts(drafts.filter(draft => draft.key !== draftKey));
            onSubmit(record, structuredClone(values));
        });
        return {
            open(selectedRecord, parent) {
                record = selectedRecord; owner = parent; draftKey = parent.id + '/' + record.id;
                drafts = readDrafts(); values = valuesFrom(matchingDrafts()[0]?.values); tab = 'form'; submitting = false;
            },
            render
        };
    };
    window.renderRelatedEditorValues = function (container, record) {
        if (!record.editorValues) return false;
        container.innerHTML = formHTML(valuesFrom(record.editorValues), true);
        return true;
    };
}());
