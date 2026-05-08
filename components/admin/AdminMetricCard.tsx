type AdminMetricCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export function AdminMetricCard({ label, value, hint }: AdminMetricCardProps) {
  return (
    <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-[#12100e] to-[#080706] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.28)]">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-champagne/85">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl tabular-nums text-cream sm:text-4xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-sm leading-relaxed text-[#9a8b78]">{hint}</p>
      ) : null}
    </div>
  );
}
