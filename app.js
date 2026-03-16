/**
 * Калькулятор материала для каркасной стены
 * Расчёт количества элементов и визуализация чертежа в SVG
 */

// ============================================================
// Хранилище проёмов
// ============================================================

/** @type {Array<{id: number, type: 'door'|'window', width: number, height: number, offsetX: number, offsetY: number}>} */
let openings = [];
let openingIdCounter = 0;

/**
 * Создаёт HTML-карточку проёма
 * @param {object} opening - данные проёма
 * @returns {HTMLElement}
 */
function createOpeningCard(opening) {
    const card = document.createElement('div');
    card.className = 'opening-card';
    card.dataset.id = String(opening.id);

    const isDoor = opening.type === 'door';

    card.innerHTML = `
        <div class="opening-card__field opening-card__field--type">
            <span class="opening-card__label">Тип</span>
            <select class="opening-card__select" data-field="type">
                <option value="door" ${isDoor ? 'selected' : ''}>Дверь</option>
                <option value="window" ${!isDoor ? 'selected' : ''}>Окно</option>
            </select>
        </div>
        <div class="opening-card__field">
            <span class="opening-card__label">Ширина, мм</span>
            <input class="opening-card__input" type="number" data-field="width" value="${opening.width}" min="200" step="1">
        </div>
        <div class="opening-card__field">
            <span class="opening-card__label">Высота, мм</span>
            <input class="opening-card__input" type="number" data-field="height" value="${opening.height}" min="200" step="1">
        </div>
        <div class="opening-card__field">
            <span class="opening-card__label">Отступ слева, мм</span>
            <input class="opening-card__input" type="number" data-field="offsetX" value="${opening.offsetX}" min="0" step="1">
        </div>
        <div class="opening-card__field">
            <span class="opening-card__label">Отступ снизу, мм</span>
            <input class="opening-card__input" type="number" data-field="offsetY" value="${opening.offsetY}" min="0" step="1">
        </div>
        <div class="opening-card__field opening-card__field--checkbox">
            <label class="form__checkbox-label">
                <input class="form__checkbox" type="checkbox" data-field="hasRigel" ${opening.hasRigel ? 'checked' : ''}>
                <span>Ригель</span>
            </label>
        </div>
        <button class="btn--remove" type="button" data-action="remove">&times; Удалить</button>
    `;

    // Обработчики изменений
    card.querySelectorAll('[data-field]').forEach(el => {
        el.addEventListener('change', () => {
            const field = el.dataset.field;
            const o = openings.find(o => o.id === opening.id);
            if (!o) return;
            if (field === 'type') {
                o.type = el.value;
                if (el.value === 'door') {
                    o.width = 1000; o.height = 2100; o.offsetY = 0;
                    card.querySelector('[data-field="width"]').value = '1000';
                    card.querySelector('[data-field="height"]').value = '2100';
                    card.querySelector('[data-field="offsetY"]').value = '0';
                } else {
                    o.width = 1200; o.height = 1000; o.offsetY = 800;
                    card.querySelector('[data-field="width"]').value = '1200';
                    card.querySelector('[data-field="height"]').value = '1000';
                    card.querySelector('[data-field="offsetY"]').value = '800';
                }
            } else if (field === 'hasRigel') {
                o.hasRigel = el.checked;
            } else {
                o[field] = parseInt(el.value, 10) || 0;
            }
        });
    });

    // Удаление
    card.querySelector('[data-action="remove"]').addEventListener('click', () => {
        openings = openings.filter(o => o.id !== opening.id);
        card.remove();
        updateOpeningsPlaceholder();
    });

    return card;
}

/**
 * Обновляет плейсхолдер пустого списка
 */
function updateOpeningsPlaceholder() {
    const list = document.getElementById('openingsList');
    if (openings.length === 0) {
        list.innerHTML = '<div class="openings-empty">Нет проёмов. Нажмите «+ Добавить проём»</div>';
    } else {
        const placeholder = list.querySelector('.openings-empty');
        if (placeholder) placeholder.remove();
    }
}


// ============================================================
// Модуль расчёта
// ============================================================

/**
 * Рассчитывает параметры каркасной стены
 * @param {object} params - входные параметры
 * @param {number} params.wallLength - длина стены, мм
 * @param {number} params.wallHeight - высота стены, мм
 * @param {number} params.studSpacing - шаг стоек (просвет между стойками), мм
 * @param {number} params.boardWidth - ширина доски (глубина сечения), мм
 * @param {number} params.boardThickness - толщина доски, мм
 * @param {boolean} params.doubleTopPlate - двойная верхняя обвязка
 * @param {boolean} params.hasRigel - ригель (доска на ребро, врезается в стойки)
 * @param {Array} params.openings - список проёмов
 * @param {boolean} [params.hasSheathing] - обшивка листовым материалом
 * @param {string} [params.sheetName] - название материала обшивки
 * @param {number} [params.sheetHeight] - высота листа, мм
 * @param {number} [params.sheetWidth] - ширина листа, мм
 * @returns {object} результат расчёта
 */
