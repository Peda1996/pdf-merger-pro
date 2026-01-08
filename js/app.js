// PDF Merger Pro - Main Application

let appFiles = []; // { id, name, size, pageCount, buffer }

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileListSection = document.getElementById('fileListSection');
const resultsList = document.getElementById('resultsList');
const mergeBtn = document.getElementById('mergeBtn');
const countBadge = document.getElementById('countBadge');
const outputFilename = document.getElementById('outputFilename');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    i18n.init();
    initTheme();

    // Language selector
    document.getElementById('langSelect').addEventListener('change', e => i18n.set(e.target.value));

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Clear all button
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        if(appFiles.length) document.getElementById('confirmModal').classList.add('active');
    });

    // Modal events
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
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
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
});

// Handle file uploads
async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f =>
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if(files.length === 0) return;

    document.body.style.cursor = 'wait';

    for (const file of files) {
        try {
            const buffer = await file.arrayBuffer();
            // Load to check validity and get page count
            const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
            const pageCount = pdfDoc.getPageCount();

            appFiles.push({
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                size: formatBytes(file.size),
                pageCount: pageCount,
                buffer: buffer
            });
        } catch (e) {
            console.error("Invalid PDF", file.name, e);
            showToast(`Error loading ${file.name}`, 'error');
        }
    }

    document.body.style.cursor = 'default';
    renderList();
}

// Render file list
function renderList() {
    resultsList.innerHTML = '';

    if(appFiles.length > 0) {
        fileListSection.classList.remove('hidden');

        appFiles.forEach((file, index) => {
            const template = document.getElementById('listItemTemplate');
            const clone = template.content.cloneNode(true);

            clone.querySelector('.index-number').textContent = index + 1;
            clone.querySelector('.file-name').textContent = file.name;
            clone.querySelector('.file-size').textContent = file.size;
            clone.querySelector('.file-pages').textContent = `${file.pageCount} pgs`;

            // Buttons
            const upBtn = clone.querySelector('.up-btn');
            const downBtn = clone.querySelector('.down-btn');
            const delBtn = clone.querySelector('.delete-btn');

            if(index === 0) {
                upBtn.disabled = true;
                upBtn.classList.add('opacity-30', 'cursor-not-allowed');
            }
            if(index === appFiles.length - 1) {
                downBtn.disabled = true;
                downBtn.classList.add('opacity-30', 'cursor-not-allowed');
            }

            upBtn.addEventListener('click', () => moveItem(index, -1));
            downBtn.addEventListener('click', () => moveItem(index, 1));
            delBtn.addEventListener('click', () => removeItem(index));

            resultsList.appendChild(clone);
        });
    } else {
        fileListSection.classList.add('hidden');
    }

    // Update stats
    countBadge.textContent = appFiles.length;
    const totalPages = appFiles.reduce((sum, f) => sum + f.pageCount, 0);
    document.getElementById('totalPageInfo').textContent = `${appFiles.length} files - ${totalPages} pages`;

    mergeBtn.disabled = appFiles.length < 2;
    fileInput.value = ''; // reset
}

// Move item in list
function moveItem(index, direction) {
    const newIndex = index + direction;
    if(newIndex < 0 || newIndex >= appFiles.length) return;

    [appFiles[index], appFiles[newIndex]] = [appFiles[newIndex], appFiles[index]];
    renderList();
}

// Remove item from list
function removeItem(index) {
    appFiles.splice(index, 1);
    renderList();
}

// Merge PDFs
async function mergePDFs() {
    if(appFiles.length < 2) return;

    const btn = document.getElementById('mergeBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Merging...`;
    btn.disabled = true;

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();

        for (const file of appFiles) {
            const pdf = await PDFLib.PDFDocument.load(file.buffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const mergedPdfBytes = await mergedPdf.save();

        // Download
        const blob = new Blob([mergedPdfBytes], { type: "application/pdf" });
        const name = (outputFilename.value || 'merged-document') + '.pdf';
        saveAs(blob, name);

        showToast(i18n.t('toast.merged'), 'success');

    } catch (err) {
        console.error(err);
        showToast(i18n.t('toast.error'), 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// Format bytes to human readable
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

    // Icon
    const iconContainer = toast.querySelector('.toast-icon');
    if(type === 'success') {
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if(type === 'error') {
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
        iconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.classList.remove('animate-slide-in');
        toast.classList.add('animate-slide-out');
        setTimeout(() => toast.remove(), 300);
    });

    document.getElementById('toastContainer').appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        if(toast.parentElement) {
            toast.classList.remove('animate-slide-in');
            toast.classList.add('animate-slide-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 4000);
}

// Initialize theme
function initTheme() {
    const stored = localStorage.getItem('app-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
        document.documentElement.classList.add('dark');
    }
}

// Toggle theme
function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('app-theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
}

