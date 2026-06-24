# Week 4 Screenshot Plan

## Screenshots for submission

1. **Full reviewer** — buggy.py loaded in Monaco, score ring showing ~32/100, 2 critical + 3 high bugs visible
2. **Bug cards expanded** — critical SQL injection card open showing description + suggestion
3. **Severity filter** — "Critical" chip active, only 2 critical bug cards visible
4. **Fixed Code tab** — Monaco editor showing AI-refactored Python with all issues addressed
5. **Diff tab** — Monaco DiffEditor side-by-side: original (red) vs refactored (green)
6. **Upload tab** — drag-drop zone highlighted with file selected
7. **JS review** — buggy.js reviewed: XSS card + prototype pollution card visible
8. **Export** — browser "Save file" dialog downloading `code-review-*.md`

## Terminal evidence

```bash
# Show structured output + validation
python -c "
from analyzer import validate_output
sample = {'bug_report': [], 'refactored_code': ''}
print('Missing bug_report:', validate_output({}))
print('Empty refactored:', validate_output({'bug_report': [], 'refactored_code': ''}))
"

# Show language detection
python -c "
from ingest import detect_language
print(detect_language('def hello(): pass', 'test.py'))
print(detect_language('console.log(\"hi\")', 'unknown.txt'))
print(detect_language('package main\nfunc main() {}', ''))
"

# Show ingest guards
python -c "
from ingest import read_text
try:
    read_text('x' * 90000)
except Exception as e:
    print('Guard triggered:', e)
"
```