function calculateWall(params) {
    let { wallLength, wallHeight, studSpacing, boardWidth, boardThickness, doubleTopPlate, hasRigel } = params;



    // Высота стоек = высота стены - нижняя обвязка - верхняя обвязка
    const bottomPlateHeight = boardThickness; // нижняя обвязка (1 слой)
    const topPlateCount = doubleTopPlate ? 2 : 1;
    const topPlateHeight = boardThickness * topPlateCount;
    const studHeight = wallHeight - bottomPlateHeight - topPlateHeight;

    // Расчёт стоек: первая и последняя стойка на краях стены,
    // промежуточные с заданным шагом (просвет между стойками)
    const studs = [];
    studs.push(0);

    let pos = boardThickness + studSpacing;
    while (pos < wallLength - boardThickness) {
        studs.push(pos);
        pos += boardThickness + studSpacing;
    }

    const lastStudPos = wallLength - boardThickness;
    if (studs[studs.length - 1] !== lastStudPos) {
        studs.push(lastStudPos);
    }

    const studCount = studs.length;

    // Длина обвязочных досок = длина стены
    const plateLength = wallLength;

    // Обработка проёмов
    const processedOpenings = (params.openings || []).map(o => {
        const offsetY = o.type === 'door' ? 0 : o.offsetY;
        return { ...o, offsetY };
    });

    // Дополнительные стойки для проёмов (по 2 на каждый проём - обрамление)
    const openingStuds = processedOpenings.length * 2;
    // Перемычки - всегда над каждым проёмом
    const headerCount = processedOpenings.length;
    // Ригели проёмов - опционально (доска на ребро над проёмом)
    const openingRigelCount = processedOpenings.filter(o => o.hasRigel).length;
    // Подоконники - только для окон
    const sillCount = processedOpenings.filter(o => o.type === 'window').length;

    // Общее кол-во стоек (основные + обрамление проёмов)
    const totalStudCount = studCount + openingStuds;

    // Объём пиломатериала
    const studVolume = totalStudCount * (boardThickness / 1000) * (boardWidth / 1000) * (studHeight / 1000);
    const plateCount = 1 + topPlateCount;
    const plateVolume = plateCount * (boardThickness / 1000) * (boardWidth / 1000) * (plateLength / 1000);

    // Ригель стены: непрерывная доска на ребро по всей длине
    let rigelVolume = 0;
    const rigelCount = hasRigel ? 1 : 0;
    if (hasRigel) {
        rigelVolume = (boardThickness / 1000) * (boardWidth / 1000) * (wallLength / 1000);
    }

    // Перемычки (доска плашмя над проёмом, всегда)
    let headerVolume = 0;
    for (const o of processedOpenings) {
        headerVolume += (boardThickness / 1000) * (boardWidth / 1000) * (o.width / 1000);
    }

    // Ригели проёмов (доска на ребро над проёмом, опционально)
    let openingRigelVolume = 0;
    for (const o of processedOpenings) {
        if (o.hasRigel) {
            openingRigelVolume += (boardThickness / 1000) * (boardWidth / 1000) * (o.width / 1000);
        }
    }

    // Подоконники
    let sillVolume = 0;
    for (const o of processedOpenings) {
        if (o.type === 'window') {
            sillVolume += (boardThickness / 1000) * (boardWidth / 1000) * (o.width / 1000);
        }
    }

    const totalVolume = studVolume + plateVolume + rigelVolume + headerVolume + openingRigelVolume + sillVolume;

    // Расчёт 6-метровых досок
    const standardLength = 6000;
    const studsPerBoard = Math.floor(standardLength / studHeight);
    const studBoards = Math.ceil(totalStudCount / studsPerBoard);
    const platesPerStrip = Math.ceil(plateLength / standardLength);
    const plateBoards = platesPerStrip * plateCount;

    const rigelBoards = hasRigel ? Math.ceil(wallLength / standardLength) : 0;

    // Оптимальный раскрой досок для проёмов (bin-packing, First Fit Decreasing)
    // Собираем все куски: перемычки, ригели проёмов, подоконники
    const openingCuts = []; // {length, label}
    for (const o of processedOpenings) {
        openingCuts.push({ length: o.width, label: 'Перемычка' });
        if (o.hasRigel) {
            openingCuts.push({ length: o.width, label: 'Ригель' });
        }
        if (o.type === 'window') {
            openingCuts.push({ length: o.width, label: 'Подоконник' });
        }
    }

    // Сортируем по убыванию длины (жадный алгоритм)
    openingCuts.sort((a, b) => b.length - a.length);

    // Раскладываем куски по 6м доскам, сохраняя состав каждой
    /** @type {Array<{remaining: number, cuts: Array<{length: number, label: string}>}>} */
    const cuttingPlan = [];
    for (const cut of openingCuts) {
        let placed = false;
        for (let i = 0; i < cuttingPlan.length; i++) {
            if (cuttingPlan[i].remaining >= cut.length) {
                cuttingPlan[i].remaining -= cut.length;
                cuttingPlan[i].cuts.push(cut);
                placed = true;
                break;
            }
        }
        if (!placed) {
            cuttingPlan.push({
                remaining: standardLength - cut.length,
                cuts: [cut]
            });
        }
    }
    const openingBoards = cuttingPlan.length;

    // Для спецификации сохраняем кол-во кусков по типам
    let headerBoards = 0;
    let openingRigelBoards = 0;
    let sillBoards = 0;
    for (const o of processedOpenings) {
        headerBoards++;
        if (o.hasRigel) openingRigelBoards++;
        if (o.type === 'window') sillBoards++;
    }

    const totalBoards = studBoards + plateBoards + rigelBoards + openingBoards;

    // === Расчёт гвоздей ===
    // Длина гвоздя: ~2x толщины доски, округлённая до стандартного размера
    const nailLength = Math.ceil(boardThickness * 2 / 10) * 10; // округляем до 10мм

    // Стойки к нижней обвязке: 2 гвоздя (косой забой) на каждую стойку
    const nailsStudBottom = totalStudCount * 2;
    // Стойки к верхней обвязке: 2 гвоздя на каждую стойку
    const nailsStudTop = totalStudCount * 2;

    // Двойная верхняя обвязка: гвозди между слоями через ~400мм + 2 на концах
    let nailsDoublePlate = 0;
    if (topPlateCount === 2) {
        nailsDoublePlate = Math.ceil(plateLength / 400) + 2;
    }

    // Перемычки: 2 гвоздя с каждой стороны = 4 на перемычку
    const nailsHeaders = headerCount * 4;

    // Ригели проёмов: 2 гвоздя с каждой стороны = 4 на ригель
    const nailsOpeningRigels = openingRigelCount * 4;

    // Подоконники: 2 гвоздя с каждой стороны = 4 на подоконник
    const nailsSills = sillCount * 4;

    // Ригель стены: 2 гвоздя в каждую стойку, куда он врезается
    let nailsWallRigel = 0;
    if (hasRigel) {
        nailsWallRigel = totalStudCount * 2;
    }

    const totalNails = nailsStudBottom + nailsStudTop + nailsDoublePlate
        + nailsHeaders + nailsOpeningRigels + nailsSills + nailsWallRigel;

    // Запас 15% на брак/потери
    const nailsWithReserve = Math.ceil(totalNails * 1.15);
    // Примерный вес (гвоздь 90мм ~5г, 100мм ~6.5г)
    const nailWeightG = nailLength <= 90 ? 5 : 6.5;
    const nailsWeightKg = Math.round(nailsWithReserve * nailWeightG / 100) / 10;

    // Просветы между стойками (от правого края одной до левого края следующей)
    const spacings = [];
    for (let i = 1; i < studs.length; i++) {
        spacings.push(studs[i] - studs[i - 1] - boardThickness);
    }

    // === Расчёт обшивки листовым материалом ===
    let sheathing = null;
    if (params.hasSheathing && params.sheetHeight > 0 && params.sheetWidth > 0) {
        const sH = params.sheetHeight; // длинная сторона, ставится вертикально
        const sW = params.sheetWidth;  // короткая сторона, по горизонтали

        const wallAreaMm2 = wallLength * wallHeight;
        let openingsAreaMm2 = 0;
        for (const o of processedOpenings) {
            openingsAreaMm2 += o.width * o.height;
        }
        const netAreaMm2 = wallAreaMm2 - openingsAreaMm2;
        const sheetAreaMm2 = sH * sW;

        // Подрезка первого листа: стык должен попасть на центр стойки
        // Центры стоек: boardThickness/2 + i * (boardThickness + studSpacing)
        // Ищем наибольший firstSheetWidth = center_i, при котором firstSheetWidth <= sheetWidth
        const studStep = boardThickness + studSpacing;
        let firstSheetWidth = sW; // по умолчанию - полный лист
        const halfBT = boardThickness / 2;
        for (let n = Math.floor((sW - halfBT) / studStep); n >= 0; n--) {
            const candidate = halfBT + n * studStep;
            if (candidate > 0 && candidate <= sW) {
                firstSheetWidth = candidate;
                break;
            }
        }

        // Раскладка листов с подрезанным первым листом
        const rows = Math.ceil(wallHeight / sH);

        /** @type {Array<{col: number, row: number, x: number, y: number, w: number, h: number, idx: number}>} */
        const sheetLayout = [];
        let idx = 0;
        let curX = 0;
        let col = 0;
        while (curX < wallLength) {
            const colWidth = (col === 0) ? firstSheetWidth : sW;
            const actualW = Math.min(colWidth, wallLength - curX);
            for (let row = 0; row < rows; row++) {
                // Снизу вверх: полный лист снизу, подрезка сверху
                const yFromBottom = row * sH;
                const actualH = Math.min(sH, wallHeight - yFromBottom);
                const y = wallHeight - yFromBottom - actualH;
                sheetLayout.push({ col, row, x: curX, y, w: actualW, h: actualH, idx: ++idx });
            }
            curX += actualW;
            col++;
        }
        const cols = col;

        sheathing = {
            name: params.sheetName || 'ОСБ',
            sheetHeight: sH,
            sheetWidth: sW,
            firstSheetWidth,
            wallAreaM2: Math.round(wallAreaMm2 / 1e6 * 100) / 100,
            openingsAreaM2: Math.round(openingsAreaMm2 / 1e6 * 100) / 100,
            netAreaM2: Math.round(netAreaMm2 / 1e6 * 100) / 100,
            sheetAreaM2: Math.round(sheetAreaMm2 / 1e6 * 100) / 100,
            sheetCount: Math.ceil(netAreaMm2 / sheetAreaMm2),
            sheetLayout,
            cols,
            rows,
        };
    }

    return {
        wallLength,
        wallHeight,
        studSpacing,
        boardWidth,
        boardThickness,
        studHeight,
        bottomPlateHeight,
        topPlateHeight,
        topPlateCount,
        plateCount,
        studs,
        studCount,
        totalStudCount,
        openingStuds,
        headerCount,
        openingRigelCount,
        sillCount,
        hasRigel,
        rigelCount,
        plateLength,
        spacings,
        openings: processedOpenings,
        studVolume: Math.round(studVolume * 1000) / 1000,
        plateVolume: Math.round(plateVolume * 1000) / 1000,
        rigelVolume: Math.round(rigelVolume * 1000) / 1000,
        headerVolume: Math.round(headerVolume * 1000) / 1000,
        openingRigelVolume: Math.round(openingRigelVolume * 1000) / 1000,
        sillVolume: Math.round(sillVolume * 1000) / 1000,
        totalVolume: Math.round(totalVolume * 1000) / 1000,
        standardLength,
        studsPerBoard,
        studBoards,
        plateBoards,
        rigelBoards,
        openingBoards,
        cuttingPlan,
        headerBoards,
        openingRigelBoards,
        sillBoards,
        totalBoards,
        // Гвозди
        nailLength,
        totalNails,
        nailsWithReserve,
        nailsWeightKg,
        nailsStudBottom,
        nailsStudTop,
        nailsDoublePlate,
        nailsHeaders,
        nailsOpeningRigels,
        nailsSills,
        nailsWallRigel,
        // Обшивка
        sheathing,
    };
}


// ============================================================
// Модуль рендеринга SVG
// ============================================================

/**
 * Создаёт SVG-элемент с заданными атрибутами
 */
function svgEl(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, String(v));
    }
    return el;
}

/**
 * Рисует размерную линию (горизонтальную или вертикальную)
 */
