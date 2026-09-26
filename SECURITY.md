# Security Policy & Deployment Guidelines

## Supported Versions

| Version | Supported |
| --- | --- |
| 2.4.x | :white_check_mark: |
| < 2.0 | :x: |

---

## 🔒 Environment Variable Protection & Secrets Management

To ensure application security, **never commit real environment files or secrets** to version control:

1. **Environment Files**: Ensure `.env` and `.env.*` files remain untracked and listed in `.gitignore`.
2. **Template Usage**: Only `.env.example` templates with sanitized dummy placeholders should be shared.
3. **Strong JWT Secrets**: In production environments (`NODE_ENV=production`), `JWT_SECRET` must be set to a cryptographically secure random string with a minimum length of 32 characters.
   ```bash
   # Generate a secure 64-character secret
   openssl rand -base64 32
   # or via Node.js
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
4. **Database Access Control**: Configure MongoDB Atlas IP access whitelists to restrict database connections solely to your backend server IP or cloud hosting provider.
5. **CORS Restrictions**: Set `CLIENT_URL` strictly to your production domain(s) to prevent unauthorized cross-origin requests.

---

## 🛡️ Built-in Security Features

Stockly incorporates defense-in-depth security mechanisms:
- **Rate Limiting**: Multi-tiered rate limits on general API routes, authentication endpoints, and pairing ticket verification.
- **HTTP Header Hardening**: Powered by `helmet` with secure defaults.
- **HTTP Parameter Pollution**: Protected with `hpp`.
- **NoSQL Injection Sanitization**: Strips malicious MongoDB operator keys (`$`, `.`) from request payloads.
- **Fail-Fast Configuration**: Production startup aborts immediately if critical environment parameters (`JWT_SECRET`, `MONGODB_URI`) are missing or insecure.
- **Session Management**: Cryptographically generated session tokens with full remote revocation capabilities.

---

## 🚨 Reporting a Vulnerability

If you discover a potential security vulnerability in Stockly, please report it responsibly:

1. **Do not create public GitHub issues** for undisclosed security vulnerabilities.
2. Email the maintainer directly or use GitHub Private Vulnerability Reporting.
3. Include detailed steps to reproduce the issue, along with environment details.
4. Vulnerability disclosures will be acknowledged within 48 hours and patched promptly.
