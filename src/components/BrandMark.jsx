export default function BrandMark({ compact = false, inverse = false }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-[0.85rem] text-sm font-black tracking-[-0.08em] shadow-[inset_-5px_-5px_0_rgba(15,118,110,0.55)] ${inverse ? "bg-white text-ink" : "bg-ink text-white"}`}
        aria-hidden="true"
      >
        RP
      </span>
      {!compact && (
        <span className={`text-[1.05rem] font-black leading-none tracking-[-0.035em] sm:text-lg ${inverse ? "text-white" : "text-ink"}`}>
          Rental Platform
        </span>
      )}
    </span>
  );
}
