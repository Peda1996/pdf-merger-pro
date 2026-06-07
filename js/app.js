// PDF Merger Pro - Main Application

// File model:
//   PDF:   { id, name, size, type:'pdf', pageCount, buffer, thumb }
//   Image: { id, name, size, type:'image', mimeType, originalSrc, currentSrc, width, height, cropped }
let appFiles = [];

const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM references
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileListSection = document.getElementById('fileListSection');
const resultsList = document.getElementById('resultsList');
const mergeBtn = document.getElementById('mergeBtn');
const countBadge = document.getElementById('countBadge');
const outputFilename = document.getElementById('outputFilename');
const imageOptions = document.getElementById('imageOptions');
const imagePageSize = document.getElementById('imagePageSize');
const mergeHint = document.querySelector('[data-i18n="settings.hint"]');

// Preview modal refs
const previewModal = document.getElementById('previewModal');
const previewTitle = document.getElementById('previewTitle');
const previewImage = document.getElementById('previewImage');
const previewCanvas = document.getElementById('previewCanvas');
const previewLoading = document.getElementById('previewLoading');
const previewCropBtn = document.getElementById('previewCropBtn');
const pdfNav = document.getElementById('pdfNav');
const pdfPrev = document.getElementById('pdfPrev');
const pdfNext = document.getElementById('pdfNext');
const pdfPageInfo = document.getElementById('pdfPageInfo');

// Crop modal refs
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const aspectGroup = document.getElementById('aspectGroup');

// Edit modal refs
const editModal = document.getElementById('editModal');
const editBgImg = document.getElementById('editBgImg');
const editOverlay = document.getElementById('editOverlay');
const editFontSize = document.getElementById('editFontSize');
const editColor = document.getElementById('editColor');
const editNav = document.getElementById('editNav');
const editPageInfo = document.getElementById('editPageInfo');

// Transient state
let previewPdf = null;
let previewPage = 1;
let previewPageCount = 1;
let previewMode = 'pdf';      // 'pdf' | 'imagePages'
let previewPagesArr = [];     // PNG data URLs for 'imagePages' mode (e.g. DOCX)
let cropper = null;
let cropFileId = null;
let cropFlipX = 1;
let cropFlipY = 1;
let dragSrcIndex = null;

// Content editor state
let editFileId = null;
let editPages = [];          // [{ src, annos: [] }]
let editPageIndex = 0;
let selectedAnno = null;

const PDF_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const DOCX_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="9" y1="9" x2="11" y2="9"/></svg>';
const PPTX_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
    initTheme();

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    }

    // Language selector
    document.getElementById('langSelect').addEventListener('change', e => i18n.set(e.target.value));
    // Re-render list when language changes (dynamic meta labels)
    document.addEventListener('i18n:changed', () => { if (appFiles.length) renderList(); });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Clear all button
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if (appFiles.length) document.getElementById('confirmModal').classList.add('active');
    });

    // Confirm modal events
    document.getElementById('confirmCancel').addEventListener('click', () => {
        document.getElementById('confirmModal').classList.remove('active');
    });
    document.getElementById('confirmOk').addEventListener('click', () => {
        appFiles = [];
        renderList();
        document.getElementById('confirmModal').classList.remove('active');
        showToast(i18n.t('confirm.clearMessage'), 'info');
    });

    // Drag & Drop setup
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    dropZone.addEventListener('dragenter', () => dropZone.classList.add('active'));
    dropZone.addEventListener('dragover', () => dropZone.classList.add('active'));
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('active'));
    dropZone.addEventListener('drop', (e) => {
        dropZone.classList.remove('active');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', e => handleFiles(e.target.files));

    // Merge button
    mergeBtn.addEventListener('click', mergePDFs);

    // Preview modal wiring
    document.getElementById('previewClose').addEventListener('click', closePreview);
    previewModal.addEventListener('click', (e) => { if (e.target === previewModal) closePreview(); });
    pdfPrev.addEventListener('click', () => previewGo(-1));
    pdfNext.addEventListener('click', () => previewGo(1));

    // Crop modal wiring
    document.getElementById('cropClose').addEventListener('click', closeCrop);
    document.getElementById('cropCancel').addEventListener('click', closeCrop);
    document.getElementById('cropApply').addEventListener('click', applyCrop);
    document.getElementById('cropReset').addEventListener('click', () => {
        if (cropper) { cropper.reset(); cropFlipX = 1; cropFlipY = 1; }
    });
    document.getElementById('rotateLeft').addEventListener('click', () => cropper && cropper.rotate(-90));
    document.getElementById('rotateRight').addEventListener('click', () => cropper && cropper.rotate(90));
    document.getElementById('flipH').addEventListener('click', () => {
        if (cropper) { cropFlipX = -cropFlipX; cropper.scaleX(cropFlipX); }
    });
    document.getElementById('flipV').addEventListener('click', () => {
        if (cropper) { cropFlipY = -cropFlipY; cropper.scaleY(cropFlipY); }
    });
    aspectGroup.querySelectorAll('.aspect-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveAspect(btn.dataset.ratio);
            if (cropper) cropper.setAspectRatio(btn.dataset.ratio === 'free' ? NaN : parseFloat(btn.dataset.ratio));
        });
    });

    // Edit modal wiring
    document.getElementById('editClose').addEventListener('click', closeEditor);
    document.getElementById('editCancel').addEventListener('click', closeEditor);
    document.getElementById('editApply').addEventListener('click', applyEdits);
    document.getElementById('addTextBtn').addEventListener('click', () => {
        const { w: dw, h: dh } = editDisplaySize();
        const el = createTextEl({ left: dw * 0.3, top: dh * 0.42, text: 'Text', fontSize: parseFloat(editFontSize.value) || 20, color: editColor.value });
        selectAnno(el);
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    });
    document.getElementById('addWhiteoutBtn').addEventListener('click', () => {
        const { w: dw, h: dh } = editDisplaySize();
        const el = createWhiteoutEl({ left: dw * 0.3, top: dh * 0.42, width: dw * 0.28, height: dh * 0.06 });
        selectAnno(el);
    });
    editFontSize.addEventListener('change', () => {
        if (selectedAnno && selectedAnno.dataset.type === 'text') selectedAnno.style.fontSize = editFontSize.value + 'px';
    });
    editColor.addEventListener('input', () => {
        if (selectedAnno && selectedAnno.dataset.type === 'text') selectedAnno.style.color = editColor.value;
    });
    document.getElementById('editDeleteSel').addEventListener('click', () => {
        if (selectedAnno) { selectedAnno.remove(); selectedAnno = null; }
    });
    document.getElementById('editPrev').addEventListener('click', () => gotoEditPage(-1));
    document.getElementById('editNext').addEventListener('click', () => gotoEditPage(1));
    editOverlay.addEventListener('mousedown', (e) => {
        if (e.target === editOverlay && selectedAnno) { selectedAnno.classList.remove('selected'); selectedAnno = null; }
    });

    // Escape closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (cropModal.classList.contains('active')) closeCrop();
        else if (previewModal.classList.contains('active')) closePreview();
        else document.getElementById('confirmModal').classList.remove('active');
    });
});

