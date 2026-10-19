export default function FormField({ label, id, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {hint && <p className="mt-1 text-sm leading-5 text-ink-muted">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && (
        <p className="mt-2 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClassName =
  "min-h-12 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-ink-soft hover:border-ink-soft/60 focus:border-brand focus:ring-3 focus:ring-brand/15 disabled:cursor-not-allowed disabled:bg-[#f1eee7] disabled:text-ink-muted";
