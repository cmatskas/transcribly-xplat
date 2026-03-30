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

Use the `generate_image` tool to create AI-generated images, then reference the returned sandbox path:

```python
# After generate_image returns { sandbox_path: "/tmp/generated_123.png" }
doc.add_picture('/tmp/generated_123.png', width=Inches(4))
```

For existing images:
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

Every document MUST include:
- **Header**: Document title, right-aligned, 9pt grey
- **Footer**: "Amazon Confidential" left-aligned, page number right-aligned

```python
from docx.shared import Pt, RGBColor
from docx.oxml.ns import qn
from docx.enum.text import WD_ALIGN_PARAGRAPH

section = doc.sections[0]

# Header — document title
header = section.header
header.is_linked_to_previous = False
hp = header.paragraphs[0]
hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
hr = hp.add_run('Document Title Here')
hr.font.size = Pt(9)
hr.font.color.rgb = RGBColor(0x80, 0x80, 0x80)

# Footer — "Amazon Confidential" on left, page number on right
footer = section.footer
footer.is_linked_to_previous = False
fp = footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.LEFT

# Add tab stop at right margin for page number alignment
from docx.oxml import OxmlElement
pPr = fp._element.get_or_add_pPr()
tabs = OxmlElement('w:tabs')
tab = OxmlElement('w:tab')
tab.set(qn('w:val'), 'right')
tab.set(qn('w:pos'), str(int(section.page_width - section.right_margin - section.left_margin)))
tabs.append(tab)
pPr.append(tabs)

# Left side: Amazon Confidential
conf_run = fp.add_run('Amazon Confidential')
conf_run.font.size = Pt(8)
conf_run.font.color.rgb = RGBColor(0x80, 0x80, 0x80)

# Tab to right side
tab_run = fp.add_run('\t')

# Right side: page number field
page_run = fp.add_run('Page ')
page_run.font.size = Pt(8)
page_run.font.color.rgb = RGBColor(0x80, 0x80, 0x80)
fldChar1 = OxmlElement('w:fldChar')
fldChar1.set(qn('w:fldCharType'), 'begin')
r1 = OxmlElement('w:r')
r1.append(fldChar1)
fp._element.append(r1)
instrText = OxmlElement('w:instrText')
instrText.set(qn('xml:space'), 'preserve')
instrText.text = ' PAGE '
r2 = OxmlElement('w:r')
r2.append(instrText)
fp._element.append(r2)
fldChar2 = OxmlElement('w:fldChar')
fldChar2.set(qn('w:fldCharType'), 'end')
r3 = OxmlElement('w:r')
r3.append(fldChar2)
fp._element.append(r3)
```

### Line Numbers

Add line numbers to all sections for review and reference:

```python
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

for section in doc.sections:
    sectPr = section._sectPr
    lnNumType = OxmlElement('w:lnNumType')
    lnNumType.set(qn('w:countBy'), '1')       # number every line
    lnNumType.set(qn('w:restart'), 'newPage')  # restart per page
    lnNumType.set(qn('w:distance'), '360')     # 0.25 inch from text
    sectPr.append(lnNumType)
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
- After saving, always tell the user the exact local file path where the document was saved
- ALWAYS include line numbers, a header with the document title, and a footer with "Amazon Confidential" (left) and page number (right)
- ALWAYS `pip install python-docx lxml` at the start of your code — do not assume packages are pre-installed
- ALWAYS write the complete document creation code in a SINGLE execute_code call — do not split across multiple calls
- After creating the document, ALWAYS call save_file_locally to transfer it from the sandbox to the user's machine
- NEVER describe what you would do — actually execute the code
