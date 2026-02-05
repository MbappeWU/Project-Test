# CLAUDE.md - AI Assistant Guidelines

This file provides guidance for AI assistants (like Claude) working with this repository.

## Project Overview

**Project Name:** Project-Test
**Status:** Initial Setup
**Repository:** MbappeWU/Project-Test

This repository is currently in its initial setup phase. As the project develops, this document should be updated to reflect the current state and conventions.

## Repository Structure

```
Project-Test/
├── CLAUDE.md          # AI assistant guidelines (this file)
└── (additional files and directories to be added)
```

As the project grows, update this structure diagram to reflect the actual organization.

## Development Environment

### Prerequisites

<!-- Update this section with actual requirements as the project develops -->
- Git
- (Add language runtime, e.g., Node.js, Python, etc.)
- (Add package manager, e.g., npm, pip, etc.)

### Setup Instructions

```bash
# Clone the repository
git clone <repository-url>
cd Project-Test

# Install dependencies (update when package manager is configured)
# npm install  # for Node.js projects
# pip install -r requirements.txt  # for Python projects
```

## Development Workflow

### Branch Naming Convention

- Feature branches: `feature/<description>`
- Bug fixes: `fix/<description>`
- Documentation: `docs/<description>`
- Claude AI branches: `claude/<description>-<session-id>`

### Commit Message Guidelines

Follow conventional commit format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example: `feat: add user authentication module`

### Pull Request Process

1. Create a feature branch from main
2. Make changes and commit with clear messages
3. Push branch and create a pull request
4. Ensure all checks pass
5. Request review if required
6. Merge after approval

## Code Conventions

<!-- Update this section based on the project's language and framework -->

### General Guidelines

- Write clear, self-documenting code
- Keep functions small and focused
- Use meaningful variable and function names
- Add comments only when the logic isn't self-evident
- Follow the DRY (Don't Repeat Yourself) principle
- Avoid over-engineering - keep solutions simple

### File Organization

- Group related functionality together
- Use consistent file naming conventions
- Keep files focused on a single responsibility

## Testing

<!-- Update when testing framework is configured -->

### Running Tests

```bash
# Run all tests
# npm test  # for Node.js
# pytest    # for Python
```

### Test Guidelines

- Write tests for new features
- Maintain existing test coverage
- Run tests before committing

## Build and Deployment

<!-- Update when build system is configured -->

### Building the Project

```bash
# Build command (update when configured)
# npm run build
```

### Deployment

Document deployment procedures here when configured.

## Key Files and Directories

| Path | Description |
|------|-------------|
| `CLAUDE.md` | AI assistant guidelines |
| (Add more as project develops) | |

## Common Tasks for AI Assistants

### When Making Changes

1. **Read before editing** - Always read a file before making changes
2. **Understand context** - Explore related files to understand the broader context
3. **Keep changes focused** - Make only the changes necessary for the task
4. **Test changes** - Run tests to verify changes don't break existing functionality
5. **Follow existing patterns** - Match the code style already in the project

### When Adding New Features

1. Check for similar existing implementations
2. Follow established architectural patterns
3. Add appropriate tests
4. Update documentation if needed

### When Fixing Bugs

1. Understand the root cause before fixing
2. Write a test that reproduces the bug (if possible)
3. Make minimal changes to fix the issue
4. Verify the fix doesn't introduce regressions

## API Documentation

<!-- Add API documentation as the project develops -->

N/A - No APIs currently implemented.

## Dependencies

<!-- Update when dependencies are added -->

No dependencies configured yet.

## Troubleshooting

### Common Issues

Document common issues and solutions here as they arise.

## Additional Resources

- [Project Repository](https://github.com/MbappeWU/Project-Test)

---

## Changelog

| Date | Changes |
|------|---------|
| 2026-02-05 | Initial CLAUDE.md created |

---

*This document should be updated as the project evolves. Keep it current to ensure AI assistants have accurate information about the codebase.*
