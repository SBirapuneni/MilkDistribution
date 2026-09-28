# Milk Distribution Tracker

Tracks daily stock dispatch and cash settlement for a milk distribution shop's routes. Data lives in a Google Sheet (no database); the app is a static site hosted on GitHub Pages that talks to a Google Apps Script Web App acting as the API.

## 1. Set up the Google Sheet + Apps Script backend

1. Create a new Google Sheet (e.g. named `MilkDistributionDB`).
2. In the Sheet, go to **Extensions > Apps Script**.
3. Delete the default `Code.gs` contents and paste in the contents of [`apps-script/Code.gs`](apps-script/Code.gs) from this repo.
4. In the Apps Script editor, select the `setup` function from the function dropdown and click **Run**. Grant the permissions it asks for. This creates the `Products`, `Routes`, `Trips`, and `TripItems` tabs with headers in your Sheet.
5. Edit the `setAppToken` function: replace `REPLACE_WITH_YOUR_PASSCODE` with a passcode of your choice — **at least 12 characters**; a few unrelated words works well (this is what you and your staff will type into the app, and it also authenticates every API request). Select `setAppToken` from the function dropdown and click **Run** once. You can change it later by editing and re-running this function.
   - Optionally, do the same with `setAdminToken` to set a separate **admin passcode** that only the owner knows. It's needed to reopen a settled trip; until it's set, reopening is disabled.
   - Check **File > Settings > Time zone** in the Sheet is your local time zone (e.g. Asia/Kolkata).
6. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize again if prompted.
7. Copy the **Web app URL** it gives you (ends in `/exec`). You'll need this for the frontend.

If you ever edit `Code.gs` again, use **Deploy > Manage deployments > Edit > New version** to push the update to the same URL, then run `setup` once more — it's safe to re-run, and it adds any new columns (for example `DispatchedBy`, `SettledBy`, `ReopenedBy`, `ReopenedAt` on the `Trips` tab) without touching existing data.

## 2. Run the frontend locally

```bash
npm install
cp .env.example .env
# edit .env and set VITE_API_URL to the Web app URL from step 1.7
npm run dev
```

Open the printed local URL, enter your name and the passcode you set in `setAppToken`, and you're in.

Leave `VITE_API_URL` unset to try the app in **demo mode** with in-memory data: the passcode is `demo` and the admin passcode is `admin`.

## 3. Add your master data

Once logged in, go to **Products** and add your product list with prices, then go to **Routes** and add your 5 routes (name, villages, default vehicle, default driver). Routes and products can be edited or deactivated later without deleting history.

## 4. Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings > Secrets and variables > Actions** and add a repository secret named `VITE_API_URL` with the Apps Script Web app URL from step 1.7.
3. Go to **Settings > Pages** and set **Source** to **GitHub Actions**.
4. Push to `main` (or run the "Deploy to GitHub Pages" workflow manually from the Actions tab). The site will build and publish automatically.

## Daily use

- **Dashboard**: today's totals (sent out, cash collected, trips awaiting return, cash short) and each route's Morning/Evening status — tap a session to go straight to it. Shortfalls show in red.
- **Route screen**: pick a date (defaults to today). It opens whichever session still needs its return settled, and warns you if the other session is still awaiting return. **Same as last trip** fills in the quantities from the previous trip for that route and session. In the morning, enter quantities dispatched per product and hit **Dispatch**. In the evening, come back to the same route/date, enter quantities returned and the cash handed over, and hit **Settle** — the app shows the discrepancy between cash handed over and the computed amount due, and asks you to confirm before settling.
- **Reopening**: a settled trip is locked. If it was settled by mistake, open it, expand **Reopen this trip**, and enter the admin passcode; it goes back to "awaiting return" with its figures kept, ready to correct and settle again.
- **Products** / **Routes**: manage the master lists.
- **History**: past trips for a route and date range (last 30 days by default), including who dispatched and settled each one, with a totals row.
- **Analytics**: pick a range with the quick buttons (Today, Last 7 days, …). Summary cards compare the complete days of the range with the same number of days before it. Includes the sales trend (today drawn dashed while it's still in progress), cash **short** and **excess** shown separately, both per day and per driver (so a shortage on one route can't be hidden by an excess on another), return rates by day, product and route, and sales by route, product and session. Tap any chart point to see its value.

## Notes on security

The passcode is the only access control, and it's also the shared secret sent with every API call and checked inside the Apps Script — so it's real enforcement, not just a UI gate. That said, this is app-level security suited to an internal single-shop tool, not encryption: anyone who has the passcode and the site URL can read and write data. Don't reuse a sensitive password as this passcode.

- Everyone enters their name at login; it's recorded on each trip (`DispatchedBy`, `SettledBy`, `ReopenedBy`) as an accountability trail. It isn't verified — it's a record, not a login.
- To slow down passcode guessing, the backend refuses **all** requests after 100 wrong passcodes within 10 minutes, until 10 minutes pass without another wrong one. The downside: someone deliberately sending wrong passcodes could lock staff out for a while. It clears by itself 10 minutes after the wrong attempts stop.
- All writes go through a script lock, so two phones saving at the same moment can't create duplicate trips.
