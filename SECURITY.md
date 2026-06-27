# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Yes       |
| < 0.3   | No        |

## Reporting a Vulnerability

Please report security vulnerabilities through GitHub's private advisory system:

https://github.com/CameronWhiteside/handprint/security/advisories/new

Do not open a public issue for a security bug. You will receive a response within a reasonable time and be credited in the fix if you wish.

## Scope

handprint runs entirely on your local machine. Signatures bind records to your key pair. The following are in scope for reports:

- Signature or verification bypass (a forged or tampered handprint passes `handprint verify`)
- Sanitizer bypass (untrusted transcript content escapes its fence and influences model output or stored data)
- Key material exposure (private key readable by an attacker through normal CLI usage)
- URI scheme injection through artifact URIs

Out of scope: vulnerabilities in optional third-party tools (node-llama-cpp, claude, opencode, codex) that handprint merely invokes.