// ---------- File loading ----------

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp)$/i;
const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f) => f.type.startsWith('image/') || IMAGE_EXT.test(f.name);
const isDocx = (f) => /\.docx$/i.test(f.name) ||
    f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const isPptx = (f) => /\.pptx$/i.test(f.name) ||
    f.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

async function handleFiles(fileList) {
    const all = Array.from(fileList);
    const accepted = all.filter(f => isPdf(f) || isImage(f) || isDocx(f) || isPptx(f));
    if (accepted.length === 0) {
        if (all.length) showToast(i18n.t('toast.unsupported'), 'error');
        fileInput.value = '';
        return;
    }

    document.body.style.cursor = 'wait';
    if (accepted.some(f => isDocx(f) || isPptx(f))) showToast(i18n.t('toast.converting'), 'info');
    for (const file of accepted) {
        try {
            if (isPdf(file)) await addPdf(file);
            else if (isDocx(file)) await addDocx(file);
            else if (isPptx(file)) await addPptx(file);
            else await addImage(file);
        } catch (e) {
            console.error('Failed to load', file.name, e);
            showToast(`${i18n.t('toast.error')}: ${file.name}`, 'error');
        }
    }
    document.body.style.cursor = 'default';
    renderList();
}

async function addPdf(file) {
    const buffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
    const item = {
        id: uid(),
        name: file.name,
        size: formatBytes(file.size),
        type: 'pdf',
        pageCount: pdfDoc.getPageCount(),
        buffer,
        thumb: null
    };
    appFiles.push(item);
    // Generate a preview thumbnail (best-effort; merge does not depend on it).
    // Timeout guards against pdf.js render stalling when the tab is backgrounded.
    try { item.thumb = await withTimeout(generatePdfThumb(buffer), 10000, null); } catch (e) { console.warn('PDF thumb failed', e); }
}

async function addImage(file) {
    const dataUrl = await fileToDataURL(file);
    const { width, height } = await getImageSize(dataUrl);

    // pdf-lib can only embed JPG/PNG. Convert anything else (webp/gif/bmp) to PNG.
    let mimeType = file.type && /image\/(jpeg|png)/.test(file.type)
        ? file.type
        : (/\.png$/i.test(file.name) ? 'image/png' : (/\.jpe?g$/i.test(file.name) ? 'image/jpeg' : ''));
    let src = dataUrl;
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
        src = await canvasConvert(dataUrl, width, height, 'image/png');
        mimeType = 'image/png';
    }

    appFiles.push({
        id: uid(),
        name: file.name,
        size: formatBytes(file.size),
        type: 'image',
        mimeType,
        originalSrc: src,
        currentSrc: src,
        width,
        height,
        cropped: false
    });
}

async function addDocx(file) {
    const buffer = await file.arrayBuffer();
    const pages = await renderDocxToPages(buffer);
    if (!pages.length) throw new Error('No pages rendered from DOCX');
    const thumb = await makeThumb(pages[0].png, 160);
    appFiles.push({
        id: uid(),
        name: file.name,
        size: formatBytes(file.size),
        type: 'docx',
        pages,                 // [{ png, wPt, hPt }]
        pageCount: pages.length,
        thumb
    });
}

// Rasterize a rendered page/slide element to a canvas. Prefers modern-screenshot
// (renders SVG shapes that PPTXjs emits) and falls back to html2canvas.
async function rasterizePage(el) {
    // Wait for embedded images to decode and fonts to load before capturing,
    // otherwise the rasterizer can grab a frame with missing images/glyphs.
    try {
        await Promise.all(Array.from(el.querySelectorAll('img')).map(img =>
            (img.complete && img.naturalWidth)
                ? Promise.resolve()
                : (img.decode ? img.decode().catch(() => {}) : new Promise(r => { img.onload = img.onerror = r; }))
        ));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch (_) { /* best effort */ }

    if (window.modernScreenshot && window.modernScreenshot.domToCanvas) {
        try {
            return await window.modernScreenshot.domToCanvas(el, { scale: 2, backgroundColor: '#ffffff' });
        } catch (e) {
            console.warn('modern-screenshot failed, falling back to html2canvas', e);
        }
    }
    return await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
}

// Render a .docx into an array of page images using docx-preview.
// Note: pages are rasterized, so text in the final PDF is not selectable.
async function renderDocxToPages(arrayBuffer) {
    if (!window.docx || !window.html2canvas) throw new Error('DOCX libraries not loaded');
    const stage = document.getElementById('renderStage');
    stage.innerHTML = '';
    const container = document.createElement('div');
    stage.appendChild(container);

    await window.docx.renderAsync(arrayBuffer, container, null, {
        className: 'docx',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        breakPages: true,
        useBase64URL: true,
        experimental: true
    });

    // docx-preview emits one <section class="docx"> per page
    let sections = Array.from(container.querySelectorAll('section.docx'));
    if (!sections.length) sections = [container];

    const pages = [];
    for (const sec of sections) {
        const cssW = sec.offsetWidth || 794;
        const cssH = sec.offsetHeight || 1123;
        const canvas = await rasterizePage(sec);
        pages.push({
            png: canvas.toDataURL('image/png'),
            wPt: cssW * 72 / 96,   // CSS px (96dpi) -> PDF points
            hPt: cssH * 72 / 96
        });
    }

    stage.innerHTML = '';
    return pages;
}

function makeThumb(src, maxDim) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = maxDim / Math.max(img.naturalWidth, img.naturalHeight);
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => resolve(src);
        img.src = src;
    });
}

