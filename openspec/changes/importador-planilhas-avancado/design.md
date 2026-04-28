## Context

InquilinoTop currently lacks bulk data import capabilities. Property managers must enter data manually, leading to inefficiency and errors. This design addresses adding spreadsheet import functionality.

Current state:
- No bulk import functionality exists
- Manual data entry only
- No way to map spreadsheet columns to system fields
- No validation on imported data

Constraints:
- Must support Excel (.xlsx) and CSV file formats
- Must integrate with existing domain models
- Must provide clear error feedback
- Must be user-friendly for non-technical users

## Goals / Non-Goals

**Goals:**
- Enable bulk import of properties, tenants, and contracts from spreadsheets
- Provide column-to-field mapping interface
- Validate data before import with clear error messages
- Support duplicate detection with user choice
- Allow preview before final commit
- Track import history

**Non-Goals:**
- Real-time sync with external systems
- Scheduled/automated imports (manual trigger only)
- Import from Google Sheets or other cloud sources (v1)
- Full ETL capabilities

## Decisions

1. **File parsing**: Use SheetJS (xlsx) library for Excel/CSV parsing in browser
   - Reason: Mature library, good browser support, handles both formats
   - Alternative: Server-side parsing with Excel library
     - Rejected: More complex, requires file upload

2. **Validation approach**: Client-side validation with server confirmation
   - Reason: Better UX, faster feedback, reduced server load
   - Alternative: Server-only validation
     - Rejected: Slower feedback, more server complexity

3. **Duplicate detection**: Match by unique fields (CPF/CNPJ, email, property code)
   - Reason: Standard deduplication approach
   - Alternative: Fuzzy matching
     - Rejected: Too complex for v1

4. **Import workflow**: Upload → Map Columns → Preview → Confirm
   - Reason: Standard pattern, clear user steps
   - Alternative: Direct import
     - Rejected: No validation/preview is poor UX

## Risks / Trade-offs

- [Risk] Large files may slow browser → Mitigation: Limit to 10,000 rows, show warning
- [Risk] Column mapping complexity → Mitigation: Auto-detect common field names, provide defaults
- [Risk] Validation rules may miss edge cases → Mitigation: Allow export of errors for review
- [Risk] Duplicate handling conflicts → Mitigation: Clear UI for user choice per batch

## Open Questions

- Should import be async (background processing) for very large files?
- What specific validation rules for each domain (property, tenant, contract)?
- How to handle rollback if import fails mid-way?