# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please open an issue with the label `security`.
We will respond within 48 hours and work on a fix.

## Best Practices

- Keep your Node.js dependencies updated (`npm audit` regularly)
- Use the dashboard locally or behind a VPN — do not expose it to the public internet
- API keys are stored in browser localStorage and SQLite — both are unencrypted
- This tool is intended for local/development use only