async function addPptx(file) {
    const pages = await renderPptxToPages(file);
    if (!pages.length) throw new Error('No slides rendered from PPTX');
    const thumb = await makeThumb(pages[0].png, 160);
    appFiles.push({
        id: uid(),
        name: file.name,
        size: formatBytes(file.size),
        type: 'pptx',
        pages,                 // [{ png, wPt, hPt }]
        pageCount: pages.length,
        thumb
    });
}

// Render a .pptx into an array of slide images using PPTXjs + html2canvas.
// Note: slides are rasterized, so text in the final PDF is not selectable.
async function renderPptxToPages(file) {
    if (!window.jQuery || !window.html2canvas) throw new Error('PPTX libraries not loaded');

    // PPTXjs uses the JSZip 2.x API (new JSZip(); zip.load()). docx-preview needs
    // JSZip 3.x, so the global is 3.x by default — swap to 2.x just for PPTXjs.
    const prevJSZip = window.JSZip;
    if (window.__JSZip2) window.JSZip = window.__JSZip2;

    const stage = document.getElementById('renderStage');
    stage.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'pptx-render';
    stage.appendChild(container);

    const url = URL.createObjectURL(file);
    try {
        window.jQuery(container).pptxToHtml({
            pptxFileUrl: url,
            slidesScale: '100%',
            slideMode: false,
            keyBoardShortCut: false
        });

        await waitForStableSlides(container);

        const slides = Array.from(container.querySelectorAll('div.slide'));
        if (!slides.length) throw new Error('No slides rendered');

        const pages = [];
        for (const slide of slides) {
            const cssW = slide.offsetWidth || 960;
            const cssH = slide.offsetHeight || 540;
            const canvas = await rasterizePage(slide);
            pages.push({
                png: canvas.toDataURL('image/png'),
                wPt: cssW * 72 / 96,
                hPt: cssH * 72 / 96
            });
        }
        return pages;
    } finally {
        URL.revokeObjectURL(url);
        stage.innerHTML = '';
        window.JSZip = prevJSZip; // restore JSZip 3.x for docx-preview
    }
}

// PPTXjs renders asynchronously with no completion promise, so poll until the
// rendered slide count (real "div.slide" elements, not the loading bar) is stable.
function waitForStableSlides(container, timeout = 20000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        let lastCount = -1;
        let stableSince = Date.now();
        const tick = () => {
            const count = container.querySelectorAll('div.slide').length;
            const now = Date.now();
            if (count > 0 && count === lastCount) {
                if (now - stableSince > 800) return resolve();
            } else {
                lastCount = count;
                stableSince = now;
            }
            if (now - start > timeout) {
                return count > 0 ? resolve() : reject(new Error('PPTX render timed out'));
            }
            setTimeout(tick, 150);
        };
        tick();
    });
}

// Enabled from the first document: 2+ files merge, a single non-PDF converts to
// PDF, and a single PDF can be exported (e.g. after editing its text).
function canMergeNow() {
    return appFiles.length >= 1;
}

// ---------- List rendering ----------

function renderList() {
    resultsList.innerHTML = '';

    if (appFiles.length > 0) {
        fileListSection.classList.remove('hidden');
        appFiles.forEach((file, index) => resultsList.appendChild(renderItem(file, index)));
    } else {
        fileListSection.classList.add('hidden');
    }

    // Stats
    countBadge.textContent = appFiles.length;
    const totalPages = appFiles.reduce((sum, f) => sum + (f.pageCount || 1), 0);
    document.getElementById('totalPageInfo').textContent =
        `${appFiles.length} ${i18n.t('list.files')} · ${totalPages} ${i18n.t('list.pagesShort')}`;

    // Image options visibility
    imageOptions.classList.toggle('hidden', !appFiles.some(f => f.type === 'image'));

    // Merge availability: 2+ files, or a single non-PDF (image/docx → PDF conversion)
    const canMerge = canMergeNow();
    mergeBtn.disabled = !canMerge;
    if (mergeHint) mergeHint.classList.toggle('hidden', canMerge);

    fileInput.value = '';
}

