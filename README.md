# PDF Merger Pro

A secure, privacy-focused PDF merging tool that runs entirely in your browser.

## Features

- **100% Local Processing**: Your files never leave your device. All PDF processing happens client-side in your browser.
- **No Server Required**: Works completely offline after initial page load.
- **Multi-language Support**: Available in English, German, French, Spanish, Italian, and Portuguese.
- **Dark Mode**: Toggle between light and dark themes.
- **Drag & Drop**: Easy file upload via drag and drop or file picker.
- **Reorder Files**: Change the order of PDFs before merging.
- **Custom Filename**: Set your own output filename.

## Privacy

This tool is designed with privacy as the top priority:

- No file uploads to any server
- No tracking or analytics
- No cookies (except for theme/language preferences stored locally)
- All processing done via WebAssembly/JavaScript in your browser

## Project Structure

```
pdf-merger-pro/
├── index.html          # Main HTML file
├── css/
│   └── styles.css      # Custom styles
├── js/
│   ├── i18n.js         # Internationalization module
│   └── app.js          # Main application logic
├── locales/
│   ├── en.json         # English translations
│   ├── de.json         # German translations
│   ├── fr.json         # French translations
│   ├── es.json         # Spanish translations
│   ├── it.json         # Italian translations
│   └── pt.json         # Portuguese translations
└── README.md           # This file
```

## Technologies Used

- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [PDF-lib](https://pdf-lib.js.org/) - JavaScript library for PDF manipulation
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/) - Client-side file saving

## Usage

1. Open `index.html` in a web browser
2. Drag and drop PDF files or click to browse
3. Reorder files if needed using the arrow buttons
4. Set your desired output filename
5. Click "Merge PDFs"
6. The merged PDF will be downloaded automatically

## Development

To run locally, simply open `index.html` in a browser. For development with live reload, use any local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve

# Using PHP
php -S localhost:8000
```

## Browser Support

Works in all modern browsers:
- Chrome/Edge (Chromium)
- Firefox
- Safari

## License

MIT License - feel free to use and modify.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
