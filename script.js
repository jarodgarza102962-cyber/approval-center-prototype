/* ============================================================
   审批中心 - 核心业务逻辑 (v2)
   1. 支持表单分类模式
   2. 自定义列弹窗 (左右两栏)
   3. localStorage 持久化
   4. 列宽拖拽调整
   ============================================================ */

// ====================================================
// 1. 数据定义
// ====================================================

const FORM_FIELD_DEFS = {
    '岗位交接班记录zz': [
        { key: 'f_dept', label: '所在科室' },
        { key: 'f_pos', label: '岗位名称' },
        { key: 'f_handover', label: '交班人' },
        { key: 'f_receiver', label: '接班人' },
        { key: 'f_time', label: '交班时间' },
        { key: 'f_status', label: '正常安全' },
        { key: 'f_desc', label: '隐患说明' }
    ],
    '病理科人员能力评估表-医师系列': [
        { key: 'f_user', label: '评估人' },
        { key: 'f_level', label: '职级' },
        { key: 'f_score', label: '评分' },
        { key: 'f_result', label: '结果' }
    ],
    '供应商评价表': [
        { key: 'f_vendor', label: '供应商' },
        { key: 'f_type', label: '类型' },
        { key: 'f_phone', label: '电话' },
        { key: 'f_quality', label: '质量等级' }
    ],
    '文件修订申请表': [
        { key: 'f_doc_no', label: '文件编号' },
        { key: 'f_doc_name', label: '文件名称' },
        { key: 'f_reason', label: '修订原因' }
    ]
};

// 通用固定列 (不可取消)
const FIXED_COLS = {
    pending: ['title', 'duration', 'ops'],
    mine: ['title', 'ops'],
    done: ['title', 'ops'],
    cc: ['title', 'ops']
};

// 预设通用列 (可选)
const COMMON_OPTIONAL_COLS = [
    { key: 'preview', label: '内容预览' },
    { key: 'status', label: '审批状态' },
    { key: 'duration', label: '处理时长' }, // 新增：处理时长
    { key: 'startTime', label: '发起时间' },
    { key: 'finishTime', label: '操作时间' },
    { key: 'group', label: '分组名称' },
    { key: 'node', label: '当前节点' },
    { key: 'initiator', label: '发起人' },
    { key: 'version', label: '流程版本号' }
];

// 全局配置：超时标红天数 (默认3天)
let RED_WARNING_DAYS = 3;

// ====================================================
// 2. 核心配置: 业务字典样式映射
// ====================================================

/**
 * 结构：{ 表单名称: { 字段Key: { 业务值: 样式表现 } } }
 */
const FIELD_STYLE_MAP = {
    '病理科人员能力评估表-医师系列': {
        'f_result': {
            '优秀': { className: 'dict-badge-blue' },
            '良好': { className: 'dict-badge-green' },
            '合格': { className: 'dict-badge-yellow' },
            '不合格': { className: 'dict-badge-red' }
        }
    }
};

