/* =====================================================================
   SITE BUILDER by ForceNet
   Конструктор сайтов без кода — экраны, элементы, стили с градиентами,
   условная логика если/то/иначе/или, медиафайлы, интеграция с Telegram.
   Всё хранится и работает локально в браузере, экспорт даёт готовый
   самостоятельный index.html.
   ===================================================================== */

const STORAGE_KEY = 'nocode_site_builder_project_v2';

const OPERATORS = [
  { value: 'eq', label: 'равно' },
  { value: 'neq', label: 'не равно' },
  { value: 'contains', label: 'содержит' },
  { value: 'gt', label: 'больше' },
  { value: 'lt', label: 'меньше' },
  { value: 'empty', label: 'пусто' },
  { value: 'notEmpty', label: 'не пусто' }
];

const ACTION_KINDS = [
  { value: 'goto', label: 'Перейти на экран' },
  { value: 'link', label: 'Открыть ссылку' },
  { value: 'alert', label: 'Показать сообщение' },
  { value: 'setVar', label: 'Установить переменную' },
  { value: 'telegram', label: 'Отправить в Telegram' },
  { value: 'condition', label: 'Условие (если / то / иначе)' }
];

let project = null;
let selection = { kind: 'screen', screenId: null, elementId: null };

// ---------- утилиты ----------
function uid(prefix) { return prefix + '_' + Math.random().toString(36).slice(2, 9); }
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function getScreen(id) { return project.screens.find(s => s.id === id); }
function getActiveScreen() { return getScreen(project.activeScreenId); }
function getElement(screen, id) { return screen.elements.find(e => e.id === id); }

// =====================================================================
// ЦВЕТ / ГРАДИЕНТ — общие хелперы
// =====================================================================
function defaultColorStyle(color1, color2, enabled) {
  return { enabled: !!enabled, mode: 'solid', color1: color1 || '#7c83fd', color2: color2 || '#e8a33d', angle: 135 };
}
function gradientCSS(style) { return `linear-gradient(${style.angle}deg, ${style.color1}, ${style.color2})`; }
function bgCSSDecl(style, force) {
  if (!style) return '';
  if (!force && !style.enabled) return '';
  if (style.mode === 'gradient') return `background-image:${gradientCSS(style)};`;
  return `background-color:${style.color1};`;
}
function textCSSDecl(style) {
  if (!style) return '';
  if (style.mode === 'gradient') {
    return `background-image:${gradientCSS(style)};-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;`;
  }
  return `color:${style.color1};`;
}

// =====================================================================
// ДАННЫЕ ПО УМОЛЧАНИЮ
// =====================================================================
function defaultBackground() { return { enabled: true, mode: 'solid', color1: '#000000', color2: '#1b1e2a', angle: 135 }; }
function defaultCondition() { return { enabled: false, logic: 'AND', rules: [] }; }

function defaultStyleFor(type) {
  const style = {};
  if (['title', 'text', 'button'].includes(type)) {
    style.textColor = defaultColorStyle(type === 'text' ? '#c7c9d6' : '#ffffff', '#e8a33d', false);
  }
  if (['button', 'input', 'image'].includes(type)) {
    style.bg = defaultColorStyle('#7c83fd', '#e8a33d', false);
    style.radius = type === 'image' ? 8 : 6;
  }
  if (type === 'divider') {
    style.bg = defaultColorStyle('#3a3d52', '#7c83fd', true);
    style.dividerWidth = 100;
    style.dividerHeight = 2;
    style.radius = 4;
  }
  return style;
}

function defaultActionOfKind(kind) {
  switch (kind) {
    case 'goto': return { kind: 'goto', target: (project && project.screens[0] && project.screens[0].id) || '' };
    case 'link': return { kind: 'link', target: 'https://' };
    case 'setVar': return { kind: 'setVar', varId: (project && project.variables[0] && project.variables[0].id) || '', value: '' };
    case 'telegram': return { kind: 'telegram', template: 'Новое сообщение с сайта' };
    case 'condition': return { kind: 'condition', logic: 'AND', rules: [], thenAction: { kind: 'alert', target: 'Условие верно' }, elseAction: { kind: 'alert', target: 'Условие неверно' } };
    case 'alert':
    default: return { kind: 'alert', target: 'Сообщение' };
  }
}

function defaultPropsFor(type) {
  switch (type) {
    case 'title': return { text: 'Заголовок' };
    case 'text': return { text: 'Текстовый блок. Напишите здесь любой текст.' };
    case 'button': return { text: 'Кнопка', action: defaultActionOfKind('alert') };
    case 'input': return { label: 'Подпись поля', placeholder: 'введите текст', varId: '' };
    case 'image': return { label: 'Изображение', assetId: '' };
    case 'divider': return {};
    default: return {};
  }
}

function defaultProject() {
  const screenId = uid('scr');
  return {
    title: 'Мой сайт',
    variables: [],
    assets: [],
    telegram: { botToken: '', chatId: '', threadId: '' },
    activeScreenId: screenId,
    screens: [
      {
        id: screenId,
        name: 'Главная',
        background: defaultBackground(),
        elements: [
          { id: uid('el'), type: 'title', props: { text: 'Добро пожаловать' }, style: defaultStyleFor('title'), condition: defaultCondition() },
          { id: uid('el'), type: 'text', props: { text: 'Это стартовый экран. Добавляйте элементы слева и настраивайте их справа — код писать не нужно.' }, style: defaultStyleFor('text'), condition: defaultCondition() },
          { id: uid('el'), type: 'button', props: { text: 'Нажми меня', action: defaultActionOfKind('alert') }, style: defaultStyleFor('button'), condition: defaultCondition() }
        ]
      }
    ]
  };
}

