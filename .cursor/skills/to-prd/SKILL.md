---
name: to-prd
description: Turn the current conversation context into a PRD and publish it to the project issue tracker. Use when user wants to create a PRD from the current context.
---

This skill takes the current conversation context and codebase understanding and produces a PRD. Do NOT interview the user — just synthesize what you already know.

The issue tracker and triage label vocabulary should have been provided to you — run `/setup-matt-pocock-skills` if not.

## Process

1. Explore the repo to understand the current state of the codebase, if you haven't already. Use the project's domain glossary vocabulary throughout the PRD, and respect any ADRs in the area you're touching.

2. Sketch out the major modules you will need to build or modify to complete the implementation. Actively look for opportunities to extract deep modules that can be tested in isolation.

A deep module (as opposed to a shallow module) is one which encapsulates a lot of functionality in a simple, testable interface which rarely changes.

Check with the user that these modules match their expectations. Check with the user which modules they want tests written for.

3. Author the user stories as **structured triples** — for each story hold an `asA` / `iWant` / `soThat` (and an optional `acceptanceCriteria`) separately. This list should be LONG and extensive, covering all aspects of the feature, each in the shape "As a `<actor>`, I want `<feature>`, so that `<benefit>`". You will emit these as native, editable rows on the Feature in step 5 — so do NOT embed them as a prose `## User Stories` section in the description below.

4. Write the PRD body using the template below (note: it no longer contains a `## User Stories` section — the stories become native rows).

5. Publish to the project issue tracker:

   - Create the Feature with the PRD body, capturing its id from the JSON response, e.g.
     `exponential features create --product <product> -n "<name>" -d "<body>" --vision "<target outcome>" --status DEFINED --json`.
   - Emit the authored user stories as **native structured rows** by piping a JSON array of
     `{ asA, iWant, soThat, acceptanceCriteria? }` objects on stdin to
     `exponential features stories add --feature <new-feature-id>`. Supply the structured triples you authored in step 3 directly — do **not** introduce a prose "As a…, I want…, so that…" parser, and do **not** paste the stories into the description.
   - Apply the `ready-for-agent` triage label — no need for additional triage.

<prd-template>

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

(User stories are NOT a section here — they are authored as structured triples in step 3 and published as native, editable user-story rows on the Feature in step 5, rather than as prose in this description.)

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it within the relevant decision and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.

</prd-template>
