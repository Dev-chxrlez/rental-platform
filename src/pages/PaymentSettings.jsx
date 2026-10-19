import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import FormField, { inputClassName } from "../components/FormField";
import { supabase } from "../lib/supabase";

const methodInfo = {
  gcash: { title: "GCash", referenceLabel: "GCash mobile number", placeholder: "09XX XXX XXXX" },
  bank: { title: "Bank transfer", referenceLabel: "Bank and account number", placeholder: "Bank name · account number" },
};

function extensionFor(file) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function PaymentMethodForm({ type, method, qrUrl, onChanged }) {
  const { user } = useAuth();
  const info = methodInfo[type];
  const [accountName, setAccountName] = useState(method?.account_name ?? "");
  const [reference, setReference] = useState(method?.account_reference ?? "");
  const [enabled, setEnabled] = useState(method?.is_enabled ?? true);
  const [qrFile, setQrFile] = useState(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const previewUrl = useMemo(() => qrFile ? URL.createObjectURL(qrFile) : "", [qrFile]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    setAccountName(method?.account_name ?? "");
    setReference(method?.account_reference ?? "");
    setEnabled(method?.is_enabled ?? true);
    setQrFile(null);
    setRemoveQr(false);
  }, [method]);

  async function save(event) {
    event.preventDefault();
    setError(""); setMessage("");
    const cleanName = accountName.trim();
    const cleanReference = reference.trim();
    if (cleanName.length < 2) { setError("Enter the account holder name."); return; }
    if (!cleanReference && !qrFile && (!method?.qr_path || removeQr)) { setError("Add an account number or a QR image."); return; }
    if (qrFile && !["image/jpeg", "image/png", "image/webp"].includes(qrFile.type)) { setError("Use a JPG, PNG, or WebP QR image."); return; }
    if (qrFile && qrFile.size > 3 * 1024 * 1024) { setError("Use a QR image no larger than 3 MB."); return; }

    setIsSaving(true);
    let uploadedPath = "";
    if (qrFile) {
      uploadedPath = `${user.id}/${type}-${crypto.randomUUID()}.${extensionFor(qrFile)}`;
      const { error: uploadError } = await supabase.storage.from("payment-qr-codes").upload(uploadedPath, qrFile, { contentType: qrFile.type });
      if (uploadError) { setError(`QR upload failed: ${uploadError.message}`); setIsSaving(false); return; }
    }

    const payload = {
      account_name: cleanName,
      account_reference: cleanReference || null,
      qr_path: uploadedPath || (removeQr ? null : method?.qr_path ?? null),
      is_enabled: enabled,
    };
    const result = method
      ? await supabase.from("payment_methods").update(payload).eq("id", method.id)
      : await supabase.from("payment_methods").insert({ method: type, ...payload });

    if (result.error) {
      if (uploadedPath) await supabase.storage.from("payment-qr-codes").remove([uploadedPath]);
      setError(result.error.message); setIsSaving(false); return;
    }
    if (method?.qr_path && (uploadedPath || removeQr)) await supabase.storage.from("payment-qr-codes").remove([method.qr_path]);
    setMessage(`${info.title} payment details saved.`);
    setIsSaving(false);
    await onChanged();
  }

  async function removeMethod() {
    if (!method || !window.confirm(`Remove your ${info.title} payment details?`)) return;
    setError(""); setMessage(""); setIsSaving(true);
    const { error: deleteError } = await supabase.from("payment_methods").delete().eq("id", method.id);
    if (deleteError) { setError(deleteError.message); setIsSaving(false); return; }
    if (method.qr_path) await supabase.storage.from("payment-qr-codes").remove([method.qr_path]);
    setIsSaving(false);
    await onChanged();
  }

  const shownQr = previewUrl || (!removeQr ? qrUrl : "");
  return (
    <form onSubmit={save} className="panel p-5 sm:p-7" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-black text-ink">{info.title}</h2><p className="mt-1 text-sm leading-6 text-ink-muted">Shared only with renters after you accept their request.</p></div>
        {method && <span className={`rounded-full px-2.5 py-1 text-xs font-black ${enabled ? "bg-brand-soft text-brand-strong" : "bg-[#ebe7df] text-ink-muted"}`}>{enabled ? "Enabled" : "Hidden"}</span>}
      </div>
      <div className="mt-6 space-y-5">
        <FormField label="Account holder name" id={`${type}-account-name`}><input id={`${type}-account-name`} value={accountName} onChange={(event) => setAccountName(event.target.value)} maxLength={120} className={inputClassName} required /></FormField>
        <FormField label={info.referenceLabel} id={`${type}-reference`} hint="Only provide the information needed to identify where payment should be sent."><input id={`${type}-reference`} value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} placeholder={info.placeholder} className={inputClassName} /></FormField>
        <FormField label="Payment QR image" id={`${type}-qr`} hint="Optional JPG, PNG, or WebP, up to 3 MB."><input id={`${type}-qr`} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setQrFile(event.target.files?.[0] ?? null); setRemoveQr(false); }} className="block w-full rounded-xl border border-line bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-bold file:text-brand-strong" /></FormField>
        {shownQr && <div><img src={shownQr} alt={`${info.title} payment QR code preview`} className="aspect-square w-full max-w-56 rounded-2xl border border-line bg-white object-contain p-2" />{method?.qr_path && !qrFile && <button type="button" onClick={() => setRemoveQr(true)} className="mt-2 text-sm font-bold text-red-700 hover:underline">Remove QR image</button>}</div>}
        <label className="flex items-start gap-3 rounded-xl border border-line bg-[#f7f4ed] p-4"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-1 h-4 w-4 accent-brand" /><span><span className="block text-sm font-black text-ink">Make this method available</span><span className="mt-1 block text-xs leading-5 text-ink-muted">Accepted renters can view these details while their rental remains active.</span></span></label>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        {message && <p className="rounded-xl border border-brand/20 bg-brand-soft p-3 text-sm text-brand-strong" role="status">{message}</p>}
        <div className="flex flex-col-reverse gap-2 min-[420px]:flex-row min-[420px]:justify-end">{method && <button type="button" onClick={removeMethod} disabled={isSaving} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60">Remove method</button>}<button type="submit" disabled={isSaving} className="button-primary">{isSaving ? "Saving…" : `Save ${info.title}`}</button></div>
      </div>
    </form>
  );
}

