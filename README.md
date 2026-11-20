# DISCIPLINE — Node.js + Express + MongoDB

A self-hosted trading discipline tracker with user registration, editable rules, daily lock, cooldown, journal and calendar. Black-and-white design with red/green/amber status indicators.

## Requirements
- Node.js 20+
- MongoDB Community Server locally, or MongoDB Atlas

## Windows setup
1. Extract this ZIP.
2. Open a terminal in the `discipline-node` folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and set `MONGO_URI` and a unique random `SESSION_SECRET` (32+ characters).
5. Start MongoDB if using a local server.
6. Run `npm start`.
7. Visit `http://localhost:3000` and register.

Example secret generation: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Features
- Separate account and data per user, password hashing, MongoDB-backed sessions
- Create, edit, enable/disable, delete personal rules; six default rules on registration
- Strict daily limits: 3 trades or 2 losses, 15-minute cooldown after a loss
- Emergency stop until the next day
- Daily pre-trade checklist and calm-state confirmation
- Trading view keeps the checklist, account lock, and New York session timer together; journal, calendar, and rules are separate dashboard tabs
- Journal: create records with instrument, direction, strategy, outcome, P&L and three-letter currency code, emotion, plan compliance, notes, optional JPEG/PNG/WebP images up to 5 MB each, and up to 3 MP4/WebM screen recordings up to 1 GB each. Preview recordings before saving and play saved recordings in a player dialog.
- A+ Setups: save, edit, and delete named examples, including backtests, with session, time, instrument, direction, outcome, currency, strategy, notes, TradingView snapshots, image attachments, and up to 3 MP4/WebM screen recordings up to 1 GB each. Preview recordings before saving and play saved recordings in a player dialog. Existing example account, P&L, emotion, and plan data remain available in their details but are no longer collected by the example form. Mark actual journal trades as A+ when creating or editing them to see them alongside examples in the library. Recent rows and library rows show outcome, record type, and saved results; expand a record for details. The separate library shows 20 records per page and supports search plus record-type, strategy, instrument, outcome, and save-date filters. Choose a save date alone or add an inclusive end date for a period. Library dates use the account timezone and are save dates, not historical setup dates. Examples remain separate from the journal, trade limits, cooldown, checklist, calendar, statistics, and CSV export; marked trades remain normal journal trades.
- In View All A+ Setups, expand a saved example and choose Delete Example. The confirmation dialog names the example and defaults to Cancel. Journal trades cannot be deleted from the library.
- Record editing uses journal-style modals for trades, rules, saved setup examples, and no-setup entries. No-setup edits work from both Journal and Calendar; setup-library edit links open the selected example's dashboard modal. Rule, trade, no-setup, and example deletions share the A+ confirmation style, name the record, and default to Cancel. Confirming preserves the original CSRF token and return location; canceling or pressing Escape does not delete anything.
- Public TradingView snapshot links show an image preview with a View in TradingView link that opens the original snapshot in a new tab. Uploaded-image previews do not show this link.
- Journal recent trades: compact latest-five rows grouped by account-timezone date, with net/day totals kept separate by currency, trade times, direction, and strategy or plan-broken status. Totals cover only the displayed five trades; select a row to open that day's full calendar records.
- All-time P&L totals grouped by currency, monthly and selected-day calendar totals, and CSV export including currency
- Calendar: selectable yearly/monthly performance bars, currency filter, compact two-column monthly summary with win rate and best/worst days, daily P&L with win/loss counts, weekly totals, and an expandable monthly table. Weekend records remain visible; selecting a day opens its records as full-detail Cards with matching heights within each row, or an A+ Library-style List table for screenshots. The List shows entry time, instrument, side, outcome, P&L, and plan status, with session and strategy on wider screens. Trades are numbered from earliest to latest entry time (or save time if no entry time was recorded), in the account timezone. No-setup entries are numbered separately.
- The monthly table has its own year selector, a year-total row, W/L and plan-adherence columns, relative P&L bars, and clickable month rows showing that month's trades below it. The table, yearly totals, and trade list follow the calendar currency without conversion. Selecting a trade date opens its full day records, including other currencies.
- The Calendar's day List uses the A+ Setup Library layout, with strategy and plan status shown as pills on collapsed rows. Expand a trade row to see its notes and actions on the left and chart thumbnails on the right. Select a thumbnail to open the full-size preview.
- Settings per account: display name, password change, daily trade/loss limits, loss cooldown, timezone, new-trade currency, default dashboard tab, world-clock/Forex/NY-reminder/economic-calendar visibility, and calendar currency/analysis defaults. Personal rules and CSV export are linked from Settings.
- Color status: green win/active, red loss/locked, amber cooldown

