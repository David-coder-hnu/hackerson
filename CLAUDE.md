# CLAUDE.md

## gstack

All web browsing must use gstack's `/browse` skill. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:

| Skill | Description |
|---|---|
| `/office-hours` | Office hours |
| `/plan-ceo-review` | Plan CEO review |
| `/plan-eng-review` | Plan engineering review |
| `/plan-design-review` | Plan design review |
| `/design-consult` | Design consultation |
| `/design-shotgun` | Design shotgun |
| `/design-html` | Design HTML |
| `/review` | Code review |
| `/ship` | Ship |
| `/land-and-deploy` | Land and deploy |
| `/canary` | Canary deployment |
| `/benchmark` | Benchmark |
| `/browse` | Web browsing |
| `/connect-chrome` | Connect Chrome browser |
| `/qa` | QA |
| `/qa-only` | QA only |
| `/design-review` | Design review |
| `/setup-browser-cookies` | Setup browser cookies |
| `/setup-deploy` | Setup deploy |
| `/setup-gbrain` | Setup gbrain |
| `/retro` | Retrospective |
| `/investigate` | Investigate |
| `/document-release` | Document release |
| `/codex` | Codex |
| `/cso` | CSO |
| `/autoplan` | Autoplan |
| `/plan-devex-review` | Plan devex review |
| `/devex-review` | Devex review |
| `/careful` | Careful mode |
| `/freeze` | Freeze |
| `/guard` | Guard |
| `/unfreeze` | Unfreeze |
| `/gstack-upgrade` | Upgrade gstack |
| `/learn` | Learn |

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
