import { Sprout, ArrowRight, MessageSquare, ScanLine, TrendingUp, CloudSun, LineChart, Droplets, Clock, Bug } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../../layouts/PublicLayout";
import { Button } from "../../components/ui/Button";
import { Plot } from "../../components/ui/Plot";
import { Ledger, LedgerRow } from "../../components/ui/Ledger";
import { Panel } from "../../components/ui/Panel";
import { FadeUp } from "../../components/motion/FadeUp";
import { RevealOnScroll } from "../../components/motion/RevealOnScroll";

export default function Home() {
  return (
    <PublicLayout>
      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 pt-16 pb-14 grid md:grid-cols-[1.1fr_0.9fr] gap-10 md:gap-14 items-center">
        <div>
          <FadeUp as="span" className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-full mb-4">
            Free for every farmer
          </FadeUp>
          <FadeUp as="h1" delay={0.08} className="text-4xl md:text-5xl leading-tight">
            Know what your field needs, before you step into it.
          </FadeUp>
          <FadeUp as="p" delay={0.16} className="text-lg text-ink-soft mt-5 mb-7 max-w-[46ch]">
            Weather, market prices, crop advice and disease checks — built for the phone in your
            pocket and the field you already know better than any app.
          </FadeUp>
          <FadeUp delay={0.24} className="flex flex-wrap gap-3.5">
            <Link to="/register">
              <Button variant="primary">
                Create your free account <ArrowRight size={16} />
              </Button>
            </Link>
            <a href="#features">
              <Button variant="ghost">See how it works</Button>
            </a>
          </FadeUp>
          <FadeUp as="p" delay={0.3} className="text-sm text-ink-soft mt-4">
            No smartphone data plan? Your daily report also comes by WhatsApp.
          </FadeUp>
        </div>

        <FadeUp delay={0.2} className="max-w-[320px] mx-auto w-full">
          <Panel className="p-4">
            <div className="bg-bg rounded-md p-4">
              <div className="flex items-start gap-2 bg-danger-tint text-danger rounded-sm px-3 py-2.5 text-[13px] font-semibold mb-3.5">
                <Bug size={16} className="mt-0.5 shrink-0" />
                Leaf spot risk rising in Kurnool this week
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                <Panel className="p-3">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-1">Today</div>
                  <div className="font-display text-xl font-semibold">31&deg;C</div>
                  <div className="text-xs text-accent font-semibold mt-0.5">Light rain, 6pm</div>
                </Panel>
                <Panel className="p-3">
                  <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-1">Tomato, local</div>
                  <div className="font-display text-xl font-semibold">&#8377;1,840</div>
                  <div className="text-xs text-accent font-semibold mt-0.5">&uarr; 6% this week</div>
                </Panel>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Panel className="p-3 flex flex-col gap-2">
                  <span className="w-7 h-7 rounded-lg bg-primary-tint text-primary flex items-center justify-center">
                    <MessageSquare size={15} />
                  </span>
                  <span className="text-[13px] font-semibold">Ask the assistant</span>
                </Panel>
                <Panel className="p-3 flex flex-col gap-2">
                  <span className="w-7 h-7 rounded-lg bg-primary-tint text-primary flex items-center justify-center">
                    <ScanLine size={15} />
                  </span>
                  <span className="text-[13px] font-semibold">Check a leaf photo</span>
                </Panel>
              </div>
            </div>
          </Panel>
        </FadeUp>
      </header>

      {/* Features - varied-size Plot patchwork, not a repeated card grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16">
        <RevealOnScroll className="max-w-xl mb-11">
          <span className="inline-block text-[13px] font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-full mb-3.5">
            What it does
          </span>
          <h2 className="text-2xl md:text-3xl mt-1">
            Six things you&rsquo;d otherwise call five different people for.
          </h2>
          <p className="text-ink-soft mt-3">
            Each one answers a question you already ask &mdash; just faster, and specific to your
            field and your soil.
          </p>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <RevealOnScroll className="md:col-span-4">
            <Plot tone="soil" className="h-full flex flex-col gap-3">
              <Sprout size={26} />
              <h3 className="text-lg font-display font-semibold">
                Crop, fertiliser and yield, worked out for your soil
              </h3>
              <p className="text-[14.5px]">
                Tell it your soil type and field size once &mdash; it fills in the rest from live
                weather and your location, and tells you what to plant, what to feed it, and what
                to expect at harvest.
              </p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.06} className="md:col-span-2">
            <Plot tone="crop" className="h-full flex flex-col gap-3">
              <ScanLine size={24} />
              <h3 className="text-base font-display font-semibold">Photo diagnosis</h3>
              <p className="text-[14px]">
                Photograph a leaf or soil sample for an instant read on disease and treatment.
              </p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1} className="md:col-span-3">
            <Plot tone="plain" className="h-full flex flex-col gap-3">
              <LineChart size={24} className="text-primary" />
              <h3 className="text-base font-display font-semibold">Local market prices</h3>
              <p className="text-[14px] text-ink-soft">
                Real prices from your district, with trends so you know if a price is worth
                waiting on.
              </p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.14} className="md:col-span-3">
            <Plot tone="ink" className="h-full flex flex-col gap-3">
              <CloudSun size={24} />
              <h3 className="text-base font-display font-semibold">Weather by field</h3>
              <p className="text-[14px] opacity-80">
                Forecasts tied to your exact village, not the nearest big city.
              </p>
            </Plot>
          </RevealOnScroll>

          <RevealOnScroll delay={0.18} className="md:col-span-6">
            <Plot tone="soil" className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <MessageSquare size={26} className="shrink-0" />
              <div>
                <h3 className="text-lg font-display font-semibold">Ask it anything, anytime</h3>
                <p className="text-[14.5px] mt-1">
                  A chat that knows your farm&rsquo;s history &mdash; ask in plain language, get an
                  answer grounded in real agricultural guidance.
                </p>
              </div>
            </Plot>
          </RevealOnScroll>
        </div>
      </section>

      {/* Dashboard preview - Ledger instead of stat cards */}
      <section id="dashboard" className="max-w-6xl mx-auto px-6 py-16">
        <RevealOnScroll className="max-w-xl mb-11">
          <span className="inline-block text-[13px] font-semibold text-accent bg-accent-tint px-3 py-1.5 rounded-full mb-3.5">
            Your farm, at a glance
          </span>
          <h2 className="text-2xl md:text-3xl mt-1">One screen, every morning.</h2>
          <p className="text-ink-soft mt-3">
            Prices, weather and anything that needs your attention today &mdash; before you head
            out.
          </p>
        </RevealOnScroll>

        <RevealOnScroll>
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <strong className="font-display text-base">Ramesh&rsquo;s dashboard &mdash; Anantapur</strong>
              <span className="text-xs font-semibold text-accent bg-accent-tint px-2.5 py-1 rounded-full">
                Season: Kharif
              </span>
            </div>
            <div className="grid md:grid-cols-[1.3fr_1fr] gap-5 p-6">
              <div className="bg-bg border border-border rounded-sm p-4.5">
                <div className="text-[11px] uppercase tracking-wide text-ink-soft mb-3">
                  Groundnut price, last 7 weeks
                </div>
                <div className="flex items-end gap-2 h-28">
                  {[52, 61, 58, 70, 66, 78, 90].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t ${i === 6 ? "bg-accent" : "bg-primary/85"}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
              <Panel className="bg-bg p-4">
                <Ledger>
                  <LedgerRow icon={Droplets} label="Soil moisture" value="Adequate" />
                  <LedgerRow icon={Clock} label="Next irrigation" value="3 days" />
                  <LedgerRow icon={Bug} label="Disease risk" value="Watch" tone="down" />
                  <LedgerRow icon={TrendingUp} label="Market trend" value="Rising" tone="up" />
                </Ledger>
              </Panel>
            </div>
          </Panel>
        </RevealOnScroll>
      </section>

      {/* CTA */}
      <section id="trust" className="max-w-6xl mx-auto px-6 py-16">
        <RevealOnScroll>
          <Plot tone="soil" className="!bg-primary text-white p-10 md:p-14 flex flex-wrap items-center justify-between gap-8">
            <h2 className="text-white text-2xl md:text-3xl max-w-[22ch]">
              Set up your farm profile once. Get advice suited to it every day after.
            </h2>
            <Link to="/register">
              <Button variant="inverse">
                Create your free account <ArrowRight size={16} />
              </Button>
            </Link>
          </Plot>
        </RevealOnScroll>
      </section>
    </PublicLayout>
  );
}