// 时间格式化辅助函数
function formatNowTime() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Mock Data Factory
function generateData(count, tabPrefix, types) {
    const list = [];
    const initiators = ['李何02', '李何01', '张三', '王五', '李四'];
    const nodes = ['考核小组', '考核负责人', '科主任审批', '质量小组'];

    for (let i = 1; i <= count; i++) {
        const type = types[i % types.length];
        const status = tabPrefix === 'pending' ? '进行中' : i % 5 === 0 ? '已撤回' : i % 7 === 0 ? '已驳回' : i % 2 === 0 ? '已通过' : '进行中';

        let arrivalDate = new Date();
        if (i % 5 === 0) arrivalDate.setDate(arrivalDate.getDate() - 5);
        else if (i % 3 === 0) arrivalDate.setDate(arrivalDate.getDate() - 3);
        else arrivalDate.setDate(arrivalDate.getDate() - 1);

        const initiatorName = initiators[i % initiators.length];
        const currentNodeName = nodes[i % nodes.length];

        const item = {
            id: `${tabPrefix}-${i}`,
            title: type,
            status: status,
            startTime: `2026-09-${10 + (i % 15)} 10:20:30`,
            arrivalNodeTime: arrivalDate.toISOString(),
            group: 'CNAS演示表单',
            node: currentNodeName,
            initiator: initiatorName,
            supportsPdf: i % 4 !== 0,
            isJoint: (i % 4 === 0),
            currentNodeKey: currentNodeName,
            flowNodes: [
                { key: '发起审批', name: '发起审批', status: 'done', user: initiatorName, time: `2026-09-${10 + (i % 15)} 10:20:30`, type: 'single' },
                { key: '考核小组', name: '考核小组', status: currentNodeName === '考核小组' ? 'active' : 'done', users: ['李何02', '高溪'], time: `2026-09-${10 + (i % 15)} 14:31:00`, type: 'or', desc: '2人 或签' },
                { key: '考核负责人', name: '考核负责人', status: currentNodeName === '考核负责人' ? 'active' : 'pending', users: ['李何02', '高溪', '高溪'], time: '', type: 'or', desc: '3人 或签' }
            ],
            approvalDetails: [
                { id: 1, nodeName: '考核小组', user: '李何02', time: `2026-09-${10 + (i % 15)} 14:31:00`, comment: '通过', action: 'agree', actionName: '同意' }
            ],
            logs: [
                { user: initiatorName, action: '发起审批', comment: '-', time: `2026-09-${10 + (i % 15)} 10:20:30` }
            ],
            formData: {
                name: initiatorName,
                job: '',
                timing: '1新人员上岗',
                rows: [
                    { pos: '取材助理', content: '分派的岗位介绍、岗位职责等', date: '', method: '口头提问', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '组织标本检查和取材操作流程，取材工具的使用《取材后剩余标本储存、处理作业指导书》', date: '', method: '理论考核及实践操作', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '手术大标本规范化剖开及固定作业指导书', date: '', method: '理论考核', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '头部及乳腺肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '消化系统肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '女性生殖系统肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '男性及泌尿系统取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '肺及纵隔肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
                    { pos: '取材助理', content: '骨与软组织肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' }
                ],
                summaryChoice: '',
                summaryText: '请填写存在的问题及针对性培训要求',
                evaluator: '',
                evalDate: ''
            }
        };

        if (status === '已通过') {
            item.node = '审批完成';
            item.flowNodes.forEach(node => { node.status = 'done'; node.time ||= item.startTime; });
        } else if (status === '已撤回') {
            item.node = '-';
            item.flowNodes.forEach((node, index) => { node.status = index ? 'pending' : 'done'; });
        } else if (status === '已驳回') {
            const rejected = item.flowNodes.find(node => node.key === item.currentNodeKey) || item.flowNodes.at(-1);
            item.currentNodeKey = rejected.key; item.node = '-';
            item.flowNodes.forEach(node => { node.status = node === rejected ? 'rejected' : 'done'; });
            item.approvalDetails = item.approvalDetails.filter(log => log.nodeName !== rejected.name);
            item.approvalDetails.push({ nodeName: rejected.name, user: '李何02', time: item.startTime, comment: '请补充考核材料。', action: 'reject', actionName: '驳回' });
        }

        if (type === '岗位交接班记录zz') {
            item.preview = '岗位:内科;接班人:张三';
            item.f_dept = '内科'; item.f_pos = '值班岗'; item.f_handover = '王五'; item.f_receiver = '张三';
        } else if (type === '病理科人员能力评估表-医师系列') {
            const results = ['优秀', '良好', '合格', '不合格'];
            const res = results[i % results.length];
            item.preview = `评估人:医师${i}; 结果:${res}`;
            item.f_user = `医师${i}`; item.f_level = '主治医师'; item.f_score = 90 - i; item.f_result = res;
        } else if (type === '供应商评价表') {
            item.preview = '供应商A; 质量:优';
            item.f_vendor = '供应商A'; item.f_type = '试剂'; item.f_quality = '优';
        } else if (type === '文件修订申请表') {
            item.preview = '修订质控标准文档';
            item.f_doc_no = `QC-00${i}`; item.f_doc_name = '化验标准'; item.f_reason = '版本更新';
        }

        list.push(item);
    }
    return list;
}

const FORM_TYPES = [
    '岗位交接班记录zz',
    '病理科人员能力评估表-医师系列',
    '供应商评价表',
    '文件修订申请表'
];

// 创建与用户截图完全一致的典型测试单
const targetSpecialItem = {
    id: 'special-tab-359',
    title: '取材助理-XZ-BLK-TAB-359员工培训及能力评估表2-岗位技能类',
    status: '进行中',
    startTime: '2026-09-30 15:51:12',
    arrivalNodeTime: new Date(Date.now() - 3600 * 1000 * 9).toISOString(),
    group: 'CNAS演示表单',
    node: '考核负责人',
    initiator: '李何02',
    version: 1,
    preview: '分派的岗位介绍、岗位职责等',
    isJoint: true,
    currentNodeKey: '考核负责人',
    flowNodes: [
        { key: '发起审批', name: '发起审批', status: 'done', user: '李何01', time: '2026-09-07 14:31:12', type: 'single' },
        { key: '考核小组', name: '考核小组', status: 'done', users: ['李何02', '高溪'], time: '2026-09-07 14:31:53', type: 'or', desc: '2人 或签' },
        { key: '考核负责人', name: '考核负责人', status: 'active', users: ['李何02', '高溪', '高溪'], time: '', type: 'or', desc: '3人 或签' }
    ],
    approvalDetails: [
        { id: 1, nodeName: '考核小组', user: '李何02', time: '2026-09-07 14:31:53', comment: '111', action: 'agree', actionName: '同意' }
    ],
    logs: [
        { user: '李何01', action: '发起审批', comment: '-', time: '2026-09-07 14:31:12' },
        { user: '李何02', action: '考核小组审批', comment: '111', time: '2026-09-07 14:31:53' }
    ],
    formData: {
        name: '李何02',
        job: '',
        timing: '1新人员上岗',
        rows: [
            { pos: '取材助理', content: '分派的岗位介绍、岗位职责等', date: '', method: '口头提问', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '组织标本检查和取材操作流程，取材工具的使用《取材后剩余标本储存、处理作业指导书》', date: '', method: '理论考核及实践操作', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '手术大标本规范化剖开及固定作业指导书', date: '', method: '理论考核', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '头部及乳腺肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '消化系统肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '女性生殖系统肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '男性及泌尿系统取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '肺及纵隔肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' },
            { pos: '取材助理', content: '骨与软组织肿瘤取材规范', date: '', method: '实践操作', checkDate: '', result: '', checker: '', remark: '' }
        ],
        summaryChoice: '',
        summaryText: '请填写存在的问题及针对性培训要求',
        evaluator: '',
        evalDate: ''
    }
};

const DATA = {
    mine: generateData(95, 'mine', FORM_TYPES),
    pending: [targetSpecialItem, ...generateData(69, 'pending', FORM_TYPES)],
    done: generateData(120, 'done', FORM_TYPES),
    cc: generateData(4, 'cc', FORM_TYPES)
};


// ====================================================
// 2. 状态管理
// ====================================================

let currentTab = 'pending';
let selectedRecordId = null;
let detailContextTab = null;
let currentFormType = '';      // 主列表：'' 表示全部表单
let currentBatchFormType = ''; // 批量列表：'' 表示全部表单
let colConfigs = {};           // { key: { keys: [], widths: {} } }
let modalContext = 'main';     // 'main' 或 'batch'

// 排序状态
let currentSort = {
    key: '',
    order: 'asc' // 'asc' or 'desc'
};

const getStorageKey = (tab, formType, isBatch = false) => {
    const prefix = isBatch ? 'batch_' : '';
    return `v2_approval_cols_${prefix}${tab}_${formType || 'all'}`;
};

// ====================================================
// 3. 初始化与核心监听
// ====================================================

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    switchTab('pending');
    initDragHandle();
    document.getElementById('table-body').addEventListener('click', event => {
        if (event.target.closest('button, a, input, select, textarea, label')) return;
        const row = event.target.closest('tr[data-record-id]');
        if (!row) return;
        markSelectedRecord(row.dataset.recordId);
        if (document.getElementById('detail-modal').style.display === 'flex') openDetail(row.dataset.recordId);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const returnModal = document.getElementById('return-modal');
            if (returnModal && returnModal.style.display !== 'none') {
                closeReturnModal();
            }
        }
    });

    const detailModal = document.getElementById('detail-modal');
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target.id === 'detail-modal') {
                closeDetailModal();
            }
        });
    }
});

// 切换顶层 Tab (待处理/已审批...)
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.id === 'tab-' + tab));

    // 控制不同 Tab 的筛选栏显示
    document.getElementById('filter-bar-pending').classList.toggle('hidden', tab !== 'pending');
    document.getElementById('filter-bar-mine').classList.toggle('hidden', tab !== 'mine');
    document.getElementById('filter-bar-done').classList.toggle('hidden', tab !== 'done');
    document.getElementById('filter-bar-cc').classList.toggle('hidden', tab !== 'cc');

    renderTable();
}

// 切换具体表单类型 (主列表)
function onFormTypeChange(type) {
    currentFormType = type;
    renderTable();
}

// 切换具体表单类型 (批量列表)
function onBatchFormTypeChange(type) {
    currentBatchFormType = type;
    renderBatchTable();
}

// ====================================================
// 4. 表格渲染逻辑
// ====================================================