function drawDimension(parent, x1, y1, x2, y2, label, direction) {
    const g = svgEl('g', { class: 'dim' });

    const arrowSize = 3;
    const tickLen = 5;
    const dimColor = '#333';
    const fontSize = 10;

    if (direction === 'h') {
        // Засечки
        g.appendChild(svgEl('line', {
            x1, y1: y1 - tickLen, x2: x1, y2: y1 + tickLen,
            stroke: dimColor, 'stroke-width': 0.5
        }));
        g.appendChild(svgEl('line', {
            x1: x2, y1: y2 - tickLen, x2, y2: y2 + tickLen,
            stroke: dimColor, 'stroke-width': 0.5
        }));
        // Линия
        g.appendChild(svgEl('line', {
            x1, y1, x2, y2,
            stroke: dimColor, 'stroke-width': 0.5
        }));
        // Стрелки-засечки (косые)
        g.appendChild(svgEl('line', {
            x1: x1 - arrowSize, y1: y1 + arrowSize,
            x2: x1 + arrowSize, y2: y1 - arrowSize,
            stroke: dimColor, 'stroke-width': 0.7
        }));
        g.appendChild(svgEl('line', {
            x1: x2 - arrowSize, y1: y2 + arrowSize,
            x2: x2 + arrowSize, y2: y2 - arrowSize,
            stroke: dimColor, 'stroke-width': 0.7
        }));
        // Текст
        const midX = (x1 + x2) / 2;
        const text = svgEl('text', {
            x: midX, y: y1 - 4,
            'text-anchor': 'middle',
            'font-size': fontSize,
            'font-family': 'Inter, sans-serif',
            fill: dimColor
        });
        text.textContent = label;
        g.appendChild(text);
    } else {
        // Засечки
        g.appendChild(svgEl('line', {
            x1: x1 - tickLen, y1, x2: x1 + tickLen, y2: y1,
            stroke: dimColor, 'stroke-width': 0.5
        }));
        g.appendChild(svgEl('line', {
            x1: x2 - tickLen, y1: y2, x2: x2 + tickLen, y2,
            stroke: dimColor, 'stroke-width': 0.5
        }));
        // Линия
        g.appendChild(svgEl('line', {
            x1, y1, x2, y2,
            stroke: dimColor, 'stroke-width': 0.5
        }));
        // Стрелки-засечки
        g.appendChild(svgEl('line', {
            x1: x1 - arrowSize, y1: y1 - arrowSize,
            x2: x1 + arrowSize, y2: y1 + arrowSize,
            stroke: dimColor, 'stroke-width': 0.7
        }));
        g.appendChild(svgEl('line', {
            x1: x2 - arrowSize, y1: y2 + arrowSize,
            x2: x2 + arrowSize, y2: y2 - arrowSize,
            stroke: dimColor, 'stroke-width': 0.7
        }));
        // Текст (повёрнутый)
        const midY = (y1 + y2) / 2;
        const text = svgEl('text', {
            x: x1 - 8, y: midY,
            'text-anchor': 'middle',
            'font-size': fontSize,
            'font-family': 'Inter, sans-serif',
            fill: dimColor,
            transform: `rotate(-90, ${x1 - 8}, ${midY})`
        });
        text.textContent = label;
        g.appendChild(text);
    }

    parent.appendChild(g);
}

/**
 * Рисует прямоугольник доски с штриховкой
 */
function drawBoard(parent, x, y, w, h, color = '#d4a76a') {
    const g = svgEl('g');

    g.appendChild(svgEl('rect', {
        x, y, width: w, height: h,
        fill: color, stroke: '#5c3d1e', 'stroke-width': 0.8
    }));

    const lineStep = Math.max(3, Math.min(w, h) / 6);
    if (w > h) {
        for (let ly = y + lineStep; ly < y + h; ly += lineStep) {
            g.appendChild(svgEl('line', {
                x1: x + 1, y1: ly, x2: x + w - 1, y2: ly,
                stroke: '#b8945a', 'stroke-width': 0.3, opacity: 0.5
            }));
        }
    } else {
        for (let lx = x + lineStep; lx < x + w; lx += lineStep) {
            g.appendChild(svgEl('line', {
                x1: lx, y1: y + 1, x2: lx, y2: y + h - 1,
                stroke: '#b8945a', 'stroke-width': 0.3, opacity: 0.5
            }));
        }
    }

    parent.appendChild(g);
}

/**
 * Генерирует SVG-чертёж каркасной стены
 * @param {object} result - результат расчёта из calculateWall
 * @returns {SVGElement} SVG элемент
 */
function renderWallSVG(result) {
    const {
        wallLength, wallHeight, boardWidth, boardThickness,
        studs, studHeight, bottomPlateHeight, topPlateHeight
    } = result;

    // Масштаб
    const maxDrawWidth = 1100;
    const marginLeft = 60;
    const marginRight = 30;
    const marginTop = 30;
    const marginBottom = 95;

    const drawScale = (maxDrawWidth - marginLeft - marginRight) / wallLength;
    const scale = Math.min(drawScale, 0.5);

    const sW = wallLength * scale;
    const sH = wallHeight * scale;
    const sBT = boardThickness * scale;

    const svgWidth = sW + marginLeft + marginRight;
    const svgHeight = sH + marginTop + marginBottom;

    const svg = svgEl('svg', {
        width: svgWidth,
        height: svgHeight,
        viewBox: `0 0 ${svgWidth} ${svgHeight}`,
        xmlns: 'http://www.w3.org/2000/svg'
    });

    // Фон
    svg.appendChild(svgEl('rect', {
        width: svgWidth, height: svgHeight,
        fill: '#ffffff'
    }));

    const oX = marginLeft;
    const oY = marginTop;

    // === Элементы стены ===

    // 1) Верхняя обвязка
    drawBoard(svg, oX, oY, sW, sBT, '#c49a5c');
    if (result.topPlateCount === 2) {
        drawBoard(svg, oX, oY + sBT, sW, sBT, '#c49a5c');
    }

    // 2) Нижняя обвязка
    const bottomPlateY = oY + sH - sBT;
    drawBoard(svg, oX, bottomPlateY, sW, sBT, '#c49a5c');

    // 3) Стойки
    const studStartY = oY + topPlateHeight * scale;
    const sStudH = studHeight * scale;

    for (const studPos of studs) {
        const sx = oX + studPos * scale;
        drawBoard(svg, sx, studStartY, sBT, sStudH, '#d4a76a');
    }

    // 4) Проёмы
    const wallBottomY = oY + sH - bottomPlateHeight * scale; // верх нижней обвязки

    for (const op of result.openings) {
        const opX = oX + op.offsetX * scale;
        const opW = op.width * scale;
        const opH = op.height * scale;
        // offsetY от верха нижней обвязки (снизу вверх)
        const opY = wallBottomY - op.offsetY * scale - opH;

        // Проём (вырез) - белый прямоугольник поверх стоек
        svg.appendChild(svgEl('rect', {
            x: opX, y: opY, width: opW, height: opH,
            fill: '#ffffff', stroke: 'none'
        }));

        // Стойки обрамления (по бокам проёма)
        // Левая стойка обрамления
        drawBoard(svg, opX - sBT, studStartY, sBT, sStudH, '#a67c4a');
        // Правая стойка обрамления
        drawBoard(svg, opX + opW, studStartY, sBT, sStudH, '#a67c4a');


        // Перемычка (всегда над проёмом, доска плашмя)
        drawBoard(svg, opX - sBT, opY - sBT, opW + sBT * 2, sBT, '#b08550');

        // Ригель проёма (доска на ребро над перемычкой, опционально)
        if (op.hasRigel) {
            const orH = boardWidth * scale; // высота ригеля на ребро
            drawBoard(svg, opX - sBT, opY - sBT - orH, opW + sBT * 2, orH, '#a07040');
        }

        // Подоконник (для окна - снизу проёма)
        if (op.type === 'window') {
            drawBoard(svg, opX - sBT, opY + opH, opW + sBT * 2, sBT, '#b08550');
        }

        // Контур проёма
        svg.appendChild(svgEl('rect', {
            x: opX, y: opY, width: opW, height: opH,
            fill: op.type === 'door' ? 'rgba(180,140,100,0.08)' : 'rgba(135,206,250,0.15)',
            stroke: op.type === 'door' ? '#8B4513' : '#4682B4',
            'stroke-width': 0.8,
            'stroke-dasharray': '4,2'
        }));

        // Подпись проёма
        const labelText = svgEl('text', {
            x: opX + opW / 2,
            y: opY + opH / 2 + 4,
            'text-anchor': 'middle',
            'font-size': 9,
            'font-family': 'Inter, sans-serif',
            fill: op.type === 'door' ? '#8B4513' : '#4682B4',
            opacity: 0.8
        });
        labelText.textContent = op.type === 'door' ? 'Дверь' : 'Окно';
        svg.appendChild(labelText);

        // Размеры проёма - справа от проёма
        const dimOpX = opX + opW + 8;
        drawDimension(svg, dimOpX, opY, dimOpX, opY + opH, `${op.height}`, 'v');

        // Ширина проёма - внутри, сверху
        drawDimension(svg, opX, opY - 12, opX + opW, opY - 12, `${op.width}`, 'h');
    }

    // 5) Ригель (непрерывная доска на ребро, врезается в стойки под верхней обвязкой)
    if (result.hasRigel) {
        const rigelH = boardWidth * scale; // высота ригеля на ребро = ширина доски
        const rigelY = studStartY; // сразу под верхней обвязкой
        drawBoard(svg, oX, rigelY, sW, rigelH, '#b08550');

        // Размер ригеля справа
        const dimRigelX = oX + sW + 8;
        drawDimension(svg, dimRigelX, rigelY, dimRigelX, rigelY + rigelH, `${boardWidth}`, 'v');
    }

    // === Размерные линии ===
    const dimHorizY = oY + sH + 18;

    for (let i = 0; i < studs.length - 1; i++) {
        // Размер от правого края текущей стойки до левого края следующей (просвет)
        const x1 = oX + (studs[i] + boardThickness) * scale;
        const x2 = oX + studs[i + 1] * scale;
        const spacing = studs[i + 1] - studs[i] - boardThickness;
        drawDimension(svg, x1, dimHorizY, x2, dimHorizY, `${spacing}`, 'h');
    }

    const dimTotalY = dimHorizY + 25;
    drawDimension(svg, oX, dimTotalY, oX + sW, dimTotalY, `${wallLength}`, 'h');

    // Кумулятивная шкала от левого нижнего угла
    const scaleY = dimTotalY + 22;
    const scaleColor = '#666';
    const scaleFontSize = 8;

    // Горизонтальная базовая линия шкалы
    svg.appendChild(svgEl('line', {
        x1: oX, y1: scaleY, x2: oX + sW, y2: scaleY,
        stroke: scaleColor, 'stroke-width': 0.4
    }));

    // Собираем все ключевые точки от левого нижнего угла
    const scalePoints = new Set();
    scalePoints.add(0);
    scalePoints.add(wallLength);

    // Стойки
    for (const s of studs) {
        scalePoints.add(s);
        scalePoints.add(s + boardThickness);
    }

    // Проёмы
    for (const op of result.openings) {
        scalePoints.add(op.offsetX);
        scalePoints.add(op.offsetX + op.width);
    }

    const sortedPoints = [...scalePoints].sort((a, b) => a - b);

    // Минимальное расстояние в пикселях между метками шкалы
    const minPixelGap = 28;
    // Фильтруем точки, которые слишком близко друг к другу
    // Приоритет: 0 и wallLength всегда остаются, проёмы важнее стоек
    const priorityPoints = new Set([0, wallLength]);
    for (const op of result.openings) {
        priorityPoints.add(op.offsetX);
        priorityPoints.add(op.offsetX + op.width);
    }

    const filteredPoints = [];
    for (const pt of sortedPoints) {
        if (priorityPoints.has(pt)) {
            filteredPoints.push(pt);
        } else {
            // Проверяем расстояние до ближайших приоритетных и уже добавленных
            const pxCurrent = pt * scale;
            let tooClose = false;
            for (const fp of filteredPoints) {
                if (Math.abs(pxCurrent - fp * scale) < minPixelGap) {
                    tooClose = true;
                    break;
                }
            }
            // Проверяем с приоритетными точками которые ниже
            if (!tooClose) {
                for (const pp of priorityPoints) {
                    if (pp > pt && Math.abs(pxCurrent - pp * scale) < minPixelGap) {
                        tooClose = true;
                        break;
                    }
                }
            }
            if (!tooClose) {
                filteredPoints.push(pt);
            }
        }
    }
    filteredPoints.sort((a, b) => a - b);

    // Чередование уровней для близких меток (верх/низ)
    let lastPx = -Infinity;
    for (let i = 0; i < filteredPoints.length; i++) {
        const pt = filteredPoints[i];
        const px = oX + pt * scale;
        const nextPx = i < filteredPoints.length - 1 ? oX + filteredPoints[i + 1] * scale : Infinity;
        const tooCloseToNeighbor = (px - lastPx < minPixelGap + 5) || (nextPx - px < minPixelGap + 5);
        const textYOffset = (tooCloseToNeighbor && i % 2 === 1) ? 22 : 12;
        const tickLen = (tooCloseToNeighbor && i % 2 === 1) ? 8 : 3;

        // Засечка
        svg.appendChild(svgEl('line', {
            x1: px, y1: scaleY - 3, x2: px, y2: scaleY + tickLen,
            stroke: scaleColor, 'stroke-width': 0.5
        }));
        // Значение
        const text = svgEl('text', {
            x: px, y: scaleY + textYOffset,
            'text-anchor': 'middle',
            'font-size': scaleFontSize,
            'font-family': 'Inter, sans-serif',
            fill: scaleColor
        });
        text.textContent = `${pt}`;
        svg.appendChild(text);
        lastPx = px;
    }

    // Вертикальные размеры - слева
    const dimVertX = oX - 20;
    drawDimension(svg, dimVertX, oY, dimVertX, oY + sH, `${wallHeight}`, 'v');

    const dimStudX = oX - 40;
    drawDimension(svg, dimStudX, studStartY, dimStudX, studStartY + sStudH, `${studHeight}`, 'v');

    return svg;
}


