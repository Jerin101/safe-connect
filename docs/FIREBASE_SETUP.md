# Firebase setup (P17), step by step

Do this by hand in the browser. It is free: SafeConnect uses the **no-cost Spark plan**, which has no billing account, so there can never be a bill.
Our project ID: **`safeconnect-67d83`**.
Button names in the Firebase console can change a little over time. If one looks different, look for the closest match.

## A. Create the project (about 10 minutes)
1. Open https://console.firebase.google.com and sign in with your Google account.
2. Click **Create a project** (or **Add project**). Name it `safeconnect`. Firebase may add letters to the end (like `safeconnect-a1b2c`). **Write down this project ID.**
3. When it asks about **Google Analytics**, turn it **off**. We don't need it, and it collects visitor data.
4. Click **Create project** and wait until it finishes.

## B. Turn on sign-in (Authentication)
1. Left menu: **Build → Authentication → Get started**.
2. Tab **Sign-in method**:
   - **Email/Password** → turn on the first switch only (leave "Email link" off) → **Save**.
   - **Google** → turn on → pick your email as the support email → **Save**.
3. Tab **Settings → Authorized domains**:
   - **Add domain** → `jerin101.github.io` → **Add**.
   - Check whether `localhost` is in the list. Newer projects may not have it. If it's missing: **Add domain** → `localhost` → **Add**.
     It is needed only to test sign-in on your laptop (P35). The rules tests don't need it.
   - Before the final release (v1.0), remove `localhost` again. Firebase advises against keeping it on a live project.
4. Do **not** turn on Phone sign-in. Since September 2024, SMS sign-in needs a Cloud Billing account, and the no-cost Spark plan has none. It would also cost money per SMS.

## C. Create the database (Firestore)
1. Left menu: **Build → Firestore Database → Create database**.
2. If it asks for an edition, choose **Standard**.
3. Location: **asia-south1 (Mumbai)**, the closest to Bangladesh. ⚠ This can never be changed later.
4. Choose **Start in production mode**. Everything stays locked until our own rules are deployed (step E).

## D. Register the website
1. Click the gear ⚙ → **Project settings → General → Your apps → Web (`</>`)**.
2. App nickname: `safeconnect-web`. Leave "Firebase Hosting" **unticked** (we use GitHub Pages). Click **Register app**.
3. You see `const firebaseConfig = { apiKey: ..., projectId: ... }`. Copy it into a note. We use it in P35.
   - This web config is **not a secret**. Every Firebase website shows it, and the security rules protect the data. It may go in Git.
   - The **service account private key** (Project settings → Service accounts) **is a secret**. Never click "Generate new private key", and never put such a file in Git.

## E. Put our rules online (after the P17 PR is merged)
In the VS Code terminal, inside the project folder:
1. `npx firebase login` opens the browser so you can sign in to Firebase. It stores the login on your laptop, not in the project.
2. `npm run test:rules` checks the rules again on your laptop (expect: 35 passed).
3. `npx firebase deploy --only firestore:rules,firestore:indexes --project safeconnect-67d83` uploads the rules.
4. In the console → **Firestore Database → Rules**, you should see our rules with today's date.

## F. Add the first admins (after P35, when sign-in works on the site)
1. Sign in on the site once with your own account.
2. Console → **Authentication → Users** → copy your **User UID**.
3. Console → **Firestore Database → Start collection** → Collection ID `admins` → Document ID = your UID → fields:
   - `since`: type **timestamp**, now
   - `addedBy`: type **string**, `console`
4. Do the same for tasmintoshi after she signs in once.
Only the console can add admins. The site can never do it (the tests check this).

## Free limits to know (no-cost Spark plan)
- About 50,000 reads and 20,000 writes per day, and 1 GB of stored data. That is plenty for a student project.
- If a limit is reached, Firestore stops answering until the next day. **The emergency part still works**: 999, numbers, location and SMS don't use Firestore.
