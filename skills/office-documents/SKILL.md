---
name: office-documents
description: Create, read, and edit Microsoft Office documents (Word, Excel, PowerPoint). Use when the user asks to generate reports, spreadsheets, presentations, or modify existing Office files.
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# Office Documents

You can create, read, and edit Microsoft Office documents using Python in a sandboxed Code Interpreter environment. Generated files are saved to the user's local filesystem.

## Available Libraries

- `python-docx` for Word documents (.docx)
- `openpyxl` for Excel spreadsheets (.xlsx)
- `python-pptx` for PowerPoint presentations (.pptx)

## Creating Documents

### Word Documents

```python
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()
doc.add_heading('Title', level=0)
doc.add_paragraph('Body text here.')
doc.add_heading('Section', level=1)
table = doc.add_table(rows=2, cols=3, style='Table Grid')
doc.save('/tmp/output.docx')
```

### Excel Spreadsheets

```python
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment

wb = Workbook()
ws = wb.active
ws.title = "Sheet1"
ws['A1'] = 'Header'
ws['A1'].font = Font(bold=True)
wb.save('/tmp/output.xlsx')
```

### PowerPoint Presentations

```python
from pptx import Presentation
from pptx.util import Inches, Pt

prs = Presentation()
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "Title"
slide.placeholders[1].text = "Content"
prs.save('/tmp/output.pptx')
```

## Reading Documents

Read existing files uploaded to the sandbox, extract text, tables, and metadata.

## Editing Documents

Load existing documents, modify content, and save. Always save output to `/tmp/` in the sandbox.

## Important Notes

- Always save files to `/tmp/` — the agent will retrieve them from the sandbox and write to the user's chosen local path.
- For large documents, build content incrementally.
- Include error handling in generated code.
