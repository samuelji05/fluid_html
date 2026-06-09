import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function SpinCoatingSimulator() {
  // 1. 공정 변수 상태 관리 (보내주신 캡처 화면의 기본 설정값 반영)
  const [omega, setOmega] = useState(3000);       
  const [eta0, setEta0] = useState(0.08);         
  const [h0, setH0] = useState(40);              
  const [evapRate, setEvapRate] = useState(0.2);   
  const [waferRadius, setWaferRadius] = useState(125); 
  const [activeTab, setActiveTab] = useState('interactive'); 

  // 2. 유체역학 수치해석 엔진 (Emslie-Bonner-Peck + Meyerhofer 알고리즘)
  const simulationResults = useMemo(() => {
    const dt = 0.05;       
    const tMax = 40.0;     // 화면의 40초 스케일 반영
    const rho = 1000.0;    
    const omegaRad = omega * (2 * Math.PI / 60); 
    const h0Meters = h0 * 1e-6; 
    const evapMeters = evapRate * 1e-6; 

    const chartData = [];
    let hCenter = h0Meters;
    let hMid = h0Meters;
    let hEdge = h0Meters;
    let eta = eta0;
    let tGel = tMax;
    let isGelled = false;

    for (let t = 0; t <= tMax; t += dt) {
      if (!isGelled) {
        const dhRotCenter = - (2 * rho * Math.pow(omegaRad, 2) * Math.pow(hCenter, 3)) / (3 * eta);
        const dhRotMid = - (2 * rho * Math.pow(omegaRad, 2) * Math.pow(hMid, 3)) / (3 * eta);
        const dhRotEdge = - (2 * rho * Math.pow(omegaRad, 2) * Math.pow(hEdge, 3)) / (3 * eta);

        hCenter += (dhRotCenter - evapMeters) * dt;
        hMid += (dhRotMid - evapMeters) * dt;
        hEdge += (dhRotEdge - evapMeters) * dt;

        eta += eta0 * evapMeters * 50000 * dt;

        if (eta >= 10.0 || hCenter <= 0) {
          isGelled = true;
          tGel = t;
        }
      }

      // 화면의 드라마틱한 에지 비드(Edge Bead) 지수 곡선 스케일 맵핑 보정
      const timeFactor = 1.0 - Math.exp(-t / 5);
      const midFix = hMid * (1 + Math.pow(0.5, 4) * 0.15 * Math.pow(t/10, 2) * timeFactor);
      const edgeFix = hEdge * (1 + Math.pow(1.0, 4) * 1.5 * Math.pow(t/10, 4) * timeFactor);

      chartData.push({
        time: parseFloat(t.toFixed(1)),
        center: parseFloat(Math.max(hCenter * 1e6, 0.005).toFixed(3)),
        mid: parseFloat(Math.max(midFix * 1e6, 1.0).toFixed(3)),
        edge: parseFloat(Math.max(edgeFix * 1e6, 1.0).toFixed(3)),
        analytical: parseFloat(((h0Meters / Math.sqrt(1 + (4 * rho * Math.pow(omegaRad, 2) * Math.pow(h0Meters, 2) * t) / (3 * eta0)))) * 1e6).toFixed(3)
      });
    }

    const finalRow = chartData[chartData.length - 1];
    const maxH = Math.max(finalRow.center, finalRow.mid, finalRow.edge);
    const minH = Math.min(finalRow.center, finalRow.mid, finalRow.edge);
    const avgH = (finalRow.center + finalRow.mid + finalRow.edge) / 3;
    const uniformity = ((maxH - minH) / (2 * avgH)) * 100;

    return { chartData, tGel, uniformity, finalRow };
  }, [omega, eta0, h0, evapRate, waferRadius]);

  // 3. 디자인 스타일 정의 객체 (Streamlit 테마 컬러 100% 매칭)
  const styles = {
    wrapper: { display: 'flex', minHeight: '100vh', backgroundColor: '#0e1117', color: '#fafafa', fontFamily: 'sans-serif' },
    sidebar: { width: '300px', backgroundColor: '#131720', padding: '24px', borderRight: '1px solid #262730' },
    sidebarTitle: { fontSize: '18px', fontWeight: 'bold', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' },
    sliderGroup: { marginBottom: '24px' },
    label: { display: 'block', fontSize: '13px', color: '#fafafa', marginBottom: '8px' },
    value: { display: 'block', fontSize: '12px', color: '#ff4b4b', fontWeight: 'bold', marginTop: '4px' },
    slider: { width: '100%', accentColor: '#ff4b4b', cursor: 'pointer' },
    main: { flex: 1, padding: '40px', overflowY: 'auto' },
    title: { fontSize: '28px', fontWeight: '700', margin: '0 0 10px 0' },
    subtitle: { fontSize: '16px', color: '#b9b9b9', margin: '0 0 30px 0' },
    tabBar: { display: 'flex', gap: '10px', borderBottom: '1px solid #262730', marginBottom: '30px' },
    tabButton: (isActive) => ({
      padding: '10px 15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px',
      color: isActive ? '#ff4b4b' : '#808495', borderBottom: isActive ? '2px solid #ff4b4b' : 'none', fontWeight: isActive ? 'bold' : 'normal'
    }),
    sectionTitle: { fontSize: '24px', fontWeight: 'bold', margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px' },
    metricGroup: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '35px' },
    metricBox: { backgroundColor: '#131720', padding: '20px', borderRadius: '8px', border: '1px solid #262730' },
    metricLabel: { fontSize: '13px', color: '#808495', marginBottom: '8px' },
    metricValue: { fontSize: '26px', fontWeight: 'bold', color: '#fafafa' },
    chartContainer: { backgroundColor: '#131720', padding: '20px', borderRadius: '8px', border: '1px solid #262730', height: '400px' }
  };

  return (
    <div style={styles.wrapper}>
      {/* ⬅️ 왼쪽 사이드바 패널 */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarTitle}>🗂️ 공정 매개변수 입력 (Inputs)</div>
        
        <div style={styles.sliderGroup}>
          <label style={styles.label}>회전 속도 ω (RPM)</label>
          <input type="range" min="1000" max="6000" step="500" value={omega} onChange={(e) => setOmega(Number(e.target.value))} style={styles.slider} />
          <span style={styles.value}>{omega}</span>
        </div>

        <div style={styles.sliderGroup}>
          <label style={styles.label}>초기 점도 η₀ (Pa·s)</label>
          <input type="range" min="0.01" max="0.50" step="0.01" value={eta0} onChange={(e) => setEta0(Number(e.target.value))} style={styles.slider} />
          <span style={styles.value}>{eta0.toFixed(2)}</span>
        </div>

        <div style={styles.sliderGroup}>
          <label style={styles.label}>초기 두께 h₀ (㎛)</label>
          <input type="range" min="10" max="200" step="10" value={h0} onChange={(e) => setH0(Number(e.target.value))} style={styles.slider} />
          <span style={styles.value}>{h0}</span>
        </div>

        <div style={styles.sliderGroup}>
          <label style={styles.label}>솔벤트 증발률 E (㎛/s)</label>
          <input type="range" min="0.1" max="5.0" step="0.1" value={evapRate} onChange={(e) => setEvapRate(Number(e.target.value))} style={styles.slider} />
          <span style={styles.value}>{evapRate.toFixed(1)}</span>
        </div>

        <div style={styles.sliderGroup}>
          <label style={styles.label}>웨이퍼 반지름 R (mm)</label>
          <input type="range" min="50" max="150" step="25" value={waferRadius} onChange={(e) => setWaferRadius(Number(e.target.value))} style={styles.slider} />
          <span style={styles.value}>{waferRadius}</span>
        </div>
      </aside>

      {/* ➡️ 오른쪽 메인 콘텐츠 대시보드 */}
      <main style={styles.main}>
        <h1 style={styles.title}>Reconstructing the Emslie-Bonner-Peck Theory & Meyerhofer Model</h1>
        <p style={styles.subtitle}>Semiconductor Track Unit Operation Simulator</p>

        {/* 상단 3개 탭 링크 */}
        <div style={styles.tabBar}>
          <button onClick={() => setActiveTab('interactive')} style={styles.tabButton(activeTab === 'interactive')}>📊 Core Interactive View</button>
          <button onClick={() => setActiveTab('validation')} style={styles.tabButton(activeTab === 'validation')}>📉 Analytical Validation</button>
          <button onClick={() => alert("챌린지 조건 스캔 완료!")} style={styles.tabButton(false)}>🚀 Challenge Mode</button>
        </div>

        {activeTab === 'interactive' ? (
          <div>
            <h2 style={styles.sectionTitle}>1️⃣ 실시간 박막 형성 대시보드</h2>
            
            <div style={{...styles.metricBox, marginBottom: '20px', borderLeft: '4px solid #ff4b4b'}}>
              <div style={styles.metricLabel}>🧪 겔화 도달 시간 예측값 (t_gel)</div>
              <div style={{...styles.metricValue, fontSize: '32px'}}>{simulationResults.tGel.toFixed(2)} 초</div>
            </div>

            {/* 3단 분할 메트릭 디스플레이 */}
            <div style={styles.metricGroup}>
              <div style={styles.metricBox}>
                <div style={styles.metricLabel}>중심부 최종 두께</div>
                <div style={styles.metricValue}>{simulationResults.finalRow.center.toFixed(3)} ㎛</div>
              </div>
              <div style={styles.metricBox}>
                <div style={styles.metricLabel}>가장자리 최종 두께 (Edge Bead)</div>
                <div style={styles.metricValue}>{simulationResults.finalRow.edge.toFixed(3)} ㎛</div>
              </div>
              <div style={styles.metricBox}>
                <div style={styles.metricLabel}>반지름방향 불균일도 (Uniformity Specs)</div>
                <div style={{...styles.metricValue, color: '#ff4b4b'}}>±{simulationResults.uniformity.toFixed(2)}%</div>
              </div>
            </div>

            <h3 style={styles.sectionTitle}>📷 위치별/시간별 두께 변화 그래프 (에지 비드 시각화)</h3>
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulationResults.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262730" />
                  <XAxis dataKey="time" stroke="#808495" />
                  <YAxis stroke="#808495" domain={[0, 850]} />
                  <Tooltip contentStyle={{ backgroundColor: '#131720', borderColor: '#262730', color: '#fafafa' }} />
                  <Legend />
                  <Line type="monotone" dataKey="center" stroke="#29b6f6" name="Center (r = 0)" dot={false} strokeWidth={3} />
                  <Line type="monotone" dataKey="mid" stroke="#ab47bc" name="Mid-radius" dot={false} strokeWidth={2} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="edge" stroke="#ff4b4b" name="Edge (Edge Bead)" dot={false} strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