function renderItem(file, index) {
    const clone = document.getElementById('listItemTemplate').content.cloneNode(true);
    const root = clone.querySelector('.file-item');
    root.dataset.index = index;

    clone.querySelector('.index-number').textContent = index + 1;
    clone.querySelector('.file-name').textContent = file.name;

    const thumbImg = clone.querySelector('.thumb-img');
    const thumbIcon = clone.querySelector('.thumb-icon');
    const meta = clone.querySelector('.file-meta');
    const cropBtn = clone.querySelector('.crop-btn');
    const editBtn = clone.querySelector('.edit-btn');
    const previewBtn = clone.querySelector('.preview-btn');
    const thumbBtn = clone.querySelector('.thumb-btn');
    const upBtn = clone.querySelector('.up-btn');
    const downBtn = clone.querySelector('.down-btn');
    const delBtn = clone.querySelector('.delete-btn');

    thumbImg.setAttribute('draggable', 'false');
    if (!isEditable(file)) editBtn.classList.add('hidden');

    const editedTag = file.edited ? ` · ${i18n.t('list.edited')}` : '';

    if (file.type === 'image') {
        const dims = `${file.width}×${file.height}`;
        const croppedTag = file.cropped ? ` · ${i18n.t('list.cropped')}` : '';
        meta.textContent = `${imgTypeLabel(file.mimeType)} · ${dims} · ${file.size}${croppedTag}${editedTag}`;
        thumbImg.src = file.currentSrc;
        thumbImg.classList.remove('hidden');
        thumbImg.classList.toggle('has-alpha', file.mimeType === 'image/png');
        thumbIcon.classList.add('hidden');
        cropBtn.title = i18n.t('crop.title');
    } else if (file.type === 'docx' || file.type === 'pptx') {
        const label = file.type === 'docx' ? 'DOCX' : 'PPTX';
        meta.textContent = `${label} · ${file.pageCount} ${i18n.t('list.pagesShort')} · ${file.size}${editedTag}`;
        cropBtn.classList.add('hidden'); // no cropping for documents
        if (file.thumb) {
            thumbImg.src = file.thumb;
            thumbImg.classList.remove('hidden');
            thumbIcon.classList.add('hidden');
        } else {
            thumbIcon.innerHTML = file.type === 'docx' ? DOCX_ICON : PPTX_ICON;
        }
    } else {
        meta.textContent = `PDF · ${file.pageCount} ${i18n.t('list.pagesShort')} · ${file.size}${editedTag}`;
        cropBtn.classList.add('hidden'); // no cropping for PDFs
        if (file.thumb) {
            thumbImg.src = file.thumb;
            thumbImg.classList.remove('hidden');
            thumbIcon.classList.add('hidden');
        } else {
            thumbIcon.innerHTML = PDF_ICON;
        }
    }

    // Tooltips
    previewBtn.title = i18n.t('list.preview');
    thumbBtn.title = i18n.t('list.preview');
    editBtn.title = i18n.t('edit.title');
    upBtn.title = i18n.t('list.moveUp');
    downBtn.title = i18n.t('list.moveDown');
    delBtn.title = i18n.t('list.remove');
    root.querySelector('.index-number').title = i18n.t('list.dragHint');

    // Disable up/down at bounds
    if (index === 0) { upBtn.disabled = true; upBtn.classList.add('opacity-30', 'cursor-not-allowed'); }
    if (index === appFiles.length - 1) { downBtn.disabled = true; downBtn.classList.add('opacity-30', 'cursor-not-allowed'); }

    // Actions
    previewBtn.addEventListener('click', () => openPreview(index));
    thumbBtn.addEventListener('click', () => openPreview(index));
    editBtn.addEventListener('click', () => openEditor(index));
    cropBtn.addEventListener('click', () => openCrop(index));
    upBtn.addEventListener('click', () => moveItem(index, -1));
    downBtn.addEventListener('click', () => moveItem(index, 1));
    delBtn.addEventListener('click', () => removeItem(index));

    // Drag to reorder
    wireDrag(root, index);

    return clone;
}

function imgTypeLabel(mime) {
    if (mime === 'image/png') return 'PNG';
    if (mime === 'image/jpeg') return 'JPG';
    return 'IMG';
}

// ---------- Reordering ----------

function moveItem(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= appFiles.length) return;
    [appFiles[index], appFiles[newIndex]] = [appFiles[newIndex], appFiles[index]];
    renderList();
}

function removeItem(index) {
    appFiles.splice(index, 1);
    renderList();
}

function wireDrag(root, index) {
    root.addEventListener('dragstart', (e) => {
        dragSrcIndex = index;
        root.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(index)); } catch (_) {}
    });
    root.addEventListener('dragend', () => { root.classList.remove('dragging'); clearDragOver(); });
    root.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = root.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        clearDragOver();
        root.classList.add(after ? 'drag-over-bottom' : 'drag-over-top');
    });
    root.addEventListener('dragleave', () => root.classList.remove('drag-over-top', 'drag-over-bottom'));
    root.addEventListener('drop', (e) => {
        e.preventDefault();
        const rect = root.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        clearDragOver();
        moveTo(dragSrcIndex, index + (after ? 1 : 0));
        dragSrcIndex = null;
    });
}

function clearDragOver() {
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
}

function moveTo(from, target) {
    if (from === null || from === undefined || from === target) return;
    const item = appFiles[from];
    appFiles.splice(from, 1);
    if (from < target) target--;
    target = Math.max(0, Math.min(target, appFiles.length));
    appFiles.splice(target, 0, item);
    renderList();
}

// ---------- Preview ----------

async function openPreview(index) {
    const file = appFiles[index];
    previewTitle.textContent = file.name;
    previewImage.classList.add('hidden');
    previewCanvas.classList.add('hidden');
    previewLoading.classList.add('hidden');
    previewLoading.classList.remove('flex');
    pdfNav.classList.add('hidden');
    pdfNav.classList.remove('flex');
    previewCropBtn.classList.add('hidden');
    previewCropBtn.classList.remove('flex');
    previewModal.classList.add('active');

    if (file.type === 'image') {
        previewMode = 'image';
        previewImage.src = file.currentSrc;
        previewImage.classList.remove('hidden');
        previewCropBtn.classList.remove('hidden');
        previewCropBtn.classList.add('flex');
        previewCropBtn.onclick = () => { closePreview(); openCrop(index); };
    } else if (file.type === 'docx' || file.type === 'pptx') {
        previewMode = 'imagePages';
        previewPagesArr = file.pages.map(p => p.png);
        previewPageCount = previewPagesArr.length;
        previewPage = 1;
        pdfNav.classList.remove('hidden');
        pdfNav.classList.add('flex');
        showImagePage();
    } else {
        previewMode = 'pdf';
        previewLoading.classList.remove('hidden');
        previewLoading.classList.add('flex');
        try {
            if (previewPdf) { previewPdf.destroy(); previewPdf = null; }
            previewPdf = await pdfjsLib.getDocument({ data: file.buffer.slice(0) }).promise;
            previewPageCount = previewPdf.numPages;
            previewPage = 1;
            pdfNav.classList.remove('hidden');
            pdfNav.classList.add('flex');
            await renderPreviewPage();
        } catch (e) {
            console.error('Preview failed', e);
            showToast(i18n.t('toast.previewError'), 'error');
            closePreview();
        } finally {
            previewLoading.classList.add('hidden');
            previewLoading.classList.remove('flex');
        }
    }
}

// Show a page in 'imagePages' mode (e.g. rendered DOCX pages)
function showImagePage() {
    previewImage.src = previewPagesArr[previewPage - 1];
    previewImage.classList.remove('hidden');
    pdfPageInfo.textContent = `${previewPage} / ${previewPageCount}`;
    pdfPrev.disabled = previewPage <= 1;
    pdfNext.disabled = previewPage >= previewPageCount;
}