function migrateProject(p) {
  p.title = p.title || 'Мой сайт';
  p.variables = Array.isArray(p.variables) ? p.variables : [];
  p.assets = Array.isArray(p.assets) ? p.assets : [];
  p.telegram = p.telegram || {};
  p.telegram.botToken = p.telegram.botToken || '';
  p.telegram.chatId = p.telegram.chatId || '';
  p.telegram.threadId = p.telegram.threadId || '';
  p.screens = p.screens || [];
  p.screens.forEach(scr => {
    scr.background = scr.background || defaultBackground();
    scr.elements = scr.elements || [];
    scr.elements.forEach(el => {
      el.style = el.style || defaultStyleFor(el.type);
      el.condition = el.condition || defaultCondition();
      if (el.type === 'button') el.props.action = el.props.action || defaultActionOfKind('alert');
      if (el.type === 'input') el.props.varId = el.props.varId || '';
      if (el.type === 'image') el.props.assetId = el.props.assetId || '';
    });
  });
  return p;
}

// ---------- сохранение / загрузка ----------
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch (e) { /* ignore */ }
}
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function init() {
  const loaded = loadFromStorage();
  project = migrateProject(loaded || defaultProject());
  if (!getActiveScreen() && project.screens.length) project.activeScreenId = project.screens[0].id;
  selection = { kind: 'screen', screenId: project.activeScreenId, elementId: null };
  bindStaticUI();
  renderAll();
}

function renderAll() {
  renderScreensList();
  renderCanvas();
  renderProps();
  renderAssetsList();
  renderVarsList();
  renderTelegramTab();
}

// =====================================================================
// ЭКРАНЫ
// =====================================================================
function renderScreensList() {
  const list = document.getElementById('screensList');
  list.innerHTML = '';
  project.screens.forEach(scr => {
    const row = document.createElement('div');
    row.className = 'screen-row' + (scr.id === project.activeScreenId ? ' active' : '');
    row.innerHTML = `<span class="name">${esc(scr.name)}</span><span class="del" title="Удалить экран">✕</span>`;
    row.querySelector('.name').onclick = () => {
      project.activeScreenId = scr.id;
      selection = { kind: 'screen', screenId: scr.id, elementId: null };
      persist();
      renderAll();
    };
    row.querySelector('.del').onclick = (e) => { e.stopPropagation(); deleteScreen(scr.id); };
    list.appendChild(row);
  });
  document.getElementById('activeScreenLabel').textContent = getActiveScreen() ? '📱 ' + getActiveScreen().name : '—';
}

function addScreen() {
  const name = prompt('Название нового экрана:', 'Новый экран');
  if (name === null) return;
  const scr = { id: uid('scr'), name: name.trim() || 'Новый экран', background: defaultBackground(), elements: [] };
  project.screens.push(scr);
  project.activeScreenId = scr.id;
  selection = { kind: 'screen', screenId: scr.id, elementId: null };
  persist();
  renderAll();
}

function deleteScreen(id) {
  if (project.screens.length <= 1) { alert('Нельзя удалить последний экран — в сайте должен остаться хотя бы один.'); return; }
  if (!confirm('Удалить этот экран вместе со всеми элементами на нём?')) return;
  project.screens = project.screens.filter(s => s.id !== id);
  project.screens.forEach(s => s.elements.forEach(el => {
    if (el.type === 'button') fixDanglingGoto(el.props.action, id);
  }));
  if (project.activeScreenId === id) project.activeScreenId = project.screens[0].id;
  selection = { kind: 'screen', screenId: project.activeScreenId, elementId: null };
  persist();
  renderAll();
}
function fixDanglingGoto(action, deletedId) {
  if (!action) return;
  if (action.kind === 'goto' && action.target === deletedId) { action.kind = 'alert'; action.target = 'Экран назначения был удалён'; }
  if (action.kind === 'condition') { fixDanglingGoto(action.thenAction, deletedId); fixDanglingGoto(action.elseAction, deletedId); }
}

// =====================================================================
// ЭЛЕМЕНТЫ
// =====================================================================
function addElement(type) {
  const scr = getActiveScreen();
  if (!scr) return;
  const el = { id: uid('el'), type, props: defaultPropsFor(type), style: defaultStyleFor(type), condition: defaultCondition() };
  scr.elements.push(el);
  selection = { kind: 'element', screenId: scr.id, elementId: el.id };
  persist();
  renderAll();
}

function deleteElement(screenId, elId) {
  const scr = getScreen(screenId);
  scr.elements = scr.elements.filter(e => e.id !== elId);
  selection = { kind: 'screen', screenId, elementId: null };
  persist();
  renderAll();
}

function duplicateElement(screenId, elId) {
  const scr = getScreen(screenId);
  const el = getElement(scr, elId);
  const idx = scr.elements.indexOf(el);
  const copy = JSON.parse(JSON.stringify(el));
  copy.id = uid('el');
  scr.elements.splice(idx + 1, 0, copy);
  selection = { kind: 'element', screenId, elementId: copy.id };
  persist();
  renderAll();
}

function moveElement(screenId, elId, dir) {
  const scr = getScreen(screenId);
  const idx = scr.elements.findIndex(e => e.id === elId);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= scr.elements.length) return;
  const [item] = scr.elements.splice(idx, 1);
  scr.elements.splice(newIdx, 0, item);
  persist();
  renderAll();
}

function elementLabel(type) {
  return { title: 'Заголовок', text: 'Текст', button: 'Кнопка', input: 'Поле ввода', image: 'Картинка', divider: 'Разделитель' }[type] || type;
}

