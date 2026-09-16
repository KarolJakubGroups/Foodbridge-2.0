/* FoodBridge 2.0 – Single-page React frontend (served statically by Spring Boot). */
const { useState, useEffect, useMemo, useCallback } = React;

/* ---------- API helper ---------- */
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data && data.error ? data.error : `Request failed (${res.status})`;
    const fields = data && data.fields ? Object.entries(data.fields).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
    throw new Error(fields ? `${msg} (${fields})` : msg);
  }
  return data;
}

/* ---------- formatting ---------- */
const pad = (n) => String(n).padStart(2, '0');
function fmtDateTime(iso) {
  if (!iso) return '–';
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtDate(iso) {
  if (!iso) return '–';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
function fmtKg(n) {
  return `${Number(n || 0).toLocaleString('de-CH', { maximumFractionDigits: 1 })} kg`;
}
function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const TEMPERATURES = [
  { value: 'AMBIENT', label: 'Ambient (+18°)' },
  { value: 'CHILLED', label: 'Gekühlt (+2° bis +5°)' },
  { value: 'FROZEN', label: 'Tiefkühl (−18°)' },
];
const TEMP_LABEL = Object.fromEntries(TEMPERATURES.map((t) => [t.value, t.label]));

const ROLE_LABEL = { DONOR: 'Spender', FOODBANK: 'Abgabestelle', DISPATCHER: 'Disponent' };

/* ---------- small UI atoms (Slate ERP style) ---------- */
function Badge({ status }) {
  const styles = {
    AVAILABLE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    CLAIMED: 'bg-amber-100 text-amber-800 border-amber-200',
    BUNDLED: 'bg-sky-100 text-sky-800 border-sky-200',
    COMPLETED: 'bg-slate-200 text-slate-700 border-slate-300',
    PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    DISPATCHED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };
  return (
    <span className={`mono inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${styles[status] || 'bg-slate-100 border-slate-200'}`}>
      {status}
    </span>
  );
}

function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-md shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            {title && <h2 className="text-sm font-bold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}
const inputCls = 'w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400';
const btnPrimary = 'bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded disabled:opacity-50';
const btnDark = 'bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50';
const btnGhost = 'border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50';

function Alert({ kind = 'error', children, onClose }) {
  const cls = kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800';
  return (
    <div className={`flex items-start justify-between gap-3 border rounded px-3 py-2 text-xs mb-4 ${cls}`}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} className="font-bold">×</button>}
    </div>
  );
}

function Table({ columns, rows, empty = 'Keine Einträge.', rowKey }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 text-left text-slate-600 border-b border-slate-200">
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-bold ${c.className || ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-slate-400">{empty}</td></tr>
          )}
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-slate-100 hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className={`px-3 py-2 align-top ${c.className || ''}`}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImpactChip({ impact }) {
  if (!impact) return null;
  return (
    <div className="mono text-[11px] bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-700">
      CO₂-Einsparung: <b>{fmtKg(impact.co2SavedKg)}</b> | Mahlzeiten: <b>{impact.meals}</b> | Gerettet: <b>{fmtKg(impact.totalWeightKg)}</b>
    </div>
  );
}

/* ---------- Login ---------- */
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('password');
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/api/auth/accounts').then(setAccounts).catch(() => {}); }, []);

  const doLogin = async (u, p) => {
    setBusy(true); setError(null);
    try {
      const user = await api('/api/auth/login', { method: 'POST', body: { username: u, password: p } });
      onLogin(user);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <Card title="Anmeldung FoodBridge 2.0" subtitle="B2B-Plattform zur Lebensmittelrettung der Stiftung Schweizer Tafel">
        {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); doLogin(username, password); }}>
          <Field label="Kennung"><input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus /></Field>
          <Field label="Passwort"><input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <button className={`${btnPrimary} w-full`} disabled={busy}>Anmelden</button>
        </form>
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-[11px] font-bold text-slate-600 mb-2">Schnellauswahl Test-Accounts (Passwort: password)</p>
          <div className="grid grid-cols-2 gap-2">
            {accounts.map((a) => (
              <button key={a.id} onClick={() => doLogin(a.username, 'password')} disabled={busy}
                className="text-left border border-slate-300 rounded px-3 py-2 hover:bg-slate-50">
                <div className="mono text-xs font-bold">{a.username}</div>
                <div className="text-[10px] text-slate-500">{ROLE_LABEL[a.role]} · {a.organizationName}</div>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Donor dashboard ---------- */
const EMPTY_FORM = () => ({
  productName: '', temperatureRange: 'AMBIENT', bestBeforeDate: '', pickupAddress: '',
  numberOfPallets: '', weightPerPallet: '', overlapStart: '', overlapEnd: '',
});

function DonorDashboard({ user }) {
  const [form, setForm] = useState(EMPTY_FORM());
  const [donations, setDonations] = useState([]);
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [d, i] = await Promise.all([api(`/api/donations/donor/${user.id}`), api(`/api/impact/donor/${user.id}`)]);
    setDonations(d); setImpact(i);
  }, [user.id]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (form.overlapEnd <= form.overlapStart) { setError('Das Abholzeitfenster-Ende muss nach dem Beginn liegen.'); return; }
    setBusy(true);
    try {
      await api('/api/donations', {
        method: 'POST',
        body: {
          donorId: user.id,
          productName: form.productName,
          temperatureRange: form.temperatureRange,
          bestBeforeDate: form.bestBeforeDate,
          pickupAddress: form.pickupAddress,
          numberOfPallets: Number(form.numberOfPallets),
          weightPerPallet: Number(form.weightPerPallet),
          overlapStart: form.overlapStart,
          overlapEnd: form.overlapEnd,
        },
      });
      setForm(EMPTY_FORM());
      setSuccess('Angebot freigegeben. Es ist jetzt für Abgabestellen sichtbar.');
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return donations.filter((d) => !q || d.productName.toLowerCase().includes(q) || d.status.toLowerCase().includes(q));
  }, [donations, query]);

  return (
    <div className="space-y-4">
      <Card
        title={`Spender-Verwaltung: ${user.username.toUpperCase()}`}
        subtitle="Erfassung überschüssiger Artikel und Freigabe der Abholzeitfenster."
        actions={<>
          <ImpactChip impact={impact} />
          <button className={`${btnDark} no-print`} onClick={() => window.print()}>Compliance-Nachweis (PDF / Druck)</button>
        </>}
      >
        <p className="text-xs text-slate-500">{user.organizationName} · {user.address}</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-2 no-print" title="Neues Angebot registrieren" subtitle="7 Pflichtfelder gemäss Schweizer Tafel">
          {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
          {success && <Alert kind="ok" onClose={() => setSuccess(null)}>{success}</Alert>}
          <form onSubmit={submit} className="grid grid-cols-2 gap-3">
            <Field label="Produkt *"><input className={inputCls} value={form.productName} onChange={set('productName')} required maxLength={120} /></Field>
            <Field label="Temperatur *">
              <select className={inputCls} value={form.temperatureRange} onChange={set('temperatureRange')} required>
                {TEMPERATURES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="MHD (Mindesthaltbarkeit) *"><input type="date" className={inputCls} value={form.bestBeforeDate} onChange={set('bestBeforeDate')} required /></Field>
            <Field label="Abholadresse *"><input className={inputCls} value={form.pickupAddress} onChange={set('pickupAddress')} required /></Field>
            <Field label="Anzahl Paletten *"><input type="number" min="1" step="1" className={inputCls} value={form.numberOfPallets} onChange={set('numberOfPallets')} required /></Field>
            <Field label="Gewicht / Palette (kg) *"><input type="number" min="0.1" step="0.1" className={inputCls} value={form.weightPerPallet} onChange={set('weightPerPallet')} required /></Field>
            <div className="col-span-2"><Field label="Abholzeitfenster Beginn *"><input type="datetime-local" className={inputCls} value={form.overlapStart} onChange={set('overlapStart')} required /></Field></div>
            <div className="col-span-2"><Field label="Abholzeitfenster Ende *"><input type="datetime-local" className={inputCls} value={form.overlapEnd} onChange={set('overlapEnd')} required /></Field></div>
            <div className="col-span-2"><button className={`${btnPrimary} w-full`} disabled={busy}>Angebot freigeben</button></div>
          </form>
        </Card>

        <Card className="lg:col-span-3" title="Registrierte Bestandsangebote"
          actions={<input className={`${inputCls} w-56 no-print`} placeholder="Suchen nach Artikel/Status…" value={query} onChange={(e) => setQuery(e.target.value)} />}>
          <Table
            rowKey={(d) => d.id}
            rows={filtered}
            columns={[
              { key: 'p', label: 'Artikel', render: (d) => <b>{d.productName}</b> },
              { key: 't', label: 'Temp.', render: (d) => <span className="text-slate-600">{TEMP_LABEL[d.temperatureRange]}</span> },
              { key: 'm', label: 'Menge', className: 'mono', render: (d) => `${d.totalWeightKg} kg (${d.numberOfPallets} Pal)` },
              { key: 'w', label: 'Verfügbares Abholfenster', className: 'mono', render: (d) => `${fmtDateTime(d.overlapStart)} – ${fmtDateTime(d.overlapEnd)}` },
              { key: 'mhd', label: 'MHD', className: 'mono', render: (d) => fmtDate(d.bestBeforeDate) },
              { key: 's', label: 'Status', render: (d) => <Badge status={d.status} /> },
              { key: 'c', label: 'Erfasst am', className: 'mono text-slate-500', render: (d) => fmtDateTime(d.createdAt) },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

/* ---------- Foodbank dashboard ---------- */
function FoodbankDashboard({ user }) {
  const [available, setAvailable] = useState([]);
  const [claims, setClaims] = useState([]);
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [a, c, i] = await Promise.all([
      api('/api/donations/available'), api(`/api/claims/foodbank/${user.id}`), api(`/api/impact/foodbank/${user.id}`),
    ]);
    setAvailable(a); setClaims(c); setImpact(i);
  }, [user.id]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const claim = async (donationId) => {
    setBusyId(donationId); setError(null);
    try {
      await api('/api/claims', { method: 'POST', body: { donationId, foodbankId: user.id } });
      await load();
    } catch (e) { setError(e.message); } finally { setBusyId(null); }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter((d) => !q || d.productName.toLowerCase().includes(q) || d.donor.username.toLowerCase().includes(q));
  }, [available, query]);

  return (
    <div className="space-y-4">
      <Card title={`Abgabestelle Allokation: ${user.username.toUpperCase()}`}
        subtitle="Übersicht verfügbarer Lebensmitteleinheiten gemäss 4-Tage-Sicherheitskriterium."
        actions={<ImpactChip impact={impact} />}>
        <p className="text-xs text-slate-500">{user.organizationName} · {user.address}</p>
      </Card>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3" title="Verfügbare Bestände (Nationale Übersicht)"
          subtitle="Angebote älter als 4 Tage werden automatisch ausgeblendet."
          actions={<input className={`${inputCls} w-48`} placeholder="Filter Partner/Artikel…" value={query} onChange={(e) => setQuery(e.target.value)} />}>
          <Table
            rowKey={(d) => d.id}
            rows={filtered}
            empty="Aktuell keine frischen Angebote verfügbar."
            columns={[
              { key: 'd', label: 'Spender', render: (d) => <b>{d.donor.username}</b> },
              { key: 'p', label: 'Artikel', render: (d) => d.productName },
              { key: 't', label: 'Temp.', render: (d) => <span className="text-slate-600">{TEMP_LABEL[d.temperatureRange]}</span> },
              { key: 'm', label: 'Menge', className: 'mono', render: (d) => `${d.totalWeightKg} kg (${d.numberOfPallets} Pal)` },
              { key: 'mhd', label: 'MHD', className: 'mono', render: (d) => fmtDate(d.bestBeforeDate) },
              { key: 'w', label: 'Abholfenster Ende', className: 'mono', render: (d) => fmtDateTime(d.overlapEnd) },
              { key: 'a', label: 'Aktion', render: (d) => <button className={btnDark} disabled={busyId === d.id} onClick={() => claim(d.id)}>Reservieren</button> },
            ]}
          />
        </Card>
        <Card className="lg:col-span-2" title="Ihre reservierten Allokationen" subtitle="Geplant für Galliker-Logistikkonsolidierung.">
          <Table
            rowKey={(c) => c.id}
            rows={claims}
            columns={[
              { key: 'd', label: 'Spender', render: (c) => <b>{c.donation.donor.username}</b> },
              { key: 'p', label: 'Artikel', render: (c) => c.donation.productName },
              { key: 'm', label: 'Menge', className: 'mono', render: (c) => `${c.donation.totalWeightKg} kg (${c.donation.numberOfPallets} Pal)` },
              { key: 's', label: 'Status', render: (c) => <Badge status={c.donation.status} /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

/* ---------- Dispatcher dashboard ---------- */
function OrderCard({ order, index, onAction, readOnly }) {
  return (
    <div className="border border-slate-200 rounded-md">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] text-slate-500">AUFTRAG #{order.id}</span>
          <Badge status={order.status} />
          <span className="text-xs font-bold">Abholstandort Spender: {order.donor.username}</span>
          <span className="text-[11px] text-slate-500 hidden md:inline">{order.donor.address}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="mono text-[11px]">Termin: <b>{fmtDateTime(order.pickupTime)}</b></span>
          <span className="mono text-[11px] text-slate-600">{fmtKg(order.totalWeightKg)} / {order.totalPallets} Pal</span>
          {order.driverName && <span className="mono text-[11px] text-slate-600">Fahrer: {order.driverName}</span>}
          {!readOnly && order.status === 'PENDING' && <>
            <button className="bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-bold px-3 py-1 rounded" onClick={() => onAction('driver', order)}>Fahrer zuweisen</button>
            <button className={btnDark} onClick={() => onAction('DISPATCHED', order)}>Disponieren</button>
          </>}
          {!readOnly && order.status === 'DISPATCHED' && (
            <button className={btnPrimary.replace('px-4 py-2', 'px-3 py-1')} onClick={() => onAction('COMPLETED', order)}>Abschliessen</button>
          )}
        </div>
      </div>
      <Table
        rowKey={(d) => d.id}
        rows={order.donations}
        columns={[
          { key: 'p', label: 'Artikel', render: (d) => <b>{d.productName}</b> },
          { key: 't', label: 'Temp.', render: (d) => <span className="text-slate-600">{TEMP_LABEL[d.temperatureRange]}</span> },
          { key: 'm', label: 'Menge', className: 'mono', render: (d) => `${d.totalWeightKg} kg (${d.numberOfPallets} Pal)` },
          { key: 'w', label: 'Individuelles Zeitfenster (Start – Ende)', className: 'mono', render: (d) => `${fmtDateTime(d.overlapStart)} – ${fmtDateTime(d.overlapEnd)}` },
          { key: 's', label: 'Positionsstatus', render: (d) => <span className="mono text-[10px] text-slate-600">{d.status}</span> },
        ]}
      />
    </div>
  );
}

function DispatcherDashboard() {
  const [orders, setOrders] = useState([]);
  const [claimedCount, setClaimedCount] = useState(0);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [o, d] = await Promise.all([api('/api/logistics/orders'), api('/api/donations')]);
    setOrders(o);
    setClaimedCount(d.filter((x) => x.status === 'CLAIMED').length);
  }, []);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const bundle = async () => {
    setBusy(true); setError(null); setInfo(null);
    try {
      const created = await api('/api/logistics/bundle', { method: 'POST' });
      const positions = created.reduce((n, o) => n + o.donations.length, 0);
      setInfo(created.length === 0
        ? 'Keine neuen beanspruchten Spenden zur Bündelung vorhanden.'
        : `${positions} Spende(n) zu ${created.length} Transportauftrag/-aufträgen für Galliker konsolidiert.`);
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const onAction = async (action, order) => {
    setError(null);
    try {
      if (action === 'driver') {
        const name = window.prompt('Name des Galliker-Fahrers:', order.driverName || '');
        if (!name || !name.trim()) return;
        await api(`/api/logistics/orders/${order.id}/driver`, { method: 'PATCH', body: { driverName: name } });
      } else {
        await api(`/api/logistics/orders/${order.id}/status`, { method: 'PATCH', body: { status: action } });
      }
      await load();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card title="Galliker Logistik-Konsolidierungszentrum"
        subtitle="Mathematische Schnittmengenberechnung zur Optimierung von Abholfenstern (Intervall-Scheduling)."
        actions={<button className={btnDark} onClick={bundle} disabled={busy}>Schnittmengenberechnung starten (Bündelung)</button>}>
        <p className="mono text-[11px] text-slate-600">Beanspruchte Spenden ohne Transportauftrag: <b>{claimedCount}</b></p>
      </Card>
      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {info && <Alert kind="ok" onClose={() => setInfo(null)}>{info}</Alert>}
      <Card title={`Disponierte Transportaufträge (${orders.length})`}>
        {orders.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Noch keine Transportaufträge. Bündelung starten.</p>}
        <div className="space-y-3">
          {orders.map((o, i) => <OrderCard key={o.id} order={o} index={i} onAction={onAction} />)}
        </div>
      </Card>
    </div>
  );
}

/* ---------- Logistics network (read-only, all roles) ---------- */
function Kpi({ label, value, unit }) {
  return (
    <div className="bg-white border border-slate-200 rounded-md px-4 py-3">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="mono text-xl font-bold text-slate-900">{value} <span className="text-xs text-slate-500">{unit}</span></div>
    </div>
  );
}

function LogisticsNetwork() {
  const [orders, setOrders] = useState([]);
  const [impact, setImpact] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    Promise.all([api('/api/logistics/orders'), api('/api/impact')])
      .then(([o, i]) => { setOrders(o); setImpact(i); })
      .catch((e) => setError(e.message));
  }, []);
  const byStatus = (s) => orders.filter((o) => o.status === s).length;
  return (
    <div className="space-y-4">
      <Card title="Logistik-Netzwerk & Wirkungsbilanz" subtitle="Nationale Übersicht aller Galliker-Transportaufträge und des Impact-Trackings.">
        {error && <Alert>{error}</Alert>}
        {impact && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Gerettetes Gewicht" value={impact.totalWeightKg.toLocaleString('de-CH')} unit="kg" />
            <Kpi label="Mahlzeiten" value={impact.meals.toLocaleString('de-CH')} unit="Portionen" />
            <Kpi label="CO₂-Einsparung" value={impact.co2SavedKg.toLocaleString('de-CH')} unit="kg CO₂e" />
            <Kpi label="Transportaufträge" value={orders.length} unit={`(${byStatus('PENDING')} offen · ${byStatus('DISPATCHED')} unterwegs · ${byStatus('COMPLETED')} erledigt)`} />
          </div>
        )}
      </Card>
      <Card title="Transportaufträge">
        {orders.length === 0 && <p className="text-xs text-slate-400 py-4 text-center">Noch keine Transportaufträge disponiert.</p>}
        <div className="space-y-3">{orders.map((o, i) => <OrderCard key={o.id} order={o} index={i} readOnly />)}</div>
      </Card>
    </div>
  );
}

/* ---------- Wishlist (Bedarfsanforderungen) ---------- */
function WishlistView({ user }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ productName: '', quantityKg: '', note: '' });
  const [error, setError] = useState(null);
  const load = useCallback(() => api('/api/wishlists').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault(); setError(null);
    try {
      await api('/api/wishlists', { method: 'POST', body: { foodbankId: user.id, productName: form.productName, quantityKg: Number(form.quantityKg), note: form.note } });
      setForm({ productName: '', quantityKg: '', note: '' });
      await load();
    } catch (err) { setError(err.message); }
  };
  const remove = async (id) => {
    try { await api(`/api/wishlists/${id}`, { method: 'DELETE' }); await load(); } catch (err) { setError(err.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {user.role === 'FOODBANK' && (
        <Card className="lg:col-span-2" title="Bedarf veröffentlichen" subtitle="Spender sehen Ihren spezifischen Bedarf.">
          {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
          <form onSubmit={submit} className="space-y-3">
            <Field label="Produkt *"><input className={inputCls} value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} required /></Field>
            <Field label="Menge (kg) *"><input type="number" min="1" step="1" className={inputCls} value={form.quantityKg} onChange={(e) => setForm({ ...form, quantityKg: e.target.value })} required /></Field>
            <Field label="Hinweis"><input className={inputCls} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
            <button className={`${btnPrimary} w-full`}>Bedarf melden</button>
          </form>
        </Card>
      )}
      <Card className={user.role === 'FOODBANK' ? 'lg:col-span-3' : 'lg:col-span-5'} title="Bedarfsanforderungen sozialer Institutionen">
        {user.role !== 'FOODBANK' && error && <Alert onClose={() => setError(null)}>{error}</Alert>}
        <Table
          rowKey={(w) => w.id}
          rows={items}
          columns={[
            { key: 'f', label: 'Institution', render: (w) => <b>{w.foodbank.organizationName}</b> },
            { key: 'p', label: 'Produkt', render: (w) => w.productName },
            { key: 'q', label: 'Menge', className: 'mono', render: (w) => fmtKg(w.quantityKg) },
            { key: 'n', label: 'Hinweis', render: (w) => <span className="text-slate-600">{w.note || '–'}</span> },
            { key: 'c', label: 'Gemeldet am', className: 'mono text-slate-500', render: (w) => fmtDateTime(w.createdAt) },
            ...(user.role === 'FOODBANK' ? [{ key: 'a', label: '', render: (w) => w.foodbank.id === user.id && <button className={btnGhost} onClick={() => remove(w.id)}>Erledigt</button> }] : []),
          ]}
        />
      </Card>
    </div>
  );
}

/* ---------- App shell ---------- */
function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('foodbridge.user')); } catch { return null; }
  });
  const [view, setView] = useState('dashboard');

  const login = (u) => { setUser(u); setView('dashboard'); try { localStorage.setItem('foodbridge.user', JSON.stringify(u)); } catch {} };
  const logout = () => { setUser(null); try { localStorage.removeItem('foodbridge.user'); } catch {} };

  const NavBtn = ({ id, children }) => (
    <button onClick={() => setView(id)}
      className={`text-xs px-3 py-1.5 rounded ${view === id ? 'bg-slate-700 text-white' : 'text-slate-300 hover:text-white'}`}>
      {children}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-black tracking-wide text-sm">SCHWEIZER TAFEL</span>
            <span className="text-slate-400 text-xs">|</span>
            <span className="text-xs font-bold">FoodBridge 2.0 B2B Portal</span>
          </div>
          {user && (
            <nav className="flex items-center gap-1">
              <NavBtn id="dashboard">Disposition</NavBtn>
              <NavBtn id="network">Logistik-Netzwerk</NavBtn>
              <NavBtn id="wishlist">Bedarfsanforderungen</NavBtn>
            </nav>
          )}
          {user && (
            <div className="flex items-center gap-2">
              <span className="mono text-[11px] bg-slate-800 border border-slate-700 px-2 py-1 rounded">{user.username} [{user.role}]</span>
              <button onClick={logout} className="bg-red-700 hover:bg-red-800 text-xs font-bold px-3 py-1 rounded">Abmelden</button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        {!user && <LoginScreen onLogin={login} />}
        {user && view === 'dashboard' && user.role === 'DONOR' && <DonorDashboard user={user} />}
        {user && view === 'dashboard' && user.role === 'FOODBANK' && <FoodbankDashboard user={user} />}
        {user && view === 'dashboard' && user.role === 'DISPATCHER' && <DispatcherDashboard user={user} />}
        {user && view === 'network' && <LogisticsNetwork />}
        {user && view === 'wishlist' && <WishlistView user={user} />}
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500">
          <span>© 2026 Stiftung Schweizer Tafel — Nationale Plattform für B2B-Lebensmittelrettung</span>
          <span>System: Spring Boot 3 / React 18 · <a className="underline" href="/h2-console" target="_blank" rel="noreferrer">H2-Konsole</a></span>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