## Important details
- Daily boundaries use `Europe/Sofia` by default (can be changed in user record). The app recalculates the day when you visit it.
- When a daily-lock midnight reset falls during the futures weekend closure (Friday 17:00 to Sunday 18:00 New York), its countdown instead shows the next futures opening, labelled separately from the daily reset. This is Monday 01:00 Bulgaria when US/Bulgarian daylight saving schedules align (00:00 during the mismatch weeks). This is display-only: daily locks still reset at account midnight, with no weekend trading/checklist restriction. Cooldown timers are unchanged; exchange holidays are not included.
- The paused checklist has its own countdown to the actual daily reset or cooldown expiry, not the display-only futures opening, and refreshes when it becomes available.
- When futures are closed, the availability card replaces daily remaining-limit counters with weekly P&L by currency, trade/outcome counts, win rate, plan adherence, and a link to the last recorded trade. The recap uses account-timezone Monday–Sunday dates: the current week on weekends, the previous completed week on weekdays. Break-even trades are excluded from win rate; unknown plan statuses are excluded from plan adherence. Opening/lock/cooldown timers remain unchanged.
- Session & Availability uses compact paired cards with small countdown units, inline local/ET milestone times, an unboxed weekly metric row, and a last-trade link. The NY card shows its next session date, timeline, and local session times; layouts stack on smaller screens without changing session schedules.
- Change your timezone in Settings. Timezone and discipline-limit changes are saved as pending values until the next midnight in the currently active account timezone; they are applied on the next authenticated dashboard/discipline/settings request after that timestamp. Editing pending values does not postpone their original deadline. Saving the currently active values cancels pending changes. Saving settings does not clear an emergency stop, running cooldown or checklist.
- Profile and display preferences apply immediately and are stored on the authenticated user's record. Existing users receive the original defaults. Default currency affects new trade forms, not existing entries. Account timezone changes regroup calendar dates but never rewrite trade timestamps. Forex hours remain in Sofia time.
- Password changes require the current password, matching new passwords of 10–128 characters (maximum 72 UTF-8 bytes for bcrypt), and are rate-limited. The current session is renewed; other active sessions are not revoked. Email changes and Notion synchronization are not implemented.
- The New York reminder follows `America/New_York`: pre-market is 8:30–9:30 AM, regular session is 9:30 AM–4:00 PM on weekdays. The account lock is a separate daily rule. Countdown milestones and lock expiry show the event time in the account timezone, New York, and Bulgaria (combined when the account timezone is Europe/Sofia); exchange holidays are not included.
- The trading dashboard also shows typical Sydney, Tokyo, London, and New York forex-session hours in each center's local time, highlighting active sessions and overlaps with daylight-saving-aware clocks. Active cards show the current session; closed cards show the next weekday session's opening and closing in Sofia time, matching their countdown. Weekdays are local to each center: Sydney's Monday session may start on Sunday in Bulgaria. Session hours are indicative and do not account for holidays or broker-specific schedules.
- The trading dashboard embeds TradingView's economic calendar widget (dark theme, US high-importance events only), loaded from `widgets.tradingview-widget.com`; it needs internet access and may be hidden by content blockers. The Content Security Policy allows TradingView scripts, frames, connections and images, plus inline style attributes required by the widget (`style-src-attr 'unsafe-inline'`). Event data and timing come from TradingView. It can be hidden in Settings.
- Calendar performance analysis defaults to the selected month, with 7-day, 30-day, and all-time filters. Win rate, plan adherence, current and longest win/loss streaks, outcomes, cumulative P&L, and daily results are calculated from journaled trades; records with no saved plan-following status are excluded from plan-adherence rates. Currency totals and charts remain separate.
- Overview sections are grouped into Summary, Account in numbers, and Charts tabs. Use Left/Right arrows or Home/End to switch tabs; the statistics/chart currency selector stays available in every section.
- The analysis trading-account selector filters Summary, Account in numbers, Charts, and strategy drill-downs by saved account name, regardless of account count. All accounts is the default; Unassigned includes missing or blank names. P&L uses the recorded amount without dividing by account count. Account names are case-sensitive, with surrounding whitespace ignored. No-setup counts remain across all accounts because those entries have no account name. The main calendar is unchanged.
- Select a strategy in analysis to open its records: period summaries, all/wins/losses filters, month/all-time selection, and date-grouped cards with daily totals. Summaries cover the selected period regardless of the outcome filter; monetary results remain separate by currency. Average win/loss uses positive/negative P&L, while outcome filters and win rate use saved outcomes. Select a card to view the day's full records and notes.
- Detailed performance includes Money, Trades, and Risk & Results cards for the selected analysis currency/period: net profit, average per recorded month/trade, profitable months/days, average positive/negative trades, profit factor, maximum realized P&L drawdown, and best/worst trades/months. Partial months use only records inside the period. Profit factor is gross positive P&L divided by absolute gross negative P&L (`∞` for profits with no losses, unavailable when both are zero). Drawdown starts cumulative realized P&L at zero and is a currency amount, not equity drawdown percentage. Balance, deposits, withdrawals and holding duration are explicitly unavailable until their source data is tracked.
- The calendar overview shows only the selected currency, without conversion; detailed analysis remains available in an expandable section. Win rate excludes break-even trades. Weekly totals include only dates within the displayed month. Return percentages are not shown because account balance history is not stored.
- Cooldown is saved in MongoDB; refreshing the page does not clear it.
- Journal and setup images and videos are stored in the private `uploads` directory and served only to their owning account. Back up this directory along with MongoDB; use persistent disk storage when deploying.
- Canceling an attachment download (for example, by refreshing the page) is not logged as a server error. File-serving errors still go through Express error handling.
- Users can still add, edit or delete historical journal entries, which changes daily trade counts. P&L totals are grouped by currency and are not converted between currencies. The app is a behavioral tracker, not a tamper-proof trading restriction.
- Trade journaling is not blocked by the lock, to allow recording completed trades. Completing a new checklist **is** blocked.
- A new checklist is required after each recorded trade. Completing a checklist does not place trades.
- For real broker-level blocking, use a supported integration with your trading platform.
- The app is not yet a PWA. This version is a mobile-responsive web application. PWA installation/offline support can be added after server-side auth and offline sync are designed.
- Data from the earlier browser-only PWA is **not automatically migrated** to MongoDB.

## Deploying online
- Restart the Node app after updating backend or model files (or use `npm run dev` during development). The Settings screen disables saving if the old backend is still running.
- Use HTTPS and set `NODE_ENV=production`, a strong session secret, and a restricted MongoDB connection string.
- Put the app behind a reverse proxy (e.g., Nginx) and secure your database.
- Configure reverse-proxy request limits and persistent disk capacity for large screen recordings. A full record upload can exceed 3 GB with three 1 GB clips, image attachments, and multipart overhead. Server and proxy timeouts can also affect slow uploads.
- Back up MongoDB regularly. Do not commit `.env` to Git.
- Add email verification, password reset, audit history and stronger server-side trade-lock controls before treating this as a production financial workflow.

## Security
- Helmet, session cookies (httpOnly, sameSite), CSRF checks, rate-limited authentication, bcrypt passwords, user-scoped database queries.
- Do not use real funds based on app permissions; this app does not enforce broker trading restrictions.

## Validation
- Run `npm test` for settings validation, account isolation, password changes, pending discipline changes, and dashboard rendering tests. These tests use isolated fixtures and do not connect to your MongoDB database.
#   T r a d e D i s c i p l i n e  
 