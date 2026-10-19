import BrandMark from "./BrandMark";

export default function AuthShell({ eyebrow, title, description, children }) {
  return (
    <section className="grid w-full self-start overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_24px_70px_rgba(18,38,63,0.09)] lg:grid-cols-[0.8fr_1.2fr]">
      <div className="relative overflow-hidden bg-ink p-6 text-white sm:p-10 lg:p-12">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border-[2rem] border-brand/35" aria-hidden="true" />
        <div className="absolute -bottom-16 -left-12 h-44 w-44 rounded-full bg-accent/15" aria-hidden="true" />
        <div className="relative">
          <BrandMark inverse />
          <p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-[#77d1c6]">{eyebrow}</p>
          <h1 className="mt-3 max-w-md font-display text-4xl font-bold leading-[1.08] tracking-[-0.03em] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">{description}</p>
        </div>
      </div>
      <div className="p-6 sm:p-10 lg:p-12">{children}</div>
    </section>
  );
}