function renderTable() {
    const config = getActiveColConfig('main');
    let cols = [...config.keys];

    // ★ 强制：将 ops 固定在最后一列
    const opsIdx = cols.indexOf('ops');
    if (opsIdx > -1) {
        cols.splice(opsIdx, 1);
        cols.push('ops');
    }

    const widths = config.widths || {};
    const thead = document.getElementById('table-head');
    const tbody = document.getElementById('table-body');

    // 生成表头
    let headHtml = '<tr>';
    cols.forEach(key => {
        const label = getLabel(key);
        const w = widths[key] ? `style="width:${widths[key]}px"` : '';
        const sortIcon = (currentSort.key === key) ? (currentSort.order === 'asc' ? ' ↑' : ' ↓') : '';

        headHtml += `<th data-col="${key}" ${w} onclick="toggleSort('${key}')">
            <div class="th-content">${label}${sortIcon}</div>
            <div class="col-resizer" onclick="event.stopPropagation()"></div>
        </th>`;
    });
    headHtml += '</tr>';
    thead.innerHTML = headHtml;

    // 过滤数据
    let data = DATA[currentTab] || [];
    if (currentTab === 'pending' && currentFormType) {
        data = data.filter(r => r.title === currentFormType);
    }

    // 排序数据
    if (currentSort.key) {
        data = [...data].sort((a, b) => {
            let valA = a[currentSort.key] || '';
            let valB = b[currentSort.key] || '';

            // 对处理时长（基于 arrivalNodeTime）进行特殊数值排序
            if (currentSort.key === 'duration' && a.arrivalNodeTime && b.arrivalNodeTime) {
                valA = new Date(a.arrivalNodeTime).getTime();
                valB = new Date(b.arrivalNodeTime).getTime();
            }

            if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // 生成行
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;color:#999;padding:40px">暂无记录</td></tr>`;
        document.getElementById('total-count').textContent = '0';
        if (document.getElementById('detail-modal').style.display === 'flex') closeDetailModal();
        return;
    }

    tbody.innerHTML = data.map(row => `
        <tr data-record-id="${row.id}" aria-selected="${row.id === selectedRecordId}">
            ${cols.map(key => `<td>${getCellHtml(key, row)}</td>`).join('')}
        </tr>
    `).join('');

    document.getElementById('total-count').textContent = data.length;
    if (document.getElementById('detail-modal').style.display === 'flex') {
        const selected = data.find(row => row.id === selectedRecordId) || data[0];
        if (selected.id !== currentDetailItem?.id || detailContextTab !== currentTab) openDetail(selected.id);
    }
}

function markSelectedRecord(id) {
    selectedRecordId = id;
    document.querySelectorAll('#table-body tr[data-record-id]').forEach(row => {
        row.setAttribute('aria-selected', String(row.dataset.recordId === id));
    });
}

function getLabel(key) {
    if (key === 'title') return '标题';
    if (key === 'ops') return '操作';
    if (key === 'checkbox') return '<input type="checkbox" id="batch-check-all" onchange="batchSelectAll(this.checked)">';
    // 查找业务字段
    for (let fType in FORM_FIELD_DEFS) {
        let field = FORM_FIELD_DEFS[fType].find(f => f.key === key);
        if (field) return field.label;
    }
    // 查找通用可选列
    let common = COMMON_OPTIONAL_COLS.find(c => c.key === key);
    return common ? common.label : key;
}

function getCellHtml(key, row) {
    const val = row[key] || '-';

    // ★ 拦截业务字典样式
    const formTitle = row.title;
    if (FIELD_STYLE_MAP[formTitle] && FIELD_STYLE_MAP[formTitle][key]) {
        const styleConfig = FIELD_STYLE_MAP[formTitle][key][val];
        if (styleConfig) {
            return `<span class="dict-badge ${styleConfig.className}">${val}</span>`;
        }
    }

    if (key === 'checkbox') return `<input type="checkbox" class="batch-cb">`;
    if (key === 'title') return `<a href="#" class="link-primary" onclick="openDetail('${row.id}');return false;">${val}</a>`;
    if (key === 'status') {
        const cls = val === '进行中' ? 'badge-progressing' : (['已通过', '审批完成'].includes(val) ? 'badge-passed' : val === '已撤回' ? 'badge-withdrawn' : 'badge-rejected');
        return `<span class="status-badge ${cls}">${val}</span>`;
    }
    if (key === 'ops') {
        const process = currentTab === 'pending' && row.status === '进行中';
        const pdf = row.supportsPdf !== false && row.source !== 'pane-ltab-content';
        const mineAction = currentTab === 'mine' ? row.status === '已撤回'
            ? `<button class="op-btn acd-row-danger" onclick="deleteRecord('${row.id}')">删除</button>`
            : `<button class="op-btn" onclick="withdrawRecord('${row.id}')">撤回</button>` : '';
        return `<div class="op-group"><button class="op-btn" onclick="openDetail('${row.id}')">${process ? '处理' : '查看'}</button>${pdf ? '<button class="op-btn" onclick="showToast(\'正在打开PDF预览...\')">PDF预览</button>' : ''}${mineAction}</div>`;
    }

    // 处理时长逻辑
    if (key === 'duration' && currentTab === 'pending') {
        if (!row.arrivalNodeTime) return '-';
        const now = new Date();
        const arrival = new Date(row.arrivalNodeTime);
        const diffMs = now - arrival;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        const text = `${diffDays}天 ${diffHrs}小时`;
        const jointMark = row.isJoint ? `<span style="font-size:10px; color:#1890ff; display:block;">[多人会签]</span>` : '';

        return `<div style="line-height:1.2;">
            <span>${text}</span>
            ${jointMark}
        </div>`;
    }

    return val;
}

// ====================================================
// 5. 自定义列弹窗逻辑
// ====================================================

let modalTempKeys = [];

function openCustomColModal() {
    modalContext = 'main';
    const config = getActiveColConfig('main');
    modalTempKeys = [...config.keys];
    renderModalList();
    document.getElementById('custom-col-modal').style.display = 'flex';
}

function openBatchCustomColModal() {
    modalContext = 'batch';
    const config = getActiveColConfig('batch');
    modalTempKeys = [...config.keys];
    renderModalList();
    document.getElementById('custom-col-modal').style.display = 'flex';
}

function closeCustomColModal() {
    document.getElementById('custom-col-modal').style.display = 'none';
}

function renderModalList() {
    const leftList = document.getElementById('col-field-list');
    const rightList = document.getElementById('col-selected-list');
    const searchVal = document.getElementById('col-search').value.toLowerCase();

    const formType = (modalContext === 'main') ? currentFormType : currentBatchFormType;
    const fixed = (modalContext === 'main') ? FIXED_COLS[currentTab] : ['checkbox', 'title'];

    // 确定所有候选列
    let available = [];
    if (currentTab === 'pending' && formType) {
        available = [...COMMON_OPTIONAL_COLS, ...(FORM_FIELD_DEFS[formType] || [])];
    } else {
        available = [...COMMON_OPTIONAL_COLS];
    }

    // 左侧渲染
    leftList.innerHTML = available
        .filter(c => c.label.toLowerCase().includes(searchVal))
        .map(c => {
            const isChecked = modalTempKeys.includes(c.key);
            return `<div class="col-field-item ${isChecked ? 'checked' : ''}" onclick="toggleModalKey('${c.key}')">
                <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation();toggleModalKey('${c.key}')">
                <span>${c.label}</span>
            </div>`;
        }).join('');

    // 右侧渲染 (已选)
    rightList.innerHTML = modalTempKeys.map(key => {
        const isFixed = fixed.includes(key);
        return `<div class="col-selected-item ${isFixed ? 'fixed-col' : ''}">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span>${getLabel(key)}</span>
        </div>`;
    }).join('');

    document.getElementById('col-checked-count').textContent = modalTempKeys.length;
    document.getElementById('col-total-count').textContent = available.length + fixed.length;
    document.getElementById('col-selected-count').textContent = modalTempKeys.length;
}

function toggleModalKey(key) {
    const fixed = (modalContext === 'main') ? FIXED_COLS[currentTab] : ['checkbox', 'title'];
    if (fixed.includes(key)) return;

    const idx = modalTempKeys.indexOf(key);
    if (idx > -1) modalTempKeys.splice(idx, 1);
    else modalTempKeys.push(key);

    renderModalList();
}

function clearSelectedCols() {
    const fixed = (modalContext === 'main') ? FIXED_COLS[currentTab] : ['checkbox', 'title'];
    modalTempKeys = [...fixed];
    renderModalList();
}

function filterColList() {
    renderModalList();
}

function colSelectAll(checked) {
    const formType = (modalContext === 'main') ? currentFormType : currentBatchFormType;
    const fixed = (modalContext === 'main') ? FIXED_COLS[currentTab] : ['checkbox', 'title'];

    if (checked) {
        let available = (currentTab === 'pending' && formType)
            ? [...COMMON_OPTIONAL_COLS, ...(FORM_FIELD_DEFS[formType] || [])]
            : [...COMMON_OPTIONAL_COLS];
        modalTempKeys = Array.from(new Set([...modalTempKeys, ...available.map(c => c.key)]));
    } else {
        modalTempKeys = [...fixed];
    }
    renderModalList();
}

function applyCustomCols() {
    const config = getActiveColConfig(modalContext);
    config.keys = [...modalTempKeys];
    saveConfig(modalContext);

    if (modalContext === 'main') renderTable();
    else renderBatchTable();

    closeCustomColModal();
    showToast('列配置已更新', 'success');
}

// ===================================
// 6. 配置持久化与渲染核心
// ===================================

/**
 * 获取当前激活的列配置
 * 优化点：当选择具体表单时，如果没有历史配置，则自动将该表单的业务字段加入显示
 */
function getActiveColConfig(ctx) {
    const isBatch = (ctx === 'batch');
    const formType = isBatch ? currentBatchFormType : currentFormType;
    const sk = getStorageKey(currentTab, formType, isBatch);

    // 如果没有找到保存的配置，则生成一个智能默认配置
    if (!colConfigs[sk]) {
        const businessFields = (FORM_FIELD_DEFS[formType] || []).map(f => f.key);

        if (isBatch) {
            // 批量模式默认列
            colConfigs[sk] = {
                keys: ['checkbox', 'title', ...(businessFields.length > 0 ? businessFields : ['preview']), 'startTime'],
                widths: {}
            };
        } else {
            // 主列表默认列
            colConfigs[sk] = {
                keys: ['title', 'status', ...(businessFields.length > 0 ? businessFields : ['preview']), 'startTime', 'ops'],
                widths: {}
            };
        }
    }
    return colConfigs[sk];
}

function saveConfig(ctx) {
    const isBatch = (ctx === 'batch');
    const formType = isBatch ? currentBatchFormType : currentFormType;
    const sk = getStorageKey(currentTab, formType, isBatch);
    localStorage.setItem(sk, JSON.stringify(colConfigs[sk]));
}

function loadConfig() {
    // 预加载所有可能的 key 到 colConfigs (仅当本地存有时)
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('v2_approval_cols_')) {
            try {
                colConfigs[k] = JSON.parse(localStorage.getItem(k));
            } catch (e) { }
        }
    }
}

