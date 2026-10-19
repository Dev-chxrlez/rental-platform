export default function PageIntro({ eyebrow, title, children }) {
  return (
    <section className="panel w-full self-start p-6 sm:p-10">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <h1 className="max-w-3xl font-display text-4xl font-bold tracking-[-0.03em] text-ink sm:text-5xl">
        {title}
      </h1>
      <div className="mt-5 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg">{children}</div>
    </section>
  );
}
