---
name: pdf
description: "Read, create, merge, split, extract text/tables from, or manipulate PDF files. Use when the user mentions .pdf files, asks to create a PDF, extract content from a PDF, merge PDFs, or convert documents to PDF format."
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# PDF Processing

## Libraries

```python
pip install pypdf pdfplumber reportlab
```

## Reading PDFs

```python
from pypdf import PdfReader

reader = PdfReader("/tmp/document.pdf")
print(f"Pages: {len(reader.pages)}")

text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Extracting Tables

```python
import pdfplumber
import pandas as pd

with pdfplumber.open("/tmp/document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

    if all_tables:
        combined = pd.concat(all_tables, ignore_index=True)
        combined.to_excel("/tmp/extracted_tables.xlsx", index=False)
```

## Extracting Text with Layout

```python
import pdfplumber

with pdfplumber.open("/tmp/document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

## Creating PDFs

```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("/tmp/output.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

story.append(Paragraph("Report Title", styles['Title']))
story.append(Spacer(1, 12))
story.append(Paragraph("Body text here. " * 20, styles['Normal']))
story.append(PageBreak())
story.append(Paragraph("Page 2", styles['Heading1']))

doc.build(story)
```

**IMPORTANT**: Never use Unicode subscript/superscript characters (₀₁₂₃₄₅₆₇₈₉) in ReportLab — they render as black boxes. Use XML markup instead: `H<sub>2</sub>O`, `x<super>2</super>`.

## Merging PDFs

```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["/tmp/doc1.pdf", "/tmp/doc2.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("/tmp/merged.pdf", "wb") as output:
    writer.write(output)
```

## Splitting PDFs

```python
reader = PdfReader("/tmp/input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"/tmp/page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

## Rotating Pages

```python
reader = PdfReader("/tmp/input.pdf")
writer = PdfWriter()
page = reader.pages[0]
page.rotate(90)
writer.add_page(page)
with open("/tmp/rotated.pdf", "wb") as output:
    writer.write(output)
```

## Adding Watermark

```python
from pypdf import PdfReader, PdfWriter

watermark = PdfReader("/tmp/watermark.pdf").pages[0]
reader = PdfReader("/tmp/document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("/tmp/watermarked.pdf", "wb") as output:
    writer.write(output)
```

## Password Protection

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("/tmp/input.pdf")
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)

writer.encrypt("userpassword", "ownerpassword")
with open("/tmp/encrypted.pdf", "wb") as output:
    writer.write(output)
```

## Metadata

```python
reader = PdfReader("/tmp/document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}, Author: {meta.author}")
```

## Quick Reference

| Task | Library | Key Method |
|---|---|---|
| Read/extract text | pypdf | `page.extract_text()` |
| Extract tables | pdfplumber | `page.extract_tables()` |
| Create PDFs | reportlab | `SimpleDocTemplate` or `Canvas` |
| Merge | pypdf | `writer.add_page(page)` |
| Split | pypdf | One page per PdfWriter |
| Rotate | pypdf | `page.rotate(90)` |
| Watermark | pypdf | `page.merge_page(watermark)` |
| Encrypt | pypdf | `writer.encrypt(password)` |

## Critical Rules

- Save all output to `/tmp/`
- Install missing libraries with pip via execute_code before using them
- For table extraction, prefer pdfplumber over pypdf (much better accuracy)
- After saving, always tell the user the exact local file path where the document was saved
