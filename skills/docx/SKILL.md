---
name: docx
description: "Create, read, edit, or manipulate Word documents (.docx files). Use when the user mentions Word doc, .docx, or asks for reports, memos, letters, or formatted documents with headings, tables, images, or page numbers."
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# Word Document (.docx) Creation and Editing

## Libraries

Use `python-docx` for creating and editing. For advanced XML manipulation (tracked changes, comments), use `zipfile` + `lxml` to unpack/edit/repack the DOCX directly.

```python
pip install python-docx lxml
```

## Creating Documents

```python
from docx import Document
from docx.shared import Inches, Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT

doc = Document()
```

### Page Setup

```python
section = doc.sections[0]
section.page_width = Inches(8.5)   # US Letter
section.page_height = Inches(11)
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
section.left_margin = Inches(1)
section.right_margin = Inches(1)

# Landscape
section.orientation = WD_ORIENT.LANDSCAPE
section.page_width, section.page_height = section.page_height, section.page_width
```

### Headings and Paragraphs

```python
doc.add_heading('Title', level=0)
doc.add_heading('Section', level=1)
doc.add_heading('Subsection', level=2)

p = doc.add_paragraph('Normal text.')
p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

# Formatted runs
p = doc.add_paragraph()
run = p.add_run('Bold ')
run.bold = True
run = p.add_run('and italic')
run.italic = True
run.font.size = Pt(14)
run.font.color.rgb = RGBColor(0x2E, 0x75, 0xB6)
run.font.name = 'Arial'
```

### Lists

```python
doc.add_paragraph('Bullet item', style='List Bullet')
doc.add_paragraph('Numbered item', style='List Number')
# Nested
doc.add_paragraph('Sub-bullet', style='List Bullet 2')
doc.add_paragraph('Sub-number', style='List Number 2')
```

### Tables

```python
table = doc.add_table(rows=3, cols=3, style='Table Grid')
table.alignment = WD_TABLE_ALIGNMENT.CENTER

# Header row shading
for cell in table.rows[0].cells:
    cell.paragraphs[0].runs[0].bold = True if cell.paragraphs[0].runs else None
    from docx.oxml.ns import qn
    shading = cell._element.get_or_add_tcPr()
    shading_elm = shading.makeelement(qn('w:shd'), {
        qn('w:fill'): 'D5E8F0',
        qn('w:val'): 'clear'
    })
    shading.append(shading_elm)

# Set column widths
for row in table.rows:
    row.cells[0].width = Inches(2)
    row.cells[1].width = Inches(3)
    row.cells[2].width = Inches(1.5)

# Populate
table.cell(0, 0).text = 'Header 1'
table.cell(1, 0).text = 'Data'
```

### Images

```python
doc.add_picture('/tmp/image.png', width=Inches(4))
# Centered image
last_paragraph = doc.paragraphs[-1]
last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
```

### Page Breaks

```python
doc.add_page_break()
```

### Headers and Footers

```python
from docx.shared import Pt
section = doc.sections[0]
header = section.header
header.paragraphs[0].text = 'Document Title'
header.paragraphs[0].style.font.size = Pt(9)

footer = section.footer
footer.paragraphs[0].text = 'Page '
# Page numbers require XML manipulation
from docx.oxml.ns import qn
run = footer.paragraphs[0].add_run()
fldChar = run._element.makeelement(qn('w:fldChar'), {qn('w:fldCharType'): 'begin'})
run._element.append(fldChar)
run2 = footer.paragraphs[0].add_run()
instrText = run2._element.makeelement(qn('w:instrText'), {})
instrText.text = ' PAGE '
run2._element.append(instrText)
run3 = footer.paragraphs[0].add_run()
fldChar2 = run3._element.makeelement(qn('w:fldChar'), {qn('w:fldCharType'): 'end'})
run3._element.append(fldChar2)
```

### Saving

```python
doc.save('/tmp/output.docx')
```

## Reading Documents

```python
doc = Document('/tmp/input.docx')
for para in doc.paragraphs:
    print(para.style.name, para.text)
for table in doc.tables:
    for row in table.rows:
        print([cell.text for cell in row.cells])
```

## Advanced: XML Manipulation

For tracked changes, comments, or anything python-docx doesn't support, unpack the DOCX as a ZIP and edit the XML directly:

```python
import zipfile, os, shutil
from lxml import etree

# Unpack
with zipfile.ZipFile('/tmp/input.docx', 'r') as z:
    z.extractall('/tmp/unpacked')

# Edit word/document.xml
tree = etree.parse('/tmp/unpacked/word/document.xml')
# ... manipulate XML ...
tree.write('/tmp/unpacked/word/document.xml', xml_declaration=True, encoding='UTF-8', standalone=True)

# Repack
with zipfile.ZipFile('/tmp/output.docx', 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk('/tmp/unpacked'):
        for f in files:
            filepath = os.path.join(root, f)
            arcname = os.path.relpath(filepath, '/tmp/unpacked')
            z.write(filepath, arcname)
```

## Critical Rules

- Always set page size explicitly (python-docx defaults may vary)
- Use `style='List Bullet'` for bullets — never insert unicode bullet characters
- Use `doc.add_page_break()` — never insert `\f` characters
- Table cell widths must be set on every row for consistency
- For images, always specify width to prevent oversized renders
- Save all output to `/tmp/` — the system transfers files to the user's local filesystem
