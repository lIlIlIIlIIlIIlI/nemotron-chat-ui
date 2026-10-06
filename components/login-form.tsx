"use client";

import { FormEvent, useState } from "react";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "로그인에 실패했습니다.");
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인에 실패했습니다.");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <a className="login-brand" href="/" aria-label="Nemotron Chat 홈">
        <span className="brand-mark">N</span>
        <span>Nemotron Chat</span>
      </a>
      <section className="login-card">
        <div className="login-card-mark"><span className="brand-mark">N</span></div>
        <h1>다시 오셨네요</h1>
        <p className="login-subtitle">계정으로 로그인해 대화를 이어가세요.</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="username">아이디</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="아이디를 입력하세요"
            required
          />
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호를 입력하세요"
            required
          />
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? "로그인 중…" : "로그인"}
          </button>
        </form>
        <p className="login-footnote">관리자가 설정한 계정으로 로그인할 수 있습니다.</p>
      </section>
      <p className="login-footer">NVIDIA Nemotron 기반 채팅</p>
    </main>
  );
}
