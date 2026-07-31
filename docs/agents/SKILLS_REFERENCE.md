# Agent Skills Reference

All skills available for cloud agents in this repository.

## 🎯 Quick Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/to-expo` | Break plan into Exponential tickets | After planning, ready to create tickets |
| `/ship-ticket SOZU-22` | Implement ticket end-to-end | Ready to implement a specific ticket |
| `/start-ticket SOZU-22` | Prep ticket (branch, read, plan) | Want to understand before implementing |
| `/to-prd` | Deploy dev → main → production | Staging tested, ready for production |
| `/grill-me` | Requirements gathering | User has vague idea, needs refinement |
| `/honest-thinking-partner` | Brutally honest feedback | Need real feedback on plan/decision |

---

## 📋 Pipeline Skills (Spine)

### 1. Requirements → Planning

**`grill-me`** - Quick requirements gathering  
Use when: User has rough idea, needs structure

**`grill-with-docs`** - Deep requirements with ADRs  
Use when: Complex feature, need architectural decisions

### 2. Planning → Tickets

**`to-expo`** - Break plan into Exponential tickets  
- Creates **tracer bullet** vertical slices (not horizontal layers)
- Marks as AFK (autonomous) or HITL (human-in-the-loop)
- Publishes to Exponential with proper dependencies
- Use when: Have approved plan, ready to create tickets

### 3. Tickets → Implementation

**`start-ticket`** - Prep for implementation  
- Creates branch
- Reads ticket + related docs
- Analyzes codebase
- Plans approach
- Use when: Want to understand before coding

**`ship-ticket`** - Full implementation  
- Complete workflow: read → implement → test → commit → push → PR
- Incremental commits
- Build verification
- PR creation to `dev`
- Use when: Ready to implement ticket end-to-end

### 4. Staging → Production

**`to-prd`** - Safe production deployment  
- Pre-deploy checks
- Create release PR (dev → main)
- Post-deploy monitoring
- Rollback planning
- Use when: Staging tested, ready for production

---

## 🛠️ Build-Time Skills

### Thinking & Feedback

**`honest-thinking-partner`** - Brutally honest reasoning  
- Surfaces blind spots
- Dismantles flawed logic
- Forces concrete action
- No sugar-coating
- Use when: Need real feedback, not validation

### Technical Guidance

**`nextjs-senior`** - Next.js/React senior engineer  
Includes modules:
- Architecture patterns
- App Router best practices
- Rendering strategies
- Caching optimization
- Edge deployment
- Performance
- TypeScript patterns
- Design system integration
- Scale strategies

Use when: Building Next.js features, need senior-level guidance

### Communication

**`explain-diff`** - HTML diff explanations  
**`explain-diff-notion`** - Notion-formatted diffs  
Use when: Need to explain changes to stakeholders

---

## ⚙️ Setup Helpers

**`setup-matt-pocock-skills`** - Configure issue tracker integration  
- Exponential setup
- GitHub setup  
- GitLab setup
- Local file-based setup
- Triage labels
- Domain glossary

**`setup-git-flow`** - Configure git workflow  
- Branch naming
- Merge strategy
- Deployment pipeline

---

## 📖 Skill Details

### to-expo (Ticket Creation)

**Vertical slice rules:**
- Each slice = complete path through ALL layers (DB → API → UI → tests)
- Must be demoable/verifiable on its own
- Prefer many thin slices over few thick ones

**Ticket types:**
- `FEATURE` - New behavior (default)
- `BUG` - Fix broken behavior
- `CHORE` - Maintenance, refactoring
- `IMPROVEMENT` - Enhance existing feature
- `SPIKE` - Timeboxed investigation
- `RESEARCH` - Open-ended exploration

**Initial status:**
- `READY_TO_PLAN` - AFK slices (agent can grab)
- `NEEDS_REFINEMENT` - HITL slices (needs human discussion)

