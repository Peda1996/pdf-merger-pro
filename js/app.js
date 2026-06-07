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

// Transient state
let previewPdf = null;
let previewPage = 1;
let previewPageCount = 1;
let cropper = null;
let cropFileId = null;
let cropFlipX = 1;
let cropFlipY = 1;
let dragSrcIndex = null;

const PDF_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

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
    pdfPrev.addEventListener('click', () => { if (previewPage > 1) { previewPage--; renderPreviewPage(); } });
    pdfNext.addEventListener('click', () => { if (previewPage < previewPageCount) { previewPage++; renderPreviewPage(); } });

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

async function handleFiles(fileList) {
    const all = Array.from(fileList);
    const accepted = all.filter(f => isPdf(f) || isImage(f));
    if (accepted.length === 0) {
        if (all.length) showToast(i18n.t('toast.unsupported'), 'error');
        fileInput.value = '';
        return;
    }

    document.body.style.cursor = 'wait';
    for (const file of accepted) {
        try {
            if (isPdf(file)) await addPdf(file);
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
    // Generate a preview thumbnail (best-effort; merge does not depend on it)
    try { item.thumb = await generatePdfThumb(buffer); } catch (e) { console.warn('PDF thumb failed', e); }
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
    const totalPages = appFiles.reduce((sum, f) => sum + (f.type === 'pdf' ? f.pageCount : 1), 0);
    document.getElementById('totalPageInfo').textContent =
        `${appFiles.length} ${i18n.t('list.files')} · ${totalPages} ${i18n.t('list.pagesShort')}`;

    // Image options visibility
    imageOptions.classList.toggle('hidden', !appFiles.some(f => f.type === 'image'));

    // Merge availability: 2+ files, or a single image (image → PDF conversion)
    const canMerge = appFiles.length >= 2 || (appFiles.length === 1 && appFiles[0].type === 'image');
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
    const previewBtn = clone.querySelector('.preview-btn');
    const thumbBtn = clone.querySelector('.thumb-btn');
    const upBtn = clone.querySelector('.up-btn');
    const downBtn = clone.querySelector('.down-btn');
    const delBtn = clone.querySelector('.delete-btn');

    thumbImg.setAttribute('draggable', 'false');

    if (file.type === 'image') {
        const dims = `${file.width}×${file.height}`;
        const croppedTag = file.cropped ? ` · ${i18n.t('list.cropped')}` : '';
        meta.textContent = `${imgTypeLabel(file.mimeType)} · ${dims} · ${file.size}${croppedTag}`;
        thumbImg.src = file.currentSrc;
        thumbImg.classList.remove('hidden');
        thumbImg.classList.toggle('has-alpha', file.mimeType === 'image/png');
        thumbIcon.classList.add('hidden');
        cropBtn.title = i18n.t('crop.title');
    } else {
        meta.textContent = `PDF · ${file.pageCount} ${i18n.t('list.pagesShort')} · ${file.size}`;
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
        previewImage.src = file.currentSrc;
        previewImage.classList.remove('hidden');
        previewCropBtn.classList.remove('hidden');
        previewCropBtn.classList.add('flex');
        previewCropBtn.onclick = () => { closePreview(); openCrop(index); };
    } else {
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

// ---------- Merge ----------

async function mergePDFs() {
    const canMerge = appFiles.length >= 2 || (appFiles.length === 1 && appFiles[0].type === 'image');
    if (!canMerge) return;

    const btn = mergeBtn;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> ${i18n.t('toast.merging')}`;
    btn.disabled = true;

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        const mode = imagePageSize.value;

        for (const file of appFiles) {
            if (file.type === 'pdf') {
                const pdf = await PDFLib.PDFDocument.load(file.buffer, { ignoreEncryption: true });
                const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                pages.forEach(p => mergedPdf.addPage(p));
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