// ============================================================
// Модуль спецификации
// ============================================================

/**
 * Генерирует HTML-карточки спецификации
 */
function renderSpec(result) {
    const {
        studCount, totalStudCount, openingStuds, studHeight, plateLength,
        boardThickness, boardWidth, wallLength,
        studVolume, plateVolume, rigelVolume, headerVolume, openingRigelVolume, sillVolume, totalVolume,
        studsPerBoard, studBoards, plateBoards, rigelBoards, openingBoards, headerBoards, openingRigelBoards, sillBoards, totalBoards,
        plateCount, headerCount, openingRigelCount, sillCount, hasRigel, rigelCount,
        nailLength, totalNails, nailsWithReserve, nailsWeightKg,
        nailsStudBottom, nailsStudTop, nailsDoublePlate, nailsHeaders, nailsOpeningRigels, nailsSills, nailsWallRigel
    } = result;

    const cards = [
        {
            title: 'Основные стойки',
            value: studCount,
            unit: 'шт.',
            detail: `${boardThickness}x${boardWidth}x${studHeight} мм`
        },
    ];

    if (openingStuds > 0) {
        cards.push({
            title: 'Стойки обрамления',
            value: openingStuds,
            unit: 'шт.',
            detail: 'по 2 на каждый проём'
        });
        cards.push({
            title: 'Всего стоек',
            value: totalStudCount,
            unit: 'шт.',
            detail: `${boardThickness}x${boardWidth}x${studHeight} мм`
        });
    }

    cards.push({
        title: 'Обвязка',
        value: plateCount,
        unit: 'полосы',
        detail: `${boardThickness}x${boardWidth}x${plateLength} мм (1 нижн. + ${plateCount - 1} верхн.)`
    });

    if (hasRigel) {
        cards.push({
            title: 'Ригель стены',
            value: rigelCount,
            unit: 'шт.',
            detail: `${boardThickness}x${boardWidth}x${wallLength} мм, на ребро, врезается в стойки`
        });
    }

    if (headerCount > 0) {
        cards.push({
            title: 'Перемычки',
            value: headerCount,
            unit: 'шт.',
            detail: 'доска плашмя над каждым проёмом'
        });
    }

    if (openingRigelCount > 0) {
        cards.push({
            title: 'Ригели проёмов',
            value: openingRigelCount,
            unit: 'шт.',
            detail: 'доска на ребро над перемычкой'
        });
    }

    if (sillCount > 0) {
        cards.push({
            title: 'Подоконники',
            value: sillCount,
            unit: 'шт.',
            detail: 'под окнами'
        });
    }

    cards.push(
        {
            title: 'Доски на стойки',
            value: studBoards,
            unit: 'шт. (6м)',
            detail: `из одной доски ${studsPerBoard} стойки`
        },
        {
            title: 'Доски на обвязку',
            value: plateBoards,
            unit: 'шт. (6м)',
            detail: `${plateCount} полосы обвязки`
        },
    );

    if (rigelBoards > 0) {
        cards.push({
            title: 'Доски на ригель',
            value: rigelBoards,
            unit: 'шт. (6м)',
            detail: 'на ребро по всей длине стены'
        });
    }

    if (openingBoards > 0) {
        const cutDetails = [];
        if (headerBoards > 0) cutDetails.push(`${headerBoards} перем.`);
        if (openingRigelBoards > 0) cutDetails.push(`${openingRigelBoards} риг.`);
        if (sillBoards > 0) cutDetails.push(`${sillBoards} подок.`);
        cards.push({
            title: 'Доски на проёмы',
            value: openingBoards,
            unit: 'шт. (6м)',
            detail: `оптим. раскрой: ${cutDetails.join(' + ')} = ${headerBoards + openingRigelBoards + sillBoards} кусков`
        });
    }

    cards.push(
        {
            title: 'Всего досок',
            value: totalBoards,
            unit: 'шт. (6м)',
            detail: `${boardThickness}x${boardWidth}x6000 мм`
        },
        {
            title: 'Общий объём',
            value: totalVolume,
            unit: 'м³',
            detail: 'весь пиломатериал'
        }
    );

    // === Гвозди ===
    const nailDetails = [];
    nailDetails.push(`стойки-низ: ${nailsStudBottom}`);
    nailDetails.push(`стойки-верх: ${nailsStudTop}`);
    if (nailsDoublePlate > 0) nailDetails.push(`2я обвязка: ${nailsDoublePlate}`);
    if (nailsHeaders > 0) nailDetails.push(`перемычки: ${nailsHeaders}`);
    if (nailsOpeningRigels > 0) nailDetails.push(`риг. проёмов: ${nailsOpeningRigels}`);
    if (nailsSills > 0) nailDetails.push(`подоконники: ${nailsSills}`);
    if (nailsWallRigel > 0) nailDetails.push(`ригель: ${nailsWallRigel}`);

    cards.push(
        {
            title: 'Гвозди',
            value: nailsWithReserve,
            unit: 'шт.',
            detail: `${nailLength} мм, с запасом 15% (~${nailsWeightKg} кг)`
        },
        {
            title: 'Расход по узлам',
            value: totalNails,
            unit: 'шт.',
            detail: nailDetails.join(', ')
        }
    );

    // === Обшивка ===
    if (result.sheathing) {
        const s = result.sheathing;
        cards.push(
            {
                title: `Обшивка (${s.name})`,
                value: s.netAreaM2,
                unit: 'м²',
                detail: `стена ${s.wallAreaM2} м² - проёмы ${s.openingsAreaM2} м²`
            },
            {
                title: `Листы ${s.name}`,
                value: s.sheetCount,
                unit: 'шт.',
                detail: `${s.sheetHeight}x${s.sheetWidth} мм (${s.sheetAreaM2} м²/лист)`
            }
        );
    }

    return cards.map(c => `
        <div class="spec__card">
            <div class="spec__card-title">${c.title}</div>
            <div class="spec__card-value">
                ${c.value}<span class="spec__card-unit">${c.unit}</span>
            </div>
            ${c.detail ? `<div class="spec__card-detail">${c.detail}</div>` : ''}
        </div>
    `).join('');
}


