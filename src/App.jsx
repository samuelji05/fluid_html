import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from "recharts";
import "./App.css";

const rho = 1000; // kg/m3, PR solution approximate

function rpmToOmega(rpm) {
  return (2 * Math.PI * rpm) / 60;
}

function viscosity(mu0, k, t) {
  return mu0 * Math.exp(k * t);
}

// dh/dt = -rho*w^2*h^3/(3*mu(t)) - E
function dhdt(h, t, params) {
  const { rpm, mu0, evap, k } = params;
  const w = rpmToOmega(rpm);
  const mu = viscosity(mu0, k, t);
  return -(rho * w * w * Math.pow(h, 3)) / (3 * mu) - evap;
}

function rk4Step(h, t, dt, params) {
  const k1 = dhdt(h, t, params);
  const k2 = dhdt(h + 0.5 * dt * k1, t + 0.5 * dt, params);
  const k3 = dhdt(h + 0.5 * dt * k2, t + 0.5 * dt, params);
  const k4 = dhdt(h + dt * k3, t + dt, params);
  return Math.max(h + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4), 0);
}

function ebpAnalytical(t, h0, rpm, mu0) {
  const w = rpmToOmega(rpm);
  return h0 / Math.sqrt(1 + (2 * rho * w * w * h0 * h0 * t) / (3 * mu0));
}

function simulate(params) {
  const dt = 0.05;
  const totalTime = 30;
  const data = [];

  let h = params.h0 * 1e-6; // μm → m
  const h0 = h;

  for (let t = 0; t <= totalTime; t += dt) {
    const hEBP = ebpAnalytical(t, h0, params.rpm, params.mu0);

    data.push({
      t: Number(t.toFixed(2)),
      numerical: h * 1e6,
      ebp: hEBP * 1e6,
      viscosity: viscosity(params.mu0, params.k, t)
    });

    h = rk4Step(h, t, dt, params);
  }

  return data;
}

function radialProfile(finalThickness, radius, edgeBeadFactor) {
  const data = [];

  for (let i = 0; i <= 50; i++) {
    const r = (radius * i) / 50;
    const x = r / radius;

    // 간단한 edge bead 모델: 가장자리에서 두께 증가
    const edgeBead = edgeBeadFactor * Math.exp(-Math.pow((1 - x) / 0.08, 2));
    const h = finalThickness * (1 + edgeBead);

    data.push({
      r: Number(r.toFixed(2)),
      h: Number(h.toFixed(3))
    });
  }

  return data;
}

function uniformity(profile) {
  const hs = profile.map((p) => p.h);
  const max = Math.max(...hs);
  const min = Math.min(...hs);
  const avg = hs.reduce((a, b) => a + b, 0) / hs.length;
  return ((max - min) / avg) * 100;
}

export default function App() {
  const [params, setParams] = useState({
    rpm: 3000,
    mu0: 0.05,
    h0: 10,
    evap: 0.03e-6,
    k: 0.04,
    radius: 150,
    edgeBeadFactor: 0.04
  });

  const simData = useMemo(() => simulate(params), [params]);
  const finalThickness = simData[simData.length - 1].numerical;

  const profile = useMemo(
    () => radialProfile(finalThickness, params.radius, params.edgeBeadFactor),
    [finalThickness, params.radius, params.edgeBeadFactor]
  );

  const uni = uniformity(profile);
  const passSpec = uni <= 4; // ±2% = 총 편차 4%

  function update(key, value) {
    setParams((p) => ({ ...p, [key]: Number(value) }));
  }

  return (
    <main className="container">
      <h1>Spin Coating Thin-Film Simulator</h1>
      <p>
        Emslie-Bonner-Peck model + evaporation-induced viscosity increase.
      </p>

      <section className="panel">
        <h2>Input Parameters</h2>

        <Slider label="Spin speed ω" unit="rpm" min="500" max="6000" step="100"
          value={params.rpm} onChange={(v) => update("rpm", v)} />

        <Slider label="Initial viscosity η₀" unit="Pa·s" min="0.005" max="0.3" step="0.005"
          value={params.mu0} onChange={(v) => update("mu0", v)} />

        <Slider label="Initial thickness h₀" unit="μm" min="1" max="50" step="1"
          value={params.h0} onChange={(v) => update("h0", v)} />

        <Slider label="Evaporation rate E" unit="μm/s" min="0" max="0.2" step="0.005"
          value={params.evap * 1e6} onChange={(v) => update("evap", v * 1e-6)} />

        <Slider label="Viscosity growth k" unit="1/s" min="0" max="0.2" step="0.005"
          value={params.k} onChange={(v) => update("k", v)} />

        <Slider label="Wafer radius" unit="mm" min="50" max="200" step="10"
          value={params.radius} onChange={(v) => update("radius", v)} />

        <Slider label="Edge bead factor" unit="" min="0" max="0.15" step="0.005"
          value={params.edgeBeadFactor} onChange={(v) => update("edgeBeadFactor", v)} />
      </section>

      <section className="summary">
        <div>
          <strong>Final average thickness</strong>
          <span>{finalThickness.toFixed(3)} μm</span>
        </div>
        <div>
          <strong>Final uniformity</strong>
          <span>{uni.toFixed(2)}%</span>
        </div>
        <div className={passSpec ? "pass" : "fail"}>
          <strong>±2% Spec</strong>
          <span>{passSpec ? "PASS" : "FAIL"}</span>
        </div>
      </section>

      <section className="panel">
        <h2>1. Real-time Thickness Evolution</h2>
        <Chart data={simData} yLabel="Thickness (μm)">
          <Line type="monotone" dataKey="numerical" name="Numerical Meyerhofer-like model" dot={false} />
        </Chart>
      </section>

      <section className="panel">
        <h2>2. Validation View: Numerical vs Analytical EBP</h2>
        <p>
          Validation condition: analytical EBP assumes no evaporation and constant viscosity.
        </p>
        <Chart data={simData} yLabel="Thickness (μm)">
          <Line type="monotone" dataKey="numerical" name="Numerical" dot={false} />
          <Line type="monotone" dataKey="ebp" name="EBP analytical limit" dot={false} />
        </Chart>
      </section>

      <section className="panel">
        <h2>3. Design Exploration: Radial Uniformity & Edge Bead</h2>
        <Chart data={profile} xKey="r" yLabel="Final h(r) (μm)">
          <Line type="monotone" dataKey="h" name="Radial thickness" dot={false} />
        </Chart>
      </section>
    </main>
  );
}

function Slider({ label, unit, min, max, step, value, onChange }) {
  return (
    <label className="slider">
      <span>{label}: <b>{Number(value).toFixed(3)}</b> {unit}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Chart({ data, children, xKey = "t", yLabel }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey={xKey}
            label={{
              value: xKey === "t" ? "Time (s)" : "Radius (mm)",
              position: "insideBottom",
              offset: -5
            }}
          />
          <YAxis
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft"
            }}
          />
          <Tooltip />
          <Legend />
          {children}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}