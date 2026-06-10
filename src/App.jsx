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
    const edgeBead =  0.04 *  (4000 / p.rpm) *  (1 + 2 * p.mu0) *  (1 + 3 * p.evap);
    const edge = h * (1 + edgeBead);
    const mid = h * (1 + 0.25 * edgeBead);

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

  for (let i = 0; i <= 100; i++) {
    const r = (p.radius * i) / 100;
    const x = r / p.radius;

    const edgeBead = 0.04 * (4000 / p.rpm) * (1 + 2 * p.mu0) * (1 + 3 * p.evap);

    const bead = edgeBead * Math.exp(-Math.pow((1 - x) / 0.09, 2));
    const slope = 0.015 * x ** 2;

    const h = finalCenter * (1 + slope + bead);

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

function findChallengeSolution(base) {
  const results = [];

  for (let rpm = 1000; rpm <= 6000; rpm += 250) {
    for (let mu0 = 0.01; mu0 <= 0.3; mu0 += 0.01) {
      const p = { ...base, rpm, mu0 };
      const data = simulate(p);
      const last = data[data.length - 1];
      const profile = radialProfile(last.center, p);
      const uni = getUniformity(profile);

      if (uni.value <= 2) {
        results.push({
          rpm,
          mu0: Number(mu0.toFixed(3)),
          uniformity: Number(uni.value.toFixed(3)),
          thickness: Number(uni.avg.toFixed(3))
        });
      }
    }
  }

  return results.slice(0, 10);
}

export default function App() {
  const [tab, setTab] = useState("core");

  const [p, setP] = useState({
    rpm: 3000,
    mu0: 0.05,
    h0: 10,
    evap: 0.03,
    k: 0.04,
    radius: 150
  });

  const data = useMemo(() => simulate(p), [p]);
  const last = data[data.length - 1];
  const profile = useMemo(() => radialProfile(last.center, p), [last.center, p]);
  const uni = getUniformity(profile);
  const pass = uni.value <= 2;

  const challenge = useMemo(() => findChallengeSolution(p), [p]);

  const tGel = Math.min(
    40,
    (1 / Math.max(p.k, 0.001)) * Math.log(0.25 / p.mu0)
  );

  function update(key, value) {
    setP((old) => ({ ...old, [key]: Number(value) }));
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>⚙️ 공정 매개변수</h2>

        <Slider title="회전 속도 ω" unit="RPM" min="500" max="6000" step="100"
          value={p.rpm} onChange={(v) => update("rpm", v)} />

        <Slider title="초기 점도 η₀" unit="Pa·s" min="0.005" max="0.3" step="0.005"
          value={p.mu0} onChange={(v) => update("mu0", v)} />

        <Slider title="초기 두께 h₀" unit="μm" min="1" max="50" step="1"
          value={p.h0} onChange={(v) => update("h0", v)} />

        <Slider title="증발률 E" unit="μm/s" min="0" max="0.2" step="0.005"
          value={p.evap} onChange={(v) => update("evap", v)} />

        <Slider title="점도 증가율 k" unit="1/s" min="0" max="0.2" step="0.005"
          value={p.k} onChange={(v) => update("k", v)} />

        <Slider title="웨이퍼 반지름 R" unit="mm" min="50" max="200" step="5"
          value={p.radius} onChange={(v) => update("radius", v)} />
      </aside>

      <main className="main">
        <header className="header">
          <h1>🌊 Spin Coating Uniformity Simulator</h1>
          <p>Emslie-Bonner-Peck Theory & Meyerhofer Model</p>
        </header>

        <nav className="tabs">
          <button className={tab === "core" ? "active" : ""} onClick={() => setTab("core")}>
            📊 Core Interactive View
          </button>
          <button className={tab === "validation" ? "active" : ""} onClick={() => setTab("validation")}>
            📉 Analytical Validation
          </button>
          <button className={tab === "challenge" ? "active" : ""} onClick={() => setTab("challenge")}>
            🚀 Challenge Mode
          </button>
        </nav>

        <section className="cards">
          <Card title="겔화 도달 시간" value={`${tGel.toFixed(2)} 초`} />
          <Card title="중심부 최종 두께" value={`${last.center.toFixed(3)} μm`} />
          <Card title="가장자리 최종 두께" value={`${uni.max.toFixed(3)} μm`} />
          <Card title="불균일도" value={`±${uni.value.toFixed(2)}%`} danger={!pass} />
        </section>

        {tab === "core" && (
          <section className="one-column">
            <Panel title="1. 위치별/시간별 두께 변화 그래프">
              <ThicknessTimeChart data={data} />
            </Panel>

            <Panel title="2. 최종 반지름 방향 두께 분포">
              <RadialChart data={profile} />
            </Panel>

            <Panel title="3. 점도 증가 η(t)">
              <ViscosityChart data={data} />
            </Panel>
          </section>
        )}

        {tab === "validation" && (
          <section className="one-column">
            <Panel title="검증: 수치해석 vs EBP 해석해">
              <ValidationChart data={data} />
            </Panel>
          </section>
        )}

        {tab === "challenge" && (
          <section className="challenge">
            <h2>🚀 Challenge Mode</h2>
            <p>현재 조건에서 ±2% 균일도 조건을 만족하는 rpm과 초기 점도 η₀ 조합을 자동 탐색합니다.</p>

            {challenge.length === 0 ? (
              <div className="no-result">
                조건을 만족하는 조합을 찾지 못했습니다. Edge Bead Factor를 낮추거나 증발률을 조정해보세요.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>추천 순위</th>
                    <th>RPM</th>
                    <th>초기 점도 η₀</th>
                    <th>불균일도</th>
                    <th>평균 최종 두께</th>
                  </tr>
                </thead>
                <tbody>
                  {challenge.map((row, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{row.rpm}</td>
                      <td>{row.mu0} Pa·s</td>
                      <td>±{row.uniformity}%</td>
                      <td>{row.thickness} μm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <footer className="footer">
          Model: EBP + Meyerhofer correction
          <span>{pass ? "✅ ±2% 조건 만족" : "⚠️ ±2% 조건 불만족"}</span>
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
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(e.target.value)} />
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

function ThicknessTimeChart({ data }) {
  return (
    <Chart
      data={data}
      xKey="t"
      xLabel="시간 t (s)"
      yLabel="포토레지스트 두께 h (μm)"
    >
      <Line type="monotone" dataKey="center" name="Center, r=0" stroke="#60a5fa" dot={false} strokeWidth={3} />
      <Line type="monotone" dataKey="mid" name="Mid-radius, r=R/2" stroke="#3b82f6" dot={false} strokeDasharray="6 6" />
      <Line type="monotone" dataKey="edge" name="Edge bead, r=R" stroke="#ef4444" dot={false} strokeWidth={3} />
    </Chart>
  );
}

function RadialChart({ data }) {
  return (
    <Chart
      data={data}
      xKey="r"
      xLabel="웨이퍼 반지름 방향 위치 r (mm)"
      yLabel="최종 막 두께 h(r) (μm)"
    >
      <Line type="monotone" dataKey="h" name="Final radial thickness h(r)" stroke="#ef4444" dot={false} strokeWidth={3} />
    </Chart>
  );
}

function ValidationChart({ data }) {
  return (
    <Chart
      data={data}
      xKey="t"
      xLabel="시간 t (s)"
      yLabel="막 두께 h(t) (μm)"
    >
      <Line type="monotone" dataKey="center" name="Numerical Meyerhofer model" stroke="#ef4444" dot={false} strokeWidth={3} />
      <Line type="monotone" dataKey="ebp" name="EBP analytical solution" stroke="#60a5fa" dot={false} strokeDasharray="6 6" />
    </Chart>
  );
}

function ViscosityChart({ data }) {
  return (
    <Chart
      data={data}
      xKey="t"
      xLabel="시간 t (s)"
      yLabel="점도 η(t) (Pa·s)"
    >
      <Line type="monotone" dataKey="eta" name="η(t)=η₀eᵏᵗ" stroke="#22c55e" dot={false} strokeWidth={3} />
    </Chart>
  );
}

function Chart({
  data,
  children,
  xKey = "t",
  xLabel = "시간 t (s)",
  yLabel = "두께 h (μm)"
}) {
  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart data={data} margin={{ top: 20, right: 35, left: 35, bottom: 35 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3442" />

        <XAxis
          dataKey={xKey}
          stroke="#cbd5e1"
          label={{
            value: xLabel,
            position: "insideBottom",
            offset: -20,
            fill: "#cbd5e1"
          }}
        />

        <YAxis
          stroke="#cbd5e1"
          label={{
            value: yLabel,
            angle: -90,
            position: "insideLeft",
            offset: -15,
            fill: "#cbd5e1"
          }}
        />

        <Tooltip
          contentStyle={{
            background: "#111827",
            border: "1px solid #334155",
            color: "#f8fafc"
          }}
        />

        <Legend verticalAlign="top" height={36} />
        {children}
      </LineChart>
    </ResponsiveContainer>
  );
}