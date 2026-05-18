"use client";

import { FormEvent, useEffect, useState } from "react";
import type { LeaderboardRow } from "@/lib/types";

async function jsonFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload as T;
}

export default function HostPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [totalPossibleScore, setTotalPossibleScore] = useState(0);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadLeaderboard() {
    const payload = await jsonFetch<{ leaderboard: LeaderboardRow[]; totalPossibleScore: number }>("/api/game?action=leaderboard");
    setRows(payload.leaderboard);
    setTotalPossibleScore(payload.totalPossibleScore);
  }

  useEffect(() => {
    loadLeaderboard().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load leaderboard."));
    const timer = window.setInterval(() => loadLeaderboard().catch(() => undefined), 3000);
    return () => window.clearInterval(timer);
  }, []);

  async function resetAll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await jsonFetch("/api/game", {
        method: "POST",
        body: JSON.stringify({ action: "reset-all", pin }),
      });
      setMessage("All players and scores were reset.");
      setPin("");
      await loadLeaderboard();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Could not reset game.");
    }
  }

  return (
    <main className="host-page">
      <section className="hero-card">
        <p className="kicker">Host screen</p>
        <h1>Live Leaderboard</h1>
        <p className="hero-copy">Open this page on a projector or TV. It refreshes every few seconds while guests play from their phones.</p>
      </section>

      {error ? <div className="error-box">{error}</div> : null}
      {message ? <div className="success-box">{message}</div> : null}

      <section className="host-board">
        {rows.length ? (
          rows.map((row, index) => (
            <div className="host-row" key={row.playerId}>
              <span className="host-rank">#{index + 1}</span>
              <span>
                <h2>{row.username}</h2>
                <span className="muted">{row.answeredCount} answers locked in</span>
              </span>
              <span className="host-score">{row.totalScore}/{totalPossibleScore}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">No players yet. Waiting for guests to join.</div>
        )}
      </section>

      <form className="admin-reset" onSubmit={resetAll}>
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="Host PIN, if configured"
          type="password"
        />
        <button className="danger-button" type="submit">Reset Full Game</button>
      </form>
    </main>
  );
}