// ============================================================
// Модуль инструкции по сборке
// ============================================================

/**
 * Генерирует HTML инструкции по сборке с учётом элементов на чертеже
 * @param {object} result - результат расчёта
 * @returns {string} HTML
 */
function renderAssemblyGuide(result) {
    const {
        boardThickness, boardWidth, studSpacing, studHeight,
        topPlateCount, hasRigel, openings
    } = result;

    const hasDoors = openings.some(o => o.type === 'door');
    const hasWindows = openings.some(o => o.type === 'window');
    const hasOpeningRigels = openings.some(o => o.hasRigel);
    const hasOpenings = openings.length > 0;
    // === Порядок сборки ===
    let step = 1;
    const steps = [];

    steps.push(`<strong>${step++}. Нижняя обвязка.</strong> Уложите доску ${boardThickness}x${boardWidth} мм плашмя по всей длине стены. Крепить к основанию анкерными болтами или глухарями.`);

    steps.push(`<strong>${step++}. Разметка стоек.</strong> Отметьте на нижней обвязке позиции стоек с просветом ${studSpacing} мм (расстояние между стойками в свету). Шаг по осям (от центра до центра) составит ${studSpacing + boardThickness} мм.`);

    if (hasRigel) {
        steps.push(`<strong>${step++}. Подготовка стоек под ригель.</strong> В каждой стойке сделайте выборку (пропил) под ригель: глубина = ${boardThickness} мм, высота = ${boardWidth} мм. Выборка делается в верхней части стойки.`);
    }

    steps.push(`<strong>${step++}. Установка стоек.</strong> Нарежьте стойки длиной ${studHeight} мм. Установите на нижнюю обвязку строго вертикально (контроль уровнем). Крепить гвоздями 90 мм косым забиванием или металлическими уголками.`);

    if (hasOpenings) {
        steps.push(`<strong>${step++}. Стойки обрамления проёмов.</strong> Установите по 2 дополнительные стойки по бокам каждого проёма вплотную к основным стойкам. Это усиливает конструкцию в зоне проёма.`);

        steps.push(`<strong>${step++}. Перемычки над проёмами.</strong> Уложите доску ${boardThickness}x${boardWidth} мм плашмя над каждым проёмом. Перемычка должна опираться на стойки обрамления.`);
    }

    if (hasOpeningRigels) {
        steps.push(`<strong>${step++}. Ригели проёмов.</strong> Над перемычкой установите доску <em>на ребро</em> (высота ${boardWidth} мм). Это обеспечивает дополнительную несущую способность над проёмом.`);
    }

    if (hasWindows) {
        steps.push(`<strong>${step++}. Подоконники.</strong> Установите доску ${boardThickness}x${boardWidth} мм плашмя под каждым оконным проёмом. Подоконник опирается на стойки обрамления.`);
    }

    if (hasRigel) {
        steps.push(`<strong>${step++}. Ригель стены.</strong> Вставьте доску ${boardThickness}x${boardWidth} мм <em>на ребро</em> в выборки стоек под верхней обвязкой по всей длине стены. Ригель распределяет нагрузку от кровли на все стойки равномерно.`);
    }

    steps.push(`<strong>${step++}. Верхняя обвязка.</strong> Уложите доску ${boardThickness}x${boardWidth} мм плашмя поверх стоек.${topPlateCount === 2 ? ` Затем уложите второй слой верхней обвязки со смещением стыков относительно первого слоя (перевязка стыков).` : ''} Крепить гвоздями в каждую стойку.`);

    steps.push(`<strong>${step++}. Проверка.</strong> Проверьте диагонали стены (должны быть равны), вертикальность стоек и плоскость стены.`);

    // === Рекомендации ===
    const tips = [];

    tips.push('Используйте строганую доску камерной сушки (влажность не более 18%), чтобы избежать усадки и деформаций.');
    tips.push('Перед установкой обработайте нижнюю обвязку антисептиком - это самый уязвимый элемент к влаге.');
    tips.push('Сборку стены удобнее вести <em>на полу</em> (в горизонтальном положении), затем поднять и закрепить.');

    if (topPlateCount === 2) {
        tips.push('Двойная верхняя обвязка: стыки второго слоя смещайте минимум на 2 шага стоек относительно первого. Это обеспечивает жёсткость узла.');
    }

    if (hasRigel) {
        const rigelOk = boardThickness <= boardWidth / 3;
        const rigelStatus = rigelOk
            ? 'выполняется'
            : '<strong>не выполняется - рассмотрите увеличение ширины доски</strong>';
        tips.push(`Ригель стены: глубина выборки в стойке должна быть не более 1/3 ширины стойки, иначе она потеряет несущую способность. При толщине доски ${boardThickness} мм это условие ${rigelStatus}.`);
    }

    if (hasOpenings) {
        tips.push('Проёмы: отступ от угла стены до проёма должен быть не менее 2 шагов стоек для сохранения несущей способности.');
    }

    if (hasDoors) {
        tips.push('Дверные проёмы: учтите зазор 10-15 мм на монтажную пену при задании размеров проёма под дверную коробку.');
    }

    if (hasWindows) {
        tips.push('Оконные проёмы: закладывайте зазор 20-30 мм по каждой стороне для монтажной пены и утеплителя.');
    }

    tips.push('Гвозди: для доски толщиной ${boardThickness} мм используйте гвозди длиной 80-90 мм. На каждое соединение - минимум 2 гвоздя.'.replace('${boardThickness}', boardThickness));

    return `
        <h3 class="drawing-legend__title">Инструкция по сборке</h3>
        <ol class="assembly-steps">
            ${steps.map(s => `<li>${s}</li>`).join('')}
        </ol>
        <h3 class="drawing-legend__title" style="margin-top: 16px;">Рекомендации</h3>
        <ul class="drawing-legend__list">
            ${tips.map(t => `<li>${t}</li>`).join('')}
        </ul>
    `;
}


// ============================================================
// Модуль раскроя досок
// ============================================================

/**
 * Рисует SVG-схему раскроя досок для проёмов
 * @param {object} result - результат расчёта
 * @returns {SVGElement|null}
 */
