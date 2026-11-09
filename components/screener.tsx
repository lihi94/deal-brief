"use client";

import { useState } from "react";
import { createMemo } from "../app/actions";
import type { Memo, Track } from "../lib/types";
import { MemoView } from "./memo-view";

const EXAMPLES = ["WIX", "NICE", "TEVA", "NVDA", "MNDY"];

export function Screener() {
  const [track, setTrack] = useState<Track>("public");
  const [query, setQuery] = useState("WIX");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [memo, setMemo] = useState<Memo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const next = await createMemo({
        track,
        query,
        website: track === "startup" ? website : undefined,
        notes: track === "startup" ? notes : undefined,
      });
      setMemo(next);
    } catch (caught) {
      setMemo(null);
      setError(caught instanceof Error ? caught.message : "The memo could not be built.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="panel" onSubmit={onSubmit}>
        <div className="tracks" role="group" aria-label="Memo track">
          <button type="button" className={track === "public" ? "track active" : "track"} onClick={() => setTrack("public")} aria-pressed={track === "public"}>
            <strong>Public company</strong>
            <p>Ticker or name. Quote statistics, SEC company facts, and a few headlines.</p>
          </button>
          <button type="button" className={track === "startup" ? "track active" : "track"} onClick={() => setTrack("startup")} aria-pressed={track === "startup"}>
            <strong>Startup / VC</strong>
            <p>Name, optional site, optional notes. Notes stay quoted and unverified.</p>
          </button>
        </div>
        <label htmlFor="company">{track === "public" ? "Ticker or company" : "Company name"}</label>
        <input
          id="company"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={track === "public" ? "WIX, NVIDIA, Teva" : "Wiz"}
          required
        />
        {track === "public" ? (
          <div className="examples">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" className="chip" onClick={() => setQuery(example)}>{example}</button>
            ))}
          </div>
        ) : (
          <>
            <label htmlFor="website">Website, optional</label>
            <input id="website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://www.wiz.io" />
            <label htmlFor="notes">Notes, optional and unverified</label>
            <textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything you type here is quoted as an unverified note. It will not be turned into a fact." />
          </>
        )}
        <div className="row">
          <button className="primary" type="submit" disabled={pending}>{pending ? "Building the memo…" : "Build screening memo"}</button>
        </div>
        <p className="hint">
          {pending
            ? "Fetching quotes, filings, or the company site. Missing fields stay Unknown."
            : "Without an API key this is a structured template, not a live model. The stance still comes from the written rubric."}
        </p>
        {error ? <p className="error" role="alert">{error}</p> : null}
      </form>
      {memo ? <MemoView memo={memo} /> : null}
    </>
  );
}
