# Tests

## End-to-end (Selenium)

`selenium_e2e.py` drives the real app in a headless Chrome and verifies the full
workflow: adding PDF / image / Word / PowerPoint files, thumbnail rendering,
PDF text recognition + in-place editing, image cropping, preview, and a mixed
merge (checking the downloaded PDF).

A real browser is used on purpose: pdf.js canvas rendering does not run in a
backgrounded/hidden tab, so headless Chrome (`--headless=new`, which reports the
page as visible) is required to exercise the PDF features.

### Requirements

- Google Chrome installed (Selenium Manager fetches the matching driver automatically)
- Python packages:

  ```bash
  pip install selenium reportlab python-docx python-pptx Pillow pypdf
  ```

### Run

```bash
python tests/selenium_e2e.py
```

The script starts its own static server on a random port, so no separate server
is needed. Exit code `0` means every check passed; it prints a `PASS/FAIL` line
per check and a summary. Test input files and the merged output are created in a
temp folder and can be discarded.