function renderCuttingPlan(result) {
    const { cuttingPlan, standardLength } = result;
    if (!cuttingPlan || cuttingPlan.length === 0) return null;

    const NS = 'http://www.w3.org/2000/svg';
    const boardH = 32;
    const gap = 12;
    const marginLeft = 70;
    const marginRight = 20;
    const marginTop = 36;
    const marginBottom = 16;
    const maxDrawW = 700;
    const scale = maxDrawW / standardLength;
    const svgW = marginLeft + maxDrawW + marginRight;
    const svgH = marginTop + cuttingPlan.length * (boardH + gap) + marginBottom;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', '100%');
    svg.style.maxWidth = svgW + 'px';

    // Заголовок
    const title = document.createElementNS(NS, 'text');
    title.setAttribute('x', svgW / 2);
    title.setAttribute('y', 18);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '13');
    title.setAttribute('font-weight', '600');
    title.setAttribute('font-family', 'Inter, sans-serif');
    title.setAttribute('fill', '#333');
    title.textContent = 'Раскрой досок для проёмов';
    svg.appendChild(title);

    const colors = {
        'Перемычка': '#e8a850',
        'Ригель': '#a07040',
        'Подоконник': '#6da9d0'
    };

    cuttingPlan.forEach((board, idx) => {
        const y = marginTop + idx * (boardH + gap);

        // Надпись доски
        const label = document.createElementNS(NS, 'text');
        label.setAttribute('x', marginLeft - 8);
        label.setAttribute('y', y + boardH / 2 + 4);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('font-size', '10');
        label.setAttribute('font-family', 'Inter, sans-serif');
        label.setAttribute('fill', '#666');
        label.textContent = `Доска ${idx + 1}`;
        svg.appendChild(label);

        // Фон 6м доски
        const bg = document.createElementNS(NS, 'rect');
        bg.setAttribute('x', marginLeft);
        bg.setAttribute('y', y);
        bg.setAttribute('width', maxDrawW);
        bg.setAttribute('height', boardH);
        bg.setAttribute('fill', '#f0ebe3');
        bg.setAttribute('stroke', '#ccc');
        bg.setAttribute('stroke-width', '0.5');
        bg.setAttribute('rx', '3');
        svg.appendChild(bg);

        // Куски
        let offsetX = 0;
        board.cuts.forEach(cut => {
            const w = cut.length * scale;
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('x', marginLeft + offsetX);
            rect.setAttribute('y', y + 1);
            rect.setAttribute('width', Math.max(w - 1, 2));
            rect.setAttribute('height', boardH - 2);
            rect.setAttribute('fill', colors[cut.label] || '#aaa');
            rect.setAttribute('rx', '2');
            rect.setAttribute('opacity', '0.85');
            svg.appendChild(rect);

            // Текст внутри куска
            if (w > 55) {
                const txt = document.createElementNS(NS, 'text');
                txt.setAttribute('x', marginLeft + offsetX + w / 2);
                txt.setAttribute('y', y + boardH / 2 - 3);
                txt.setAttribute('text-anchor', 'middle');
                txt.setAttribute('font-size', '8');
                txt.setAttribute('font-family', 'Inter, sans-serif');
                txt.setAttribute('fill', '#fff');
                txt.setAttribute('font-weight', '600');
                txt.textContent = cut.label;
                svg.appendChild(txt);

                const sz = document.createElementNS(NS, 'text');
                sz.setAttribute('x', marginLeft + offsetX + w / 2);
                sz.setAttribute('y', y + boardH / 2 + 9);
                sz.setAttribute('text-anchor', 'middle');
                sz.setAttribute('font-size', '9');
                sz.setAttribute('font-family', 'Inter, sans-serif');
                sz.setAttribute('fill', '#fff');
                sz.textContent = `${cut.length} мм`;
                svg.appendChild(sz);
            }
            offsetX += w;
        });

        // Остаток
        if (board.remaining > 0) {
            const remW = board.remaining * scale;
            if (remW > 30) {
                const remTxt = document.createElementNS(NS, 'text');
                remTxt.setAttribute('x', marginLeft + offsetX + remW / 2);
                remTxt.setAttribute('y', y + boardH / 2 + 4);
                remTxt.setAttribute('text-anchor', 'middle');
                remTxt.setAttribute('font-size', '8');
                remTxt.setAttribute('font-family', 'Inter, sans-serif');
                remTxt.setAttribute('fill', '#aaa');
                remTxt.textContent = `ост. ${board.remaining}`;
                svg.appendChild(remTxt);
            }
        }
    });

    // Легенда
    const legendY = svgH - 4;
    let lx = marginLeft;
    for (const [label, color] of Object.entries(colors)) {
        const hasCuts = cuttingPlan.some(b => b.cuts.some(c => c.label === label));
        if (!hasCuts) continue;
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', lx);
        r.setAttribute('y', legendY - 8);
        r.setAttribute('width', 10);
        r.setAttribute('height', 10);
        r.setAttribute('fill', color);
        r.setAttribute('rx', '2');
        svg.appendChild(r);
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', lx + 14);
        t.setAttribute('y', legendY);
        t.setAttribute('font-size', '9');
        t.setAttribute('font-family', 'Inter, sans-serif');
        t.setAttribute('fill', '#666');
        t.textContent = label;
        svg.appendChild(t);
        lx += label.length * 6 + 30;
    }

    return svg;
}


// ============================================================
// Модуль раскроя обшивки
// ============================================================

/**
 * Рисует SVG-схему раскладки листов обшивки на стене
 * @param {object} result - результат расчёта
 * @returns {SVGElement|null}
 */
function renderSheathingLayout(result) {
    const { sheathing, wallLength, wallHeight, openings } = result;
    if (!sheathing || !sheathing.sheetLayout) return null;

    const { sheetLayout, sheetHeight, sheetWidth, name, cols, rows: rowCount } = sheathing;

    const NS = 'http://www.w3.org/2000/svg';
    const marginLeft = 50;
    const marginRight = 20;
    const marginTop = 36;
    const marginBottom = 20;
    const maxDrawW = 800;

    const scale = Math.min((maxDrawW - marginLeft - marginRight) / wallLength, 0.4);
    const sW = wallLength * scale;
    const sH = wallHeight * scale;

    const svgW = marginLeft + sW + marginRight;
    const svgH = marginTop + sH + marginBottom;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', '100%');
    svg.style.maxWidth = svgW + 'px';

    // Фон
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', svgW);
    bg.setAttribute('height', svgH);
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    // Заголовок
    const title = document.createElementNS(NS, 'text');
    title.setAttribute('x', svgW / 2);
    title.setAttribute('y', 18);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '13');
    title.setAttribute('font-weight', '600');
    title.setAttribute('font-family', 'Inter, sans-serif');
    title.setAttribute('fill', '#333');
    title.textContent = `Раскладка ${name} на стене`;
    svg.appendChild(title);

    const oX = marginLeft;
    const oY = marginTop;

    // Контур стены
    const wallRect = document.createElementNS(NS, 'rect');
    wallRect.setAttribute('x', oX);
    wallRect.setAttribute('y', oY);
    wallRect.setAttribute('width', sW);
    wallRect.setAttribute('height', sH);
    wallRect.setAttribute('fill', '#fafafa');
    wallRect.setAttribute('stroke', '#333');
    wallRect.setAttribute('stroke-width', '1.5');
    svg.appendChild(wallRect);

    // Палитра цветов для чередования листов
    const sheetColors = [
        'rgba(180, 210, 140, 0.55)',
        'rgba(140, 190, 210, 0.55)',
        'rgba(210, 180, 140, 0.55)',
        'rgba(170, 160, 210, 0.55)',
    ];

    // Листы
    for (const sheet of sheetLayout) {
        const sx = oX + sheet.x * scale;
        const sy = oY + sheet.y * scale;
        const sw = sheet.w * scale;
        const sh = sheet.h * scale;
        const colorIdx = (sheet.col + sheet.row) % sheetColors.length;

        // Прямоугольник листа
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', sx);
        rect.setAttribute('y', sy);
        rect.setAttribute('width', sw);
        rect.setAttribute('height', sh);
        rect.setAttribute('fill', sheetColors[colorIdx]);
        rect.setAttribute('stroke', '#666');
        rect.setAttribute('stroke-width', '0.8');
        svg.appendChild(rect);

        // Номер листа
        if (sw > 20 && sh > 20) {
            const numText = document.createElementNS(NS, 'text');
            numText.setAttribute('x', sx + sw / 2);
            numText.setAttribute('y', sy + sh / 2 - 4);
            numText.setAttribute('text-anchor', 'middle');
            numText.setAttribute('font-size', '11');
            numText.setAttribute('font-weight', '700');
            numText.setAttribute('font-family', 'Inter, sans-serif');
            numText.setAttribute('fill', '#333');
            numText.textContent = `#${sheet.idx}`;
            svg.appendChild(numText);

            // Размер листа
            const isCut = (sheet.w < sheetWidth) || (sheet.h < sheetHeight);
            if (sw > 40 && sh > 35) {
                const sizeText = document.createElementNS(NS, 'text');
                sizeText.setAttribute('x', sx + sw / 2);
                sizeText.setAttribute('y', sy + sh / 2 + 10);
                sizeText.setAttribute('text-anchor', 'middle');
                sizeText.setAttribute('font-size', '8');
                sizeText.setAttribute('font-family', 'Inter, sans-serif');
                sizeText.setAttribute('fill', isCut ? '#c0392b' : '#666');
                sizeText.textContent = `${sheet.w}x${sheet.h}`;
                svg.appendChild(sizeText);
            }
        }
    }

    // Проёмы поверх листов
    for (const op of openings) {
        const opX = oX + op.offsetX * scale;
        // offsetY от низа стены
        const opY = oY + (wallHeight - op.offsetY - op.height) * scale;
        const opW = op.width * scale;
        const opH = op.height * scale;

        const opRect = document.createElementNS(NS, 'rect');
        opRect.setAttribute('x', opX);
        opRect.setAttribute('y', opY);
        opRect.setAttribute('width', opW);
        opRect.setAttribute('height', opH);
        opRect.setAttribute('fill', '#ffffff');
        opRect.setAttribute('stroke', op.type === 'door' ? '#8B4513' : '#4682B4');
        opRect.setAttribute('stroke-width', '1.2');
        opRect.setAttribute('stroke-dasharray', '4,2');
        svg.appendChild(opRect);

        // Подпись проёма
        const opLabel = document.createElementNS(NS, 'text');
        opLabel.setAttribute('x', opX + opW / 2);
        opLabel.setAttribute('y', opY + opH / 2 + 4);
        opLabel.setAttribute('text-anchor', 'middle');
        opLabel.setAttribute('font-size', '9');
        opLabel.setAttribute('font-family', 'Inter, sans-serif');
        opLabel.setAttribute('fill', op.type === 'door' ? '#8B4513' : '#4682B4');
        opLabel.textContent = op.type === 'door' ? 'Дверь' : 'Окно';
        svg.appendChild(opLabel);
    }

    // Размерные подписи: ширина и высота стены
    // Ширина снизу
    const dimY = oY + sH + 14;
    drawDimension(svg, oX, dimY, oX + sW, dimY, `${wallLength}`, 'h');

    // Высота слева
    const dimX = oX - 20;
    drawDimension(svg, dimX, oY, dimX, oY + sH, `${wallHeight}`, 'v');

    return svg;
}


