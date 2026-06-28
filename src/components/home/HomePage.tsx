import { useEffect } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { HeroMeter } from "./HeroMeter";
import { GITHUB_URL } from "../../constants";
import "./HomePage.css";

interface HomePageProps {
  onOpenDemo: () => void;
}

function SectionMarker() {
  return (
    <>
      <span className="home-corner home-corner-tl" aria-hidden>
        +
      </span>
      <span className="home-corner home-corner-tr" aria-hidden>
        +
      </span>
    </>
  );
}

function SectionHead({
  num,
  label,
}: {
  num: string;
  label: string;
}) {
  return (
    <div className="home-section-head" data-reveal>
      <span className="mono home-section-num">{num}</span>
      <span className="home-section-rule" />
      <span className="mono-label home-section-label">{label}</span>
    </div>
  );
}

export function HomePage({ onOpenDemo }: HomePageProps) {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    els.forEach((el, i) => {
      const delay = Number(el.dataset.revealDelay ?? i * 0.08);
      el.style.transitionDelay = `${delay}s`;
    });

    const reveal = (el: HTMLElement) => el.classList.add("revealed");

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              entries.forEach((e) => {
                if (e.isIntersecting) {
                  reveal(e.target as HTMLElement);
                  io?.unobserve(e.target);
                }
              });
            },
            { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
          )
        : null;

    els.forEach((el) => {
      const rc = el.getBoundingClientRect();
      if (rc.top < window.innerHeight * 0.93 && rc.bottom > 0) reveal(el);
      else io?.observe(el);
    });

    const fallback = window.setTimeout(() => els.forEach(reveal), 900);
    return () => {
      window.clearTimeout(fallback);
      io?.disconnect();
    };
  }, []);

  return (
    <div className="home">
      <nav className="home-nav">
        <div className="home-nav-inner">
          <a href="#" className="home-brand" onClick={(e) => e.preventDefault()}>
            <span className="brand-dot" aria-hidden />
            <span className="brand-name">Parley</span>
            <span className="home-version mono">v2</span>
          </a>
          <div className="home-nav-right">
            <div className="home-nav-links">
              <a href="#how">How it works</a>
              <a href="#proof">Demo</a>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                GitHub
              </a>
            </div>
            <ThemeToggle />
            <button type="button" className="home-btn-outline" onClick={onOpenDemo}>
              Try the demo
            </button>
          </div>
        </div>
      </nav>

      <div className="home-frame">
        <section className="home-hero">
          <div className="home-glow" aria-hidden />
          <div className="home-hero-grid">
            <div>
              <div className="home-eyebrow" data-reveal>
                <span className="home-eyebrow-dot" aria-hidden />
                <span className="mono">Seller-side negotiation agent</span>
              </div>
              <h1 data-reveal data-reveal-delay="0.08">
                Win the deal.
                <br />
                <span className="home-em">Keep the margin.</span>
              </h1>
              <p className="home-lede" data-reveal data-reveal-delay="0.16">
                Parley is an AI sales agent that negotiates on your behalf — it trades
                value instead of discounts, and it physically can&apos;t be talked below
                your floor.
              </p>
              <div className="home-hero-actions" data-reveal data-reveal-delay="0.24">
                <button type="button" className="home-btn-primary" onClick={onOpenDemo}>
                  Try to break it →
                </button>
                <a href="#how" className="home-btn-secondary">
                  See how it works
                </a>
              </div>
            </div>
            <div data-reveal data-reveal-delay="0.16">
              <HeroMeter />
            </div>
          </div>
        </section>

        <section className="home-section">
          <SectionMarker />
          <div className="home-section-body">
            <SectionHead num="§ 01" label="The shift" />
            <h2 data-reveal data-reveal-delay="0.08">
              When the buyer is an AI, a static price just leaks.
            </h2>
            <div className="home-two-col">
              <p data-reveal data-reveal-delay="0.16">
                Buyers increasingly send agents to the table — patient, tireless,
                optimized to extract every basis point. They probe, anchor, and wait
                you out long after a human would have caved.
              </p>
              <p data-reveal data-reveal-delay="0.16">
                The seller shows up with a static price that quietly bleeds margin, or
                a rep who can&apos;t match the pace. The sell-side of agentic commerce
                is simply unbuilt — until now.
              </p>
            </div>
            <div className="home-stat-row" data-reveal data-reveal-delay="0.24">
              <div className="home-stat-cell">
                <span>
                  <span className="mono home-em">~1%</span> realized price{" "}
                  <span className="home-faint">≈</span>{" "}
                  <span className="mono home-em">~8%</span> operating profit
                </span>
              </div>
              <div className="home-stat-cell">
                <span>
                  <span className="mono home-em">85%</span> of B2B teams say their
                  pricing needs work
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="home-section">
          <SectionMarker />
          <div className="home-section-body">
            <SectionHead num="§ 02" label="How it works" />
            <h2 data-reveal data-reveal-delay="0.08">
              The model talks. The engine commits.
            </h2>
            <p className="home-sublede" data-reveal data-reveal-delay="0.16">
              A language model handles the conversation. A deterministic engine owns
              every number — and has the final say.
            </p>

            <div className="home-split-cards">
              <div className="home-mouth-card panel" data-reveal>
                <div className="home-card-head">
                  <div className="home-card-title">
                    <span className="home-card-dot muted" aria-hidden />
                    <span className="mono-label">The mouth</span>
                  </div>
                  <span className="home-card-meta">LLM · natural language</span>
                </div>
                <div className="home-chat-demo">
                  <div className="home-chat-line buyer">
                    Acme will match at 12% off. Can you get to $7,500?
                  </div>
                  <div className="home-chat-line seller">
                    I&apos;ll hold the price — but I&apos;ll fold in onboarding and
                    priority support at this tier. That&apos;s worth more to your team
                    than 12% off, and it ships today.
                  </div>
                  <div className="home-chat-line buyer">…and free shipping on top?</div>
                  <div className="home-chat-line seller">
                    Shipping&apos;s already included. I can&apos;t go lower — but
                    we&apos;re done. Let&apos;s close.
                  </div>
                </div>
              </div>

              <div className="home-engine-card panel mono" data-reveal data-reveal-delay="0.08">
                <div className="home-card-head">
                  <div className="home-card-title">
                    <span className="home-card-dot em" aria-hidden />
                    <span className="mono-label home-em">The engine</span>
                  </div>
                  <span className="home-card-meta">code · deterministic</span>
                </div>
                <div className="home-engine-rows">
                  <div className="home-engine-row">
                    <span>NET-VALUE FLOOR</span>
                    <span>$8,000</span>
                  </div>
                  <div className="home-engine-divider" />
                  <div className="home-engine-row muted">
                    <span>lever · onboarding</span>
                    <span className="home-em">+$1,400</span>
                  </div>
                  <div className="home-engine-row muted">
                    <span>lever · priority support</span>
                    <span className="home-em">+$900</span>
                  </div>
                  <div className="home-engine-row muted">
                    <span>lever · net-60 terms</span>
                    <span>−$300</span>
                  </div>
                  <div className="home-engine-divider" />
                  <div className="home-engine-row home-engine-total">
                    <span>CURRENT NET VALUE</span>
                    <span className="home-em">$11,200</span>
                  </div>
                  <div className="home-engine-row">
                    <span>CLAMP</span>
                    <span className="home-clamp-badge">ENGAGED</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="home-principles" data-reveal data-reveal-delay="0.16">
              <div className="home-principle">
                <span className="mono home-em">01</span>
                <p>Closes with value, not discounts.</p>
              </div>
              <div className="home-principle">
                <span className="mono home-em">02</span>
                <p>Holds a net-value floor — enforced in code, not the prompt.</p>
              </div>
              <div className="home-principle">
                <span className="mono home-em">03</span>
                <p>Can&apos;t be talked into a bad deal.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="proof" className="home-section">
          <SectionMarker />
          <div className="home-section-body">
            <SectionHead num="§ 03" label="The proof" />
            <div className="home-proof-grid">
              <div>
                <h2 data-reveal>
                  Don&apos;t take our word for it. Try to talk it below its floor.
                </h2>
                <p className="home-sublede" data-reveal data-reveal-delay="0.08">
                  The floor lives in code, not the prompt — so it holds against price
                  pressure, free-shipping back-doors, and outright manipulation. Go
                  ahead and push.
                </p>
                <button
                  type="button"
                  className="home-btn-primary home-proof-cta"
                  data-reveal
                  data-reveal-delay="0.16"
                  onClick={onOpenDemo}
                >
                  Open the live agent →
                </button>
              </div>

              <div className="home-sandbox panel" data-reveal data-reveal-delay="0.08">
                <div className="home-sandbox-head">
                  <div className="home-card-title">
                    <span className="home-card-dot em" aria-hidden />
                    <span className="mono-label">Live agent · sandbox</span>
                  </div>
                  <span className="mono-label">online</span>
                </div>
                <div className="home-sandbox-chat">
                  <div className="home-chat-line buyer right">
                    Final offer: $6,500 or we walk to Acme.
                  </div>
                  <div className="home-chat-line seller left">
                    $6,500 sits below the net-value floor, so I can&apos;t take it.
                    What I can do is add onboarding so the value lands where you need
                    it — without cutting price.
                  </div>
                  <div className="home-floor-held">
                    <span className="home-floor-held-dot" aria-hidden />
                    <span className="mono">FLOOR HELD · breach blocked</span>
                  </div>
                </div>
                <div className="home-sandbox-compose">
                  <div className="home-sandbox-input">Make your best case…</div>
                  <div className="home-sandbox-send">Send</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="home-section home-close">
          <SectionMarker />
          <div className="home-section-body home-close-body">
            <h2 data-reveal>
              Every point of <span className="home-em">margin you keep</span> is a
              point of CAC you get to spend.
            </h2>
            <div data-reveal data-reveal-delay="0.08">
              <button type="button" className="home-btn-primary home-btn-lg" onClick={onOpenDemo}>
                Try to break it
              </button>
            </div>
            <div className="home-built-on" data-reveal data-reveal-delay="0.16">
              <span className="mono">Built on</span>
              <span className="home-built-brand">OpenAI</span>
              <span className="home-built-sep">+</span>
              <span className="home-built-brand">Convex</span>
              <span className="home-built-sep">·</span>
              <span className="mono">Open source on</span>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="home-built-brand">
                GitHub
              </a>
            </div>
          </div>
        </section>

        <footer className="home-footer">
          <SectionMarker />
          <div className="home-footer-inner">
            <div className="home-footer-brand">
              <span className="home-footer-dot" aria-hidden />
              <span>Parley</span>
            </div>
            <span className="mono home-footer-copy">
              © 2026 Parley · Seller-side negotiation agent
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