// =====================================================================
// ХОЛСТ (превью)
// =====================================================================
function renderCanvas() {
  const holder = document.getElementById('phoneScreen');
  holder.innerHTML = '';
  const scr = getActiveScreen();
  if (!scr) return;

  holder.setAttribute('style', bgCSSDecl(scr.background, true));

  if (scr.elements.length === 0) {
    holder.innerHTML = '<div class="empty-hint">Экран пуст.<br>Добавьте элементы из левой панели «Добавить на экран».</div>';
    return;
  }

  scr.elements.forEach(el => {
    const wrap = document.createElement('div');
    const hasCond = el.condition && el.condition.enabled && el.condition.rules.length > 0;
    wrap.className = 'el-wrap' + (selection.kind === 'element' && selection.elementId === el.id ? ' selected' : '') + (hasCond ? ' has-cond' : '');
    wrap.innerHTML = `
      <div class="el-controls">
        <button data-act="up" title="Выше">↑</button>
        <button data-act="down" title="Ниже">↓</button>
        <button data-act="dup" title="Дублировать">⧉</button>
        <button data-act="del" title="Удалить">✕</button>
      </div>
    `;
    const inner = renderElementPreview(el);
    wrap.appendChild(inner);

    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.el-controls')) return;
      selection = { kind: 'element', screenId: scr.id, elementId: el.id };
      renderCanvas();
      renderProps();
    });
    wrap.querySelector('[data-act="up"]').onclick = () => moveElement(scr.id, el.id, -1);
    wrap.querySelector('[data-act="down"]').onclick = () => moveElement(scr.id, el.id, 1);
    wrap.querySelector('[data-act="dup"]').onclick = () => duplicateElement(scr.id, el.id);
    wrap.querySelector('[data-act="del"]').onclick = () => deleteElement(scr.id, el.id);

    holder.appendChild(wrap);
  });
}

function renderElementPreview(el) {
  const box = document.createElement('div');
  const st = el.style || {};
  switch (el.type) {
    case 'title':
      box.className = 'el-title';
      box.textContent = el.props.text;
      box.setAttribute('style', textCSSDecl(st.textColor));
      break;
    case 'text':
      box.className = 'el-text';
      box.textContent = el.props.text;
      box.setAttribute('style', textCSSDecl(st.textColor));
      break;
    case 'button':
      box.className = 'el-button';
      box.textContent = el.props.text;
      box.setAttribute('style', textCSSDecl(st.textColor) + bgCSSDecl(st.bg, false) + `border-radius:${st.radius}px;`);
      break;
    case 'input': {
      box.innerHTML = `<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:5px;">${esc(el.props.label)}</div>`;
      const input = document.createElement('div');
      input.className = 'el-input';
      input.textContent = el.props.placeholder;
      input.setAttribute('style', `opacity:0.6;${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;`);
      box.appendChild(input);
      break;
    }
    case 'image': {
      box.className = 'el-image';
      box.setAttribute('style', bgCSSDecl(st.bg, false) + `border-radius:${st.radius}px;`);
      const asset = el.props.assetId ? project.assets.find(a => a.id === el.props.assetId) : null;
      if (asset) {
        const img = document.createElement('img');
        img.src = asset.dataUrl;
        img.style.borderRadius = st.radius + 'px';
        box.appendChild(img);
      } else {
        box.textContent = '🖼️ ' + el.props.label;
      }
      break;
    }
    case 'divider':
      box.setAttribute('style', `width:${st.dividerWidth || 100}%;height:${st.dividerHeight || 2}px;margin:4px auto;${bgCSSDecl(st.bg, true)}border-radius:${st.radius || 0}px;`);
      break;
  }
  return box;
}

// =====================================================================
// РЕДАКТОР ЦВЕТА / ГРАДИЕНТА (переиспользуемый блок UI)
// =====================================================================
function colorEditorHTML(idPrefix, style, showEnable) {
  const isGrad = style.mode === 'gradient';
  return `
    ${showEnable ? `<label class="chk-row"><input type="checkbox" id="${idPrefix}_en" ${style.enabled ? 'checked' : ''}> Заливка фона</label>` : ''}
    <div class="color-mode-toggle" id="${idPrefix}_modes">
      <button type="button" data-mode="solid" class="${!isGrad ? 'active' : ''}">Сплошной</button>
      <button type="button" data-mode="gradient" class="${isGrad ? 'active' : ''}">Градиент</button>
    </div>
    <div class="color-row">
      <input type="color" id="${idPrefix}_c1" value="${style.color1}">
      <input type="color" id="${idPrefix}_c2" value="${style.color2}" style="${isGrad ? '' : 'display:none'}">
    </div>
    <div class="range-row" id="${idPrefix}_angleRow" style="${isGrad ? '' : 'display:none'}">
      <span class="field-hint" style="margin:0;white-space:nowrap;">угол</span>
      <input type="range" id="${idPrefix}_angle" min="0" max="360" value="${style.angle}">
      <span class="range-val" id="${idPrefix}_angleVal">${style.angle}°</span>
    </div>
  `;
}
function bindColorEditor(idPrefix, style, showEnable) {
  if (showEnable) {
    document.getElementById(idPrefix + '_en').onchange = (e) => { style.enabled = e.target.checked; persist(); renderCanvas(); };
  }
  document.querySelectorAll(`#${idPrefix}_modes button`).forEach(btn => {
    btn.onclick = () => { style.mode = btn.dataset.mode; persist(); renderCanvas(); renderProps(); };
  });
  document.getElementById(idPrefix + '_c1').oninput = (e) => { style.color1 = e.target.value; persist(); renderCanvas(); };
  const c2 = document.getElementById(idPrefix + '_c2');
  if (c2) c2.oninput = (e) => { style.color2 = e.target.value; persist(); renderCanvas(); };
  const angle = document.getElementById(idPrefix + '_angle');
  if (angle) angle.oninput = (e) => {
    style.angle = parseInt(e.target.value, 10);
    document.getElementById(idPrefix + '_angleVal').textContent = e.target.value + '°';
    persist(); renderCanvas();
  };
}

