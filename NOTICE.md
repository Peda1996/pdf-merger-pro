# PDF Merger Pro — Licensing & Third-Party Notices

Copyright (C) 2025 Peda1996

This program is free software: you can redistribute it and/or modify it under the
terms of the **GNU Affero General Public License v3.0** (AGPL-3.0) as published by
the Free Software Foundation. See the [LICENSE](./LICENSE) file for the full text.

The whole application is licensed under AGPL-3.0 because it bundles and conveys
**mupdf** (see below), which is AGPL-3.0. Everything runs in the browser; no user
files are uploaded.

## Third-party libraries (loaded from CDNs at runtime)

| Library | Purpose | License |
|---|---|---|
| [mupdf](https://github.com/ArtifexSoftware/mupdf.js) | True PDF text removal (redaction) | **AGPL-3.0** (Artifex) |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | PDF creation / merging / drawing | MIT |
| [pdf.js](https://github.com/mozilla/pdf.js) | PDF rendering & text extraction | Apache-2.0 |
| [Cropper.js](https://github.com/fengyuanchen/cropperjs) | Image cropping | MIT |
| [PPTXjs](https://github.com/meshesha/PPTXjs) | PowerPoint (.pptx) rendering | MIT |
| [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) | Word (.docx) rendering | Apache-2.0 |
| [html2canvas](https://github.com/niklasvh/html2canvas) | DOM rasterization (fallback) | MIT |
| [modern-screenshot](https://github.com/qq15725/modern-screenshot) | DOM/SVG rasterization | MIT |
| [JSZip](https://github.com/Stuk/jszip) / jszip-utils | ZIP handling for Office files | MIT or GPLv3 |
| [FileSaver.js](https://github.com/eligrey/FileSaver.js) | File download | MIT |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | Styling | MIT |

Each library remains under its own license; this notice does not relicense them.
mupdf's AGPL-3.0 is the reason this project is distributed under AGPL-3.0.
