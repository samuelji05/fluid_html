import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import "./App.css";

const rho = 1000;

function rpmToOmega(rpm) {
  return (2 * Math.PI * rpm) / 60;
}

function viscosity(mu0, k, t) {
  return mu0 * Math.exp(k * t);
}

function dhdt(h, t, p) {
  const omega = rpmToOmega(p.rpm);
  const mu = viscosity(p.mu0, p.k, t);
  return -(rho * omega ** 2 * h ** 3) / (3 * mu) - p.evap * 1e-6;
}

function rk4(h, t, dt, p) {
  const k1 = dhdt(h, t, p);
  const k2 = dhdt(h + 0.5 * dt * k1, t + 0.5 * dt, p);
  const k3 = dhdt(h + 0.5 * dt * k2, t + 0.5 * dt, p);
  const k4 = dhdt(h + dt * k3, t + dt, p);
  return Math.max(h + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4), 0);
}

function ebp(t, h0, rpm, mu0) {
  const omega = rpmToOmega(rpm);
  return h0 / Math.sqrt(1 + (2 * rho * omega ** 2 * h0 ** 2 * t) / (3 * mu0));
}

function simulate(p) {
  const dt = 0.1;
  const totalTime = 40;
  let h = p.h0 * 1e-6;
  const h0 = h;
  const data = [];

  for (let t = 0; t <= totalTime; t += dt) {
    const edge = h * (1 + p.edgeBead * (1 + 0.04 * t));
    const mid = h * (1 + 0.45 * p.edgeBead * (1 + 0.02 * t));

    data.push({
      t: Number(t.toFixed(1)),
      center: h * 1e6,
      mid: mid * 1e6,
      edge: edge * 1e6,
      ebp: ebp(t, h0, p.rpm, p.mu0) * 1e6,
      eta: viscosity(p.mu0, p.k, t)
    });

    h = rk4(h, t, dt, p);
  }

  return data;
}

function radialProfile(finalCenter, p) {
  const data = [];

  for (let i = 0; i <= 80; i++) {
    const r = (p.radius * i) / 80;
    const x = r / p.radius;
    const bead = p.edgeBead * 18 * Math.exp(-Math.pow((1 - x) / 0.08, 2));
    const mildSlope = 0.06 * x ** 2;
    const h = finalCenter * (1 + mildSlope + bead);

    data.push({
      r: Number(r.toFixed(1)),
      h: Number(h.toFixed(3))
    });
  }

  return data;
}

function getUniformity(profile) {
  const hs = profile.map((d) => d.h);
  const max = Math.max(...hs);
  const min = Math.min(...hs);
  const avg = hs.reduce((a, b) => a + b, 0) / hs.length;
  return {
    value: ((max - min) / (2 * avg)) * 100,
    max,
    min,
    avg
  };
}

