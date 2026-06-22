import { useState } from 'react';
import logo from '../images/BabaLab.png';

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Small reusable pieces ──────────────────────────────────────────────────────

function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="flex items-start gap-3 border-2 border-red-700 bg-red-50 px-5 py-4 text-base text-red-700"
      style={{ boxShadow: '3px 3px 0 0 #b91c1c' }}>
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="font-bold text-red-500 hover:text-red-700 text-xl leading-none">×</button>
    </div>
  );
}

function SuccessBanner({ message }) {
  return (
    <div className="border-2 border-ink bg-white px-5 py-4 text-base text-ink"
      style={{ boxShadow: '3px 3px 0 0 #1a1a1a' }}>
      ✓ {message}
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handle}
      className="ml-2 shrink-0 border-2 border-ink px-3 py-1 text-sm
                 hover:bg-ink hover:text-white transition-colors duration-100">
      {copied ? 'copied!' : 'copy'}
    </button>
  );
}

function InfoRow({ label, value, copyable }) {
  return (
    <div className="flex items-start gap-3 border-b-2 border-dashed border-gray-300 py-3 last:border-0">
      <span className="w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-500 pt-0.5">
        {label}
      </span>
      <span className="flex-1 break-all text-base text-ink">{value}</span>
      {copyable && <CopyButton text={value} />}
    </div>
  );
}

// ── Create form ────────────────────────────────────────────────────────────────