export default function PaymentSettings() {
  const [methods, setMethods] = useState({});
  const [qrUrls, setQrUrls] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMethods = useCallback(async () => {
    setIsLoading(true); setError("");
    const { data, error: loadError } = await supabase.from("payment_methods").select("id, owner_id, method, account_name, account_reference, qr_path, is_enabled, updated_at").order("method");
    if (loadError) { setError(loadError.message); setIsLoading(false); return; }
    const nextMethods = Object.fromEntries((data ?? []).map((item) => [item.method, item]));
    const nextUrls = {};
    await Promise.all((data ?? []).filter((item) => item.qr_path).map(async (item) => {
      const { data: signed } = await supabase.storage.from("payment-qr-codes").createSignedUrl(item.qr_path, 3600);
      if (signed?.signedUrl) nextUrls[item.method] = signed.signedUrl;
    }));
    setMethods(nextMethods); setQrUrls(nextUrls); setIsLoading(false);
  }, []);

  useEffect(() => { loadMethods(); }, [loadMethods]);
  if (isLoading) return <p className="m-auto text-base text-ink-muted" role="status">Loading payment details…</p>;
  return (
    <section className="w-full self-start">
      <p className="eyebrow">Owner settings</p>
      <h1 className="mt-3 font-display text-4xl font-bold tracking-[-0.035em] text-ink sm:text-5xl">Payment details</h1>
      <p className="mt-3 max-w-3xl text-base leading-7 text-ink-muted">Add manual payment instructions for accepted rentals. Rental Platform does not process, verify, refund, or guarantee payments.</p>
      <div className="mt-6 rounded-xl border border-[#efd8a4] bg-accent-soft p-4 text-sm leading-6 text-[#76500d]">Never upload PINs, passwords, one-time codes, card numbers, or online-banking login details.</div>
      {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert"><p>{error}</p><p className="mt-2">Apply migration <strong>20260924001200_add_manual_payment_methods.sql</strong>, then reload.</p></div>}
      {!error && <div className="mt-8 grid gap-6 lg:grid-cols-2"><PaymentMethodForm type="gcash" method={methods.gcash} qrUrl={qrUrls.gcash} onChanged={loadMethods} /><PaymentMethodForm type="bank" method={methods.bank} qrUrl={qrUrls.bank} onChanged={loadMethods} /></div>}
      <Link to="/my-listings" className="mt-7 inline-flex text-sm font-bold text-brand-strong hover:underline">← Back to your listings</Link>
    </section>
  );
}
