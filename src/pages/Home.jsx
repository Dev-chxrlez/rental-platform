import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const categories = ["Tools & equipment", "Vehicles", "Spaces", "Technology"];

export default function Home() {
  const { profile } = useAuth();
  return (
    <div className="w-full self-start">
      <section className="relative overflow-hidden rounded-[2rem] bg-ink px-5 py-10 text-white shadow-[0_28px_80px_rgba(18,38,63,0.18)] sm:px-10 sm:py-14 lg:grid lg:min-h-[36rem] lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-10 lg:px-14 lg:py-16">
        <div className="relative z-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#75d2c6]">Rent what moves you forward</p>
          <h1 className="mt-5 max-w-3xl font-display text-[2.65rem] font-bold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
            More access.
            <span className="block text-[#f4bd58]">Less overhead.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl">
            Discover useful equipment, vehicles, spaces, and technology—or put your own resources to work.
          </p>
          <div className="mt-8 flex flex-col gap-3 min-[430px]:flex-row">
            <Link to="/listings" className="button-primary bg-[#18a096] hover:bg-[#12867e]">
              Browse listings
              <span className="ml-2" aria-hidden="true">→</span>
            </Link>
            {!profile?.is_admin && <Link to="/listings/new" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/30 bg-white/8 px-5 py-3 font-bold text-white transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">List an item</Link>}
          </div>
        </div>

        <div className="relative mx-auto mt-12 w-full max-w-lg lg:mt-0" aria-label="Marketplace categories">
          <div className="absolute -right-16 -top-24 h-52 w-52 rounded-full border-[2.5rem] border-brand/30" aria-hidden="true" />
          <div className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-accent/15" aria-hidden="true" />
          <div className="relative rotate-[-2deg] rounded-[1.75rem] border border-white/15 bg-white/8 p-4 shadow-2xl backdrop-blur-sm sm:p-5">
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-ink shadow-lg">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-xl text-brand" aria-hidden="true">⌕</span>
              <div>
                <p className="text-sm font-bold text-ink">What do you need?</p>
                <p className="mt-0.5 text-sm text-ink-muted">Explore the marketplace</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {categories.map((category, index) => (
                <div key={category} className={`min-h-24 rounded-2xl border border-white/15 p-4 ${index === 0 ? "bg-[#f4bd58] text-ink" : "bg-white/10 text-white"}`}>
                  <span className="text-xs font-black uppercase tracking-[0.16em] opacity-65">0{index + 1}</span>
                  <p className="mt-5 text-sm font-bold leading-tight sm:text-base">{category}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 py-8 sm:grid-cols-3 sm:py-10" aria-label="Marketplace principles">
        {[
          ["Clear pricing", "See the daily price and replacement value before you decide."],
          ["Useful variety", "Browse practical resources from individuals and small businesses."],
          ["Your listing, your control", "Create, edit, and remove your own listings from one place."],
        ].map(([title, description], index) => (
          <div key={title} className="rounded-2xl border border-line/80 bg-surface/70 p-5">
            <span className="text-sm font-black text-accent" aria-hidden="true">0{index + 1}</span>
            <h2 className="mt-3 text-lg font-black text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
