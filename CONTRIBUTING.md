# Contributing to BUMEET

## Local development

See [README.md](README.md) for full setup instructions. The short version:

```bash
# API + Web
cd platform && pnpm install && docker compose up -d
pnpm --filter api dev          # :3001
pnpm --filter web dev          # :3000

# Python agent
pip install -e ".[dev]"
PYTHONPATH=src python -m bumeet_agent.app --simulate
```

## Branching model

- `main` — production-ready, protected. No direct pushes.
- Feature branches: `feat/<short-description>`
- Bug fixes: `fix/<short-description>`
- Phase work: `fase-N/<area>`

Open a PR against `main`. Every PR requires the `quality` check to pass.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Webex presence integration
fix: prevent CoreInk from powering off on GPIO glitch
chore: bump pnpm to 9.1.0
ci: add gitleaks secret scanning
docs: rewrite README for current architecture
refactor: extract BLE protocol logic into its own module
```

One logical change per commit. Keep commits small and reviewable.

## Pull requests

- Title: same format as commit message (imperative, present tense)
- Description: what changes, why, how to test, any risks
- Max 400 lines changed — split larger PRs by area
- Attach relevant screenshots or logs when touching UI or CI

## Code style

### TypeScript / JavaScript

- Prettier + ESLint (configured in each app). Run `pnpm lint` before pushing.
- Strict TypeScript — no `any`, no `as unknown`.

### Python

- `ruff check .` and `ruff format .` — enforced in CI.
- `mypy src/bumeet_agent` with strict mode.
- Type annotations on all public functions and class methods.

### Firmware (Arduino / C++)

- `clang-format` style where possible.
- Every ISR and callback is documented with its calling context (BLE task / main task).

### Terraform

- `terraform fmt -recursive` before committing.
- Module outputs are always documented.

## Tests

- New API endpoints: add at least one integration test.
- New agent detection logic: add a unit test under `tests/unit/`.
- New web components: add a Vitest component test.
- Firmware changes: must compile clean with `arduino-cli compile`.

## Secrets and sensitive data

Never commit secrets, tokens, or credentials. Use `.env` files (gitignored) locally and GitHub Secrets / Azure Key Vault in CI/CD.

If you accidentally commit a secret, follow the [GitHub secret scanning docs](https://docs.github.com/en/code-security/secret-scanning) and rotate the credential immediately.

## Questions?

Open a GitHub Discussion or drop a message in the team channel.
