# Milk Distribution Tracker

Tracks daily stock dispatch and cash settlement for a milk distribution shop's routes. Data lives in a Google Sheet (no database); the app is a static site hosted on GitHub Pages that talks to a Google Apps Script Web App acting as the API.

## 1. Set up the Google Sheet + Apps Script backend

1. Create a new Google Sheet (e.g. named `MilkDistributionDB`).
2. In the Sheet, go to **Extensions > Apps Script**.
3. Delete the default `Code.gs` contents and paste in the contents of [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
4. In the Apps Script editor, select the `setup` function from the function dropdown and click **Run**. Grant the permissions it asks for. This creates the `Products`, `Routes`, `Trips`, and `TripItems` tabs with headers in your Sheet.
5. Edit the `setAppToken` function: replace `REPLACE_WITH_YOUR_PASSCODE` with a passcode of your choice (this is what you and your staff will type into the app, and it also authenticates every API request). Select `setAppToken` from the function dropdown and click **Run** once. You can change it later by editing and re-running this function.
6. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize again if prompted.
7. Copy the **Web app URL** it gives you (ends in `/exec`). You'll need this for the frontend.

If you ever edit `Code.gs` again, use **Deploy > Manage deployments > Edit > New version** to push the update to the same URL.

## 2. Run the frontend locally

```bash
npm install
cp .env.example .env
# edit .env and set VITE_API_URL to the Web app URL from step 1.7
npm run dev
```

Open the printed local URL, enter the passcode you set in `setAppToken`, and you're in.

## 3. Add your master data

Once logged in, go to **Products** and add your product list with prices, then go to **Routes** and add your 5 routes (name, villages, default vehicle, default driver). Routes and products can be edited or deactivated later without deleting history.

## 4. Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings > Secrets and variables > Actions** and add a repository secret named `VITE_API_URL` with the Apps Script Web app URL from step 1.7.
3. Go to **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Push to `main` (or run the "Deploy to GitHub Pages" workflow manually from the Actions tab). The site will build and publish automatically.

## Daily use

- **Dashboard**: shows each route's status for today — not started, awaiting return, or settled.
- **Route screen**: pick a date (defaults to today). In the morning, enter quantities dispatched per product and hit **Dispatch**. In the evening, come back to the same route/date, enter quantities returned and the cash handed over, and hit **Settle** — the app shows the discrepancy between cash handed over and the computed amount due.
- **Products** / **Routes**: manage the master lists.
- **History**: filter past trips by route and date range.

## Notes on security

The passcode is the only access control, and it's also the shared secret sent with every API call and checked inside the Apps Script — so it's real enforcement, not just a UI gate. That said, this is app-level security suited to an internal single-shop tool, not encryption: anyone who has the passcode and the site URL can read and write data. Don't reuse a sensitive password as this passcode.