// Page navigation shared by PDF and imagePages modes
function previewGo(delta) {
    const next = previewPage + delta;
    if (next < 1 || next > previewPageCount) return;
    previewPage = next;
    if (previewMode === 'pdf') renderPreviewPage();
    else showImagePage();
}

async function renderPreviewPage() {
    if (!previewPdf) return;
    const page = await previewPdf.getPage(previewPage);
    const containerWidth = (previewCanvas.parentElement.clientWidth || 800) - 32;
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(0.3, Math.min(2.5, containerWidth / base.width));
    const viewport = page.getViewport({ scale });
    previewCanvas.width = Math.ceil(viewport.width);
    previewCanvas.height = Math.ceil(viewport.height);
    const ctx = previewCanvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    previewCanvas.classList.remove('hidden');
    pdfPageInfo.textContent = `${previewPage} / ${previewPageCount}`;
    pdfPrev.disabled = previewPage <= 1;
    pdfNext.disabled = previewPage >= previewPageCount;
}

function closePreview() {
    previewModal.classList.remove('active');
    if (previewPdf) { previewPdf.destroy(); previewPdf = null; }
    previewImage.src = '';
}

// ---------- Crop ----------

function openCrop(index) {
    const file = appFiles[index];
    if (!file || file.type !== 'image') return;
    cropFileId = file.id;
    cropFlipX = 1;
    cropFlipY = 1;
    setActiveAspect('free');

    cropImage.src = file.originalSrc; // always crop from original (non-destructive)
    cropModal.classList.add('active');

    // Cropper.js waits for the image's load event internally, so we can build
    // it right away. The modal uses visibility (not display:none), so the image
    // already has layout dimensions.
    if (cropper) { cropper.destroy(); cropper = null; }
    cropper = new Cropper(cropImage, {
        viewMode: 1,
        autoCropArea: 1,
        background: true,
        responsive: true,
        checkOrientation: true
    });
}

function setActiveAspect(ratio) {
    aspectGroup.querySelectorAll('.aspect-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.ratio === ratio);
    });
}

function applyCrop() {
    const file = appFiles.find(f => f.id === cropFileId);
    if (!file || !cropper) return;

    const canvas = cropper.getCroppedCanvas({
        maxWidth: 4096,
        maxHeight: 4096,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
    });
    if (!canvas) { showToast(i18n.t('toast.error'), 'error'); return; }

    let outCanvas = canvas;
    // JPEG has no alpha → flatten onto white
    if (file.mimeType === 'image/jpeg') {
        outCanvas = document.createElement('canvas');
        outCanvas.width = canvas.width;
        outCanvas.height = canvas.height;
        const ctx = outCanvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, outCanvas.width, outCanvas.height);
        ctx.drawImage(canvas, 0, 0);
    }

    file.currentSrc = file.mimeType === 'image/jpeg'
        ? outCanvas.toDataURL('image/jpeg', 0.92)
        : outCanvas.toDataURL('image/png');
    file.width = outCanvas.width;
    file.height = outCanvas.height;
    file.cropped = true;

    closeCrop();
    renderList();
    showToast(i18n.t('toast.cropped'), 'success');
}

function closeCrop() {
    cropModal.classList.remove('active');
    if (cropper) { cropper.destroy(); cropper = null; }
    cropImage.src = '';
    cropFileId = null;
}

// ---------- Content editor (text + whiteout overlays) ----------

// Which file types support the overlay editor.
function isEditable(file) {
    return file.type === 'image' || file.type === 'docx' || file.type === 'pptx' || file.type === 'pdf';
}

async function openEditor(index) {
    const file = appFiles[index];
    if (!file || !isEditable(file)) return;
    editFileId = file.id;
    selectedAnno = null;

    if (file.type === 'image') {
        editPages = [{ src: file.currentSrc, annos: [] }];
    } else if (file.type === 'docx' || file.type === 'pptx') {
        editPages = file.pages.map(p => ({ src: p.png, annos: [] }));
    } else if (file.type === 'pdf') {
        // Render pages to images for display only; annotations stay as data
        // and are drawn onto the real vector page at merge time (lossless).
        document.body.style.cursor = 'wait';
        showToast(i18n.t('toast.converting'), 'info');
        try {
            editPages = await withTimeout(renderPdfPagesForEdit(file.buffer), 30000, null);
        } catch (e) {
            console.error('PDF render for edit failed', e);
            editPages = null;
        }
        document.body.style.cursor = 'default';
        if (!editPages || !editPages.length) {
            showToast(i18n.t('toast.previewError'), 'error');
            return;
        }
    }

    // Restore previously saved edits (PDF keeps them as data: manual annos + recognized-text edits)
    if (file.annotations) {
        editPages.forEach((pg, i) => {
            const saved = file.annotations[i];
            if (saved) {
                pg.annos = (saved.manual || []).map(a => Object.assign({}, a));
                pg.savedEdits = saved.edits || {};
            }
        });
    }

    editPageIndex = 0;
    document.getElementById('editTitle').textContent = file.name;
    editModal.classList.add('active');
    const multi = editPages.length > 1;
    editNav.classList.toggle('hidden', !multi);
    editNav.classList.toggle('flex', multi);
    showEditPage(0);
}

