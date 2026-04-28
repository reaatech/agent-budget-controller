# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in agent-budget-controller, please report it to the maintainers via a GitHub security advisory at:

https://github.com/reaatech/agent-budget-controller/security/advisories

Please do not report security vulnerabilities through public GitHub issues.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

## Security Considerations

- This library processes cost data locally. No telemetry or spend data is sent to external services.
- Budget definitions and configuration should not contain secrets. Use environment variables for sensitive values.
- The in-memory spend tracker does not persist data. For production deployments requiring persistence, use an external backend (planned for v2).