// ============================================================
// Модуль наложения обшивки на каркас
// ============================================================

/**
 * Вычисляет подходящие шаги стоек для данной ширины листа
 * Стык листа должен попадать на середину стойки (studPos + boardThickness/2).
 * Условие: (sheetWidth - boardThickness/2) делится на spacing.
 * @param {number} sheetWidth - ширина листа, мм
 * @param {number} boardThickness - толщина доски (стойки), мм
 * @returns {Array<number>} массив подходящих шагов
 */
function getSuggestedSpacings(sheetWidth, boardThickness) {
    const suggestions = [];
    const target = sheetWidth - boardThickness / 2;
    const tolerance = 2; // допуск ±2мм
    // spacing = просвет, шаг по осям = boardThickness + spacing
    // стык на центре стойки: target % (boardThickness + spacing) ≈ 0
    for (let spacing = 200; spacing <= 650; spacing += 5) {
        const step = boardThickness + spacing;
        const rem = target % step;
        if (rem <= tolerance || (step - rem) <= tolerance) {
            suggestions.push(spacing);
        }
    }
    return suggestions;
}

/**
 * Рисует SVG-схему наложения листов на каркас стены
 * @param {object} result - результат расчёта
 * @returns {{svg: SVGElement, warnings: string[]}|null}
 */
function renderSheathingOnFrame(result) {
    const { sheathing, wallLength, wallHeight, studs, boardThickness, boardWidth,
        studHeight, topPlateHeight, bottomPlateHeight } = result;
    if (!sheathing || !sheathing.sheetLayout) return null;

    const { sheetLayout, sheetHeight, sheetWidth, name } = sheathing;

    const NS = 'http://www.w3.org/2000/svg';
    const marginLeft = 50;
    const marginRight = 20;
    const marginTop = 36;
    const marginBottom = 30;
    const maxDrawW = 800;

    const scale = Math.min((maxDrawW - marginLeft - marginRight) / wallLength, 0.4);
    const sW = wallLength * scale;
    const sH = wallHeight * scale;
    const sBT = boardThickness * scale;

    const svgW = marginLeft + sW + marginRight;
    const svgH = marginTop + sH + marginBottom;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    svg.setAttribute('width', '100%');
    svg.style.maxWidth = svgW + 'px';

    // Фон
    svg.appendChild(svgEl('rect', { width: svgW, height: svgH, fill: '#ffffff' }));

    // Заголовок
    const title = svgEl('text', {
        x: svgW / 2, y: 18,
        'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600,
        'font-family': 'Inter, sans-serif', fill: '#333'
    });
    title.textContent = `Наложение ${name} на каркас`;
    svg.appendChild(title);

    const oX = marginLeft;
    const oY = marginTop;

    // === Каркас ===
    // Верхняя обвязка
    drawBoard(svg, oX, oY, sW, sBT, '#c49a5c');
    if (result.topPlateCount === 2) {
        drawBoard(svg, oX, oY + sBT, sW, sBT, '#c49a5c');
    }
    // Нижняя обвязка
    drawBoard(svg, oX, oY + sH - sBT, sW, sBT, '#c49a5c');

    // Стойки
    const studStartY = oY + topPlateHeight * scale;
    const sStudH = studHeight * scale;
    for (const studPos of studs) {
        const sx = oX + studPos * scale;
        drawBoard(svg, sx, studStartY, sBT, sStudH, '#d4a76a');
    }

    // === Листы обшивки поверх каркаса ===
    const sheetColors = [
        'rgba(100, 180, 80, 0.25)',
        'rgba(80, 150, 180, 0.25)',
        'rgba(180, 140, 80, 0.25)',
        'rgba(140, 120, 180, 0.25)',
    ];

    for (const sheet of sheetLayout) {
        const sx = oX + sheet.x * scale;
        const sy = oY + sheet.y * scale;
        const sw = sheet.w * scale;
        const sh = sheet.h * scale;
        const colorIdx = (sheet.col + sheet.row) % sheetColors.length;

        svg.appendChild(svgEl('rect', {
            x: sx, y: sy, width: sw, height: sh,
            fill: sheetColors[colorIdx], stroke: '#2d8c4e', 'stroke-width': 1,
            'stroke-dasharray': '6,3'
        }));

        // Номер листа
        if (sw > 25 && sh > 25) {
            const num = svgEl('text', {
                x: sx + sw / 2, y: sy + sh / 2 + 4,
                'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700,
                'font-family': 'Inter, sans-serif', fill: '#2d8c4e', opacity: 0.8
            });
            num.textContent = `#${sheet.idx}`;
            svg.appendChild(num);
        }
    }

    // === Анализ стыков ===
    const warnings = [];
    // Вертикальные стыки - берём из реальной раскладки (правые края листов, кроме последнего)
    const jointPositions = [];
    const seenJoints = new Set();
    for (const sheet of sheetLayout) {
        const rightEdge = Math.round(sheet.x + sheet.w);
        if (rightEdge < wallLength && !seenJoints.has(rightEdge)) {
            seenJoints.add(rightEdge);
            jointPositions.push(rightEdge);
        }
    }
    jointPositions.sort((a, b) => a - b);

    // Информация о подрезке первого листа
    if (sheathing.firstSheetWidth < sheetWidth) {
        warnings.push(`Первый лист подрезан до ${sheathing.firstSheetWidth} мм для выравнивания стыков по стойкам`);
    }

    let allJointsOk = true;
    const tolerance = 2; // допуск ±2мм
    for (const jointX of jointPositions) {
        // Проверим, попадает ли стык на середину стойки
        let onStud = false;
        let closestStudCenter = null;
        let minDist = Infinity;
        for (const studPos of studs) {
            const studCenter = studPos + boardThickness / 2;
            const dist = Math.abs(jointX - studCenter);
            if (dist < minDist) {
                minDist = dist;
                closestStudCenter = studCenter;
            }
            // Стык попадает на середину стойки (с допуском)
            if (dist <= tolerance) {
                onStud = true;
                break;
            }
        }

        const px = oX + jointX * scale;
        if (onStud) {
            // Зеленая линия - стык на стойке
            svg.appendChild(svgEl('line', {
                x1: px, y1: oY, x2: px, y2: oY + sH,
                stroke: '#27ae60', 'stroke-width': 2, opacity: 0.8
            }));
            const ok = svgEl('text', {
                x: px, y: oY - 4, 'text-anchor': 'middle',
                'font-size': 8, 'font-family': 'Inter, sans-serif',
                fill: '#27ae60', 'font-weight': 600
            });
            ok.textContent = '✓';
            svg.appendChild(ok);
        } else {
            allJointsOk = false;
            // Красная линия - стык между стойками
            svg.appendChild(svgEl('line', {
                x1: px, y1: oY, x2: px, y2: oY + sH,
                stroke: '#e74c3c', 'stroke-width': 2, 'stroke-dasharray': '4,2', opacity: 0.9
            }));
            const warn = svgEl('text', {
                x: px, y: oY - 4, 'text-anchor': 'middle',
                'font-size': 8, 'font-family': 'Inter, sans-serif',
                fill: '#e74c3c', 'font-weight': 600
            });
            warn.textContent = '✗';
            svg.appendChild(warn);

            const distMm = Math.round(minDist);
            warnings.push(`Стык на ${jointX} мм не попадает на середину стойки (ближайший центр стойки на ${Math.round(closestStudCenter)} мм, смещение ${distMm} мм)`);
        }
    }

    if (!allJointsOk) {
        const suggested = getSuggestedSpacings(sheetWidth, boardThickness);
        if (suggested.length > 0) {
            warnings.push(`Рекомендуемый просвет между стойками для листа ${sheetWidth} мм: ${suggested.join(', ')} мм`);
        }
    }

    // Легенда внизу
    const legendY = oY + sH + 18;
    const legendItems = [
        { color: '#27ae60', label: 'Стык на стойке' },
        { color: '#e74c3c', label: 'Стык между стойками' },
    ];
    let lx = oX;
    for (const item of legendItems) {
        svg.appendChild(svgEl('line', {
            x1: lx, y1: legendY, x2: lx + 14, y2: legendY,
            stroke: item.color, 'stroke-width': 2
        }));
        const t = svgEl('text', {
            x: lx + 18, y: legendY + 3,
            'font-size': 9, 'font-family': 'Inter, sans-serif', fill: '#666'
        });
        t.textContent = item.label;
        svg.appendChild(t);
        lx += item.label.length * 6 + 35;
    }

    return { svg, warnings };
}


// ============================================================
// Модуль сметы
// ============================================================

