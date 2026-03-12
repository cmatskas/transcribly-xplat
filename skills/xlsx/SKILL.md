---
name: xlsx
description: "Create, read, edit, or analyze Excel spreadsheets (.xlsx files). Use when the user mentions Excel, spreadsheet, .xlsx, or asks for data tables, charts, formulas, pivot-style summaries, or formatted workbooks."
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# Excel Spreadsheet (.xlsx) Creation and Editing

## Libraries

```python
pip install openpyxl
```

## Creating Workbooks

```python
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side, numbers
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, LineChart, PieChart, Reference

wb = Workbook()
ws = wb.active
ws.title = "Sheet1"
```

### Writing Data

```python
# Single cell
ws['A1'] = 'Header'
ws.cell(row=2, column=1, value='Data')

# Row at a time
ws.append(['Name', 'Age', 'Score'])
ws.append(['Alice', 30, 95.5])
ws.append(['Bob', 25, 87.0])
```

### Cell Formatting

```python
# Font
ws['A1'].font = Font(name='Arial', size=12, bold=True, color='FFFFFF')

# Fill (background color)
ws['A1'].fill = PatternFill(start_color='2E75B6', end_color='2E75B6', fill_type='solid')

# Alignment
ws['A1'].alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)

# Number format
ws['B2'].number_format = '#,##0.00'       # 1,234.56
ws['C2'].number_format = '0.0%'           # 95.5%
ws['D2'].number_format = '$#,##0.00'      # $1,234.56
ws['E2'].number_format = 'YYYY-MM-DD'     # 2024-01-15

# Borders
thin_border = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)
ws['A1'].border = thin_border
```

### Column Widths and Row Heights

```python
ws.column_dimensions['A'].width = 20
ws.column_dimensions['B'].width = 15
ws.row_dimensions[1].height = 30

# Auto-fit approximation (openpyxl doesn't auto-fit natively)
for col in ws.columns:
    max_length = max(len(str(cell.value or '')) for cell in col)
    ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_length + 2, 50)
```

### Formulas

```python
ws['D2'] = '=SUM(B2:C2)'
ws['D3'] = '=AVERAGE(B2:B10)'
ws['D4'] = '=IF(B2>90,"Pass","Fail")'
ws['D5'] = '=VLOOKUP(A2,Sheet2!A:B,2,FALSE)'
ws['D6'] = '=COUNTIF(B:B,">90")'
```

### Merge Cells

```python
ws.merge_cells('A1:D1')
ws['A1'] = 'Merged Title'
ws['A1'].alignment = Alignment(horizontal='center')
```

### Freeze Panes

```python
ws.freeze_panes = 'A2'   # Freeze header row
ws.freeze_panes = 'B2'   # Freeze header row + first column
```

### Auto-Filter

```python
ws.auto_filter.ref = 'A1:D100'
```

### Conditional Formatting

```python
from openpyxl.formatting.rule import CellIsRule, ColorScaleRule

# Highlight cells > 90
ws.conditional_formatting.add('B2:B100',
    CellIsRule(operator='greaterThan', formula=['90'],
              fill=PatternFill(bgColor='C6EFCE')))

# Color scale (red → yellow → green)
ws.conditional_formatting.add('B2:B100',
    ColorScaleRule(start_type='min', start_color='F8696B',
                   mid_type='percentile', mid_value=50, mid_color='FFEB84',
                   end_type='max', end_color='63BE7B'))
```

### Data Validation

```python
from openpyxl.worksheet.datavalidation import DataValidation

dv = DataValidation(type='list', formula1='"Yes,No,Maybe"', allow_blank=True)
dv.error = 'Invalid entry'
dv.errorTitle = 'Invalid'
ws.add_data_validation(dv)
dv.add('C2:C100')
```

### Charts

```python
# Bar chart
chart = BarChart()
chart.title = 'Scores by Person'
chart.x_axis.title = 'Person'
chart.y_axis.title = 'Score'
data = Reference(ws, min_col=3, min_row=1, max_row=4)
cats = Reference(ws, min_col=1, min_row=2, max_row=4)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)
chart.width = 15
chart.height = 10
ws.add_chart(chart, 'F2')

# Pie chart
pie = PieChart()
pie.title = 'Distribution'
pie.add_data(data, titles_from_data=True)
pie.set_categories(cats)
ws.add_chart(pie, 'F18')
```

### Multiple Sheets

```python
ws2 = wb.create_sheet('Summary')
ws2 = wb.create_sheet('Data', 0)  # Insert at position 0
```

### Saving

```python
wb.save('/tmp/output.xlsx')
```

## Reading Spreadsheets

```python
from openpyxl import load_workbook

wb = load_workbook('/tmp/input.xlsx', data_only=True)  # data_only=True reads cached formula values
ws = wb.active

for row in ws.iter_rows(min_row=1, max_row=ws.max_row, values_only=True):
    print(row)
```

## Critical Rules

- Always set column widths — default widths are too narrow for most data
- Use `data_only=True` when reading if you need formula results (not the formulas themselves)
- Number formats use Excel format codes, not Python format strings
- Charts need `titles_from_data=True` if the first row of the data range is a header
- Formulas are strings starting with `=` — openpyxl doesn't evaluate them
- Save all output to `/tmp/`