// =====================================================================
// РЕДАКТОР ПРАВИЛ УСЛОВИЯ (если ... И/ИЛИ ...)
// =====================================================================
function renderRulesList(container, owner) {
  container.innerHTML = '';
  if (project.variables.length === 0) {
    container.innerHTML = '<div class="small-note">Нет переменных. Добавьте их во вкладке «Переменные» слева.</div>';
    return;
  }
  owner.rules.forEach(rule => {
    const row = document.createElement('div');
    row.className = 'rule-row';
    const showValue = !['empty', 'notEmpty'].includes(rule.op);
    row.innerHTML = `
      <select class="rvar">${project.variables.map(v => `<option value="${v.id}" ${v.id === rule.varId ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
      <select class="rop">${OPERATORS.map(o => `<option value="${o.value}" ${o.value === rule.op ? 'selected' : ''}>${o.label}</option>`).join('')}</select>
      <input type="text" class="rval" placeholder="значение" value="${esc(rule.value)}" style="${showValue ? '' : 'display:none'}">
      <button class="del" type="button">✕</button>
    `;
    row.querySelector('.rvar').onchange = e => { rule.varId = e.target.value; persist(); };
    const opSel = row.querySelector('.rop');
    const valInput = row.querySelector('.rval');
    opSel.onchange = e => { rule.op = e.target.value; valInput.style.display = ['empty', 'notEmpty'].includes(rule.op) ? 'none' : ''; persist(); };
    valInput.oninput = e => { rule.value = e.target.value; persist(); };
    row.querySelector('.del').onclick = () => { owner.rules = owner.rules.filter(r => r.id !== rule.id); persist(); renderProps(); };
    container.appendChild(row);
  });
}

function renderConditionEditor(container, cond) {
  container.innerHTML = `
    <label class="chk-row"><input type="checkbox" id="condEnabled" ${cond.enabled ? 'checked' : ''}> Показывать по условию</label>
    <div id="condBody" style="${cond.enabled ? '' : 'display:none'}">
      <div class="field">
        <label>Логика между условиями</label>
        <select id="condLogic">
          <option value="AND" ${cond.logic === 'AND' ? 'selected' : ''}>Все условия верны (И)</option>
          <option value="OR" ${cond.logic === 'OR' ? 'selected' : ''}>Хотя бы одно верно (ИЛИ)</option>
        </select>
      </div>
      <div class="rules-list" id="condRules"></div>
      <button type="button" class="add-btn" id="condAddRule">+ добавить условие</button>
      <div class="small-note">Если условие не выполняется — элемент скрыт (это и есть «иначе»). Работает в предпросмотре и в экспортированном сайте, не в этом редакторе.</div>
    </div>
  `;
  renderRulesList(document.getElementById('condRules'), cond);
  document.getElementById('condEnabled').onchange = (e) => { cond.enabled = e.target.checked; persist(); renderProps(); };
  document.getElementById('condLogic').onchange = (e) => { cond.logic = e.target.value; persist(); };
  document.getElementById('condAddRule').onclick = () => {
    cond.rules.push({ id: uid('rule'), varId: project.variables[0] ? project.variables[0].id : '', op: 'eq', value: '' });
    persist(); renderProps();
  };
}

// =====================================================================
// РЕДАКТОР ДЕЙСТВИЯ (для кнопки, и вложенно для если/иначе)
// =====================================================================
function renderActionEditor(container, action, allowCondition) {
  const kinds = allowCondition === false ? ACTION_KINDS.filter(k => k.value !== 'condition') : ACTION_KINDS;
  container.innerHTML = `<div class="field"><label>Действие</label><select class="actKind">${kinds.map(k => `<option value="${k.value}" ${k.value === action.kind ? 'selected' : ''}>${k.label}</option>`).join('')}</select></div><div class="actBody"></div>`;
  const kindSel = container.querySelector('.actKind');
  const bodyWrap = container.querySelector('.actBody');

  function renderBody() {
    bodyWrap.innerHTML = '';
    if (action.kind === 'goto') {
      bodyWrap.innerHTML = `<div class="field"><label>Экран</label><select class="actTarget">${project.screens.map(s => `<option value="${s.id}" ${s.id === action.target ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>`;
      bodyWrap.querySelector('.actTarget').onchange = e => { action.target = e.target.value; persist(); };
    } else if (action.kind === 'link') {
      bodyWrap.innerHTML = `<div class="field"><label>Ссылка</label><input type="text" class="actTarget" placeholder="https://example.com" value="${esc(action.target)}"></div>`;
      bodyWrap.querySelector('.actTarget').oninput = e => { action.target = e.target.value; persist(); };
    } else if (action.kind === 'alert') {
      bodyWrap.innerHTML = `<div class="field"><label>Текст сообщения</label><input type="text" class="actTarget" value="${esc(action.target)}"></div>`;
      bodyWrap.querySelector('.actTarget').oninput = e => { action.target = e.target.value; persist(); };
    } else if (action.kind === 'setVar') {
      if (project.variables.length === 0) {
        bodyWrap.innerHTML = '<div class="small-note">Сначала добавьте переменную во вкладке «Переменные» слева.</div>';
      } else {
        bodyWrap.innerHTML = `
          <div class="field"><label>Переменная</label><select class="actVar">${project.variables.map(v => `<option value="${v.id}" ${v.id === action.varId ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Новое значение</label><input type="text" class="actVal" value="${esc(action.value)}"></div>
        `;
        bodyWrap.querySelector('.actVar').onchange = e => { action.varId = e.target.value; persist(); };
        bodyWrap.querySelector('.actVal').oninput = e => { action.value = e.target.value; persist(); };
      }
    } else if (action.kind === 'telegram') {
      bodyWrap.innerHTML = `
        <div class="field">
          <label>Шаблон сообщения</label>
          <textarea class="actTpl">${esc(action.template)}</textarea>
          <div class="field-hint">Можно вставлять {ИмяПеременной} — подставится текущее значение. Токен бота и chat id настраиваются во вкладке «Telegram» слева.</div>
        </div>
      `;
      bodyWrap.querySelector('.actTpl').oninput = e => { action.template = e.target.value; persist(); };
    } else if (action.kind === 'condition') {
      bodyWrap.innerHTML = `
        <div class="field"><label>Логика</label><select class="condLogicSel">
          <option value="AND" ${action.logic === 'AND' ? 'selected' : ''}>Все условия верны (И)</option>
          <option value="OR" ${action.logic === 'OR' ? 'selected' : ''}>Хотя бы одно верно (ИЛИ)</option>
        </select></div>
        <div class="rules-list condRulesList"></div>
        <button type="button" class="add-btn condAddRuleBtn">+ добавить условие</button>
        <div class="props-section-title">Если верно →</div>
        <div class="subaction-box thenBox"></div>
        <div class="props-section-title">Иначе →</div>
        <div class="subaction-box elseBox"></div>
      `;
      bodyWrap.querySelector('.condLogicSel').onchange = e => { action.logic = e.target.value; persist(); };
      renderRulesList(bodyWrap.querySelector('.condRulesList'), action);
      bodyWrap.querySelector('.condAddRuleBtn').onclick = () => {
        action.rules.push({ id: uid('rule'), varId: project.variables[0] ? project.variables[0].id : '', op: 'eq', value: '' });
        persist(); renderBody();
      };
      renderActionEditor(bodyWrap.querySelector('.thenBox'), action.thenAction, false);
      renderActionEditor(bodyWrap.querySelector('.elseBox'), action.elseAction, false);
    }
  }
  renderBody();
  kindSel.onchange = (e) => {
    const fresh = defaultActionOfKind(e.target.value);
    Object.keys(action).forEach(k => delete action[k]);
    Object.assign(action, fresh);
    persist();
    renderBody();
  };
}

// =====================================================================
// ПАНЕЛЬ СВОЙСТВ
// =====================================================================
function renderProps() {
  const empty = document.getElementById('propsEmpty');
  const content = document.getElementById('propsContent');
  content.innerHTML = '';

  if (selection.kind === 'screen') {
    empty.style.display = 'none';
    const scr = getActiveScreen();
    if (!scr) { empty.style.display = 'block'; return; }
    content.innerHTML = `
      <div class="field">
        <label>Название экрана</label>
        <input type="text" id="propScreenName" value="${esc(scr.name)}">
      </div>
      <div class="props-section-title">Фон экрана</div>
      <div id="screenBgWrap"></div>
      <div class="props-section-title">О проекте</div>
      <div class="field">
        <label>Название сайта</label>
        <input type="text" id="propSiteTitle" value="${esc(project.title)}">
        <div class="field-hint">Заголовок вкладки браузера в экспортированном сайте.</div>
      </div>
    `;
    document.getElementById('propScreenName').oninput = (e) => { scr.name = e.target.value; persist(); renderScreensList(); };
    document.getElementById('propSiteTitle').oninput = (e) => { project.title = e.target.value; persist(); };
    document.getElementById('screenBgWrap').innerHTML = colorEditorHTML('scrbg', scr.background, false);
    bindColorEditor('scrbg', scr.background, false);
    return;
  }

  // элемент
  const scr = getScreen(selection.screenId);
  const el = scr ? getElement(scr, selection.elementId) : null;
  if (!el) { empty.style.display = 'block'; selection = { kind: 'screen', screenId: project.activeScreenId, elementId: null }; return; }
  empty.style.display = 'none';

  let html = `<div class="props-section-title">${elementLabel(el.type)}</div>`;

  if (el.type === 'title' || el.type === 'text') {
    html += `<div class="field"><label>Текст</label><textarea id="propText">${esc(el.props.text)}</textarea></div>`;
  }
  if (el.type === 'button') {
    html += `<div class="field"><label>Текст на кнопке</label><input type="text" id="propText" value="${esc(el.props.text)}"></div>`;
  }
  if (el.type === 'input') {
    html += `
      <div class="field"><label>Подпись над полем</label><input type="text" id="propLabel" value="${esc(el.props.label)}"></div>
      <div class="field"><label>Текст-подсказка внутри поля</label><input type="text" id="propPlaceholder" value="${esc(el.props.placeholder)}"></div>
      <div class="field">
        <label>Сохранять значение в переменную</label>
        <select id="propVarBind">
          <option value="">— не привязано —</option>
          ${project.variables.map(v => `<option value="${v.id}" ${v.id === el.props.varId ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}
        </select>
        <div class="field-hint">При вводе текста значение сохраняется в переменную и может использоваться в условиях и Telegram-шаблонах (в предпросмотре/экспорте).</div>
      </div>
    `;
  }
  if (el.type === 'image') {
    html += `
      <div class="field">
        <label>Картинка</label>
        <select id="propAsset">
          <option value="">— плейсхолдер (без картинки) —</option>
          ${project.assets.map(a => `<option value="${a.id}" ${a.id === el.props.assetId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
        </select>
        <div class="field-hint">Файлы загружаются во вкладке «Медиа» слева.</div>
      </div>
      <div class="field"><label>Подпись плейсхолдера (если картинка не выбрана)</label><input type="text" id="propLabel" value="${esc(el.props.label)}"></div>
    `;
  }

  // --- Стиль: цвет текста ---
  if (['title', 'text', 'button'].includes(el.type)) {
    html += `<div class="props-section-title">Цвет текста</div><div id="styleTextWrap"></div>`;
  }
  // --- Стиль: фон (кнопка / поле / картинка) ---
  if (['button', 'input', 'image'].includes(el.type)) {
    html += `<div class="props-section-title">Фон элемента</div><div id="styleBgWrap"></div>`;
    html += `
      <div class="field">
        <label>Скругление углов (px)</label>
        <div class="range-row">
          <input type="range" id="propRadius" min="0" max="40" value="${el.style.radius}">
          <span class="range-val" id="propRadiusVal">${el.style.radius}px</span>
        </div>
      </div>
    `;
  }
  // --- Стиль разделителя ---
  if (el.type === 'divider') {
    html += `
      <div class="props-section-title">Цвет разделителя</div><div id="styleBgWrap"></div>
      <div class="field">
        <label>Ширина (%)</label>
        <div class="range-row"><input type="range" id="propDivWidth" min="5" max="100" value="${el.style.dividerWidth}"><span class="range-val" id="propDivWidthVal">${el.style.dividerWidth}%</span></div>
      </div>
      <div class="field">
        <label>Толщина (px)</label>
        <div class="range-row"><input type="range" id="propDivHeight" min="1" max="30" value="${el.style.dividerHeight}"><span class="range-val" id="propDivHeightVal">${el.style.dividerHeight}px</span></div>
      </div>
      <div class="field">
        <label>Скругление краёв (px)</label>
        <div class="range-row"><input type="range" id="propRadius" min="0" max="15" value="${el.style.radius}"><span class="range-val" id="propRadiusVal">${el.style.radius}px</span></div>
      </div>
    `;
  }

  // --- Действие кнопки ---
  if (el.type === 'button') {
    html += `<div class="props-section-title">Действие кнопки</div><div id="btnActionWrap"></div>`;
  }

  // --- Условие показа (для всех типов) ---
  html += `<div class="props-section-title">Видимость</div><div id="condWrap"></div>`;

  content.innerHTML = html;

  // привязка простых полей
  if (document.getElementById('propText')) document.getElementById('propText').oninput = (e) => { el.props.text = e.target.value; persist(); renderCanvas(); };
  if (document.getElementById('propLabel')) document.getElementById('propLabel').oninput = (e) => { el.props.label = e.target.value; persist(); renderCanvas(); };
  if (document.getElementById('propPlaceholder')) document.getElementById('propPlaceholder').oninput = (e) => { el.props.placeholder = e.target.value; persist(); renderCanvas(); };
  if (document.getElementById('propVarBind')) document.getElementById('propVarBind').onchange = (e) => { el.props.varId = e.target.value; persist(); };
  if (document.getElementById('propAsset')) document.getElementById('propAsset').onchange = (e) => { el.props.assetId = e.target.value; persist(); renderCanvas(); };

  // цвет текста
  if (document.getElementById('styleTextWrap')) {
    document.getElementById('styleTextWrap').innerHTML = colorEditorHTML('txtcol', el.style.textColor, false);
    bindColorEditor('txtcol', el.style.textColor, false);
  }
  // фон
  if (document.getElementById('styleBgWrap')) {
    const showEnable = el.type !== 'divider';
    document.getElementById('styleBgWrap').innerHTML = colorEditorHTML('bgcol', el.style.bg, showEnable);
    bindColorEditor('bgcol', el.style.bg, showEnable);
  }
  // радиус
  if (document.getElementById('propRadius')) {
    document.getElementById('propRadius').oninput = (e) => {
      el.style.radius = parseInt(e.target.value, 10);
      document.getElementById('propRadiusVal').textContent = e.target.value + 'px';
      persist(); renderCanvas();
    };
  }
  // divider ширина/толщина
  if (document.getElementById('propDivWidth')) {
    document.getElementById('propDivWidth').oninput = (e) => {
      el.style.dividerWidth = parseInt(e.target.value, 10);
      document.getElementById('propDivWidthVal').textContent = e.target.value + '%';
      persist(); renderCanvas();
    };
  }
  if (document.getElementById('propDivHeight')) {
    document.getElementById('propDivHeight').oninput = (e) => {
      el.style.dividerHeight = parseInt(e.target.value, 10);
      document.getElementById('propDivHeightVal').textContent = e.target.value + 'px';
      persist(); renderCanvas();
    };
  }
  // действие кнопки
  if (document.getElementById('btnActionWrap')) {
    renderActionEditor(document.getElementById('btnActionWrap'), el.props.action, true);
  }
  // условие видимости
  renderConditionEditor(document.getElementById('condWrap'), el.condition);
}

// =====================================================================
// МЕДИАФАЙЛЫ
// =====================================================================
function renderAssetsList() {
  const wrap = document.getElementById('assetsList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (project.assets.length === 0) { wrap.innerHTML = '<div class="small-note">Файлов пока нет. Загрузите картинку кнопкой выше.</div>'; return; }
  project.assets.forEach(a => {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.innerHTML = `
      <img class="asset-thumb" src="${a.dataUrl}">
      <input type="text" class="asset-name-input" value="${esc(a.name)}">
      <div class="asset-actions">
        <button data-act="dl" title="Скачать">⬇️</button>
        <button data-act="dup" title="Копировать">⧉</button>
        <button data-act="del" title="Удалить">✕</button>
      </div>
    `;
    card.querySelector('.asset-name-input').oninput = (e) => { a.name = e.target.value; persist(); renderProps(); };
    card.querySelector('[data-act="dl"]').onclick = () => downloadDataUrl(a.name, a.dataUrl);
    card.querySelector('[data-act="dup"]').onclick = () => {
      project.assets.push({ id: uid('asset'), name: a.name + ' (копия)', dataUrl: a.dataUrl });
      persist(); renderAssetsList();
    };
    card.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm('Удалить файл «' + a.name + '»? Если он используется как картинка на экране, там появится плейсхолдер.')) return;
      project.assets = project.assets.filter(x => x.id !== a.id);
      project.screens.forEach(s => s.elements.forEach(el => { if (el.type === 'image' && el.props.assetId === a.id) el.props.assetId = ''; }));
      persist(); renderAssetsList(); renderCanvas(); renderProps();
    };
    wrap.appendChild(card);
  });
}
function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function handleAssetUpload(files) {
  Array.from(files || []).forEach(f => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      project.assets.push({ id: uid('asset'), name: f.name, dataUrl: ev.target.result });
      persist();
      renderAssetsList();
    };
    reader.readAsDataURL(f);
  });
}

// =====================================================================
// ПЕРЕМЕННЫЕ
// =====================================================================
function renderVarsList() {
  const wrap = document.getElementById('varsList');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (project.variables.length === 0) { wrap.innerHTML = '<div class="small-note">Переменных пока нет.</div>'; return; }
  project.variables.forEach(v => {
    const row = document.createElement('div');
    row.className = 'var-row';
    row.innerHTML = `
      <input type="text" class="vname" placeholder="имя" value="${esc(v.name)}">
      <input type="text" class="vval" placeholder="начальное значение" value="${esc(v.value)}">
      <button class="del" title="Удалить">✕</button>
    `;
    row.querySelector('.vname').oninput = e => { v.name = e.target.value; persist(); renderProps(); };
    row.querySelector('.vval').oninput = e => { v.value = e.target.value; persist(); };
    row.querySelector('.del').onclick = () => {
      if (!confirm('Удалить переменную «' + v.name + '»?')) return;
      project.variables = project.variables.filter(x => x.id !== v.id);
      persist(); renderVarsList(); renderProps();
    };
    wrap.appendChild(row);
  });
}

// =====================================================================
// TELEGRAM
// =====================================================================
function renderTelegramTab() {
  const tok = document.getElementById('tgToken');
  if (!tok) return;
  const t = project.telegram;
  tok.value = t.botToken;
  document.getElementById('tgChat').value = t.chatId;
  document.getElementById('tgThread').value = t.threadId;
  tok.oninput = e => { t.botToken = e.target.value; persist(); };
  document.getElementById('tgChat').oninput = e => { t.chatId = e.target.value; persist(); };
  document.getElementById('tgThread').oninput = e => { t.threadId = e.target.value; persist(); };
}

// =====================================================================
// ЛОГИКА (для предвычисления начальной видимости при экспорте)
// =====================================================================
function evalRuleStatic(rule, stateMap) {
  const current = stateMap[rule.varId] !== undefined ? stateMap[rule.varId] : '';
  const val = rule.value || '';
  switch (rule.op) {
    case 'eq': return String(current) === String(val);
    case 'neq': return String(current) !== String(val);
    case 'contains': return String(current).includes(val);
    case 'gt': return parseFloat(current) > parseFloat(val);
    case 'lt': return parseFloat(current) < parseFloat(val);
    case 'empty': return String(current).trim() === '';
    case 'notEmpty': return String(current).trim() !== '';
    default: return false;
  }
}
function evalConditionStatic(cond, stateMap) {
  if (!cond || !cond.enabled || !cond.rules || cond.rules.length === 0) return true;
  const results = cond.rules.map(r => evalRuleStatic(r, stateMap));
  return cond.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

// =====================================================================
// СБОРКА ГОТОВОГО САЙТА
// =====================================================================
function renderElementExport(el, initialState) {
  const st = el.style || {};
  const condAttr = (el.condition && el.condition.enabled && el.condition.rules.length)
    ? ` data-cond='${JSON.stringify({ logic: el.condition.logic, rules: el.condition.rules }).replace(/'/g, '&apos;')}'`
    : '';
  const visible = evalConditionStatic(el.condition, initialState);
  const hideStyle = visible ? '' : 'display:none;';

  switch (el.type) {
    case 'title':
      return `<div class="title"${condAttr} style="${hideStyle}${textCSSDecl(st.textColor)}">${esc(el.props.text)}</div>`;
    case 'text':
      return `<div class="text"${condAttr} style="${hideStyle}${textCSSDecl(st.textColor)}">${esc(el.props.text)}</div>`;
    case 'button': {
      return `<button class="btn"${condAttr} style="${hideStyle}${textCSSDecl(st.textColor)}${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;" onclick="runAction(${esc(JSON.stringify(el.props.action))})">${esc(el.props.text)}</button>`;
    }
    case 'input': {
      const varAttr = el.props.varId ? ` oninput="setVar('${el.props.varId}', this.value)"` : '';
      return `<div${condAttr} style="${hideStyle}"><div class="field-label">${esc(el.props.label)}</div><input class="input" type="text" placeholder="${esc(el.props.placeholder)}" style="${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;"${varAttr}></div>`;
    }
    case 'image': {
      const asset = el.props.assetId ? project.assets.find(a => a.id === el.props.assetId) : null;
      if (asset) return `<img class="imgtag"${condAttr} src="${asset.dataUrl}" style="${hideStyle}border-radius:${st.radius}px;">`;
      return `<div class="image-box"${condAttr} style="${hideStyle}${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;">🖼️ ${esc(el.props.label)}</div>`;
    }
    case 'divider':
      return `<div${condAttr} style="${hideStyle}width:${st.dividerWidth}%;height:${st.dividerHeight}px;margin:4px auto;border-radius:${st.radius || 0}px;${bgCSSDecl(st.bg, true)}"></div>`;
    default:
      return '';
  }
}

function buildStandaloneHTML() {
  const firstId = project.screens[0].id;
  const initialState = {};
  project.variables.forEach(v => { initialState[v.id] = v.value; });

  const screensHTML = project.screens.map(scr => {
    const elementsHTML = scr.elements.map(el => renderElementExport(el, initialState)).join('\n');
    return `<div class="screen" id="screen-${scr.id}" style="display:${scr.id === firstId ? 'flex' : 'none'};${bgCSSDecl(scr.background, true)}">\n${elementsHTML}\n</div>`;
  }).join('\n');

  const varDefsJSON = JSON.stringify(project.variables.map(v => ({ id: v.id, name: v.name })));
  const stateInitJSON = JSON.stringify(initialState);
  const tg = project.telegram;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>${esc(project.title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { background:#14161f; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px 12px; }
  .phone { width:100%; max-width:400px; background:#000; border:2px solid #2c2f40; border-radius:18px; padding:26px 20px; min-height:640px; }
  .screen { display:flex; flex-direction:column; gap:14px; }
  .title { font-size:22px; font-weight:700; color:#fff; }
  .text { font-size:15px; line-height:1.55; color:rgba(255,255,255,0.75); }
  .btn { width:100%; padding:14px; text-align:center; border:2px solid #7c83fd; color:#fff; border-radius:6px; font-size:16px; font-weight:500; cursor:pointer; background:transparent; transition:0.15s; }
  .btn:active { transform:scale(0.97); opacity:0.8; }
  .field-label { color:rgba(255,255,255,0.5); font-size:13px; margin-bottom:4px; }
  .input { width:100%; padding:12px 14px; background:transparent; border:2px solid #7c83fd; border-radius:6px; color:#fff; font-size:15px; outline:none; }
  .image-box { width:100%; min-height:120px; border:2px dashed rgba(255,255,255,0.25); border-radius:8px; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.35); font-size:13px; text-align:center; }
  .imgtag { width:100%; display:block; }
  .credit { text-align:center; color:rgba(255,255,255,0.25); font-size:11px; margin-top:12px; }
</style>
</head>
<body>
<div class="phone">
${screensHTML}
</div>
<div class="credit">Site Builder · ForceNet</div>
<script>
  var state = ${stateInitJSON};
  var VAR_DEFS = ${varDefsJSON};
  var TG_BOT_TOKEN = ${JSON.stringify(tg.botToken)};
  var TG_CHAT_ID = ${JSON.stringify(tg.chatId)};
  var TG_THREAD_ID = ${JSON.stringify(tg.threadId)};

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s){ s.style.display = 'none'; });
    var target = document.getElementById('screen-' + id);
    if (target) target.style.display = 'flex';
  }

  function interpolate(str) {
    return String(str || '').replace(/\\{([^}]+)\\}/g, function(m, name) {
      var v = VAR_DEFS.find(function(d){ return d.name === name; });
      if (!v) return m;
      return state[v.id] !== undefined ? state[v.id] : '';
    });
  }

  function evalRule(rule) {
    var current = state[rule.varId] !== undefined ? state[rule.varId] : '';
    var val = rule.value || '';
    switch (rule.op) {
      case 'eq': return String(current) === String(val);
      case 'neq': return String(current) !== String(val);
      case 'contains': return String(current).indexOf(val) !== -1;
      case 'gt': return parseFloat(current) > parseFloat(val);
      case 'lt': return parseFloat(current) < parseFloat(val);
      case 'empty': return String(current).trim() === '';
      case 'notEmpty': return String(current).trim() !== '';
      default: return false;
    }
  }
  function evalCondition(cond) {
    if (!cond || !cond.rules || cond.rules.length === 0) return true;
    var results = cond.rules.map(evalRule);
    return cond.logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
  }

  function refreshConditions() {
    document.querySelectorAll('[data-cond]').forEach(function(node){
      try {
        var cond = JSON.parse(node.getAttribute('data-cond'));
        node.style.display = evalCondition(cond) ? '' : 'none';
      } catch (e) { /* ignore */ }
    });
  }

  function setVar(varId, value) { state[varId] = value; refreshConditions(); }

  function sendTelegram(template) {
    if (!TG_BOT_TOKEN || !TG_CHAT_ID) { console.warn('Telegram не настроен'); return; }
    var text = interpolate(template);
    var payload = { chat_id: TG_CHAT_ID, text: text };
    if (TG_THREAD_ID) payload.message_thread_id = parseInt(TG_THREAD_ID, 10);
    fetch('https://api.telegram.org/bot' + TG_BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(function(e){ console.error('Telegram error', e); });
  }

  function runAction(action) {
    if (!action) return;
    if (action.kind === 'goto') showScreen(action.target);
    else if (action.kind === 'link') window.open(action.target, '_blank');
    else if (action.kind === 'alert') alert(interpolate(action.target));
    else if (action.kind === 'setVar') setVar(action.varId, interpolate(action.value));
    else if (action.kind === 'telegram') sendTelegram(action.template);
    else if (action.kind === 'condition') runAction(evalCondition({ logic: action.logic, rules: action.rules }) ? action.thenAction : action.elseAction);
  }

  refreshConditions();
</script>
</body>
</html>`;
}

function downloadTextFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSite() { downloadTextFile('index.html', buildStandaloneHTML(), 'text/html'); }
function previewSite() {
  const blob = new Blob([buildStandaloneHTML()], { type: 'text/html' });
  window.open(URL.createObjectURL(blob), '_blank');
}
function exportProjectJSON() { downloadTextFile('project.json', JSON.stringify(project, null, 2), 'application/json'); }

function importProjectJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.screens || !Array.isArray(data.screens)) throw new Error('bad shape');
      project = migrateProject(data);
      project.activeScreenId = project.activeScreenId || (project.screens[0] && project.screens[0].id);
      selection = { kind: 'screen', screenId: project.activeScreenId, elementId: null };
      persist();
      renderAll();
      alert('✅ Проект загружен');
    } catch (err) {
      alert('❌ Не удалось прочитать файл проекта: похоже, это не тот формат.');
    }
  };
  reader.readAsText(file);
}

function newProject() {
  if (!confirm('Создать новый проект? Текущий будет заменён в редакторе (сохранённые файлы project.json это не затронет).')) return;
  project = defaultProject();
  selection = { kind: 'screen', screenId: project.activeScreenId, elementId: null };
  persist();
  renderAll();
}

// =====================================================================
// ПРИВЯЗКА СТАТИЧНОГО UI
// =====================================================================
function bindStaticUI() {
  document.getElementById('btnAddScreen').onclick = addScreen;
  document.getElementById('btnNewProject').onclick = newProject;
  document.getElementById('btnSaveJSON').onclick = exportProjectJSON;
  document.getElementById('btnExport').onclick = exportSite;
  document.getElementById('btnPreview').onclick = previewSite;
  document.getElementById('fileLoadJSON').addEventListener('change', (e) => {
    if (e.target.files[0]) importProjectJSON(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('palette').addEventListener('click', (e) => {
    const btn = e.target.closest('.palette-btn');
    if (btn) addElement(btn.dataset.type);
  });
  document.getElementById('fileUploadAssets').addEventListener('change', (e) => {
    handleAssetUpload(e.target.files);
    e.target.value = '';
  });
  document.getElementById('btnAddVar').onclick = () => {
    project.variables.push({ id: uid('var'), name: 'переменная' + (project.variables.length + 1), value: '' });
    persist();
    renderVarsList();
  };
  document.getElementById('leftTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
    document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
  });
}

// ---------- старт ----------
init();
