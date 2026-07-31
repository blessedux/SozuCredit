---
name: exponential
description: Exponential ticket management system integration. Use when creating, updating, or publishing tickets to Exponential. Triggers on commands like /to-expo, "publish tickets", "create exponential tickets", or when working with .exponential directory.
license: MIT
metadata:
  author: sozu
  version: "1.0.0"
---

# Exponential Ticket Management

Integration skill for publishing and managing tickets in the Exponential project management system.

## When to Apply

Use this skill when:
- User says `/to-expo` or "publish to expo"
- Creating or updating tickets in `.exponential/tickets/`
- Converting planning docs to Exponential ticket format
- Syncing ticket status with Exponential

## Ticket Format

Exponential tickets are stored as YAML files in `.exponential/tickets/` with this structure:

```yaml
id: "PROJ-123"
title: "Ticket title"
description: |
  Multi-line description
  with markdown support
status: "todo" | "in_progress" | "blocked" | "completed"
priority: "critical" | "high" | "medium" | "low"
estimate: "2-3 days"
dependencies:
  - "PROJ-120"
  - "PROJ-121"
assignee: null | "username"
labels:
  - "backend"
  - "auth"
created: "2026-07-31T00:00:00Z"
updated: "2026-07-31T00:00:00Z"
```

## Commands

### `/to-expo` - Publish Tickets

Converts markdown ticket files from `docs/tickets/*.md` to Exponential YAML format in `.exponential/tickets/*.yaml`.

**Process:**
1. Read ticket markdown from `docs/tickets/`
2. Parse ticket structure (title, description, dependencies, estimates)
3. Generate YAML files in `.exponential/tickets/`
4. Preserve ticket IDs if already published
5. Update status tracking

### Creating New Tickets

When creating tickets:
1. Start with markdown in `docs/tickets/` for human review
2. Use clear priority markers (🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW)
3. Include dependency chains
4. Provide realistic estimates
5. Link to detailed planning docs

### Ticket ID Format

- Use format: `PROJECT-NUMBER` (e.g., `SOZU-22`, `AUTH-101`)
- Maintain sequential numbering per project
- Never reuse IDs

## Integration

If Exponential has an API:
- Set `EXPONENTIAL_API_KEY` in environment
- Use `EXPONENTIAL_PROJECT_ID` for project scope
- API endpoint: `EXPONENTIAL_API_URL` (defaults to `https://api.exponential.io`)

## Best Practices

1. **Document First**: Write detailed planning docs before tickets
2. **Atomic Tickets**: Each ticket should be independently testable
3. **Clear Acceptance Criteria**: Define "done" explicitly
4. **Track Dependencies**: Use `depends_on` and `blocks` fields
5. **Estimate Conservatively**: Better to under-promise and over-deliver

## Example Workflow

```bash
# 1. Create planning doc
docs/authentication-hardening-plan.md

# 2. Break down into tickets
docs/tickets/auth-hardening.md

# 3. Publish to Exponential
/to-expo auth-hardening

# 4. YAML files generated
.exponential/tickets/auth-hardening-*.yaml
```

## References

- Exponential Docs: [docs.exponential.io](https://docs.exponential.io)
- Ticket Template: `.exponential/templates/ticket.yaml`
