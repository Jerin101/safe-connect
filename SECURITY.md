# Security

## Reporting a problem

If you find a security problem in SafeConnect, please do not describe it in a public issue. If the repository's
**Security** tab shows a **Report a vulnerability** button, use it (private reporting). If it does not, open an
issue that only says "I have a security report" (no details), and we will contact you.
In an emergency, call **999** first.

## Firebase web API key

`js/firebase-config.js` contains the Firebase **web** API key (it starts with `AIza`). This key is **public by
design**: every visitor's browser needs it to talk to Firebase, so it is in the website and in Git history on
purpose. It is not a password and gives no special access. Access is protected by:

- **Key restrictions** (Google Cloud → APIs & Services → Credentials): only our websites may use it
  (`jerin101.github.io`, `safeconnect-67d83.firebaseapp.com`, and `localhost` for development), and only for the
  Identity Toolkit, Token Service, Cloud Firestore and Firebase Installations APIs.
- **Firestore security rules** (`firestore.rules`, tested with `npm run test:rules`): they decide who may read or
  write each document. Hiding a button is never the protection.

GitHub's secret-scanning alert for this file was closed as *won't fix* for this reason, and
`.github/secret_scanning.yml` tells GitHub to skip this one file. Gitleaks (`.gitleaks.toml`) still checks every file.

**Never commit a real secret:** service-account keys (`*-firebase-adminsdk-*.json`, `*serviceAccount*.json`),
private keys (`*.pem`, `*.key`), passwords, tokens or `.env` files. If one is ever committed, **rotate it first**
(make a new one and turn off the old one), then remove it: deleting the file is not enough, because Git history keeps it.