// 列宽拖拽
function initDragHandle() {
    let startX, startWidth, curCol, curHandle;

    document.addEventListener('mousedown', e => {
        if (e.target.classList.contains('col-resizer')) {
            curHandle = e.target;
            curCol = curHandle.parentElement;
            startX = e.pageX;
            startWidth = curCol.offsetWidth;
            curHandle.classList.add('dragging');

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        }
    });

    function onMouseMove(e) {
        if (!curCol) return;
        const diff = e.pageX - startX;
        const newW = Math.max(50, startWidth + diff);
        curCol.style.width = newW + 'px';
    }

    function onMouseUp() {
        if (curCol) {
            const tableId = curCol.closest('table').id;
            const ctx = (tableId === 'batch-table') ? 'batch' : 'main';
            const key = curCol.getAttribute('data-col');
            const config = getActiveColConfig(ctx);
            config.widths[key] = curCol.offsetWidth;
            saveConfig(ctx);
        }
        if (curHandle) curHandle.classList.remove('dragging');
        curCol = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

// ===================================
// 7. 其它交互 (详情/批量/Toast)
// ===================================

let currentDetailItem = null;
let currentFlowSort = 'asc';

function openDetail(id) {
    const item = (DATA[currentTab] || []).find(record => record.id === id) || Object.values(DATA).flat().find(record => record.id === id);
    if (!item) return;

    markSelectedRecord(item.id);
    detailContextTab = currentTab;
    currentDetailItem = item;
    approvalDetail.open(item);
    switchDetailTab('content', document.querySelector('#detail-modal .detail-tab-btn'));
    document.getElementById('pane-content').scrollTop = 0;
    document.getElementById('pane-log').scrollTop = 0;
    renderDetailModal();
    document.getElementById('detail-modal').style.display = 'flex';
}

function closeDetailModal() {
    document.getElementById('detail-modal').style.display = 'none';
    approvalDetail.close();
}

function switchDetailTab(tab, btn) {
    document.querySelectorAll('#detail-modal .detail-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('#detail-modal .detail-tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('pane-' + tab).classList.add('active');
}

function renderDetailModal() {
    if (!currentDetailItem) return;
    const item = currentDetailItem;

    // 1. 顶部基础信息
    document.getElementById('detail-form-name').textContent = item.title;
    document.getElementById('detail-form-name').title = item.title;
    const statusBadge = document.getElementById('detail-status');
    statusBadge.textContent = item.status;
    statusBadge.className = `status-badge ${item.status === '进行中' ? 'badge-progressing' : (item.status === '已通过' ? 'badge-passed' : 'badge-rejected')}`;
    document.getElementById('detail-initiator').textContent = item.initiator;
    document.getElementById('detail-time').textContent = item.startTime;

    // 2. 表单内容 Tab
    renderDetailFormContent();
    const canEdit = item.status === '进行中' && (currentTab === 'pending' || (currentTab === 'mine' && item.currentNodeKey === '发起人'));
    if (!canEdit) document.querySelectorAll('#form-content-container input, #form-content-container textarea, #form-content-container select').forEach(input => { input.disabled = true; });

    // 审批进度与关联表单统一展示在右侧。
    renderDetailFlow();

    // 5. 操作日志 Tab
    renderDetailLogs();

    // 6. 底部操作按钮
    renderDetailFooter();
}

function renderDetailSidebar() {
    const sidebar = document.getElementById('detail-sidebar');
    if (!sidebar) return;
    const list = DATA[currentTab] || DATA.pending || [];
    const showList = list.slice(0, 15);
    sidebar.innerHTML = showList.map(it => {
        const isActive = it.id === currentDetailItem.id ? 'active' : '';
        return `<div class="sidebar-item ${isActive}" title="${it.title}" onclick="switchDetailItem('${it.id}')">${it.title}</div>`;
    }).join('');
}

function switchDetailItem(id) {
    openDetail(id);
}

// 渲染表单内容 (对应截图 2 岗位技能评估表)
function renderDetailFormContent() {
    const container = document.getElementById('form-content-container');
    if (!container || !currentDetailItem) return;
    const item = currentDetailItem;
    if (window.approvalDetail?.renderPersonnelForm(container, item)) return;
    const form = item.formData || {};
    const rows = form.rows || [];

    // 节点权限细化控制：
    // 1. 发起人权限：退回到发起人时，发起人负责编辑基础业务数据 (培训内容、日期、考核方式等)
    const isInitiatorNode = (item.currentNodeKey === '发起人' || item.node === '发起人');
    const attrDisabled = isInitiatorNode ? '' : 'disabled';
    const attrReadonly = isInitiatorNode ? '' : 'readonly';

    // 2. 审批人权限：处于审批节点 (考核小组/负责人) 时，负责填写/修改综合评估意见与评价人签名
    const isApproverNode = !isInitiatorNode;
    const attrApproverDisabled = isApproverNode ? '' : 'disabled';
    const attrApproverReadonly = isApproverNode ? '' : 'readonly';

    let tableRowsHtml = rows.map((r, idx) => `
        <tr>
            <td>${r.pos}</td>
            <td style="text-align:left; line-height:1.5;">${r.content}</td>
            <td style="width:110px;">
                <input type="date" value="${r.date || ''}" ${attrDisabled} onchange="updateFormRow(${idx}, 'date', this.value)">
            </td>
            <td>${r.method}</td>
            <td style="width:110px;">
                <input type="date" value="${r.checkDate || ''}" ${attrDisabled} onchange="updateFormRow(${idx}, 'checkDate', this.value)">
            </td>
            <td style="width:130px; white-space:nowrap;">
                <label class="eval-result-radio">
                    <input type="radio" name="result_${idx}" value="合格" ${r.result === '合格' ? 'checked' : ''} ${attrDisabled} onchange="updateFormRow(${idx}, 'result', '合格')"> 合格
                </label>
                <label class="eval-result-radio">
                    <input type="radio" name="result_${idx}" value="不合格" ${r.result === '不合格' ? 'checked' : ''} ${attrDisabled} onchange="updateFormRow(${idx}, 'result', '不合格')"> 不合格
                </label>
                ${isInitiatorNode ? `<a href="javascript:void(0)" class="eval-clear-btn" onclick="clearFormRowResult(${idx})">清空</a>` : ''}
            </td>
            <td style="width:90px;">
                <input type="text" value="${r.checker || ''}" placeholder="" ${attrReadonly} oninput="updateFormRow(${idx}, 'checker', this.value)">
            </td>
            <td style="width:90px;">
                <input type="text" value="${r.remark || ''}" placeholder="" ${attrReadonly} oninput="updateFormRow(${idx}, 'remark', this.value)">
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="eval-form-wrap">
            <div class="eval-form-title">员工培训及能力评估表2-岗位技能类</div>
            <div class="eval-form-subtitle">（2025 年）</div>
            <div class="eval-form-no">表格编号：XZ-BLK-TAB-359</div>

            <table class="eval-table">
                <tr>
                    <th style="width:100px;">姓名</th>
                    <td style="width:200px;">
                        <input type="text" value="${form.name || item.initiator || ''}" ${attrReadonly} oninput="updateFormMeta('name', this.value)">
                    </td>
                    <th style="width:100px;">职称</th>
                    <td style="width:200px;">
                        <input type="text" value="${form.job || ''}" placeholder="" ${attrReadonly} oninput="updateFormMeta('job', this.value)">
                    </td>
                    <th style="width:120px;">评估时机（见注释）</th>
                    <td>
                        <select ${attrDisabled} onchange="updateFormMeta('timing', this.value)">
                            <option value="1新人员上岗" ${form.timing === '1新人员上岗' ? 'selected' : ''}>1 新人员上岗</option>
                            <option value="2每年的定期评估" ${form.timing === '2每年的定期评估' ? 'selected' : ''}>2 每年的定期评估</option>
                            <option value="3离开岗位超过6个月" ${form.timing === '3离开岗位超过6个月' ? 'selected' : ''}>3 离开岗位超过6个月时间重新上岗培训后</option>
                            <option value="4评估岗位不胜任" ${form.timing === '4评估岗位不胜任' ? 'selected' : ''}>4 评估岗位不胜任，培训后再评价</option>
                            <option value="5岗位变更培训后再评价" ${form.timing === '5岗位变更培训后再评价' ? 'selected' : ''}>5 岗位变更培训后再评价</option>
                        </select>
                    </td>
                </tr>
            </table>

            <table class="eval-table">
                <thead>
                    <tr>
                        <th style="width:80px;">岗位名称</th>
                        <th>培训内容</th>
                        <th>培训日期</th>
                        <th style="width:110px;">考核方式</th>
                        <th>考核日期（清理号）</th>
                        <th>考核结果</th>
                        <th>培训人/考核人</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHtml}
                </tbody>
            </table>

            <div class="eval-summary-box">
                <div class="eval-summary-title">综合评估意见：</div>
                <div style="display:flex; gap:16px; align-items:center; margin-bottom:6px;">
                    <label class="eval-result-radio">
                        <input type="radio" name="summary_choice" value="合格" ${form.summaryChoice === '合格' ? 'checked' : ''} ${attrApproverDisabled} onchange="updateFormMeta('summaryChoice', '合格')">
                        合格，该员工经过以上岗位培训，已具备胜任上述岗位的能...
                    </label>
                    <label class="eval-result-radio">
                        <input type="radio" name="summary_choice" value="不合格" ${form.summaryChoice === '不合格' ? 'checked' : ''} ${attrApproverDisabled} onchange="updateFormMeta('summaryChoice', '不合格')">
                        不合格，存在以下问题，需要针对性再培...
                    </label>
                    ${isApproverNode ? `<a href="javascript:void(0)" class="eval-clear-btn" onclick="updateFormMeta('summaryChoice', '')">清空</a>` : ''}
                </div>
                <textarea class="eval-summary-textarea" ${attrApproverReadonly} placeholder="请填写存在的问题及针对性培训要求" oninput="updateFormMeta('summaryText', this.value)">${form.summaryText || ''}</textarea>
            </div>

            <div class="eval-summary-meta">
                <div>
                    <label style="color:#4e5969;">评价人：</label>
                    <input type="text" value="${form.evaluator || ''}" style="width:140px;" ${attrApproverReadonly} oninput="updateFormMeta('evaluator', this.value)">
                </div>
                <div>
                    <label style="color:#4e5969;">日期：</label>
                    <input type="date" value="${form.evalDate || ''}" style="width:140px;" ${attrApproverDisabled} onchange="updateFormMeta('evalDate', this.value)">
                </div>
            </div>

            <div class="eval-note-text">
                注释：<br>
                评估时机：1新人员上岗 2每年的定期评估 3离开岗位超过6个月时间重新上岗培训后<br>
                4评估岗位不胜任，培训后再评价 5岗位变更培训后再评价 6其他：
            </div>
        </div>
    `;
    container.querySelectorAll('table').forEach(table => {
        const wrapper = document.createElement('div');
        wrapper.className = 'acd-table-scroll';
        table.before(wrapper);
        wrapper.appendChild(table);
    });
}

function updateFormRow(idx, field, val) {
    if (!currentDetailItem || !currentDetailItem.formData) return;
    currentDetailItem.formData.rows[idx][field] = val;
}

function clearFormRowResult(idx) {
    if (!currentDetailItem || !currentDetailItem.formData) return;
    currentDetailItem.formData.rows[idx].result = '';
    renderDetailFormContent();
}

function updateFormMeta(field, val) {
    if (!currentDetailItem || !currentDetailItem.formData) return;
    currentDetailItem.formData[field] = val;
}

// 渲染审批流程 (左侧流程树 + 右侧详情卡片)
function renderDetailFlow() {
    approvalDetail.render();
}

function renderDetailFlowTimeline(container = document.getElementById('flow-timeline-container'), item = currentDetailItem) {
    if (!container || !item) return;
    const nodes = item.flowNodes || [];

    let html = '';
    nodes.forEach((node, idx) => {
        const isDone = node.status === 'done';
        const isActive = node.status === 'active';
        const iconCls = isDone ? 'success' : (isActive ? 'warning' : 'gray');

        let iconSvg = '';
        if (isDone) {
            iconSvg = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else if (isActive) {
            iconSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else {
            iconSvg = `<svg width="16" height="16" fill="none" stroke="#ccc" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>`;
        }

        const titleColor = isActive ? 'style="color:#fa8c16; font-weight:600;"' : (isDone ? '' : 'class="gray"');
        const statusText = isActive ? ' - <span style="color:#fa8c16; font-weight:500;">进行中</span>' : (isDone ? '' : ' - 待处理');

        // 人员头像展示
        let avatarsHtml = '';
        if (node.users && Array.isArray(node.users)) {
            avatarsHtml = node.users.map(u => `
                <div class="flow-avatar ${isDone ? 'blue' : 'gray'}">${u.slice(0, 1)}</div>
                <span class="flow-avatar-name" style="margin-right:8px;">${u}</span>
            `).join('');
        } else if (node.user) {
            avatarsHtml = `
                <div class="flow-avatar ${isDone ? 'blue' : (isActive ? 'blue' : 'gray')}">${node.user.slice(0, 1)}</div>
                <span class="flow-avatar-name">${node.user}</span>
            `;
        }

        html += `
            <div class="flow-node-wrap">
                <div class="flow-status-icon ${iconCls}">${iconSvg}</div>
                <div class="flow-node-content">
                    <div class="flow-node-title" ${titleColor}>
                        ${node.name} ${statusText}
                        ${node.time ? `<span class="flow-node-time">${node.time}</span>` : ''}
                    </div>
                    ${node.desc ? `<div class="flow-node-sub">${node.desc}</div>` : ''}
                    <div class="flow-node-avatars">${avatarsHtml}</div>
                </div>
            </div>
        `;

        if (idx < nodes.length - 1) {
            html += `<div class="flow-connector ${isDone ? '' : 'dashed'}"></div>`;
        }
    });

    container.innerHTML = html;
}

function renderDetailFlowCards(container = document.getElementById('flow-cards-container'), item = currentDetailItem) {
    if (!container || !item) return;
    let list = [...(item.approvalDetails || [])];
    list.sort((a, b) => a.time.localeCompare(b.time));

    if (currentFlowSort === 'desc') {
        list.reverse();
    }

    if (list.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#999; padding:20px;">暂无审批详情</div>`;
        return;
    }

    container.innerHTML = list.map(c => {
        let tagCls = 'agree';
        if (c.action === 'return') tagCls = 'return';
        else if (c.action === 'submit') tagCls = 'submit';
        else if (c.action === 'reject') tagCls = 'reject';

        return `
            <div class="flow-detail-card">
                <div class="flow-card-head">
                    <span class="flow-card-node-name">${c.nodeName}</span>
                    <span class="card-action-tag ${tagCls}">${c.actionName || '处理'}</span>
                </div>
                <div class="flow-card-info-item"><span class="flow-card-label">审批人：</span>${c.user}</div>
                <div class="flow-card-info-item"><span class="flow-card-label">审批时间：</span>${c.time}</div>
                ${c.targetNode ? `<div class="flow-card-info-item"><span class="flow-card-label">退回节点：</span><span style="color:#ff7d00; font-weight:500;">${c.targetNode}</span></div>` : ''}
                <div class="flow-card-info-item"><span class="flow-card-label">审批意见：</span>${c.comment || '-'}</div>
            </div>
        `;
    }).join('');
}

function changeFlowSort(sort) {
    currentFlowSort = sort;
    renderDetailFlowCards();
}

function renderDetailLogs() {
    const tbody = document.getElementById('detail-log-tbody');
    if (!tbody || !currentDetailItem) return;
    if (window.approvalDetail) { window.approvalDetail.renderOperationLogs(tbody, currentDetailItem); return; }
    const logs = currentDetailItem.logs || [];
    tbody.innerHTML = logs.map(l => `
        <tr>
            <td>${l.user}</td>
            <td>${l.time}</td>
            <td><button class="acd-text-button" type="button">查看</button></td>
        </tr>
    `).join('');
}

function renderDetailFooter() {
    const footer = document.getElementById('detail-footer');
    if (!footer || !currentDetailItem) return;
    const isInitiatorEditing = (currentDetailItem.currentNodeKey === '发起人' || currentDetailItem.node === '发起人');
    const copy = '<button class="btn-default acd-blue-outline" onclick="showToast(\'已复制新表单\')">复制发起</button>';
    const withdraw = `<button class="btn-default acd-blue-outline" onclick="withdrawRecord('${currentDetailItem.id}')">撤回</button>`;
    const close = '<button class="btn-default" onclick="closeDetailModal()">关闭</button>';
    if (['done', 'cc'].includes(currentTab) || currentDetailItem.status === '已撤回') {
        footer.innerHTML = close;
    } else if (currentTab === 'mine' && !isInitiatorEditing) {
        footer.innerHTML = withdraw + copy + close;
    } else if (isInitiatorEditing && currentDetailItem.status === '进行中') {
        footer.innerHTML = `
            <button class="btn-primary" onclick="submitReEdit()">重新提交</button>
            ${withdraw}${copy}
        `;
    } else if (currentTab === 'pending' && currentDetailItem.status === '进行中') {
        footer.innerHTML = `
            ${currentDetailItem.initiator === '李何02' ? withdraw : ''}
            <button class="btn-primary" onclick="confirmApproveCurrent()">同意</button>
            <button class="btn-default" onclick="openReturnModal()">退回</button>
            <button class="btn-danger acd-danger-outline" onclick="confirmRejectCurrent()">拒绝</button>
            ${copy}
        `;
    } else footer.innerHTML = copy + close;
}

function withdrawRecord(id) {
    const record = Object.values(DATA).flat().find(item => item.id === id);
    if (!record || record.status === '已撤回') return;
    record.status = '已撤回'; record.node = '-';
    record.logs ||= [];
    record.logs.push({ user: '李何02', action: '撤回', time: formatNowTime() });
    DATA.pending = DATA.pending.filter(item => item.id !== id);
    if (currentDetailItem?.id === id) renderDetailModal();
    renderTable(); showToast('已撤回表单');
}

function deleteRecord(id) {
    const record = DATA.mine.find(item => item.id === id);
    if (!record || record.status !== '已撤回') return;
    if (!window.confirm('确定删除该已撤回的记录吗？')) return;
    Object.keys(DATA).forEach(tab => { DATA[tab] = DATA[tab].filter(item => item.id !== id); });
    renderTable(); showToast('已删除记录');
}

// ===================================
// 8. 审批退回与流转 (核心业务逻辑)
// ===================================

function openReturnModal() {
    if (!currentDetailItem) return;
    const modal = document.getElementById('return-modal');
    const select = document.getElementById('return-node-select');

    // 动态提取退回节点：始终包含“发起人”，并包含当前节点之前的所有流转节点
    const options = [
        { key: '发起人', label: '发起人' }
    ];

    if (currentDetailItem.currentNodeKey === '考核负责人') {
        options.push({ key: '考核小组', label: '考核小组' });
    }

    select.innerHTML = options.map(opt => `<option value="${opt.key}">${opt.label}</option>`).join('');
    document.getElementById('return-comment').value = '';
    modal.style.display = 'flex';
}

function closeReturnModal() {
    document.getElementById('return-modal').style.display = 'none';
}

function confirmReturn() {
    if (!currentDetailItem) return;
    const targetNode = document.getElementById('return-node-select').value;
    const comment = document.getElementById('return-comment').value.trim();
    if (!comment) {
        showToast('请输入审批意见', 'error');
        document.getElementById('return-comment').focus();
        return;
    }
    const nowStr = formatNowTime();

    if (targetNode === '发起人') {
        // ★ 核心要求 1：退回的节点为表单发起人时，表单状态仍为”进行中“
        currentDetailItem.status = '进行中';
        currentDetailItem.currentNodeKey = '发起人';
        currentDetailItem.node = '发起人';

        // ★ 核心要求 1.2：审批流程退回到发起人节点
        currentDetailItem.flowNodes.forEach(n => {
            if (n.key === '发起审批') {
                n.status = 'active'; // 发起人节点激活进行中
            } else {
                n.status = 'pending'; // 后续节点变回待处理
            }
        });

        // 记录右侧审批详情
        currentDetailItem.approvalDetails.push({
            id: Date.now(),
            nodeName: currentDetailItem.currentNodeKey || '考核负责人',
            user: '李何02',
            targetNode: targetNode,
            time: nowStr,
            comment: comment,
            action: 'return',
            actionName: '退回'
        });

        // 记录操作日志
        currentDetailItem.logs.push({
            user: '李何02',
            action: `考核负责人退回至${targetNode}`,
            comment: comment,
            time: nowStr
        });

        // ★ 核心要求 1.1：确保在发起人的“待我处理”中
        const inPending = DATA.pending.some(x => x.id === currentDetailItem.id);
        if (!inPending) {
            DATA.pending.unshift(currentDetailItem);
        }

        closeReturnModal();
        showToast(`已退回至${targetNode}节点，表单状态保持进行中`, 'success');
        renderDetailModal();
        renderTable();
    } else {
        // 退回到指定前置审批节点 (如考核小组)
        currentDetailItem.status = '进行中';
        currentDetailItem.currentNodeKey = targetNode;
        currentDetailItem.node = targetNode;

        currentDetailItem.flowNodes.forEach(n => {
            if (n.key === targetNode) n.status = 'active';
            else if (n.key === '发起审批') n.status = 'done';
            else n.status = 'pending';
        });

        currentDetailItem.approvalDetails.push({
            id: Date.now(),
            nodeName: currentDetailItem.currentNodeKey || '考核负责人',
            user: '李何02',
            targetNode: targetNode,
            time: nowStr,
            comment: comment,
            action: 'return',
            actionName: '退回'
        });

        currentDetailItem.logs.push({
            user: '李何02',
            action: `退回到${targetNode}`,
            comment: comment,
            time: nowStr
        });

        closeReturnModal();
        showToast(`已成功退回至${targetNode}`, 'success');
        renderDetailModal();
        renderTable();
    }
}

// ★ 核心要求 1.1 & 1.3：发起人二次编辑提交
function submitReEdit() {
    if (!currentDetailItem) return;
    const nowStr = formatNowTime();

    // 核心流转规则：从第一审批节点（考核小组）重新流转
    currentDetailItem.status = '进行中';
    const firstApproval = currentDetailItem.source === 'pane-ltab-content' ? '分值填写并审核' : '考核小组';
    currentDetailItem.currentNodeKey = firstApproval;
    currentDetailItem.node = firstApproval;

    currentDetailItem.flowNodes.forEach(n => {
        if (n.key === '发起审批') {
            n.status = 'done';
            n.time = nowStr;
        } else if (n.key === firstApproval) {
            n.status = 'active';
        } else {
            n.status = 'pending';
        }
    });

    // 右侧审批详情新增重新提交记录
    currentDetailItem.approvalDetails.push({
        id: Date.now(),
        nodeName: '发起审批',
        user: currentDetailItem.initiator,
        time: nowStr,
        comment: '表单重新编辑后提交',
        action: 'submit',
        actionName: '重新提交'
    });

    // ★ 核心要求 1.3：表单重新编辑后并提交后新增一条操作记录
    currentDetailItem.logs.push({
        user: currentDetailItem.initiator,
        action: '重新编辑提交审批',
        comment: '修改表单内容后重新提交',
        time: nowStr
    });

    showToast(`重新编辑提交成功，流程已流转至${firstApproval}`, 'success');
    renderDetailModal();
    renderTable();
}

function saveFormDraft() {
    window.approvalDetail?.saveVersion(currentDetailItem);
    showToast('草稿保存成功', 'success');
}

function confirmApproveCurrent() {
    if (!currentDetailItem) return;
    const nowStr = formatNowTime();

    if (currentDetailItem.currentNodeKey === '考核小组') {
        currentDetailItem.currentNodeKey = '考核负责人';
        currentDetailItem.node = '考核负责人';
        currentDetailItem.flowNodes.forEach(n => {
            if (n.key === '考核小组') n.status = 'done';
            else if (n.key === '考核负责人') n.status = 'active';
        });
        currentDetailItem.approvalDetails.push({
            id: Date.now(),
            nodeName: '考核小组',
            user: '李何02',
            time: nowStr,
            comment: '同意',
            action: 'agree',
            actionName: '同意'
        });
        currentDetailItem.logs.push({
            user: '李何02',
            action: '考核小组同意',
            comment: '同意',
            time: nowStr
        });
        showToast('审批同意，流转至考核负责人', 'success');
    } else {
        currentDetailItem.status = '已通过';
        currentDetailItem.flowNodes.forEach(n => { if (n.status === 'active') n.time = nowStr; n.status = 'done'; });
        currentDetailItem.approvalDetails.push({
            id: Date.now(),
            nodeName: currentDetailItem.currentNodeKey,
            user: '李何02',
            time: nowStr,
            comment: '同意',
            action: 'agree',
            actionName: '同意'
        });
        currentDetailItem.logs.push({
            user: '李何02',
            action: '审批通过',
            comment: '同意通过',
            time: nowStr
        });
        showToast('审批已通过，流程结束', 'success');
    }

    renderDetailModal();
    renderTable();
}

function confirmRejectCurrent() {
    if (!currentDetailItem) return;
    const nowStr = formatNowTime();
    currentDetailItem.status = '已驳回';
    currentDetailItem.approvalDetails.push({
        id: Date.now(),
        nodeName: currentDetailItem.currentNodeKey,
        user: '李何02',
        time: nowStr,
        comment: '拒绝',
        action: 'reject',
        actionName: '拒绝'
    });
    currentDetailItem.logs.push({
        user: '李何02',
        action: '审批拒绝',
        comment: '已驳回',
        time: nowStr
    });
    showToast('表单已驳回', 'error');
    renderDetailModal();
    renderTable();
}

function openBatchModal() {
    currentBatchFormType = ''; // 每次打开默认显示全部
    document.getElementById('batch-filter-form-type').value = '';
    renderBatchTable();
    document.getElementById('batch-modal').style.display = 'flex';
}
function closeBatchModal() {
    document.getElementById('batch-modal').style.display = 'none';
}

function renderBatchTable() {
    const config = getActiveColConfig('batch');
    let cols = [...config.keys];

    // ★ 强制：将 ops 固定在最后一列 (如果存在)
    const opsIdx = cols.indexOf('ops');
    if (opsIdx > -1) {
        cols.splice(opsIdx, 1);
        cols.push('ops');
    }

    const widths = config.widths || {};
    const thead = document.getElementById('batch-table-head');
    const tbody = document.getElementById('batch-table-body');

    // 生成表头
    let headHtml = '<tr>';
    cols.forEach(key => {
        const label = getLabel(key);
        const w = widths[key] ? `style="width:${widths[key]}px"` : (key === 'checkbox' ? 'style="width:40px"' : '');
        headHtml += `<th data-col="${key}" ${w}>
            <div class="th-content">${label}</div>
            <div class="col-resizer"></div>
        </th>`;
    });
    headHtml += '</tr>';
    thead.innerHTML = headHtml;

    // 搜索与过滤
    const searchVal = document.getElementById('batch-search').value.trim().toLowerCase();
    let data = DATA.pending || [];
    if (currentBatchFormType) {
        data = data.filter(r => r.title === currentBatchFormType);
    }
    if (searchVal) {
        data = data.filter(r => r.title.toLowerCase().includes(searchVal));
    }

    // 生成行
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;color:#999;padding:40px">暂无记录</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(row => `
        <tr>
            ${cols.map(key => `<td>${getCellHtml(key, row)}</td>`).join('')}
        </tr>
    `).join('');
}

function batchSearch() {
    renderBatchTable();
}

function resetBatchSearch() {
    document.getElementById('batch-search').value = '';
    document.getElementById('batch-filter-form-type').value = '';
    currentBatchFormType = '';
    renderBatchTable();
}

function batchSelectAll(checked) {
    document.querySelectorAll('.batch-cb').forEach(c => c.checked = checked);
}
function confirmBatchApprove() {
    const count = document.querySelectorAll('.batch-cb:checked').length;
    if (count === 0) {
        showToast('请至少选择一条记录', 'error');
        return;
    }
    showToast(`成功批量审批 ${count} 条记录`, 'success');
    closeBatchModal();
}

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast-msg show ${type}`;
    setTimeout(() => t.classList.remove('show'), 2000);
}

// ===================================
// 9. 自定义筛选条件逻辑 (上下文敏感)
// ===================================

let selectedFilterKeys = new Set();      // 主页面已选
let batchSelectedFilterKeys = new Set(); // 批量处理已选
let filterContext = 'main';              // 'main' 或 'batch'

function openCustomFilterModal(ctx = 'main') {
    filterContext = ctx;
    const modal = document.getElementById('custom-filter-modal');
    modal.style.display = 'flex';
    renderFilterTags();
}

function closeCustomFilterModal() {
    document.getElementById('custom-filter-modal').style.display = 'none';
}

function renderFilterTags() {
    const container = document.getElementById('filter-tags-container');
    const activeSet = filterContext === 'batch' ? batchSelectedFilterKeys : selectedFilterKeys;
    const activeFormType = filterContext === 'batch' ? currentBatchFormType : currentFormType;

    let allFields = [...COMMON_OPTIONAL_COLS];
    if (activeFormType && FORM_FIELD_DEFS[activeFormType]) {
        allFields = [...allFields, ...FORM_FIELD_DEFS[activeFormType]];
    }

    container.innerHTML = allFields.map(f => {
        const isActive = activeSet.has(f.key) ? 'active' : '';
        return `<div class="filter-tag-item ${isActive}" onclick="toggleFilterTag('${f.key}')">${f.label}</div>`;
    }).join('');
}

function toggleFilterTag(key) {
    const activeSet = filterContext === 'batch' ? batchSelectedFilterKeys : selectedFilterKeys;
    if (activeSet.has(key)) {
        activeSet.delete(key);
    } else {
        activeSet.add(key);
    }
    renderFilterTags();
}

function clearFilterTags() {
    const activeSet = filterContext === 'batch' ? batchSelectedFilterKeys : selectedFilterKeys;
    activeSet.clear();
    renderFilterTags();
}

function applyCustomFilters() {
    closeCustomFilterModal();
    renderDynamicFilters(filterContext);
    showToast(`筛选面板已更新`);
}

function renderDynamicFilters(ctx = 'main') {
    const selector = ctx === 'batch' ? '#batch-dynamic-filters-container' : '#dynamic-filters-container';
    const container = document.querySelector(selector);
    const activeSet = ctx === 'batch' ? batchSelectedFilterKeys : selectedFilterKeys;
    if (!container) return;

    let allFieldDefs = [...COMMON_OPTIONAL_COLS];
    for (const key in FORM_FIELD_DEFS) {
        allFieldDefs = [...allFieldDefs, ...FORM_FIELD_DEFS[key]];
    }

    let html = '';
    activeSet.forEach(key => {
        const field = allFieldDefs.find(f => f.key === key);
        const label = field ? field.label : key;
        html += `
            <div class="filter-group dynamic-filter-item">
                <label>${label}：</label>
                <input type="text" class="filter-input" data-filter-key="${key}" placeholder="请输入${label}">
            </div>
        `;
    });
    container.innerHTML = html;
}

function doSearch() {
    renderTable();
    showToast('搜索已更新');
}

function resetSearch() {
    const selects = document.querySelectorAll('#filter-bar-pending select');
    selects.forEach(s => s.selectedIndex = 0);
    const inputs = document.querySelectorAll('#filter-bar-pending input');
    inputs.forEach(i => i.value = '');

    selectedFilterKeys.clear();
    renderDynamicFilters('main');
    currentFormType = '';
    renderTable();
    showToast('条件已重置');
}

function resetBatchSearch() {
    const selects = document.querySelectorAll('#batch-modal select');
    selects.forEach(s => s.selectedIndex = 0);
    const inputs = document.querySelectorAll('#batch-modal input');
    inputs.forEach(i => i.value = '');

    batchSelectedFilterKeys.clear();
    renderDynamicFilters('batch');
    currentBatchFormType = '';
    renderBatchTable();
    showToast('重置成功');
}

function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast-msg show ${type}`;
    setTimeout(() => t.classList.remove('show'), 2000);
}

// 排序切换逻辑
function toggleSort(key) {
    if (key === 'ops' || key === 'checkbox') return;

    if (currentSort.key === key) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.order = 'asc';
    }
    renderTable();
}
