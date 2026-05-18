# Lane — Job Application Tracker

A Chrome extension that tracks your job applications with one click, on any career page.

## Quick start

```bash
npm install
npm run build
```

Then load the extension in Chrome:

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `dist/` folder inside this directory
5. The Lane extension will appear in your toolbar

## Usage

- Navigate to any job posting (LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, or any company career page)
- Click the Lane icon in your toolbar
- If a job is detected, review the pre-filled details and click **Save to Lane**
- If no job is detected, click **+ Add manually** to fill in the details yourself
- On pages you have already saved, update the application status from the dropdown
- Open the dashboard to sync Gmail replies, review analytics, and update statuses

## Gmail sync setup

Lane can scan recent Gmail messages for interview and rejection language, match those messages to tracked companies, update the application status, and apply Gmail labels such as `Lane/Interview` and `Lane/Rejected`.

Before the **Connect Gmail** button can work, replace the placeholder OAuth client ID in `manifest.json`:

```json
"oauth2": {
  "client_id": "YOUR_CHROME_EXTENSION_OAUTH_CLIENT_ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/gmail.modify"]
}
```

High-level setup:

1. Create a Google Cloud project and enable the Gmail API.
2. Configure the OAuth consent screen.
3. Create an OAuth client for a Chrome extension.
4. Use the extension ID from `chrome://extensions` for that OAuth client.
5. Paste the generated client ID into `manifest.json`.
6. Run `npm run build`, then reload the unpacked `dist/` extension.

The dashboard uses Gmail labels as folders. The default label prefix is `Lane`, but you can change it in the dashboard before syncing.

## Adding icons (optional)

Chrome will use a default puzzle-piece icon until you add real icons. To use a custom icon:

1. Export `src/popup/icon.svg` to PNG at these sizes: 16x16, 48x48, 128x128
2. Place them in the `public/` folder as `icon16.png`, `icon48.png`, `icon128.png`
3. Add to `manifest.json`:

```json
"icons": {
  "16": "icon16.png",
  "48": "icon48.png",
  "128": "icon128.png"
},
"action": {
  "default_icon": {
    "16": "icon16.png",
    "48": "icon48.png"
  },
  "default_popup": "src/popup/index.html",
  "default_title": "Lane"
}
```

4. Run `npm run build` again

## Data

All application data and Gmail sync settings are stored locally in `chrome.storage.local`. Nothing is sent to any server. Gmail messages are only read through the Gmail API after you approve the OAuth consent prompt.

## Supported platforms (Tier 1 — auto-detected)

- LinkedIn Jobs
- Indeed
- Greenhouse
- Lever
- Workday
- Ashby

Any other career page is detected via a scoring heuristic (Tier 2) and may require manual verification of the extracted details.