function CreateForm({ onCreated }) {
  const [url, setUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body = { url };
      if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();
      const data = await apiFetch('/api/qr/create', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(data);
      setUrl('');
      setExpiresAt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <label className="block text-base font-semibold text-ink mb-2">URL</label>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com" required className="input-sketch" />
      </div>
      <div>
        <label className="block text-base font-semibold text-ink mb-2">
          Expires at <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
          className="input-sketch" />
      </div>
      <button type="submit" disabled={loading} className="btn-ink w-full py-4 px-6 text-base">
        {loading ? 'Generating...' : 'Generate QR Code'}
      </button>
    </form>
  );
}

// ── Lookup form ────────────────────────────────────────────────────────────────

function LookupForm({ onLoaded }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const info = await apiFetch(`/api/qr/${token.trim()}`);
      onLoaded({
        token: info.token,
        short_url: `http://localhost:8000/r/${info.token}`,
        qr_code_url: `http://localhost:8000/api/qr/${info.token}/image`,
        original_url: info.original_url,
      });
      setToken('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <div>
        <label className="block text-base font-semibold text-ink mb-2">Token</label>
        <input type="text" value={token} onChange={(e) => setToken(e.target.value)}
          placeholder="e.g. aB3xYz7" required className="input-sketch" />
      </div>
      <button type="submit" disabled={loading} className="btn-ink w-full py-4 px-6 text-base">
        {loading ? 'Looking up...' : 'Lookup'}
      </button>
    </form>
  );
}

// ── Result panel ───────────────────────────────────────────────────────────────

function QRResult({ data, onDeleted }) {
  const { token, short_url, qr_code_url, original_url } = data;

  const [updateUrl, setUpdateUrl] = useState('');
  const [updateExpiry, setUpdateExpiry] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdateSuccess(false);
    setUpdating(true);
    try {
      const body = {};
      if (updateUrl) body.url = updateUrl;
      if (updateExpiry) body.expires_at = new Date(updateExpiry).toISOString();
      await apiFetch(`/api/qr/${token}`, { method: 'PATCH', body: JSON.stringify(body) });
      setUpdateSuccess(true);
      setUpdateUrl('');
      setUpdateExpiry('');
      setTimeout(() => setUpdateSuccess(false), 2500);
    } catch (err) {
      setUpdateError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this QR code? The short link will stop working.')) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/qr/${token}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  };

  const toggleAnalytics = async () => {
    if (showAnalytics) { setShowAnalytics(false); return; }
    setAnalyticsLoading(true);
    try {
      const result = await apiFetch(`/api/qr/${token}/analytics`);
      setAnalytics(result);
      setShowAnalytics(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      {/* QR image + info */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="shrink-0 mx-auto sm:mx-0 flex flex-col items-center gap-3">
          <div className="border-2 border-ink p-3 bg-white" style={{ boxShadow: '5px 5px 0 0 #1a1a1a' }}>
            <img src={qr_code_url} alt="QR Code" className="w-56 h-56 block" />
          </div>
          <a href={qr_code_url} download={`qr-${token}.png`}
            className="text-sm text-ink underline hover:no-underline">
            Download PNG
          </a>
        </div>
        <div className="flex-1 w-full card-sketch px-5 py-2">
          <InfoRow label="token" value={token} copyable />
          <InfoRow label="short url" value={short_url} copyable />
          <InfoRow label="original" value={original_url} copyable />
        </div>
      </div>

      {/* Update form */}
      <div className="card-sketch p-6 space-y-4">
        <h3 className="font-hand text-2xl text-ink">Update</h3>
        {updateError && <ErrorBanner message={updateError} onDismiss={() => setUpdateError(null)} />}
        {updateSuccess && <SuccessBanner message="Updated successfully." />}
        <form onSubmit={handleUpdate} className="space-y-4">
          <input type="url" value={updateUrl} onChange={(e) => setUpdateUrl(e.target.value)}
            placeholder="New URL (leave blank to keep current)" className="input-sketch" />
          <input type="datetime-local" value={updateExpiry} onChange={(e) => setUpdateExpiry(e.target.value)}
            className="input-sketch" />
          <button type="submit" disabled={updating || (!updateUrl && !updateExpiry)}
            className="btn-outline w-full py-4 px-6 text-base">
            {updating ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Analytics */}
      <div className="card-sketch overflow-hidden">
        <button onClick={toggleAnalytics}
          className="w-full flex items-center justify-between px-6 py-4 text-base font-semibold text-ink hover:bg-cream transition-colors">
          <span>Analytics</span>
          <span className="text-gray-400 text-lg">{showAnalytics ? '▲' : '▼'}</span>
        </button>
        {analyticsLoading && (
          <div className="px-6 pb-5 text-sm text-gray-500">Loading...</div>
        )}
        {showAnalytics && analytics && (
          <div className="px-6 pb-5 space-y-4 border-t-2 border-dashed border-gray-300 pt-4">
            <p className="text-5xl font-bold text-ink">
              {analytics.total_scans}
              <span className="text-base font-normal text-gray-500 ml-3">total scans</span>
            </p>
            {analytics.scans_by_day.length === 0 ? (
              <p className="text-sm text-gray-400">No scans yet.</p>
            ) : (
              <table className="w-full text-base">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b-2 border-ink">
                    <th className="text-left pb-2">Date</th>
                    <th className="text-right pb-2">Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.scans_by_day.map((row) => (
                    <tr key={row.date} className="border-b border-dashed border-gray-300">
                      <td className="py-2 text-ink">{row.date}</td>
                      <td className="py-2 text-right text-ink">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Delete */}
      <button onClick={handleDelete} disabled={deleting}
        className="btn-danger w-full py-4 px-6 text-base">
        {deleting ? 'Deleting...' : 'Delete QR Code'}
      </button>
    </div>
  );
}

// ── App root ───────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('create');
  const [qrData, setQrData] = useState(null);

  const handleResult = (data) => setQrData(data);
  const handleDeleted = () => setQrData(null);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b-2 border-ink bg-white" style={{ boxShadow: '0 4px 0 0 #1a1a1a' }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-5">
          <img src={logo} alt="Baba Lab" className="h-20 w-auto" />
          <div>
            <p className="font-hand text-sm text-gray-400 uppercase tracking-widest -mb-1">by baba lab</p>
            <h1 className="font-hand text-4xl text-ink leading-tight">QR Code Generator</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Input card */}
        <div className="card-sketch overflow-hidden">
          <div className="flex border-b-2 border-ink">
            {['create', 'lookup'].map((t) => (
              <button key={t} onClick={() => { setTab(t); setQrData(null); }}
                className={`flex-1 py-4 text-base font-semibold transition-colors duration-100
                  ${tab === t
                    ? 'bg-ink text-white'
                    : 'bg-white text-ink hover:bg-cream'
                  }`}>
                {t === 'create' ? 'Create New' : 'Lookup by Token'}
              </button>
            ))}
          </div>
          <div className="p-8 bg-white">
            {tab === 'create'
              ? <CreateForm onCreated={handleResult} />
              : <LookupForm onLoaded={handleResult} />
            }
          </div>
        </div>

        {/* Result card */}
        {qrData && (
          <div className="card-sketch p-8 bg-white">
            <h2 className="font-hand text-3xl text-ink mb-6 border-b-2 border-dashed border-gray-300 pb-3">
              {tab === 'create' ? 'Your QR Code' : 'Found it'}
            </h2>
            <QRResult key={qrData.token} data={qrData} onDeleted={handleDeleted} />
          </div>
        )}
      </main>
    </div>
  );
}
