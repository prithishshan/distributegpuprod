"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="landing-root">
      <h1 className="landing-title">Mosaic GPU</h1>
      <p className="landing-subtitle">Choose an option</p>
      <nav className="landing-nav">
        <Link href="/design" className="landing-card landing-card-design">
          <span className="landing-card-label">Design</span>
          <span className="landing-card-desc">Upload OBJ, MTL &amp; configure grid</span>
        </Link>
        <Link href="/job" className="landing-card landing-card-job">
          <span className="landing-card-label">Job</span>
          <span className="landing-card-desc">Run and manage jobs</span>
        </Link>
      </nav>
    </main>
  );
}
