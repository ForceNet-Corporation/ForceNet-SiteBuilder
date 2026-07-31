/* =====================================================================
   SITE BUILDER by ForceNet
   Свободный холст: элементы перетаскиваются и меняют размер мышкой.
   Стили с градиентами и палитрой сохранённых цветов, шрифты и начертание,
   условная логика если/то/иначе/или, вычисления, медиафайлы,
   интеграция с Telegram (чат или личные сообщения).
   ===================================================================== */

const STORAGE_KEY = 'nocode_site_builder_project_v2';
const CANVAS_SIZE = { width: 390, height: 700 };

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
  { value: 'compute', label: 'Вычислить (математика/логика)' },
  { value: 'telegram', label: 'Отправить в Telegram' },
  { value: 'condition', label: 'Условие (если / то / иначе)' }
];

const FONT_OPTIONS = [
  { value: '', label: 'Обычный (по умолчанию)' },
  { value: "'Georgia', serif", label: 'Georgia (с засечками)' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New (моно)' },
  { value: "'Trebuchet MS', sans-serif", label: 'Trebuchet MS' },
  { value: "'Verdana', sans-serif", label: 'Verdana' },
  { value: "'Arial', sans-serif", label: 'Arial' },
  { value: "'Impact', sans-serif", label: 'Impact (акцент)' }
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
// ЦВЕТ / ГРАДИЕНТ
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
function fontCSSDecl(font) {
  if (!font) return '';
  let decl = '';
  if (font.family) decl += `font-family:${font.family};`;
  if (font.bold) decl += `font-weight:700;`;
  if (font.italic) decl += `font-style:italic;`;
  const deco = [];
  if (font.underline) deco.push('underline');
  if (font.strike) deco.push('line-through');
  if (deco.length) decl += `text-decoration:${deco.join(' ')};`;
  return decl;
}

// ---------- палитра сохранённых цветов ----------
function paletteMatches(p, style) {
  return p.mode === style.mode && p.color1 === style.color1 && (style.mode !== 'gradient' || (p.color2 === style.color2 && p.angle === style.angle));
}
function addToPalette(style) {
  if (project.colorPalette.some(p => paletteMatches(p, style))) return;
  project.colorPalette.push({ id: uid('pal'), mode: style.mode, color1: style.color1, color2: style.color2, angle: style.angle });
  if (project.colorPalette.length > 30) project.colorPalette.shift();
  persist();
}

// =====================================================================
// ДАННЫЕ ПО УМОЛЧАНИЮ
// =====================================================================
function defaultBackground() { return { enabled: true, mode: 'solid', color1: '#000000', color2: '#1b1e2a', angle: 135 }; }
function defaultCondition() { return { enabled: false, logic: 'AND', rules: [] }; }
function defaultFont() { return { family: '', bold: false, italic: false, underline: false, strike: false }; }

function defaultSizeFor(type) {
  switch (type) {
    case 'title': return { width: 300, height: 44 };
    case 'text': return { width: 300, height: 80 };
    case 'button': return { width: 220, height: 50 };
    case 'input': return { width: 280, height: 70 };
    case 'image': return { width: 200, height: 150 };
    case 'divider': return { width: 300, height: 3 };
    default: return { width: 200, height: 50 };
  }
}

function defaultStyleFor(type) {
  const style = { pos: { x: 20, y: 20 }, size: defaultSizeFor(type) };
  if (['title', 'text', 'button'].includes(type)) {
    style.textColor = defaultColorStyle(type === 'text' ? '#c7c9d6' : '#ffffff', '#e8a33d', false);
    style.font = defaultFont();
  }
  if (['button', 'input', 'image'].includes(type)) {
    style.bg = defaultColorStyle('#7c83fd', '#e8a33d', false);
    style.radius = type === 'image' ? 8 : 6;
  }
  if (type === 'divider') {
    style.bg = defaultColorStyle('#3a3d52', '#7c83fd', true);
    style.radius = 4;
  }
  return style;
}

function nextPosFor(scr) {
  const idx = scr.elements.length;
  return { x: 20, y: 20 + idx * 80 };
}

function defaultActionOfKind(kind) {
  switch (kind) {
    case 'goto': return { kind: 'goto', target: (project && project.screens[0] && project.screens[0].id) || '' };
    case 'link': return { kind: 'link', target: 'https://' };
    case 'setVar': return { kind: 'setVar', varId: (project && project.variables[0] && project.variables[0].id) || '', value: '' };
    case 'compute': return { kind: 'compute', varId: (project && project.variables[0] && project.variables[0].id) || '', expression: '' };
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
    colorPalette: [],
    telegram: { mode: 'chat', botToken: '', chatId: '', userId: '', threadId: '' },
    activeScreenId: screenId,
    screens: [
      {
        id: screenId,
        name: 'Главная',
        background: defaultBackground(),
        elements: [
          { id: uid('el'), type: 'title', props: { text: 'Добро пожаловать' }, style: { ...defaultStyleFor('title'), pos: { x: 20, y: 20 } }, condition: defaultCondition() },
          { id: uid('el'), type: 'text', props: { text: 'Это стартовый экран. Перетаскивайте и растягивайте элементы прямо на холсте — код писать не нужно.' }, style: { ...defaultStyleFor('text'), pos: { x: 20, y: 80 } }, condition: defaultCondition() },
          { id: uid('el'), type: 'button', props: { text: 'Нажми меня', action: defaultActionOfKind('alert') }, style: { ...defaultStyleFor('button'), pos: { x: 20, y: 180 } }, condition: defaultCondition() }
        ]
      }
    ]
  };
}

function migrateProject(p) {
  p.title = p.title || 'Мой сайт';
  p.variables = Array.isArray(p.variables) ? p.variables : [];
  p.assets = Array.isArray(p.assets) ? p.assets : [];
  p.colorPalette = Array.isArray(p.colorPalette) ? p.colorPalette : [];
  p.telegram = p.telegram || {};
  p.telegram.mode = p.telegram.mode === 'dm' ? 'dm' : 'chat';
  p.telegram.botToken = p.telegram.botToken || '';
  p.telegram.chatId = p.telegram.chatId || '';
  p.telegram.userId = p.telegram.userId || '';
  p.telegram.threadId = p.telegram.threadId || '';
  p.screens = p.screens || [];
  p.screens.forEach(scr => {
    scr.background = scr.background || defaultBackground();
    scr.elements = scr.elements || [];
    scr.elements.forEach((el, idx) => {
      el.style = el.style || defaultStyleFor(el.type);
      if (!el.style.pos) {
        // старый формат без позиции: раскладываем каскадом сверху вниз
        const oldW = el.style.dividerWidth;
        const oldH = el.style.dividerHeight;
        el.style.pos = { x: 20, y: 20 + idx * 80 };
        el.style.size = el.type === 'divider'
          ? { width: oldW ? Math.round(CANVAS_SIZE.width * oldW / 100) : 300, height: oldH || 3 }
          : defaultSizeFor(el.type);
        delete el.style.dividerWidth;
        delete el.style.dividerHeight;
      }
      if (!el.style.size) el.style.size = defaultSizeFor(el.type);
      if (['title', 'text', 'button'].includes(el.type) && !el.style.font) el.style.font = defaultFont();
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
  project.screens.forEach(s => s.elements.forEach(el => { if (el.type === 'button') fixDanglingGoto(el.props.action, id); }));
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
  el.style.pos = nextPosFor(scr);
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
  copy.style.pos = { x: el.style.pos.x + 16, y: el.style.pos.y + 16 };
  scr.elements.splice(idx + 1, 0, copy);
  selection = { kind: 'element', screenId, elementId: copy.id };
  persist();
  renderAll();
}

function elementLabel(type) {
  return { title: 'Заголовок', text: 'Текст', button: 'Кнопка', input: 'Поле ввода', image: 'Картинка', divider: 'Разделитель' }[type] || type;
}

// =====================================================================
// ХОЛСТ: РЕНДЕР + ПЕРЕТАСКИВАНИЕ + РЕСАЙЗ
// =====================================================================
function renderCanvas() {
  const holder = document.getElementById('phoneScreen');
  holder.innerHTML = '';
  const scr = getActiveScreen();
  if (!scr) return;

  holder.setAttribute('style', `width:${CANVAS_SIZE.width}px;height:${CANVAS_SIZE.height}px;${bgCSSDecl(scr.background, true)}`);

  if (scr.elements.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'Холст пуст. Добавьте элементы из левой панели «Добавить на холст».';
    holder.appendChild(hint);
    return;
  }

  scr.elements.forEach(el => {
    const wrap = document.createElement('div');
    const hasCond = el.condition && el.condition.enabled && el.condition.rules.length > 0;
    wrap.className = 'el-wrap' + (selection.kind === 'element' && selection.elementId === el.id ? ' selected' : '') + (hasCond ? ' has-cond' : '');
    wrap.style.left = el.style.pos.x + 'px';
    wrap.style.top = el.style.pos.y + 'px';
    wrap.style.width = el.style.size.width + 'px';
    wrap.style.height = el.style.size.height + 'px';

    wrap.innerHTML = `
      <div class="el-controls">
        <button data-act="dup" title="Дублировать">⧉</button>
        <button data-act="del" title="Удалить">✕</button>
      </div>
      <div class="rh rh-e" title="Изменить ширину"></div>
      <div class="rh rh-s" title="Изменить высоту"></div>
      <div class="rh rh-se" title="Изменить размер (сразу оба)"></div>
    `;
    const content = renderElementPreview(el);
    content.classList.add('el-content');
    wrap.insertBefore(content, wrap.firstChild);

    wrap.addEventListener('mousedown', (e) => {
      if (e.target.closest('.rh') || e.target.closest('.el-controls')) return;
      selectElementSoft(scr.id, el.id, wrap);
      startDrag(e, wrap, el);
    });
    wrap.querySelector('[data-act="dup"]').onclick = (e) => { e.stopPropagation(); duplicateElement(scr.id, el.id); };
    wrap.querySelector('[data-act="del"]').onclick = (e) => { e.stopPropagation(); deleteElement(scr.id, el.id); };
    startResize(wrap.querySelector('.rh-e'), el, 'e');
    startResize(wrap.querySelector('.rh-s'), el, 's');
    startResize(wrap.querySelector('.rh-se'), el, 'se');

    holder.appendChild(wrap);
  });
}

function selectElementSoft(screenId, elId, wrapEl) {
  document.querySelectorAll('.el-wrap.selected').forEach(w => w.classList.remove('selected'));
  wrapEl.classList.add('selected');
  selection = { kind: 'element', screenId, elementId: elId };
  renderProps();
}

function startDrag(e, wrapEl, el) {
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const origX = el.style.pos.x, origY = el.style.pos.y;
  function onMove(ev) {
    el.style.pos.x = Math.max(0, origX + (ev.clientX - startX));
    el.style.pos.y = Math.max(0, origY + (ev.clientY - startY));
    wrapEl.style.left = el.style.pos.x + 'px';
    wrapEl.style.top = el.style.pos.y + 'px';
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    persist();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function startResize(handleEl, el, mode) {
  if (!handleEl) return;
  handleEl.addEventListener('mousedown', (e) => {
    e.stopPropagation(); e.preventDefault();
    const wrapEl = handleEl.parentElement;
    const startX = e.clientX, startY = e.clientY;
    const origW = el.style.size.width, origH = el.style.size.height;
    function onMove(ev) {
      if (mode === 'e' || mode === 'se') el.style.size.width = Math.max(24, origW + (ev.clientX - startX));
      if (mode === 's' || mode === 'se') el.style.size.height = Math.max(16, origH + (ev.clientY - startY));
      wrapEl.style.width = el.style.size.width + 'px';
      wrapEl.style.height = el.style.size.height + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      persist();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function renderElementPreview(el) {
  const box = document.createElement('div');
  const st = el.style || {};
  const fontDecl = fontCSSDecl(st.font);
  switch (el.type) {
    case 'title':
      box.className = 'el-title';
      box.textContent = el.props.text;
      box.setAttribute('style', `width:100%;height:100%;${textCSSDecl(st.textColor)}${fontDecl}`);
      break;
    case 'text':
      box.className = 'el-text';
      box.textContent = el.props.text;
      box.setAttribute('style', `width:100%;height:100%;${textCSSDecl(st.textColor)}${fontDecl}`);
      break;
    case 'button':
      box.className = 'el-button';
      box.textContent = el.props.text;
      box.setAttribute('style', `width:100%;height:100%;${textCSSDecl(st.textColor)}${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;${fontDecl}`);
      break;
    case 'input': {
      box.setAttribute('style', 'width:100%;height:100%;display:flex;flex-direction:column;gap:4px;');
      box.innerHTML = `<div style="font-size:12px;color:rgba(255,255,255,0.5);">${esc(el.props.label)}</div>`;
      const input = document.createElement('div');
      input.className = 'el-input';
      input.textContent = el.props.placeholder;
      input.setAttribute('style', `flex:1;opacity:0.6;${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;`);
      box.appendChild(input);
      break;
    }
    case 'image': {
      box.className = 'el-image';
      box.setAttribute('style', `width:100%;height:100%;${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;`);
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
      box.setAttribute('style', `width:100%;height:100%;${bgCSSDecl(st.bg, true)}border-radius:${st.radius || 0}px;`);
      break;
  }
  return box;
}

// =====================================================================
// РЕДАКТОР ЦВЕТА / ГРАДИЕНТА + ПАЛИТРА
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
    <div class="swatch-row" id="${idPrefix}_swatches"></div>
  `;
}
function renderSwatchRow(containerId, style) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (project.colorPalette.length === 0) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = project.colorPalette.map(p => {
    const bg = p.mode === 'gradient' ? `linear-gradient(${p.angle}deg, ${p.color1}, ${p.color2})` : p.color1;
    return `<div class="swatch" data-id="${p.id}" style="background:${bg};" title="Применить этот цвет"></div>`;
  }).join('');
  wrap.querySelectorAll('.swatch').forEach(sw => {
    sw.onclick = () => {
      const p = project.colorPalette.find(x => x.id === sw.dataset.id);
      if (!p) return;
      style.mode = p.mode; style.color1 = p.color1; style.color2 = p.color2; style.angle = p.angle;
      persist(); renderCanvas(); renderProps();
    };
  });
}
function bindColorEditor(idPrefix, style, showEnable) {
  if (showEnable) {
    document.getElementById(idPrefix + '_en').onchange = (e) => { style.enabled = e.target.checked; persist(); renderCanvas(); };
  }
  document.querySelectorAll(`#${idPrefix}_modes button`).forEach(btn => {
    btn.onclick = () => { style.mode = btn.dataset.mode; persist(); renderCanvas(); renderProps(); };
  });
  const c1 = document.getElementById(idPrefix + '_c1');
  c1.oninput = (e) => { style.color1 = e.target.value; persist(); renderCanvas(); };
  c1.onchange = () => { addToPalette(style); renderProps(); };
  const c2 = document.getElementById(idPrefix + '_c2');
  if (c2) {
    c2.oninput = (e) => { style.color2 = e.target.value; persist(); renderCanvas(); };
    c2.onchange = () => { addToPalette(style); renderProps(); };
  }
  const angle = document.getElementById(idPrefix + '_angle');
  if (angle) {
    angle.oninput = (e) => {
      style.angle = parseInt(e.target.value, 10);
      document.getElementById(idPrefix + '_angleVal').textContent = e.target.value + '°';
      persist(); renderCanvas();
    };
    angle.onchange = () => { addToPalette(style); renderProps(); };
  }
  renderSwatchRow(idPrefix + '_swatches', style);
}

// =====================================================================
// РЕДАКТОР ПРАВИЛ УСЛОВИЯ
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
// РЕДАКТОР ДЕЙСТВИЯ
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
    } else if (action.kind === 'compute') {
      if (project.variables.length === 0) {
        bodyWrap.innerHTML = '<div class="small-note">Сначала добавьте переменную во вкладке «Переменные» слева.</div>';
      } else {
        bodyWrap.innerHTML = `
          <div class="field"><label>Записать результат в переменную</label><select class="actVar">${project.variables.map(v => `<option value="${v.id}" ${v.id === action.varId ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></div>
          <div class="field">
            <label>Выражение</label>
            <input type="text" class="actExpr" value="${esc(action.expression)}" placeholder="{очки} + 10">
            <div class="field-hint">Операторы: + − * / % ( ). Сравнения: &gt; &lt; &gt;= &lt;= == !=. Логика: &amp;&amp; || !. Переменные — в фигурных скобках, например {очки}.</div>
          </div>
        `;
        bodyWrap.querySelector('.actVar').onchange = e => { action.varId = e.target.value; persist(); };
        bodyWrap.querySelector('.actExpr').oninput = e => { action.expression = e.target.value; persist(); };
      }
    } else if (action.kind === 'telegram') {
      bodyWrap.innerHTML = `
        <div class="field">
          <label>Шаблон сообщения</label>
          <textarea class="actTpl">${esc(action.template)}</textarea>
          <div class="field-hint">Можно вставлять {ИмяПеременной} — подставится текущее значение. Получатель настраивается во вкладке «Telegram» слева.</div>
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

  if (['title', 'text', 'button'].includes(el.type)) {
    html += `<div class="props-section-title">Шрифт и стиль текста</div><div id="fontWrap"></div>`;
    html += `<div class="props-section-title">Цвет текста</div><div id="styleTextWrap"></div>`;
  }
  if (['button', 'input', 'image'].includes(el.type)) {
    html += `<div class="props-section-title">Фон элемента</div><div id="styleBgWrap"></div>`;
    html += `
      <div class="field">
        <label>Скругление углов (px)</label>
        <div class="range-row"><input type="range" id="propRadius" min="0" max="40" value="${el.style.radius}"><span class="range-val" id="propRadiusVal">${el.style.radius}px</span></div>
      </div>
    `;
  }
  if (el.type === 'divider') {
    html += `<div class="props-section-title">Цвет разделителя</div><div id="styleBgWrap"></div>`;
    html += `
      <div class="field">
        <label>Скругление краёв (px)</label>
        <div class="range-row"><input type="range" id="propRadius" min="0" max="15" value="${el.style.radius}"><span class="range-val" id="propRadiusVal">${el.style.radius}px</span></div>
      </div>
      <div class="small-note">Ширину и толщину меняйте, перетаскивая за края/уголок прямо на холсте.</div>
    `;
  }
  if (el.type === 'button') {
    html += `<div class="props-section-title">Действие кнопки</div><div id="btnActionWrap"></div>`;
  }
  html += `<div class="props-section-title">Видимость</div><div id="condWrap"></div>`;

  content.innerHTML = html;

  if (document.getElementById('propText')) document.getElementById('propText').oninput = (e) => { el.props.text = e.target.value; persist(); renderCanvas(); };
  if (document.getElementById('propLabel')) document.getElementById('propLabel').oninput = (e) => { el.props.label = e.target.value; persist(); renderCanvas(); };
  if (document.getElementById('propPlaceholder')) document.getElementById('propPlaceholder').oninput = (e) => { el.props.placeholder = e.target.value; persist(); renderCanvas(); };
  if (document.getElementById('propVarBind')) document.getElementById('propVarBind').onchange = (e) => { el.props.varId = e.target.value; persist(); };
  if (document.getElementById('propAsset')) document.getElementById('propAsset').onchange = (e) => { el.props.assetId = e.target.value; persist(); renderCanvas(); };

  if (document.getElementById('fontWrap')) {
    const fw = document.getElementById('fontWrap');
    fw.innerHTML = `
      <div class="field"><label>Шрифт</label><select id="fontFamily">${FONT_OPTIONS.map(f => `<option value="${f.value}" ${f.value === el.style.font.family ? 'selected' : ''}>${f.label}</option>`).join('')}</select></div>
      <div class="font-toggle-row">
        <button type="button" class="ftbtn ${el.style.font.bold ? 'active' : ''}" data-k="bold" title="Жирный"><b>Ж</b></button>
        <button type="button" class="ftbtn ${el.style.font.italic ? 'active' : ''}" data-k="italic" title="Курсив"><i>К</i></button>
        <button type="button" class="ftbtn ${el.style.font.underline ? 'active' : ''}" data-k="underline" title="Подчёркнутый" style="text-decoration:underline;">П</button>
        <button type="button" class="ftbtn ${el.style.font.strike ? 'active' : ''}" data-k="strike" title="Зачёркнутый" style="text-decoration:line-through;">З</button>
      </div>
    `;
    fw.querySelector('#fontFamily').onchange = e => { el.style.font.family = e.target.value; persist(); renderCanvas(); };
    fw.querySelectorAll('.ftbtn').forEach(btn => {
      btn.onclick = () => { el.style.font[btn.dataset.k] = !el.style.font[btn.dataset.k]; persist(); renderCanvas(); renderProps(); };
    });
  }
  if (document.getElementById('styleTextWrap')) {
    document.getElementById('styleTextWrap').innerHTML = colorEditorHTML('txtcol', el.style.textColor, false);
    bindColorEditor('txtcol', el.style.textColor, false);
  }
  if (document.getElementById('styleBgWrap')) {
    const showEnable = el.type !== 'divider';
    document.getElementById('styleBgWrap').innerHTML = colorEditorHTML('bgcol', el.style.bg, showEnable);
    bindColorEditor('bgcol', el.style.bg, showEnable);
  }
  if (document.getElementById('propRadius')) {
    document.getElementById('propRadius').oninput = (e) => {
      el.style.radius = parseInt(e.target.value, 10);
      document.getElementById('propRadiusVal').textContent = e.target.value + 'px';
      persist(); renderCanvas();
    };
  }
  if (document.getElementById('btnActionWrap')) {
    renderActionEditor(document.getElementById('btnActionWrap'), el.props.action, true);
  }
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
        <button data-act="up" title="Выше в списке">↑</button>
        <button data-act="down" title="Ниже в списке">↓</button>
        <button data-act="replace" title="Изменить файл">✏️</button>
        <button data-act="dl" title="Скачать">⬇️</button>
        <button data-act="dup" title="Копировать">⧉</button>
        <button data-act="del" title="Удалить">✕</button>
      </div>
      <input type="file" accept="image/*" class="asset-replace-input" hidden>
    `;
    card.querySelector('.asset-name-input').oninput = (e) => { a.name = e.target.value; persist(); renderProps(); };
    card.querySelector('[data-act="up"]').onclick = () => moveAsset(a.id, -1);
    card.querySelector('[data-act="down"]').onclick = () => moveAsset(a.id, 1);
    card.querySelector('[data-act="dl"]').onclick = () => downloadDataUrl(a.name, a.dataUrl);
    card.querySelector('[data-act="dup"]').onclick = () => {
      project.assets.push({ id: uid('asset'), name: a.name + ' (копия)', dataUrl: a.dataUrl });
      persist(); renderAssetsList();
    };
    const replaceInput = card.querySelector('.asset-replace-input');
    card.querySelector('[data-act="replace"]').onclick = () => replaceInput.click();
    replaceInput.addEventListener('change', (e) => {
      if (e.target.files[0]) replaceAsset(a.id, e.target.files[0]);
      e.target.value = '';
    });
    card.querySelector('[data-act="del"]').onclick = () => {
      if (!confirm('Удалить файл «' + a.name + '»? Если он используется как картинка на экране, там появится плейсхолдер.')) return;
      project.assets = project.assets.filter(x => x.id !== a.id);
      project.screens.forEach(s => s.elements.forEach(el => { if (el.type === 'image' && el.props.assetId === a.id) el.props.assetId = ''; }));
      persist(); renderAssetsList(); renderCanvas(); renderProps();
    };
    wrap.appendChild(card);
  });
}
function moveAsset(id, dir) {
  const idx = project.assets.findIndex(a => a.id === id);
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= project.assets.length) return;
  const [item] = project.assets.splice(idx, 1);
  project.assets.splice(newIdx, 0, item);
  persist(); renderAssetsList();
}
function replaceAsset(id, file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    const asset = project.assets.find(a => a.id === id);
    if (asset) { asset.dataUrl = ev.target.result; persist(); renderAssetsList(); renderCanvas(); }
  };
  reader.readAsDataURL(file);
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
  document.getElementById('tgMode').value = t.mode;
  document.getElementById('tgChat').value = t.chatId;
  document.getElementById('tgThread').value = t.threadId;
  document.getElementById('tgUserId').value = t.userId;
  updateTelegramModeUI(t.mode);

  tok.oninput = e => { t.botToken = e.target.value; persist(); };
  document.getElementById('tgMode').onchange = e => { t.mode = e.target.value; persist(); updateTelegramModeUI(t.mode); };
  document.getElementById('tgChat').oninput = e => { t.chatId = e.target.value; persist(); };
  document.getElementById('tgThread').oninput = e => { t.threadId = e.target.value; persist(); };
  document.getElementById('tgUserId').oninput = e => { t.userId = e.target.value; persist(); };
}
function updateTelegramModeUI(mode) {
  document.getElementById('tgChatWrap').style.display = mode === 'dm' ? 'none' : 'block';
  document.getElementById('tgThreadWrap').style.display = mode === 'dm' ? 'none' : 'block';
  document.getElementById('tgUserWrap').style.display = mode === 'dm' ? 'block' : 'none';
}

// =====================================================================
// ЛОГИКА: ПРЕДВЫЧИСЛЕНИЕ НАЧАЛЬНОЙ ВИДИМОСТИ ПРИ ЭКСПОРТЕ
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
  const pos = st.pos || { x: 20, y: 20 };
  const size = st.size || { width: 200, height: 50 };
  const posDecl = `position:absolute;left:${pos.x}px;top:${pos.y}px;width:${size.width}px;height:${size.height}px;`;
  const condAttr = (el.condition && el.condition.enabled && el.condition.rules.length)
    ? ` data-cond='${JSON.stringify({ logic: el.condition.logic, rules: el.condition.rules }).replace(/'/g, '&apos;')}'`
    : '';
  const visible = evalConditionStatic(el.condition, initialState);
  const hideDecl = visible ? '' : 'display:none;';
  const fontDecl = fontCSSDecl(st.font);

  switch (el.type) {
    case 'title':
      return `<div class="title"${condAttr} style="${posDecl}${hideDecl}${textCSSDecl(st.textColor)}${fontDecl}">${esc(el.props.text)}</div>`;
    case 'text':
      return `<div class="text"${condAttr} style="${posDecl}${hideDecl}${textCSSDecl(st.textColor)}${fontDecl}">${esc(el.props.text)}</div>`;
    case 'button':
      return `<button class="btn"${condAttr} style="${posDecl}${hideDecl}${textCSSDecl(st.textColor)}${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;${fontDecl}" onclick="runAction(${esc(JSON.stringify(el.props.action))})">${esc(el.props.text)}</button>`;
    case 'input': {
      const varAttr = el.props.varId ? ` oninput="setVar('${el.props.varId}', this.value)"` : '';
      return `<div${condAttr} style="${posDecl}${hideDecl}display:flex;flex-direction:column;gap:4px;"><div class="field-label">${esc(el.props.label)}</div><input class="input" type="text" placeholder="${esc(el.props.placeholder)}" style="flex:1;${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;"${varAttr}></div>`;
    }
    case 'image': {
      const asset = el.props.assetId ? project.assets.find(a => a.id === el.props.assetId) : null;
      if (asset) return `<img class="imgtag"${condAttr} src="${asset.dataUrl}" style="${posDecl}${hideDecl}object-fit:cover;border-radius:${st.radius}px;">`;
      return `<div class="image-box"${condAttr} style="${posDecl}${hideDecl}${bgCSSDecl(st.bg, false)}border-radius:${st.radius}px;">🖼️ ${esc(el.props.label)}</div>`;
    }
    case 'divider':
      return `<div${condAttr} style="${posDecl}${hideDecl}${bgCSSDecl(st.bg, true)}border-radius:${st.radius || 0}px;"></div>`;
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
    return `<div class="screen" id="screen-${scr.id}" style="display:${scr.id === firstId ? 'block' : 'none'};${bgCSSDecl(scr.background, true)}">\n${elementsHTML}\n</div>`;
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
  html, body { min-height: 100%; }
  body { background:#0e0f14; }
  .screen { position:relative; min-height:100vh; width:100%; }
  .title { font-size:22px; font-weight:700; color:#fff; overflow:hidden; }
  .text { font-size:15px; line-height:1.55; color:rgba(255,255,255,0.75); overflow:hidden; }
  .btn { text-align:center; border:2px solid #7c83fd; color:#fff; font-size:16px; font-weight:500; cursor:pointer; background:transparent; transition:0.15s; display:flex; align-items:center; justify-content:center; }
  .btn:active { transform:scale(0.97); opacity:0.8; }
  .field-label { color:rgba(255,255,255,0.5); font-size:13px; }
  .input { padding:10px 12px; background:transparent; border:2px solid #7c83fd; color:#fff; font-size:15px; outline:none; }
  .image-box { border:2px dashed rgba(255,255,255,0.25); display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.35); font-size:13px; text-align:center; }
  .imgtag { display:block; }
  .credit { position:fixed; left:0; right:0; bottom:16px; text-align:center; color:rgba(255,255,255,0.4); font-size:12px; opacity:0; transition:opacity 0.8s ease; pointer-events:none; }
</style>
</head>
<body>
${screensHTML}
<div class="credit" id="creditText">made by the ForceNet website generator</div>
<script>
  var state = ${stateInitJSON};
  var VAR_DEFS = ${varDefsJSON};
  var TG_BOT_TOKEN = ${JSON.stringify(tg.botToken)};
  var TG_MODE = ${JSON.stringify(tg.mode)};
  var TG_CHAT_ID = ${JSON.stringify(tg.chatId)};
  var TG_USER_ID = ${JSON.stringify(tg.userId)};
  var TG_THREAD_ID = ${JSON.stringify(tg.threadId)};

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function(s){ s.style.display = 'none'; });
    var target = document.getElementById('screen-' + id);
    if (target) target.style.display = 'block';
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

  function runCompute(expression) {
    var text = interpolate(expression);
    var safe = /^[0-9+\\-*/%.()<>=!&|\\s]+$/.test(text);
    if (!safe) return '';
    try { return String(Function('"use strict";return (' + text + ')')()); } catch (e) { return ''; }
  }

  function sendTelegram(template) {
    if (!TG_BOT_TOKEN) { console.warn('Telegram-бот не настроен'); return; }
    var recipient = TG_MODE === 'dm' ? TG_USER_ID : TG_CHAT_ID;
    if (!recipient) { console.warn('Не указан получатель Telegram'); return; }
    var text = interpolate(template);
    var payload = { chat_id: recipient, text: text };
    if (TG_MODE !== 'dm' && TG_THREAD_ID) payload.message_thread_id = parseInt(TG_THREAD_ID, 10);
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
    else if (action.kind === 'compute') setVar(action.varId, runCompute(action.expression));
    else if (action.kind === 'telegram') sendTelegram(action.template);
    else if (action.kind === 'condition') runAction(evalCondition({ logic: action.logic, rules: action.rules }) ? action.thenAction : action.elseAction);
  }

  refreshConditions();
  window.addEventListener('load', function () {
    var credit = document.getElementById('creditText');
    if (credit) {
      setTimeout(function () { credit.style.opacity = '1'; }, 150);
      setTimeout(function () { credit.style.opacity = '0'; }, 3150);
    }
  });
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
