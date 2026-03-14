import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import roadLoginImage from "./assets/road-login.jpg";

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const apiBaseUrl = viteEnv.VITE_API_BASE_URL || "/api";
const assetBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "");
const api = axios.create({ baseURL: apiBaseUrl });

const severityColor = { Small: "#f4b860", Medium: "#ff7b5c", Dangerous: "#ff4d6d" };
const defaultCoords = { latitude: 12.9716, longitude: 77.5946 };

const sectionsByPortal = {
  user: ["overview", "map", "report", "track", "alerts"],
  authority: ["overview", "map", "analytics", "queue"],
};

function getImageUrl(photoUrl) {
  if (!photoUrl) return "";
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;
  if (photoUrl.startsWith("/")) return `${assetBaseUrl}${photoUrl}`;
  return photoUrl;
}

function getHashSection() {
  if (typeof window === "undefined") return "overview";
  return window.location.hash.replace(/^#/, "") || "overview";
}

function isValidSection(portalMode, section) {
  return sectionsByPortal[portalMode]?.includes(section);
}

function App() {
  const [potholes, setPotholes] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filter, setFilter] = useState("All");
  const [portalMode, setPortalMode] = useState("user");
  const [activeSection, setActiveSection] = useState("overview");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "SB User", email: "sb@gmail.com", password: "1234" });
  const [session, setSession] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [reportForm, setReportForm] = useState({
    latitude: defaultCoords.latitude,
    longitude: defaultCoords.longitude,
    description: "",
    image: null,
  });
  const [reportMessage, setReportMessage] = useState("");
  const [nearbyAlerts, setNearbyAlerts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!session) return;
    Promise.all([api.get("/potholes"), api.get("/analytics/summary")]).then(([potholeRes, analyticsRes]) => {
      setPotholes(potholeRes.data);
      setAnalytics(analyticsRes.data);
    });
  }, [session]);

  useEffect(() => {
    const nextSection = isValidSection(portalMode, getHashSection()) ? getHashSection() : "overview";
    setActiveSection(nextSection);
    const onHashChange = () => {
      const section = getHashSection();
      setActiveSection(isValidSection(portalMode, section) ? section : "overview");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [portalMode]);

  const filteredPotholes = useMemo(
    () => (filter === "All" ? potholes : potholes.filter((item) => item.severity === filter)),
    [filter, potholes]
  );

  const chartData = useMemo(
    () => [
      { name: "Dangerous", count: potholes.filter((item) => item.severity === "Dangerous").length },
      { name: "Medium", count: potholes.filter((item) => item.severity === "Medium").length },
      { name: "Small", count: potholes.filter((item) => item.severity === "Small").length },
    ],
    [potholes]
  );

  const myReports = useMemo(
    () => (session ? potholes.filter((item) => item.reporter_id === session.userId) : []),
    [potholes, session]
  );

  const myReportChartData = useMemo(() => {
    const source = myReports.length ? myReports : potholes.slice(0, 6);
    return source.map((item) => ({
      name: `#${item.id}`,
      diameter: item.diameter,
    }));
  }, [myReports, potholes]);

  const statusCounts = useMemo(
    () =>
      potholes.reduce(
        (acc, item) => {
          const key = item.status.toLowerCase().replace(/\s+/g, "-");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        { pending: 0, "under-repair": 0, fixed: 0 }
      ),
    [potholes]
  );

  const dashboardOptions =
    portalMode === "authority"
      ? [
          { id: "overview", title: "Overview", description: "See authority quick access pages." },
          { id: "map", title: "Live Map", description: "Monitor potholes across the road network." },
          { id: "analytics", title: "Analytics", description: "Review severity and response trends." },
          { id: "queue", title: "Repair Queue", description: "Manage incident repair workflow." },
        ]
      : [
          { id: "overview", title: "Overview", description: "See your main website pages." },
          { id: "map", title: "Live Map", description: "View potholes and severity near your route." },
          { id: "report", title: "Report Pothole", description: "Submit a new pothole report." },
          { id: "track", title: "Track Reports", description: "Check repair progress for your reports." },
          { id: "alerts", title: "Safety Alerts", description: "Review live nearby travel alerts." },
        ];

  const heroStats = [
    { label: "Total reports", value: analytics?.total_reports ?? 0, tone: "neutral" },
    { label: "Dangerous now", value: analytics?.dangerous_count ?? 0, tone: "danger" },
    { label: "Pending action", value: analytics?.pending_count ?? 0, tone: "warm" },
    { label: "Repairs closed", value: analytics?.fixed_count ?? 0, tone: "cool" },
  ];

  const topAlert = nearbyAlerts[0]?.message || "No live warning at current coordinates.";

  const navigateToSection = (section) => {
    const nextSection = isValidSection(portalMode, section) ? section : "overview";
    setActiveSection(nextSection);
    window.location.hash = nextSection;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadData = async () => {
    const [potholeRes, analyticsRes] = await Promise.all([api.get("/potholes"), api.get("/analytics/summary")]);
    setPotholes(potholeRes.data);
    setAnalytics(analyticsRes.data);
  };

  const authenticate = async (event) => {
    event.preventDefault();
    setAuthMessage("");
    try {
      const endpoint = authMode === "signup" ? "/auth/signup" : "/auth/login";
      const payload = authMode === "signup" ? authForm : { email: authForm.email, password: authForm.password };
      const response = await api.post(endpoint, payload);
      setSession({ token: response.data.access_token, userId: response.data.user_id, name: response.data.name, email: authForm.email });
      navigateToSection("overview");
      setReportMessage(`Signed in as ${response.data.name}.`);
    } catch (error) {
      setAuthMessage(error.response?.data?.detail || "Authentication failed.");
    }
  };

  const detectLocation = async () => {
    if (!navigator.geolocation) return setReportMessage("Geolocation is not available in this browser.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCoords = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };
        setReportForm((current) => ({ ...current, ...nextCoords }));
        try {
          const response = await api.get("/nearby-potholes", { params: { ...nextCoords, radius: 150 } });
          setNearbyAlerts(response.data.alerts || []);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setReportMessage("Location access was denied. You can still enter coordinates manually.");
      }
    );
  };

  const submitReport = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setReportMessage("");
    try {
      const formData = new FormData();
      formData.append("latitude", String(reportForm.latitude));
      formData.append("longitude", String(reportForm.longitude));
      formData.append("description", reportForm.description);
      if (session?.userId) formData.append("reporter_id", String(session.userId));
      if (reportForm.image) formData.append("image", reportForm.image);
      const response = await api.post("/report", formData);
      setReportMessage(`Report submitted. Severity: ${response.data.severity}, diameter: ${response.data.diameter} cm.`);
      setReportForm((current) => ({ ...current, description: "", image: null }));
      await loadData();
    } catch (error) {
      const details = error.response?.data;
      setReportMessage(typeof details === "string" ? details : details?.detail || error.message || "Report failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, status) => {
    await api.put("/status-update", { pothole_id: id, status });
    await loadData();
  };

  const renderMapPage = (title) => (
    <div className="panel premium-panel map-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Live Map</p>
          <h2>{title}</h2>
        </div>
        <div className="pill-switch">
          {["All", "Dangerous", "Medium", "Small"].map((value) => (
            <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
              {value}
            </button>
          ))}
        </div>
      </div>
      <MapContainer center={[defaultCoords.latitude, defaultCoords.longitude]} zoom={13} className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {filteredPotholes.map((item) => (
          <CircleMarker
            key={item.id}
            center={[item.latitude, item.longitude]}
            radius={item.severity === "Dangerous" ? 14 : item.severity === "Medium" ? 10 : 7}
            pathOptions={{ color: severityColor[item.severity], fillOpacity: 0.7 }}
          >
            <Popup>
              <strong>#{item.id} {item.severity}</strong><br />
              Diameter: {item.diameter} cm<br />
              Status: {item.status}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );

  if (!session) {
    return (
      <div className="shell auth-shell">
        <main className="auth-landing">
          <img className="auth-bg-image" src={roadLoginImage} alt="Open road background" />
          <div className="auth-overlay" />
          <section className="auth-content">
            <article className="auth-copy">
              <p className="brand-name">SmartPathole System</p>
              <h1>Road safety starts with one clear login.</h1>
              <p className="auth-lead">Report potholes, track repair progress, and monitor road conditions from a website experience designed for citizens and municipal teams.</p>
            </article>
            <article className="auth-card">
              <div className="logo-badge"><span>SP</span></div>
              <div className="auth-title-block">
                <p className="brand-name">SmartPathole System</p>
                <h2>{portalMode === "authority" ? "Authority Login" : authMode === "signup" ? "Create account" : "User Login"}</h2>
              </div>
              <div className="portal-switch">
                <button type="button" className={portalMode === "user" ? "active" : ""} onClick={() => setPortalMode("user")}>User Login</button>
                <button type="button" className={portalMode === "authority" ? "active" : ""} onClick={() => setPortalMode("authority")}>Authority Login</button>
              </div>
              <div className="pill-switch auth-mode-switch">
                <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>Login</button>
                <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>Sign up</button>
              </div>
              <form className="auth-phone-form" onSubmit={authenticate}>
                {authMode === "signup" && (
                  <label>Full Name<input placeholder="Enter your name" value={authForm.name} onChange={(e) => setAuthForm((c) => ({ ...c, name: e.target.value }))} /></label>
                )}
                <label>Email<input type="email" placeholder="Enter email" value={authForm.email} onChange={(e) => setAuthForm((c) => ({ ...c, email: e.target.value }))} /></label>
                <label>Password<input type="password" placeholder="Enter password" value={authForm.password} onChange={(e) => setAuthForm((c) => ({ ...c, password: e.target.value }))} /></label>
                <button type="submit" className="otp-button">{authMode === "signup" ? "Create Account" : "Continue"} <span aria-hidden="true">→</span></button>
                <p className="auth-helper">{portalMode === "authority" ? "Authority staff can use their email and password to review reports, maps, and repair workflows." : "Use your email and password to enter the command center."}</p>
                {authMessage && <p className="feedback auth-feedback">{authMessage}</p>}
              </form>
            </article>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <header className="site-header premium-panel">
        <div className="site-brand">
          <span className="site-brand-mark">SP</span>
          <div className="site-brand-copy">
            <span className="eyebrow">SmartPathole System</span>
            <strong>{portalMode === "authority" ? "Authority Dashboard" : "User Dashboard"}</strong>
          </div>
        </div>
        <nav className="site-nav" aria-label="Dashboard sections">
          {dashboardOptions.map((option) => (
            <button key={option.id} type="button" className={`site-nav-link ${activeSection === option.id ? "active" : ""}`} onClick={() => navigateToSection(option.id)}>
              {option.title}
            </button>
          ))}
        </nav>
        <div className="site-header-actions">
          <span className="mode-chip">{portalMode === "authority" ? "Authority Portal" : "Citizen Portal"}</span>
          <button type="button" className="top-logout-button" onClick={() => { setSession(null); navigateToSection("overview"); }}>Log out</button>
        </div>
      </header>

      {portalMode === "user" && activeSection === "overview" && (
        <>
          <section className="dashboard-welcome panel premium-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">User Dashboard</p>
                <h2>{`Hello, ${session.name}`}</h2>
              </div>
              <button className="primary-action dashboard-gps-button" type="button" onClick={detectLocation}>
                {locating ? "Locating..." : "Use My GPS"}
              </button>
            </div>
            <div className="session-card">
              <div>
                <span className="eyebrow">Active session</span>
                <p>Signed in as <strong>{session.email}</strong></p>
              </div>
              <span className="mode-chip">Live account</span>
            </div>
          </section>

          {activeSection === "overview" && (
            <section className="website-intro premium-panel project-overview-card">
              <div>
                <span className="eyebrow">About The Project</span>
                <h2>SmartPathole Road Safety Platform</h2>
              </div>
              <p>
                SmartPathole is a smart road safety platform that helps citizens and authorities work together to
                improve street conditions by making it easy to report potholes, explore live road maps, track repair
                progress, receive nearby safety alerts, review severity analytics, and manage repair operations from
                one connected website.
              </p>
            </section>
          )}
        </>
      )}

      {activeSection === "overview" && (
        <>
          <header className="hero">
            <div className="hero-copywrap panel premium-panel">
              <div className="hero-copyline"><span className="eyebrow">Urban intelligence suite</span><span className="signal-dot">Live network</span></div>
              <h1>Road safety command, redesigned for urgency and trust.</h1>
              <p className="hero-copy">A premium control surface for citizens and city authorities to report road damage, review AI severity, and drive repair decisions from one cinematic dashboard.</p>
              <div className="hero-actions">
                <button className="primary-action" type="button" onClick={detectLocation}>{locating ? "Locating your corridor..." : "Use My GPS"}</button>
                <div className="hero-alert"><span className="eyebrow">Driver alert</span><strong>{topAlert}</strong></div>
              </div>
            </div>
            <div className="hero-rail">
              {heroStats.map((item) => <article key={item.label} className={`metric-card metric-${item.tone}`}><span>{item.label}</span><strong>{item.value}</strong></article>)}
            </div>
          </header>

          <section className="info-ribbon">
            <article className="ribbon-card"><span className="eyebrow">{portalMode === "authority" ? "Authority mode" : "Citizen mode"}</span><strong>{`Welcome back, ${session.name}`}</strong></article>
            <article className="ribbon-card"><span className="eyebrow">Field operations</span><strong>{statusCounts.pending} pending, {statusCounts["under-repair"]} active repairs, {statusCounts.fixed} fixed</strong></article>
            <article className="ribbon-card"><span className="eyebrow">Map scope</span><strong>{filteredPotholes.length} incidents visible in the current severity view</strong></article>
          </section>
        </>
      )}

      <main className="layout single-page-layout">
        <section className="stack full-width-stack">
          {portalMode === "user" && activeSection === "overview" && (
            <>
              <div className="panel premium-panel quick-links-panel">
                <div className="panel-head"><div><p className="eyebrow">Quick Access</p><h2>Open a page from your portal</h2></div></div>
                <div className="quick-links-grid">
                  {dashboardOptions.filter((option) => option.id !== "overview").map((option) => (
                    <button key={option.id} type="button" className="quick-link-card" onClick={() => navigateToSection(option.id)}>
                      <strong>{option.title}</strong><span>{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {portalMode === "authority" && activeSection === "overview" && (
            <section className="website-intro premium-panel project-overview-card">
              <div>
                <span className="eyebrow">About The Project</span>
                <h2>SmartPathole Municipal Control Platform</h2>
              </div>
              <p>
                SmartPathole is a smart municipal road safety platform that helps city teams respond to road damage
                faster by connecting citizen reports with live map monitoring, severity analytics, and repair queue
                management in one centralized website experience.
              </p>
            </section>
          )}

          {portalMode === "user" && activeSection === "map" && renderMapPage("Live pothole visibility across the network")}

          {portalMode === "user" && activeSection === "report" && (
            <div className="panel premium-panel report-panel">
              <div className="panel-head"><div><p className="eyebrow">Citizen Reporting</p><h2>Send a high-confidence incident report</h2></div><div className="mini-chip">AI severity + duplicate merge</div></div>
              <form className="report-form" onSubmit={submitReport}>
                <div className="grid two">
                  <label>Latitude<input type="number" step="0.000001" value={reportForm.latitude} onChange={(e) => setReportForm((c) => ({ ...c, latitude: e.target.value }))} /></label>
                  <label>Longitude<input type="number" step="0.000001" value={reportForm.longitude} onChange={(e) => setReportForm((c) => ({ ...c, longitude: e.target.value }))} /></label>
                </div>
                <label>Description<textarea rows="3" placeholder="Describe lane, landmark, traffic speed, or immediate risk" value={reportForm.description} onChange={(e) => setReportForm((c) => ({ ...c, description: e.target.value }))} /></label>
                <div className="grid two">
                  <label className="upload-card"><span>Upload or capture photo</span><input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" capture="environment" onChange={(e) => setReportForm((c) => ({ ...c, image: e.target.files?.[0] || null }))} /><small>{reportForm.image ? reportForm.image.name : "Use phone camera on site or upload a clear JPG/PNG"}</small></label>
                  <div className="notice-card"><span>Live warning surface</span><strong>{topAlert}</strong><small>Nearby hazards refresh after GPS lookups and report submissions.</small></div>
                </div>
                <button type="submit" className="primary-action">{submitting ? "Submitting incident..." : "Submit Pothole Report"}</button>
                {reportMessage && <p className="feedback">{reportMessage}</p>}
              </form>
            </div>
          )}

          {portalMode === "user" && activeSection === "track" && (
            <>
              <div className="panel premium-panel analytics-panel">
                <div className="panel-head">
                  <div>
                    <p className="eyebrow">Track Reports</p>
                    <h2>Report size overview</h2>
                  </div>
                  <div className="mini-chip">{`${myReports.length || potholes.slice(0, 6).length} reports in chart view`}</div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={myReportChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={{ fill: "#bfc5de" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#bfc5de" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="diameter" fill="url(#trackBarGlow)" radius={[12, 12, 0, 0]} />
                    <defs>
                      <linearGradient id="trackBarGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7ee7ff" />
                        <stop offset="100%" stopColor="#4f6bff" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="panel premium-panel status-panel">
                <div className="panel-head"><div><p className="eyebrow">My Reports</p><h2>Repair visibility with live status badges</h2></div><div className="mini-chip">{`${myReports.length} linked to your profile`}</div></div>
                <div className="report-table">
                  <div className="report-table-head">
                    <span>Report ID</span>
                    <span>Description</span>
                    <span>Status</span>
                    <span>Severity</span>
                    <span>Diameter</span>
                  </div>
                  {(myReports.length ? myReports : potholes.slice(0, 4)).map((item) => (
                    <article key={item.id} className="report-table-row">
                      <strong>{`#${item.id}`}</strong>
                      <span>{item.description || "No description provided"}</span>
                      <span className={`badge badge-${item.status.toLowerCase().replace(/\s+/g, "-")}`}>{item.status}</span>
                      <span>{item.severity}</span>
                      <span>{item.diameter} cm</span>
                    </article>
                  ))}
                </div>
              </div>
            </>
          )}

          {portalMode === "user" && activeSection === "alerts" && (
            <div className="panel premium-panel alerts-panel">
              <div className="panel-head"><div><p className="eyebrow">Safety Alerts</p><h2>Nearby warnings and travel guidance</h2></div><div className="mini-chip">{nearbyAlerts.length ? `${nearbyAlerts.length} active alerts` : "No active alerts"}</div></div>
              <div className="status-list">
                {(nearbyAlerts.length ? nearbyAlerts : [{ message: "No live warning at your saved coordinates. Use GPS to refresh hazard alerts." }]).map((alert, index) => (
                  <article key={`${alert.message}-${index}`} className="status-item single-line-status"><div className="status-copy"><strong>{`Alert ${index + 1}`}</strong><p>{alert.message}</p></div><span className="badge badge-under-repair">Live</span></article>
                ))}
              </div>
            </div>
          )}

          {portalMode === "authority" && activeSection === "overview" && (
            <div className="panel premium-panel quick-links-panel">
              <div className="panel-head"><div><p className="eyebrow">Authority Overview</p><h2>Open the operational page you need</h2></div></div>
              <div className="quick-links-grid">
                {dashboardOptions.filter((option) => option.id !== "overview").map((option) => (
                  <button key={option.id} type="button" className="quick-link-card" onClick={() => navigateToSection(option.id)}>
                    <strong>{option.title}</strong><span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {portalMode === "authority" && activeSection === "map" && renderMapPage("Severity pulse across the active road network")}

          {portalMode === "authority" && activeSection === "analytics" && (
            <div className="authority-grid">
              <div className="panel premium-panel analytics-panel">
                <div className="panel-head"><div><p className="eyebrow">Authority Analytics</p><h2>Severity distribution</h2></div></div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="name" tick={{ fill: "#bfc5de" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#bfc5de" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                    <Bar dataKey="count" fill="url(#barGlow)" radius={[12, 12, 0, 0]} />
                    <defs><linearGradient id="barGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8cc8ff" /><stop offset="100%" stopColor="#4562ff" /></linearGradient></defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {portalMode === "authority" && activeSection === "queue" && (
            <>
              <div className="panel premium-panel command-panel">
                <div className="panel-head"><div><p className="eyebrow">Repair Command</p><h2>Queue health snapshot</h2></div></div>
                <div className="command-stack">
                  <article><span>Pending</span><strong>{statusCounts.pending}</strong></article>
                  <article><span>Under repair</span><strong>{statusCounts["under-repair"]}</strong></article>
                  <article><span>Fixed</span><strong>{statusCounts.fixed}</strong></article>
                </div>
              </div>
              <div className="panel premium-panel operations-panel">
                <div className="panel-head"><div><p className="eyebrow">Authority Operations</p><h2>Repair queue with image-first review</h2></div><div className="mini-chip">{filteredPotholes.length} visible incidents</div></div>
                <div className="operations-grid">
                  {filteredPotholes.map((item) => (
                    <article key={item.id} className="ops-card">
                      <div className="ops-image-wrap">
                        <img src={getImageUrl(item.photo_url)} alt={`Pothole ${item.id}`} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                        <span className="severity-tag" style={{ backgroundColor: severityColor[item.severity] }}>{item.severity}</span>
                      </div>
                      <div className="ops-copy">
                        <div className="ops-topline"><strong>Incident #{item.id}</strong><span>{item.status}</span></div>
                        <p>{item.description || "Citizen did not add extra details."}</p>
                        <div className="ops-meta"><span>{item.diameter} cm diameter</span><span>{item.estimated_depth_cm ?? "-"} cm depth</span><span>{item.report_count} reports</span></div>
                        <div className="ops-actions">
                          <button type="button" onClick={() => updateStatus(item.id, "Under Repair")}>Under Repair</button>
                          <button type="button" className="primary-action" onClick={() => updateStatus(item.id, "Fixed")}>Fixed</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