// Render every PDF page to an image (display only) and extract its text items
// (positions/sizes) so existing text can be edited in place.
async function renderPdfPagesForEdit(buffer) {
    if (!window.pdfjsLib) throw new Error('pdf.js not loaded');
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    const pages = [];
    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const base = page.getViewport({ scale: 1 });
            const W = base.width, H = base.height;
            const scale = Math.min(2, 1100 / W);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Extract text items (parser-based; coordinates in PDF points, origin bottom-left)
            let textItems = [];
            try {
                const tc = await page.getTextContent();
                textItems = tc.items.filter(it => it.str && it.str.trim()).map((it, k) => {
                    const tx = it.transform;
                    const size = Math.hypot(tx[1], tx[3]) || tx[3] || 12;
                    const xPt = tx[4];
                    const yBase = tx[5];
                    const wPt = it.width || it.str.length * size * 0.5;
                    return {
                        idx: k,
                        str: it.str,
                        // text annotation coords (match drawAnnotationsOnPdfPage round-trip)
                        leftPct: (xPt - size * 0.2) / W,
                        topPct: (H - yBase - size * 0.92) / H,
                        fontPct: size / H,
                        // whiteout coords to cover the original glyphs
                        woLeftPct: (xPt - size * 0.12) / W,
                        woTopPct: (H - yBase - size * 0.95) / H,
                        woWPct: (wPt + size * 0.24) / W,
                        woHPct: (size * 1.3) / H
                    };
                });
            } catch (e) {
                console.warn('Text extraction failed for page', i, e);
            }

            // White out the recognized text in the editor image so the editable
            // boxes (which carry the text) don't show a doubled/ghosted background.
            if (textItems.length) {
                ctx.fillStyle = '#ffffff';
                textItems.forEach(t => {
                    ctx.fillRect(t.woLeftPct * canvas.width, t.woTopPct * canvas.height,
                        t.woWPct * canvas.width, t.woHPct * canvas.height);
                });
            }

            pages.push({ src: canvas.toDataURL('image/jpeg', 0.85), annos: [], textItems });
        }
    } finally {
        pdf.destroy();
    }
    return pages;
}

function showEditPage(i) {
    editPageIndex = i;
    selectedAnno = null;
    editOverlay.innerHTML = '';
    editPageInfo.textContent = `${i + 1} / ${editPages.length}`;
    document.getElementById('editPrev').disabled = i <= 0;
    document.getElementById('editNext').disabled = i >= editPages.length - 1;

    editBgImg.onload = () => {
        const { w: dw, h: dh } = editDisplaySize();
        editOverlay.style.width = dw + 'px';
        editOverlay.style.height = dh + 'px';
        // Recognized PDF text → editable boxes (with any previously saved change)
        const saved = editPages[i].savedEdits || {};
        (editPages[i].textItems || []).forEach(t => createRecognizedTextEl(t, dw, dh, saved[t.idx]));
        // Manual annotations
        (editPages[i].annos || []).forEach(a => {
            if (a.type === 'text') {
                createTextEl({ left: a.leftPct * dw, top: a.topPct * dh, text: a.text, fontSize: a.fontPct * dh, color: a.color });
            } else {
                createWhiteoutEl({ left: a.leftPct * dw, top: a.topPct * dh, width: a.wPct * dw, height: a.hPct * dh });
            }
        });
    };
    editBgImg.src = editPages[i].src;
    if (editBgImg.complete && editBgImg.naturalWidth) editBgImg.onload();
}

function gotoEditPage(delta) {
    const next = editPageIndex + delta;
    if (next < 0 || next >= editPages.length) return;
    serializeEditPage();
    showEditPage(next);
}

function createTextEl(data) {
    const el = document.createElement('div');
    el.className = 'anno anno-text';
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.dataset.type = 'text';
    el.textContent = data.text != null ? data.text : 'Text';
    el.style.left = (data.left || 0) + 'px';
    el.style.top = (data.top || 0) + 'px';
    el.style.fontSize = (data.fontSize || 20) + 'px';
    el.style.color = data.color || '#111111';
    wireAnnoDrag(el);
    editOverlay.appendChild(el);
    return el;
}

// Editable box positioned over a recognized PDF text run. Only emitted at save
// time if its text was actually changed.
function createRecognizedTextEl(t, dw, dh, ed) {
    const useEdit = ed && ed.text != null;
    const el = document.createElement('div');
    el.className = 'anno anno-text anno-recognized' + (useEdit ? ' anno-changed' : '');
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.dataset.type = 'text';
    el.dataset.recognized = '1';
    el.dataset.idx = t.idx;
    el.dataset.orig = t.str;
    el.dataset.woLeftPct = t.woLeftPct;
    el.dataset.woTopPct = t.woTopPct;
    el.dataset.woWPct = t.woWPct;
    el.dataset.woHPct = t.woHPct;
    el.textContent = useEdit ? ed.text : t.str;
    el.style.left = ((useEdit ? ed.leftPct : t.leftPct) * dw) + 'px';
    el.style.top = ((useEdit ? ed.topPct : t.topPct) * dh) + 'px';
    el.style.fontSize = ((useEdit ? ed.fontPct : t.fontPct) * dh) + 'px';
    el.style.color = (useEdit && ed.color) ? ed.color : '#000000';
    wireAnnoDrag(el);
    el.addEventListener('input', () => {
        el.classList.toggle('anno-changed', getAnnoText(el) !== el.dataset.orig);
    });
    editOverlay.appendChild(el);
    return el;
}

