# Contributing to Nekuvio

> [!NOTE]
> Nekuvio is currently a personal project maintained by its author. External contributions, pull requests, feature requests and issues are not being accepted at this time. You are welcome to fork the repository for your own purposes.

If you are exploring the codebase or working with a fork, please adhere to the following conventions and guidelines.

## Development Setup

For complete prerequisites, environment setup, and instructions on running the addon locally, see [docs/development.md](docs/development.md).

## Branching Model

- `main` is the primary stable branch.
- Feature and bugfix branches should branch off `main`.
- Use descriptive branch names such as:
  - `feat/<short-description>`
  - `fix/<short-description>`
  - `chore/<short-description>`

## Commit Message Conventions

Commit messages should follow standard conventional commit formatting:

```
<type>(<optional scope>): <description>
```

### Types
- `feat`: A new feature or capability
- `fix`: A bug fix
- `refactor`: Code restructuring without functional changes
- `test`: Adding or updating test suites
- `docs`: Documentation updates or additions
- `chore`: Build scripts, dependencies, or configuration changes

### Rules
- Use imperative mood in the summary line (e.g., `fix: resolve filename matching edge case`, not `fixed:` or `fixes:`).
- Keep the summary line concise.
- Do not commit generated build files (`dist/`, `build-info.json`) or local secrets.

## Code Quality Standards

Before committing, verify all quality checks pass:

1. **Type Checking**:
   ```bash
   npm run build:check
   ```
2. **Tests**:
   ```bash
   npm test
   ```
3. Ensure no unhandled promise rejections or lint/type errors exist.
