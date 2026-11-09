# Deal Brief

Deal Brief is a one-page screening memo for an early-career analyst portfolio. You pick a public company or a startup, the app pulls only what free public sources will give it, and it writes a note that looks like desk work: a snapshot, a thesis, what would change the call, and a stance. The stance comes from a written rubric. A missing figure stays **Unknown**. Nothing here is a forecast, a DCF, or a chatbot transcript.

This is a portfolio project, not an investment adviser. A memo is not a recommendation to buy, sell, or hold any security.

## How to run

Works with no API key.

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Checked-in samples** (Wix, NVIDIA, Wiz) render with no network and no key. They are captures, not live fetches.
- **Build screening memo** fetches live sources and fills a structured template. The memo is labeled **not live AI**.
- Set `ANTHROPIC_API_KEY` only if you want Claude to rewrite sentences. Default model is `claude-haiku-4-5`. The model does not choose the stance. A draft that introduces a figure not in the source pack is thrown out and the template is kept. See `.env.example`. Do not commit a `.env` file.

`npm test` does not call a model and does not need network. `npm run build` produces the production app.

## Architecture

```
data sources → structured context → memo sections → rubric judgment
```

1. **Data.** Public track: Yahoo Finance quote statistics (the unauthenticated quote endpoint returns 401; quoteSummary works with Yahoo’s public crumb cookie, and the chart endpoint is the fallback for last price) and SEC EDGAR submissions plus company facts for SEC filers. A few headlines come from Yahoo Finance RSS or Google News RSS. Article bodies are not scraped. Startup track: the user-supplied site, if any, plus a few headlines. Fetches time out and are cached in memory for about ten minutes. Whatever came back is what the memo may use.
2. **Structured context.** A source pack of named facts: price, market cap, fiscal line items, a profile paragraph, site quotes, headlines, and the URL of each source. User notes are stored beside the pack and are not facts.
3. **Memo sections.** A template writes the sections below from that pack. Calculated margins and the revenue multiple are labeled as calculated from cited inputs. There is no cash-flow model.
4. **Judgment.** `lib/rubric.ts` sets the stance and the conviction. Conviction is confidence in the classification, not a view on upside. If a key is set, the model may only rewrite prose, and only after the stance is already fixed.

## Memo framework

### Public company

Sections: snapshot (name, ticker, sector, market cap, last price, date of the price), business, investment thesis (2–4 numbered points), what would change my mind, financial highlights, valuation context, key risks, bottom line.

**Attractive** only if every gate below is true on sourced figures:

- Last-fiscal operating margin is at least **8%**.
- Book equity is **positive**.
- Operating cash flow for that year is not negative, when the filing reports it.
- Market cap / last-fiscal revenue is at or below **15×**.

Last-fiscal means the latest full year in SEC company facts (10-K, 20-F, or 40-F), not Yahoo’s trailing quote statistics. Trailing figures are shown separately and are not mixed into the gates. Sell-side targets, forward EPS, and recommendation strings are ignored. No DCF is computed.

**Watch** when the issuer is a real, described business but one or more Attractive gates fail or are Unknown. A low multiple does not offset a broken margin or negative equity.

**Pass** when the issuer cannot be resolved, or when the distress test fires: operating margin below **−15%**, negative book equity, and negative operating cash flow, all three.

### Startup / VC

Sections: what they do and why it might matter now, market / why now, traction team and funding, how we’d underwrite, diligence questions, an explicit Unknowns list, bottom line.

**Diligence further** when the fetched site says what the company claims to sell, and nothing sourced shows the product is gone. Marketing lines stay labeled as company claims.

**Need more information** when there is no sourced product description. Notes typed into the form do not count.

**Pass** when the fetched site says the business has shut down or the domain is parked.

Funding, headcount, valuation, revenue, and the cap table stay **Unknown** unless a source in the pack states them. A headline dollar figure is not booked as a round. Notes are quoted as unverified and are not used in the stance.

## Worked examples

Captured 9 Nov 2026. Filing facts are from SEC company facts. The market cap moves with the quote; the multiple below is the one stored in `data/samples/`.

- **Wix (WIX) — Watch, high conviction.** Year ended 31 Dec 2025 (Form 20-F): revenue $1,993,044,000, gross margin 68.1%, operating margin **0.09%** (down from 5.7% the year before), operating cash flow $582,858,000, book equity **−$366,002,000**. Gross margin and cash generation are real. Attractive is refused because the operating margin is under 8% and book equity is negative. Either fact is enough. The revenue multiple on that capture was about 1.6×, inside the 15× ceiling, and it still does not rescue the call.
- **NVIDIA (NVDA) — Watch, high conviction.** Year ended 25 Jan 2026 (Form 10-K): revenue $215,938,000,000, operating margin 60.4%, book equity $157,293,000,000. The filing is exceptional on those lines. Market cap / that revenue printed at **19.87×** on the checked-in quote, above the **15×** ceiling, so the stance is not Attractive. An earlier pass at this screen used the same 15× ceiling; 19.87× is the measured multiple in this capture, not a second ceiling. No DCF fills the gap.
- **Wiz — Diligence further.** The site says it connects code, cloud, and runtime into one cybersecurity platform, and it states “Trusted by more than 65% of Fortune 100 companies.” That sentence is quoted as a company claim. Funding, headcount, and valuation are Unknown. Headlines in the capture were the company’s own posts, and the memo says independent coverage is thin.

## How this differs from a generic chatbot

A chatbot will invent a round, a headcount, or a price target to finish the paragraph. Deal Brief will not.

- The stance is a function in the repo, with thresholds you can read. The model is not asked who is right.
- Every populated figure has a source name and a URL or API. Empty cells say Unknown.
- Notes cannot be promoted into traction, funding, or valuation. A regression test locks that.
- If a rewrite adds a number that is not in the source pack, the rewrite is discarded.
- Valuation context is a multiple of reported revenue, or it is Unknown. There is no fabricated DCF.

## Limitations

- Quote timestamps are intraday. A memo built tomorrow will not match the market cap in the checked-in NVIDIA sample. Filing facts change only when a new annual report is in company facts.
- SEC fair access requires a contact in the User-Agent (`EDGAR_USER_AGENT`). The default is the portfolio contact in `.env.example`. Override it if you fork the repo.
- Foreign private issuers (Wix, NICE, Teva, monday.com) report on Form 20-F. The annual numbers are only as current as that form. Yahoo trailing statistics can disagree with the last fiscal year; the rubric uses the fiscal year and shows the disagreement when the signs differ.
- Headline coverage is titles only. Paywalled bodies are not fetched. A short or ambiguous name without a website will match badly, which is why the startup track asks for a URL.
- The template is terse on purpose. It will not invent a competitive thesis, a customer call, or a management view that was not in the pack.
- This is not investment advice. Sources can be wrong, late, or revised.

## Project layout

```
app/                 Next.js App Router UI and the server action
components/          Screener and the memo page
lib/rubric.ts        Stance rules
lib/memo.ts          Section template
lib/gather.ts        Source pack
lib/sources/         Yahoo, SEC EDGAR, RSS, company site
lib/llm.ts           Optional sentence rewrite and figure check
data/samples/        Checked-in Wix, NVIDIA, and Wiz memos
tests/               Rubric, parsers, figure guard, sample integrity
```

## Disclaimer

Deal Brief is a portfolio screening tool, not an investment adviser. A memo is not a recommendation to buy, sell, or hold any security. Figures are only as good as the cited sources, and missing data stays Unknown.