export default function App() {
  const [p, setP] = useState({
    rpm: 3000,
    mu0: 0.05,
    h0: 10,
    evap: 0.03,
    k: 0.04,
    radius: 150,
    edgeBead: 0.04
  });

  const data = useMemo(() => simulate(p), [p]);
  const last = data[data.length - 1];
  const profile = useMemo(() => radialProfile(last.center, p), [last.center, p]);
  const uni = getUniformity(profile);

  const pass = uni.value <= 2;
  const tGel = Math.min(40, 1 / Math.max(p.k, 0.001) * Math.log(0.25 / p.mu0));

  function update(key, value) {
    setP((old) => ({ ...old, [key]: Number(value) }));
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>⚙️ 공정 매개변수 입력</h2>

        <Slider title="회전 속도 ω" unit="RPM" min="500" max="6000" step="100"
          value={p.rpm} onChange={(v) => update("rpm", v)} />

        <Slider title="초기 점도 η₀" unit="Pa·s" min="0.005" max="0.3" step="0.005"
          value={p.mu0} onChange={(v) => update("mu0", v)} />

        <Slider title="초기 두께 h₀" unit="μm" min="1" max="50" step="1"
          value={p.h0} onChange={(v) => update("h0", v)} />

        <Slider title="용매 증발률 E" unit="μm/s" min="0" max="0.2" step="0.005"
          value={p.evap} onChange={(v) => update("evap", v)} />

        <Slider title="점도 증가율 k" unit="1/s" min="0" max="0.2" step="0.005"
          value={p.k} onChange={(v) => update("k", v)} />

        <Slider title="웨이퍼 반지름 R" unit="mm" min="50" max="200" step="5"
          value={p.radius} onChange={(v) => update("radius", v)} />

        <Slider title="Edge Bead Factor" unit="" min="0" max="0.15" step="0.005"
          value={p.edgeBead} onChange={(v) => update("edgeBead", v)} />

        <div className="preset-box">
          <h3>Quick Presets</h3>
          <button onClick={() => setP({ ...p, rpm: 1500, mu0: 0.08, evap: 0.02 })}>
            Low Speed
          </button>
          <button onClick={() => setP({ ...p, rpm: 3000, mu0: 0.05, evap: 0.03 })}>
            Standard
          </button>
          <button onClick={() => setP({ ...p, rpm: 5000, mu0: 0.03, evap: 0.05 })}>
            High Speed
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <h1>🌊 Semiconductor Process Simulator: Spin Coating Uniformity</h1>
          <p>Reconstructing the Emslie-Bonner-Peck Theory & Meyerhofer Model</p>
        </header>

        <nav className="tabs">
          <span className="active">📊 Core Interactive View</span>
          <span>📉 Analytical Validation</span>
          <span>🚀 Challenge Mode</span>
        </nav>

        <section className="cards">
          <Card title="겔화 도달 시간 예측값" value={`${tGel.toFixed(2)} 초`} />
          <Card title="중심부 최종 두께" value={`${last.center.toFixed(3)} μm`} />
          <Card title="가장자리 최종 두께" value={`${uni.max.toFixed(3)} μm`} />
          <Card title="반지름 방향 불균일도" value={`±${uni.value.toFixed(2)}%`} danger={!pass} />
        </section>

        <section className="grid">
          <Panel title="1. 위치별/시간별 두께 변화 그래프">
            <ResponsiveContainer width="100%" height={330}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3442" />
                <XAxis dataKey="t" stroke="#cbd5e1" label={{ value: "시간 (초)", position: "insideBottom", offset: -5 }} />
                <YAxis stroke="#cbd5e1" label={{ value: "PR 두께 h (μm)", angle: -90, position: "insideLeft" }} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
                <Legend />
                <Line type="monotone" dataKey="center" name="Center (r=0)" stroke="#60a5fa" dot={false} strokeWidth={3} />
                <Line type="monotone" dataKey="mid" name="Mid-radius" stroke="#3b82f6" dot={false} strokeDasharray="6 6" />
                <Line type="monotone" dataKey="edge" name="Edge bead" stroke="#ef4444" dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="2. 최종 반지름 방향 두께 분포">
            <ResponsiveContainer width="100%" height={330}>
              <LineChart data={profile}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3442" />
                <XAxis dataKey="r" stroke="#cbd5e1" label={{ value: "반지름 r (mm)", position: "insideBottom", offset: -5 }} />
                <YAxis stroke="#cbd5e1" label={{ value: "최종 두께 h(r) (μm)", angle: -90, position: "insideLeft" }} />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
                <Legend />
                <Line type="monotone" dataKey="h" name="Radial thickness" stroke="#ef4444" dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="3. 검증: 수치해석 vs EBP 해석해">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3442" />
                <XAxis dataKey="t" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
                <Legend />
                <Line type="monotone" dataKey="center" name="Numerical Meyerhofer" stroke="#ef4444" dot={false} strokeWidth={3} />
                <Line type="monotone" dataKey="ebp" name="EBP Analytical" stroke="#60a5fa" dot={false} strokeDasharray="6 6" />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="4. 점도 증가 η(t)">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3442" />
                <XAxis dataKey="t" stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
                <Legend />
                <Line type="monotone" dataKey="eta" name="η(t)=η₀eᵏᵗ" stroke="#22c55e" dot={false} strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </Panel>
        </section>

        <footer className="footer">
          Model: Emslie-Bonner-Peck + Meyerhofer evaporation/viscosity correction
          <span>{pass ? "✅ ±2% 균일도 조건 만족" : "⚠️ ±2% 균일도 조건 불만족"}</span>
        </footer>
      </main>
    </div>
  );
}

function Slider({ title, unit, min, max, step, value, onChange }) {
  return (
    <div className="slider">
      <div className="slider-top">
        <span>{title}</span>
        <b>{Number(value).toFixed(step < 1 ? 3 : 0)} {unit}</b>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="range">
        <small>{min}</small>
        <small>{max}</small>
      </div>
    </div>
  );
}

function Card({ title, value, danger }) {
  return (
    <div className={`card ${danger ? "danger" : ""}`}>
      <p>{title}</p>
      <h2>{value}</h2>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