/**
 * Генерирует HTML-таблицу сметы
 * @param {object} result - результат расчёта
 * @param {number} boardPrice - стоимость одной 6м доски
 * @returns {string} HTML
 */
function renderEstimate(result, boardPrice, sheetPrice) {
    const {
        studBoards, plateBoards, rigelBoards, openingBoards, totalBoards,
        nailsWithReserve, nailLength, nailsWeightKg,
        boardThickness, boardWidth,
        sheathing
    } = result;

    const rows = [];
    let total = 0;

    if (studBoards > 0 && boardPrice > 0) {
        const cost = studBoards * boardPrice;
        total += cost;
        rows.push({ name: `Доска на стойки (${boardThickness}x${boardWidth}x6000)`, qty: studBoards, unit: 'шт', price: boardPrice, cost });
    }
    if (plateBoards > 0 && boardPrice > 0) {
        const cost = plateBoards * boardPrice;
        total += cost;
        rows.push({ name: `Доска на обвязку (${boardThickness}x${boardWidth}x6000)`, qty: plateBoards, unit: 'шт', price: boardPrice, cost });
    }
    if (rigelBoards > 0 && boardPrice > 0) {
        const cost = rigelBoards * boardPrice;
        total += cost;
        rows.push({ name: `Доска на ригель стены (${boardThickness}x${boardWidth}x6000)`, qty: rigelBoards, unit: 'шт', price: boardPrice, cost });
    }
    if (openingBoards > 0 && boardPrice > 0) {
        const cost = openingBoards * boardPrice;
        total += cost;
        rows.push({ name: `Доска на проёмы (${boardThickness}x${boardWidth}x6000)`, qty: openingBoards, unit: 'шт', price: boardPrice, cost });
    }

    // Обшивка
    if (sheathing && sheetPrice > 0) {
        const cost = sheathing.sheetCount * sheetPrice;
        total += cost;
        rows.push({
            name: `${sheathing.name} (${sheathing.sheetHeight}x${sheathing.sheetWidth})`,
            qty: sheathing.sheetCount,
            unit: 'лист',
            price: sheetPrice,
            cost
        });
    }

    if (rows.length === 0) return '';

    return `
        <h3 class="drawing-legend__title">Смета</h3>
        <table class="estimate-table">
            <thead>
                <tr>
                    <th>Позиция</th>
                    <th>Кол-во</th>
                    <th>Ед.</th>
                    <th>Цена, ₽</th>
                    <th>Сумма, ₽</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => `
                    <tr>
                        <td>${r.name}</td>
                        <td>${r.qty}</td>
                        <td>${r.unit}</td>
                        <td>${r.price.toLocaleString('ru-RU')}</td>
                        <td>${r.cost.toLocaleString('ru-RU')}</td>
                    </tr>
                `).join('')}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="4"><strong>Итого:</strong></td>
                    <td><strong>${total.toLocaleString('ru-RU')} ₽</strong></td>
                </tr>
            </tfoot>
        </table>
    `;
}


// ============================================================
// Инициализация
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('wallForm');
    const resultPanel = document.getElementById('resultPanel');
    const drawingContainer = document.getElementById('drawingContainer');
    const specContainer = document.getElementById('specContainer');
    const addOpeningBtn = document.getElementById('addOpeningBtn');
    const openingsList = document.getElementById('openingsList');

    // Начальный плейсхолдер
    updateOpeningsPlaceholder();

    // Toggle полей обшивки
    const sheathingCheckbox = document.getElementById('hasSheathing');
    const sheathingFields = document.getElementById('sheathingFields');
    sheathingCheckbox.addEventListener('change', () => {
        sheathingFields.style.display = sheathingCheckbox.checked ? '' : 'none';
    });

    // Добавление проёма
    addOpeningBtn.addEventListener('click', () => {
        const opening = {
            id: ++openingIdCounter,
            type: 'window',
            width: 1200,
            height: 1000,
            offsetX: 1000,
            offsetY: 800,
            hasRigel: false,
        };
        openings.push(opening);
        updateOpeningsPlaceholder();
        openingsList.appendChild(createOpeningCard(opening));
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const hasSheathing = sheathingCheckbox.checked;

        const params = {
            wallLength: parseInt(document.getElementById('wallLength').value, 10),
            wallHeight: parseInt(document.getElementById('wallHeight').value, 10),
            studSpacing: parseInt(document.getElementById('studSpacing').value, 10),
            boardWidth: parseInt(document.getElementById('boardWidth').value, 10),
            boardThickness: parseInt(document.getElementById('boardThickness').value, 10),
            doubleTopPlate: document.getElementById('doubleTopPlate').checked,
            hasRigel: document.getElementById('hasRigel').checked,
            openings: openings,
            // Обшивка
            hasSheathing,
            sheetName: hasSheathing ? document.getElementById('sheetName').value.trim() : '',
            sheetHeight: hasSheathing ? parseInt(document.getElementById('sheetHeight').value, 10) : 0,
            sheetWidth: hasSheathing ? parseInt(document.getElementById('sheetWidth').value, 10) : 0,
        };

        // Валидация
        if (params.wallLength < params.studSpacing) {
            alert('Длина стены должна быть больше шага стоек');
            return;
        }
        if (params.wallHeight < params.boardThickness * 4) {
            alert('Высота стены слишком мала для конструкции');
            return;
        }

        // Валидация проёмов
        for (const o of params.openings) {
            if (o.offsetX < 0 || o.offsetX + o.width > params.wallLength) {
                alert(`Проём "${o.type === 'door' ? 'Дверь' : 'Окно'}" выходит за пределы стены по горизонтали`);
                return;
            }
            if (o.offsetY + o.height > params.wallHeight - params.boardThickness * 3) {
                alert(`Проём "${o.type === 'door' ? 'Дверь' : 'Окно'}" выходит за пределы стены по вертикали`);
                return;
            }
        }

        // Расчёт
        const result = calculateWall(params);



        // SVG чертёж
        drawingContainer.innerHTML = '';
        const svg = renderWallSVG(result);
        drawingContainer.appendChild(svg);

        // Раскрой досок для проёмов
        const cuttingContainer = document.getElementById('cuttingContainer');
        cuttingContainer.innerHTML = '';
        const cuttingSvg = renderCuttingPlan(result);
        if (cuttingSvg) {
            cuttingContainer.appendChild(cuttingSvg);
            cuttingContainer.style.display = 'block';
        } else {
            cuttingContainer.style.display = 'none';
        }

        // Раскрой обшивки
        const sheathingLayoutContainer = document.getElementById('sheathingLayoutContainer');
        sheathingLayoutContainer.innerHTML = '';
        const sheathingSvg = renderSheathingLayout(result);
        if (sheathingSvg) {
            sheathingLayoutContainer.appendChild(sheathingSvg);
            sheathingLayoutContainer.style.display = 'block';
        } else {
            sheathingLayoutContainer.style.display = 'none';
        }

        // Наложение обшивки на каркас
        const sheathingOnFrameContainer = document.getElementById('sheathingOnFrameContainer');
        const sheathingWarnings = document.getElementById('sheathingWarnings');
        sheathingOnFrameContainer.innerHTML = '';
        sheathingWarnings.innerHTML = '';
        const frameResult = renderSheathingOnFrame(result);
        if (frameResult) {
            sheathingOnFrameContainer.appendChild(frameResult.svg);
            sheathingOnFrameContainer.style.display = 'block';

            let warningsHtml = '';



            // Предупреждения о стыках
            if (frameResult.warnings.length > 0) {
                warningsHtml += `
                    <h3 class="drawing-legend__title" style="color: #c0392b;">⚠ Предупреждения по обшивке</h3>
                    <ul class="drawing-legend__list">
                        ${frameResult.warnings.map(w => `<li style="color:#c0392b;">${w}</li>`).join('')}
                    </ul>
                `;
            }

            if (warningsHtml) {
                sheathingWarnings.innerHTML = warningsHtml;
                sheathingWarnings.style.display = 'block';
            } else {
                sheathingWarnings.style.display = 'none';
            }
        } else {
            sheathingOnFrameContainer.style.display = 'none';
            sheathingWarnings.style.display = 'none';
        }

        // Спецификация
        specContainer.innerHTML = renderSpec(result);

        // Смета (если указана хотя бы одна стоимость)
        const estimateContainer = document.getElementById('estimateContainer');
        const boardPrice = parseInt(document.getElementById('boardPrice').value, 10) || 0;
        const sheetPrice = hasSheathing ? (parseInt(document.getElementById('sheetPrice').value, 10) || 0) : 0;
        const estimateHtml = renderEstimate(result, boardPrice, sheetPrice);
        if (estimateHtml) {
            estimateContainer.innerHTML = estimateHtml;
            estimateContainer.style.display = 'block';
        } else {
            estimateContainer.style.display = 'none';
        }

        // Инструкция по сборке
        const assemblyGuide = document.getElementById('assemblyGuide');
        assemblyGuide.innerHTML = renderAssemblyGuide(result);
        assemblyGuide.style.display = 'block';

        // Показываем панель результатов
        resultPanel.style.display = 'block';
        resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});