function createWhiteoutEl(data) {
    const el = document.createElement('div');
    el.className = 'anno anno-whiteout';
    el.dataset.type = 'whiteout';
    el.style.left = (data.left || 0) + 'px';
    el.style.top = (data.top || 0) + 'px';
    el.style.width = (data.width || 120) + 'px';
    el.style.height = (data.height || 32) + 'px';
    wireAnnoDrag(el);
    const handle = document.createElement('div');
    handle.className = 'anno-resize';
    el.appendChild(handle);
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight;
        const onMove = (ev) => {
            el.style.width = Math.max(12, sw + ev.clientX - sx) + 'px';
            el.style.height = Math.max(12, sh + ev.clientY - sy) + 'px';
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
    editOverlay.appendChild(el);
    return el;
}

function wireAnnoDrag(el) {
    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('anno-resize')) return;
        selectAnno(el);
        const sx = e.clientX, sy = e.clientY;
        const ol = parseFloat(el.style.left) || 0, ot = parseFloat(el.style.top) || 0;
        let moved = false;
        const onMove = (ev) => {
            const dx = ev.clientX - sx, dy = ev.clientY - sy;
            if (!moved && Math.abs(dx) + Math.abs(dy) > 3) { moved = true; if (el.dataset.type === 'text') el.blur(); }
            if (moved) {
                ev.preventDefault();
                el.style.left = (ol + dx) + 'px';
                el.style.top = (ot + dy) + 'px';
            }
        };
        const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

// Editor display size with a stable fallback (clientWidth can be 0 before layout)
function editDisplaySize() {
    return {
        w: editBgImg.clientWidth || editBgImg.naturalWidth || 1,
        h: editBgImg.clientHeight || editBgImg.naturalHeight || 1
    };
}

function selectAnno(el) {
    if (selectedAnno) selectedAnno.classList.remove('selected');
    selectedAnno = el;
    el.classList.add('selected');
    if (el.dataset.type === 'text') {
        editFontSize.value = String(Math.round(parseFloat(el.style.fontSize) || 20));
        const c = rgbToHex(el.style.color);
        if (c) editColor.value = c;
    }
}

function getAnnoText(el) {
    // Reliable text extraction for the contenteditable box. innerText can be
    // empty right after insertion (layout-dependent), so walk child nodes.
    var NL = String.fromCharCode(10);
    var out = '';
    el.childNodes.forEach(function (node) {
        if (node.nodeType === 3) {
            out += node.nodeValue;
        } else if (node.nodeName === 'BR') {
            out += NL;
        } else if (node.nodeType === 1) {
            if (out && out.charAt(out.length - 1) !== NL) out += NL;
            out += node.textContent;
        }
    });
    if (!out) out = el.textContent || '';
    return out.replace(/ /g, ' ');
}

function serializeEditPage() {
    const { w: dw, h: dh } = editDisplaySize();
    const annos = [];      // manual annotations (and image/office burn list)
    const edits = {};      // changed recognized PDF text, keyed by item index
    editOverlay.querySelectorAll('.anno').forEach(el => {
        const left = parseFloat(el.style.left) || 0;
        const top = parseFloat(el.style.top) || 0;
        if (el.dataset.recognized === '1') {
            const text = getAnnoText(el);
            if (text === el.dataset.orig) return; // unchanged → keep original PDF glyphs
            edits[el.dataset.idx] = {
                text,
                leftPct: left / dw, topPct: top / dh,
                fontPct: (parseFloat(el.style.fontSize) || 12) / dh,
                color: el.style.color || '#000000',
                woLeftPct: parseFloat(el.dataset.woLeftPct),
                woTopPct: parseFloat(el.dataset.woTopPct),
                woWPct: parseFloat(el.dataset.woWPct),
                woHPct: parseFloat(el.dataset.woHPct)
            };
        } else if (el.dataset.type === 'text') {
            annos.push({
                type: 'text', leftPct: left / dw, topPct: top / dh,
                text: getAnnoText(el),
                fontPct: (parseFloat(el.style.fontSize) || 20) / dh,
                color: el.style.color || '#111111'
            });
        } else {
            annos.push({
                type: 'whiteout', leftPct: left / dw, topPct: top / dh,
                wPct: el.offsetWidth / dw, hPct: el.offsetHeight / dh
            });
        }
    });
    editPages[editPageIndex].annos = annos;
    editPages[editPageIndex].edits = edits;
}

async function applyEdits() {
    serializeEditPage();
    const file = appFiles.find(f => f.id === editFileId);
    if (!file) { closeEditor(); return; }

    // PDF: keep annotations as data and draw them as real vector objects at
    // merge time (no rasterization, text stays crisp/selectable).
    if (file.type === 'pdf') {
        const ann = {};
        editPages.forEach((pg, i) => {
            const manual = pg.annos || [];
            const edits = pg.edits || {};
            if (manual.length || Object.keys(edits).length) ann[i] = { manual, edits };
        });
        file.annotations = Object.keys(ann).length ? ann : null;
        file.edited = !!file.annotations;
        closeEditor();
        renderList();
        showToast(i18n.t('toast.edited'), 'success');
        return;
    }

    const isJpeg = file.type === 'image' && file.mimeType === 'image/jpeg';
    const out = [];
    for (const pg of editPages) {
        const img = await loadImage(pg.src);
        const W = img.naturalWidth, H = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        const annos = pg.annos || [];
        // Whiteouts first (background cover), then text on top — regardless of creation order
        for (const a of annos.filter(a => a.type === 'whiteout')) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(a.leftPct * W, a.topPct * H, a.wPct * W, a.hPct * H);
        }
        for (const a of annos.filter(a => a.type === 'text')) {
            const fs = a.fontPct * H;
            ctx.fillStyle = a.color || '#111111';
            ctx.font = fs + 'px Arial, Helvetica, sans-serif';
            ctx.textBaseline = 'top';
            const padX = fs * 0.2, padY = fs * 0.12;
            let y = a.topPct * H + padY;
            String(a.text || '').split('\n').forEach(line => {
                ctx.fillText(line, a.leftPct * W + padX, y);
                y += fs * 1.25;
            });
        }
        out.push(canvas.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', 0.92));
    }

    if (file.type === 'image') {
        file.currentSrc = out[0];
        const dim = await loadImage(out[0]);
        file.width = dim.naturalWidth;
        file.height = dim.naturalHeight;
    } else {
        file.pages.forEach((p, i) => { if (out[i]) p.png = out[i]; });
    }
    file.edited = true;

    closeEditor();
    renderList();
    showToast(i18n.t('toast.edited'), 'success');
}

function closeEditor() {
    editModal.classList.remove('active');
    editOverlay.innerHTML = '';
    editBgImg.onload = null;
    editBgImg.src = '';
    editFileId = null;
    editPages = [];
    selectedAnno = null;
}

function rgbToHex(rgb) {
    if (!rgb) return null;
    if (rgb[0] === '#') return rgb;
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return null;
    return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
}

// ---------- Merge ----------

async function mergePDFs() {
    if (!canMergeNow()) return;

    const btn = mergeBtn;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${i18n.t('toast.merging')}`;
    btn.disabled = true;

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        const mode = imagePageSize.value;
        let annoFont = null; // Helvetica, embedded lazily for PDF annotations

        for (const file of appFiles) {
            if (file.type === 'pdf') {
                const pdf = await PDFLib.PDFDocument.load(file.buffer, { ignoreEncryption: true });
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                for (let idx = 0; idx < pages.length; idx++) {
                    mergedPdf.addPage(pages[idx]);
                    const pageAnn = file.annotations && file.annotations[idx];
                    if (pageAnn) {
                        const all = (pageAnn.manual || []).slice();
                        Object.keys(pageAnn.edits || {}).forEach(k => {
                            const e = pageAnn.edits[k];
                            all.push({ type: 'whiteout', leftPct: e.woLeftPct, topPct: e.woTopPct, wPct: e.woWPct, hPct: e.woHPct });
                            all.push({ type: 'text', leftPct: e.leftPct, topPct: e.topPct, text: e.text, fontPct: e.fontPct, color: e.color });
                        });
                        if (all.length) {
                            if (!annoFont) annoFont = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                            drawAnnotationsOnPdfPage(pages[idx], all, annoFont);
                        }
                    }
                }
            } else if (file.type === 'docx' || file.type === 'pptx') {
                // Each rendered document page/slide is embedded at its own size
                for (const pg of file.pages) {
                    const img = await mergedPdf.embedPng(dataUrlToUint8(pg.png));
                    const page = mergedPdf.addPage([pg.wPt, pg.hPt]);
                    page.drawImage(img, { x: 0, y: 0, width: pg.wPt, height: pg.hPt });
                }
            } else {
                const bytes = dataUrlToUint8(file.currentSrc);
                const img = file.mimeType === 'image/png'
                    ? await mergedPdf.embedPng(bytes)
                    : await mergedPdf.embedJpg(bytes);
                addImagePage(mergedPdf, img, mode);
            }
        }

        const mergedBytes = await mergedPdf.save();
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        const name = (outputFilename.value.trim() || 'merged-document') + '.pdf';
        saveAs(blob, name);

        showToast(i18n.t('toast.merged'), 'success');
    } catch (err) {
        console.error(err);
        showToast(i18n.t('toast.error'), 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
        renderList();
    }
}

// Draw stored annotations onto a real (vector) PDF page.
// pdf-lib's origin is bottom-left; the editor stores top-left percentages.
function drawAnnotationsOnPdfPage(page, annos, font) {
    const W = page.getWidth();
    const H = page.getHeight();
    // Whiteouts first (cover), then text on top — same layering as the editor
    annos.filter(a => a.type === 'whiteout').forEach(a => {
        page.drawRectangle({
            x: a.leftPct * W,
            y: H - (a.topPct + a.hPct) * H,
            width: a.wPct * W,
            height: a.hPct * H,
            color: PDFLib.rgb(1, 1, 1)
        });
    });
    annos.filter(a => a.type === 'text').forEach(a => {
        const size = a.fontPct * H;
        const [r, g, b] = parseColorRGB01(a.color);
        const padX = size * 0.2, padY = size * 0.12;
        let topFromTop = a.topPct * H + padY; // top edge of text line, measured from page top
        String(a.text || '').split('\n').forEach(line => {
            const text = sanitizePdfText(line);
            if (text) {
                page.drawText(text, {
                    x: a.leftPct * W + padX,
                    y: H - topFromTop - size * 0.8, // convert top edge → baseline
                    size: size,
                    font: font,
                    color: PDFLib.rgb(r, g, b)
                });
            }
            topFromTop += size * 1.25;
        });
    });
}

function parseColorRGB01(color) {
    if (!color) return [0, 0, 0];
    if (color[0] === '#') {
        const h = color.length === 4 ? color.slice(1).split('').map(c => c + c).join('') : color.slice(1);
        return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
    }
    const m = color.match(/\d+(?:\.\d+)?/g);
    if (m && m.length >= 3) return [(+m[0]) / 255, (+m[1]) / 255, (+m[2]) / 255];
    return [0, 0, 0];
}

// StandardFonts.Helvetica is WinAnsi-only; strip characters it can't encode.
function sanitizePdfText(s) {
    return String(s).replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function addImagePage(pdf, img, mode) {
    if (mode === 'a4' || mode === 'letter') {
        const [pw, ph] = mode === 'a4' ? [595.28, 841.89] : [612, 792];
        const page = pdf.addPage([pw, ph]);
        const margin = 0.04;
        const maxW = pw * (1 - 2 * margin);
        const maxH = ph * (1 - 2 * margin);
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    } else {
        // fit: page exactly matches image size
        const page = pdf.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
}

// ---------- PDF thumbnail ----------

async function generatePdfThumb(buffer, maxDim = 160) {
    if (!window.pdfjsLib) return null;
    const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
    try {
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = maxDim / Math.max(base.width, base.height);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        return canvas.toDataURL('image/jpeg', 0.8);
    } finally {
        pdf.destroy();
    }
}

// ---------- Helpers ----------

function uid() {
    return Math.random().toString(36).substr(2, 9);
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function getImageSize(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('Image decode failed'));
        img.src = src;
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = src;
    });
}

// Resolve with `fallback` if `promise` doesn't settle within `ms`. Guards against
// pdf.js canvas rendering stalling in background/hidden tabs.
function withTimeout(promise, ms, fallback) {
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); });
    return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(timer)), timeout]);
}

function canvasConvert(src, w, h, mime) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL(mime));
        };
        img.onerror = () => reject(new Error('Image decode failed'));
        img.src = src;
    });
}

function dataUrlToUint8(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const bin = atob(base64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

// Show toast notification
function showToast(message, type = 'info') {
    const template = document.getElementById('toastTemplate');
    const clone = template.content.cloneNode(true);
    const toast = clone.querySelector('.toast');

    toast.classList.add(`toast-${type}`);
    toast.querySelector('.toast-message').textContent = message;

    const iconContainer = toast.querySelector('.toast-icon');
    if (type === 'success') {
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (type === 'error') {
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('animate-slide-in');
        toast.classList.add('animate-slide-out');
        setTimeout(() => toast.remove(), 300);
    });

    document.getElementById('toastContainer').appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.remove('animate-slide-in');
            toast.classList.add('animate-slide-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

// Theme
function initTheme() {
    const stored = localStorage.getItem('app-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
        document.documentElement.classList.add('dark');
    }
}

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('app-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}