**Example:**
```
User: /to-expo auth-hardening

Agent:
1. Reads docs/authentication-hardening-plan.md
2. Proposes vertical slices:
   - Slice 1: Device detection (AFK, FEATURE)
   - Slice 2: PIN registration (AFK, FEATURE)
   - Slice 3: Error recovery (AFK, CHORE)
   etc.
3. Quizzes user on granularity
4. Publishes to Exponential with dependencies
```

### ship-ticket (Full Implementation)

**Workflow:**
1. Branch from `dev`
2. Read ticket + specs
3. Implement with tests
4. Commit incrementally (not at end!)
5. Run `bun run build` (must pass)
6. Push to origin
7. Create PR to `dev`

**Pre-push checklist:**
- [ ] All acceptance criteria met
- [ ] Tests passing
- [ ] Build succeeds
- [ ] No console errors
- [ ] Code follows best practices

**Example:**
```
User: /ship-ticket SOZU-22

Agent:
1. Creates cursor/sozu-22-device-detection-3d62
2. Implements lib/webauthn/device-detection.ts
3. Updates app/auth/page.tsx
4. Writes tests
5. Commits incrementally
6. Verifies build
7. Pushes and creates PR
```

### honest-thinking-partner (Feedback)

**6-Step framework:**
0. **Assumption Audit** - Name unstated assumptions
1. **Reality Check** - What are they actually saying?
2. **Logic Breakdown** - Where is reasoning broken?
3. **Avoidance Cost** - What are they dodging and what's it costing?
4. **Expert Delta** - How would someone successful do this differently?
5. **Action Plan** - What to do, in order, starting now
6. **Uncomfortable Question** - What are they avoiding?

**Ground rules:**
- Never open with praise
- Never soften criticism
- No motivational clichés
- Concrete language only
- Show, don't tell

**Example:**
```
User: I'm thinking of rewriting our auth system from scratch because it's messy.

Agent (honest-thinking-partner mode):
Assumption audit: You're assuming a rewrite is faster than refactoring, 
and that "messy" means "unfixable."

What you're actually saying: "I'm frustrated and want to start fresh 
because debugging this feels hard."

Where reasoning breaks: Rewriting means rebuilding all the edge cases 
you've already fixed. That "messy" code probably handles 20 bugs you 
don't remember. You're trading known problems for unknown ones.

[etc. - no sugar-coating]
```

---

## 🎯 Common Workflows

### New Feature Flow
1. `/grill-me` or `/grill-with-docs` - Gather requirements
2. Create planning doc (docs/plans/)
3. `/to-expo` - Break into tickets
4. For each ticket: `/ship-ticket {ID}`
5. Test on staging (dev.sozu.capital)
6. `/to-prd` - Deploy to production

### Bug Fix Flow
1. Read ticket
2. `/start-ticket {ID}` - Investigate and plan
3. `/ship-ticket {ID}` - Implement fix
4. Verify on staging
5. If critical, fast-track `/to-prd`

### Architecture Decision
1. `/grill-with-docs` - Deep exploration
2. Agent creates ADR in docs/adr/
3. Review with team
4. `/to-expo` - Create implementation tickets

---

## 🚫 Anti-Patterns

### DON'T
- ❌ Ask `/ship-ticket` to create tickets (use `/to-expo`)
- ❌ Skip `/to-expo` and manually write tickets
- ❌ Use `/to-prd` without testing on staging
- ❌ Create thick horizontal slices (just the API, just the UI)
- ❌ Skip build verification before pushing

### DO
- ✅ Use `/to-expo` for all ticket creation
- ✅ Create thin vertical slices
- ✅ Test on staging before production
- ✅ Run build before every push
- ✅ Use `/honest-thinking-partner` when stuck

---

## 📝 Notes

- All skills are version-controlled in `.cursor/skills/`
- Skills persist across cloud agent sessions
- Each skill has detailed SKILL.md with examples
- Some skills include support files (nextjs-senior has tools/)

## 🔗 Related

- [Implementation Guide](./implement-auth-hardening.md)
- [Git Flow](./git-flow.md)
- [Start Here](../../AGENT_START_HERE.md)
