---
name: self-correction
description: "Automatic error recovery and self-correction during code execution. Use when executing code that may fail due to missing libraries, runtime errors, or unexpected data formats."
metadata:
  provider: agentcore-code-interpreter
  version: "1.0"
---

# Self-Correction Protocol

When executing code, apply these automatic recovery rules.

## Rule 1: Auto-Fix Runtime Errors

**Trigger:** Code execution returns an error or exception.

**Action:**
1. Read the error message and traceback
2. Diagnose the root cause (wrong API, bad syntax, type mismatch, missing import)
3. Fix the code and retry
4. Max 3 retry attempts per error

**Examples:** ImportError, TypeError, KeyError, IndexError, ValueError, FileNotFoundError

## Rule 2: Auto-Install Missing Libraries

**Trigger:** `ModuleNotFoundError` or `ImportError` for a pip-installable package.

**Action:**
1. Install via `pip install <package>` in execute_code
2. Re-run the original code
3. If install fails, try an alternative library

**Common substitutions:**
- `openpyxl` for Excel files
- `python-pptx` for PowerPoint
- `python-docx` for Word documents
- `Pillow` for image processing
- `matplotlib` or `plotly` for charts
- `pandas` for data manipulation
- `requests` for HTTP calls

## Rule 3: Auto-Fix Data Format Issues

**Trigger:** Data doesn't match expected format (wrong columns, unexpected nulls, encoding errors).

**Action:**
1. Inspect the actual data structure (`type()`, `.head()`, `.columns`, `.keys()`)
2. Adapt the code to the actual format
3. Re-run with corrected approach

## Rule 4: Escalate Architectural Problems

**Trigger:** Fix requires a fundamentally different approach (wrong library choice, impossible constraint).

**Action:** Stop retrying. Explain to the user what went wrong and propose 2-3 alternative approaches.

## Priority Order

1. Rule 2 (missing library) — fastest fix
2. Rule 1 (runtime error) — diagnose and patch
3. Rule 3 (data format) — inspect and adapt
4. Rule 4 (architectural) — escalate to user

## Critical Rules

- Never retry the exact same code without changes
- Always read the full error message before attempting a fix
- After 3 failed attempts on the same step, move to Rule 4 (escalate)
- Log each retry attempt so the user can see what was tried
