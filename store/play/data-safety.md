# Google Play: "Data safety" and "App content" answers

Based on the app as built (see public/privacy.html and public/terms.html).

**Data safety**
- Does the app collect or share user data? **Yes** (be conservative: the optional AI features send the text the user chooses to the AI service they picked).
- Data type: *App activity > Other user-generated content* (text sent to the AI on request).
  - Collected: yes. Shared: no (sent at the user's request to the service they chose).
  - Processed ephemerally: yes. Required or optional: **optional**. Purpose: **App functionality**.
- Encrypted in transit: **yes** (HTTPS only).
- Can users ask for deletion: **yes**, documents live on the device; deleting the app or a document deletes it.
- No account, no ads, no analytics, no location, no contacts, no payments.

**App content**
- Privacy policy: https://fisbal.github.io/oi1/privacy.html
- Ads: **No ads**.
- App access: **All functionality is available without special access** (no login).
- Content rating questionnaire: category *Utility, Productivity, Communication or Other*; answer **No** to violence, sexuality, language, drugs, gambling; **Yes** "users can interact / share content"? **No** (no chat between users). Expected rating: Everyone / PEGI 3.
- Target audience: **18+** (simplest; avoids the Families policy). Can be widened later.
- News app: No. Health app: No. Government app: No. Financial features: **None** (calculators only, no money handling).
