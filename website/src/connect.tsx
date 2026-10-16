import { useState } from "react";
import { sheetsApi } from "./shared/api-client";

export function ConnectSheet({
  initialError,
  onConnected,
  onSignOut,
}: {
  initialError: string;
  onConnected: () => void;
  onSignOut: () => void;
}) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sheetsApi.connectSheet(
        String(new FormData(e.currentTarget).get("url")).trim(),
      );
      onConnected();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not verify this Google Sheet.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-wrap">
      <section className="login-card">
        <p className="eyebrow">FIRST TIME SETUP</p>
        <h1>Connect your inventory</h1>
        <p className="muted">
          Paste your private Google Apps Script Web App URL. Stockly verifies it
          through the shared backend and never stores the URL in this browser.
        </p>
        <form className="form-stack" onSubmit={submit}>
          <label>
            Apps Script Web App URL
            <input
              name="url"
              type="url"
              placeholder="https://script.google.com/macros/s/…/exec"
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" disabled={busy}>
            {busy ? "Verifying…" : "Verify and connect"}
          </button>
        </form>
        <p className="muted">
          Deploy `apps-script/Code.gs` as a Web App, then keep your Google Sheet
          private.
        </p>
        <button className="text-btn" onClick={onSignOut}>
          Sign out
        </button>
      </section>
    </main>
  );
}
