---
name: pptx
description: "Create, read, edit, or manipulate PowerPoint presentations (.pptx files). Use when the user mentions PowerPoint, presentation, slides, .pptx, or asks for slide decks, pitch decks, or visual presentations."
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# PowerPoint Presentation (.pptx) Creation and Editing

## Libraries

```python
pip install python-pptx
```

## Creating Presentations

```python
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.chart import XL_CHART_TYPE

prs = Presentation()
# Default slide size is 10x7.5 inches (standard 4:3)
# For widescreen 16:9:
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
```

### Slide Layouts

```python
# Common layouts (index depends on template, but typically):
# 0 = Title Slide
# 1 = Title and Content
# 2 = Section Header
# 5 = Blank
# 6 = Content with Caption

layout = prs.slide_layouts[1]  # Title and Content
slide = prs.slides.add_slide(layout)
```

### Title Slide

```python
slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = 'Presentation Title'
slide.placeholders[1].text = 'Subtitle or Author Name'
```

### Content Slide with Bullets

```python
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = 'Slide Title'

body = slide.placeholders[1]
tf = body.text_frame
tf.text = 'First bullet point'

p = tf.add_paragraph()
p.text = 'Second bullet point'
p.level = 0

p = tf.add_paragraph()
p.text = 'Sub-bullet'
p.level = 1

p = tf.add_paragraph()
p.text = 'Another sub-bullet'
p.level = 1
```

### Text Formatting

```python
from pptx.util import Pt
from pptx.dml.color import RGBColor

p = tf.add_paragraph()
run = p.add_run()
run.text = 'Formatted text'
run.font.size = Pt(18)
run.font.bold = True
run.font.italic = True
run.font.color.rgb = RGBColor(0x2E, 0x75, 0xB6)
run.font.name = 'Arial'

p.alignment = PP_ALIGN.CENTER
```

### Text Boxes

```python
from pptx.util import Inches, Pt

slide = prs.slides.add_slide(prs.slide_layouts[6])  # Blank
txBox = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(8), Inches(2))
tf = txBox.text_frame
tf.word_wrap = True

p = tf.paragraphs[0]
p.text = 'Custom positioned text'
p.font.size = Pt(24)
```

### Tables

```python
rows, cols = 4, 3
left, top, width, height = Inches(1), Inches(2), Inches(8), Inches(3)
table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
table = table_shape.table

# Set column widths
table.columns[0].width = Inches(3)
table.columns[1].width = Inches(3)
table.columns[2].width = Inches(2)

# Populate and format header
for i, header in enumerate(['Name', 'Role', 'Score']):
    cell = table.cell(0, i)
    cell.text = header
    cell.fill.solid()
    cell.fill.fore_color.rgb = RGBColor(0x2E, 0x75, 0xB6)
    for paragraph in cell.text_frame.paragraphs:
        for run in paragraph.runs:
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            run.font.bold = True

# Data rows
table.cell(1, 0).text = 'Alice'
table.cell(1, 1).text = 'Engineer'
table.cell(1, 2).text = '95'
```

### Images

Use the `generate_image` tool to create AI-generated images (photos, illustrations, backgrounds), then reference the returned sandbox path:

```python
# After generate_image returns { sandbox_path: "/tmp/generated_123.png" }
slide.shapes.add_picture('/tmp/generated_123.png',
    left=Inches(1), top=Inches(2),
    width=Inches(5))  # Height auto-calculated from aspect ratio
```

For existing images:
```python
slide.shapes.add_picture('/tmp/image.png',
    left=Inches(1), top=Inches(2),
    width=Inches(5))  # Height auto-calculated from aspect ratio
```

### Charts

```python
from pptx.chart.data import CategoryChartData

chart_data = CategoryChartData()
chart_data.categories = ['Q1', 'Q2', 'Q3', 'Q4']
chart_data.add_series('Revenue', (120, 150, 180, 200))
chart_data.add_series('Costs', (80, 90, 100, 110))

chart_frame = slide.shapes.add_chart(
    XL_CHART_TYPE.COLUMN_CLUSTERED,
    Inches(1), Inches(2), Inches(8), Inches(4.5),
    chart_data
)
chart = chart_frame.chart
chart.has_legend = True
chart.chart_title.has_text_frame = True
chart.chart_title.text_frame.text = 'Quarterly Results'
```

### Shapes

```python
from pptx.enum.shapes import MSO_SHAPE

shape = slide.shapes.add_shape(
    MSO_SHAPE.ROUNDED_RECTANGLE,
    Inches(1), Inches(1), Inches(3), Inches(1.5)
)
shape.fill.solid()
shape.fill.fore_color.rgb = RGBColor(0x2E, 0x75, 0xB6)
shape.text = 'Shape with text'
shape.text_frame.paragraphs[0].font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
```

### Slide Background

```python
background = slide.background
fill = background.fill
fill.solid()
fill.fore_color.rgb = RGBColor(0xF5, 0xF5, 0xF5)
```

### Saving

```python
prs.save('/tmp/output.pptx')
```

## Reading Presentations

```python
prs = Presentation('/tmp/input.pptx')
for i, slide in enumerate(prs.slides):
    print(f'--- Slide {i+1} ---')
    for shape in slide.shapes:
        if shape.has_text_frame:
            print(shape.text)
        if shape.has_table:
            for row in shape.table.rows:
                print([cell.text for cell in row.cells])
```

## Critical Rules

- Always set `prs.slide_width` and `prs.slide_height` for widescreen (16:9) — default is 4:3
- Slide layout indices vary by template — check `prs.slide_layouts` before assuming
- Use `p.level = N` for bullet indentation, not spaces or tabs
- For images, specify `width` only — height auto-calculates from aspect ratio
- Table column widths must be set explicitly — defaults are often uneven
- Chart data must use `CategoryChartData` — raw numbers won't work
- Save all output to `/tmp/`
