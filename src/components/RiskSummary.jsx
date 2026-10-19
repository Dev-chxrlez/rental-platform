import { formatPrice } from "../lib/listings";
import { factorDisplay, riskBandLabel } from "../lib/rentalRequests";

const factorKeys = ["verification", "replacement_value", "rental_duration", "history"];

const bandClass = {
  low: "border-brand/25 bg-brand-soft text-brand-strong",
  medium: "border-amber-300 bg-accent-soft text-[#78500a]",
  high: "border-red-200 bg-red-50 text-red-800",
};

export default function RiskSummary({ request, compact = false }) {
  const factors = request.risk_factors ?? {};
  const safeguards = Array.isArray(request.safeguard_requirements)
    ? request.safeguard_requirements
    : [];

  return (
    <section className={`${compact ? "mt-5" : "mt-7"}`} aria-labelledby={`risk-${request.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={`risk-${request.id}`} className="text-lg font-black text-ink">Risk decision</h3>
        <span className={`rounded-full border px-3 py-1 text-sm font-black ${bandClass[request.risk_band] ?? bandClass.medium}`}>
          {riskBandLabel(request.risk_band)} risk · {request.risk_score}/100
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-ink-muted">{request.risk_explanation}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {factorKeys.map((key) => {
          const factor = factors[key];
          if (!factor) return null;
          return (
            <div key={key} className="rounded-xl border border-line bg-white p-3">
              <dt className="text-sm font-bold text-ink">{factor.label}</dt>
              <dd className="mt-1 text-sm text-ink-muted">
                {factorDisplay(key, factor)} · {factor.points} points
              </dd>
              {factor.note && <dd className="mt-1 text-sm leading-5 text-ink-soft">{factor.note}</dd>}
            </div>
          );
        })}
      </dl>

      <div className="mt-4 rounded-xl border border-line bg-[#f7f4ed] p-4">
        <h4 className="text-sm font-black uppercase tracking-[0.12em] text-ink">Required safeguards</h4>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-ink-muted">
          {safeguards.map((safeguard) => (
            <li key={safeguard.code} className="flex gap-2">
              <span className="font-black text-brand" aria-hidden="true">•</span>
              <span>
                {safeguard.label}
                {safeguard.amount != null && ` Required amount: ${formatPrice(safeguard.amount)}.`}
              </span>
            </li>
          ))}
        </ul>
        {Number(request.required_deposit) > 0 && (
          <p className="mt-3 border-t border-line pt-3 text-sm font-bold text-ink">
            Required deposit: {formatPrice(request.required_deposit)}
            <span className="mt-1 block font-normal text-ink-muted">{request.deposit_verified_at ? "Deposit verified by the owner." : request.deposit_submitted_at ? "Receipt submitted and waiting for owner verification." : "The renter must submit this deposit before the owner can accept the request."}</span>
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-ink-soft">Rule version: {request.rule_version}</p>
    </section>
  );
}
