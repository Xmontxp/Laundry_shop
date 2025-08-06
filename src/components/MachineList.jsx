// MachineList.jsx
import React, { useEffect, useState } from "react";

function StatusBadge({ status }) {
  const map = {
    available: "badge-available",
    "in-use": "badge-inuse",
    "out-of-service": "badge-off",
  };
  return <span className={`status-badge ${map[status] || ""}`}>{status}</span>;
}

function formatTime(sec) {
  if (!sec || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

const WASH_PRICES = {
  normal: { 10: 40, 15: 50, 20: 60 },
  warm: { 10: 50, 15: 60, 20: 70 },
  hot: { 10: 60, 15: 70, 20: 80 },
};
const DRYER_BASE_PRICE = { 15: 40, 20: 50 };
const DRYER_ADD_PRICE = 10;
const DRYER_ADD_SECONDS = 6 * 60;

export default function MachineList({ balance, onBalanceChange }) {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [localExtra, setLocalExtra] = useState({});
  const [countdowns, setCountdowns] = useState({});

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns((prev) => {
        const updated = {};
        for (const [id, time] of Object.entries(prev)) {
          const newTime = time > 0 ? time - 1 : 0;
          updated[id] = newTime;

          // เมื่อครบ 0 แล้วแจ้งให้ backend เปลี่ยนเป็น available
          if (newTime === 0) {
            fetch("http://localhost:3001/api/setAvailable", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.ok) {
                  fetchMachines();
                }
              })
              .catch(console.error);
          }
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function fetchMachines() {
    try {
      setLoading(true);
      const res = await fetch("http://localhost:3001/api/machines");
      const data = await res.json();
      setMachines(data);

      setCountdowns((prev) => {
        const updated = { ...prev };
        for (const m of data) {
          if (m.status === "in-use") {
            if (!(m.id in updated)) {
              updated[m.id] = m.timeLeft || 0;
            }
          } else {
            delete updated[m.id];
          }
        }
        return updated;
      });
    } catch (err) {
      console.error(err);
      alert("ไม่สามารถดึงข้อมูลเครื่องได้");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMachines();
    const id = setInterval(fetchMachines, 5000);
    return () => clearInterval(id);
  }, []);

  function setWaterChoice(id, water) {
    setMachines((prev) =>
      prev.map((m) => (m.id === id ? { ...m, selectedWater: water } : m))
    );
  }

  function calcWashingPrice(capacity, waterType) {
    const cap = capacity.replace("kg", "");
    return WASH_PRICES[waterType]?.[cap] || 0;
  }

  function calcDryerPrice(capacity, extraPaid = 0) {
    const cap = capacity.replace("kg", "");
    return (DRYER_BASE_PRICE[cap] || 0) + (extraPaid || 0);
  }

  async function handleStart(machine) {
    if (machine.status === "out-of-service") {
      return alert("เครื่องนี้ไม่สามารถใช้งานได้ (out-of-service)");
    }

    const remaining = countdowns[machine.id] ?? machine.timeLeft ?? 0;
    if (machine.status === "in-use" && remaining > 0) {
      return alert("เครื่องกำลังใช้งานอยู่");
    }

    let durationSec = 2 * 60;
    let price = 0;

    if (machine.kind === "washing") {
      const water = machine.selectedWater || "normal";
      price = calcWashingPrice(machine.capacity, water);
    } else if (machine.kind === "dryer") {
      const extraPaid = localExtra[machine.id] || 0;
      price = calcDryerPrice(machine.capacity, extraPaid);
      const extraSeconds = Math.floor(
        (extraPaid / DRYER_ADD_PRICE) * DRYER_ADD_SECONDS
      );
      durationSec = 2 * 60 + extraSeconds;
    }

    if (balance < price) {
      return alert(`ยอดคงเหลือไม่เพียงพอ (ราคาที่ต้องชำระ: ${price} ฿)`);
    }

    try {
      const res = await fetch("http://localhost:3001/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: machine.id, durationSec, price }),
      });
      const data = await res.json();
      if (data.ok) {
        if (typeof data.balance !== "undefined") {
          onBalanceChange(data.balance);
        }
        setLocalExtra((p) => {
          const n = { ...p };
          delete n[machine.id];
          return n;
        });
        setCountdowns((prev) => ({ ...prev, [machine.id]: durationSec }));
        fetchMachines();
      } else {
        alert(data.message || "ไม่สามารถเริ่มเครื่องได้");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดปัญหาเชื่อมต่อเซิร์ฟเวอร์");
    }
  }

  function handleAdd10Dryer(id) {
    setLocalExtra((prev) => {
      const cur = prev[id] || 0;
      return { ...prev, [id]: cur + DRYER_ADD_PRICE };
    });
  }

  function handleRemove10Dryer(id, basePrice) {
    setLocalExtra((prev) => {
      const cur = prev[id] || 0;
      const total = basePrice + cur;
      if (cur <= 0 || total <= basePrice) {
        alert("ไม่สามารถลบเงินได้ต่ำกว่าราคาฐาน");
        return prev;
      }
      return { ...prev, [id]: Math.max(0, cur - DRYER_ADD_PRICE) };
    });
  }

  return (
    <div>
      <h3>Machines</h3>
      {loading && <div>Loading machines...</div>}

      <section className="machine-section">
        <h4>Washing Machines</h4>
        <div className="machine-list">
          {machines
            .filter((m) => m.kind === "washing")
            .map((m) => (
              <div key={m.id} className="machine-card">
                <div className="machine-header">
                  <strong>{m.id}</strong> <small>· {m.capacity}</small>
                </div>

                <div className="machine-body">
                  <div className="water-select">
                    {[
                      "normal",
                      "warm",
                      "hot"
                    ].map((type) => (
                      <label key={type}>
                        <input
                          type="radio"
                          name={`water-${m.id}`}
                          checked={(m.selectedWater || "normal") === type}
                          onChange={() => setWaterChoice(m.id, type)}
                        />
                        น้ำ
                        {type === "normal"
                          ? "ปกติ"
                          : type === "warm"
                          ? "อุ่น"
                          : "ร้อน"} ({calcWashingPrice(m.capacity, type)} ฿)
                      </label>
                    ))}
                  </div>

                  {m.status === "in-use" && (countdowns[m.id] ?? m.timeLeft) > 0 ? (
                    <div>
                      <strong>เวลาเหลือ:</strong> {formatTime(countdowns[m.id] ?? m.timeLeft)}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStart(m)}
                      disabled={m.status === "out-of-service"}
                      style={{
                        backgroundColor:
                          m.status === "out-of-service" ? "#9ca3af" : "#10b981",
                        color: "#fff",
                        padding: "8px 16px",
                        border: "none",
                        borderRadius: "6px",
                        cursor:
                          m.status === "out-of-service" ? "not-allowed" : "pointer",
                        opacity: m.status === "out-of-service" ? 0.6 : 1,
                        fontWeight: "bold",
                      }}
                      title={
                        m.status === "out-of-service"
                          ? "เครื่องนี้ไม่สามารถใช้งานได้"
                          : "Confirm & Start (25 นาที)"
                      }
                    >
                      Confirm & Start (25 นาที)
                    </button>
                  )}
                </div>

                <div style={{ textAlign: "right" }}>
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="machine-section" style={{ marginTop: 18 }}>
        <h4>Dryers</h4>
        <div className="machine-list">
          {machines
            .filter((m) => m.kind === "dryer")
            .map((m) => {
              const extra = localExtra[m.id] || 0;
              const base = DRYER_BASE_PRICE[m.capacity.replace("kg", "")] || 0;
              const totalTimeSec =
                2 * 60 + (extra / DRYER_ADD_PRICE) * DRYER_ADD_SECONDS;

              return (
                <div key={m.id} className="machine-card">
                  <div className="machine-header">
                    <strong>{m.id}</strong> <small>· {m.capacity}</small>
                  </div>

                  <div className="machine-body">
                    {m.status === "in-use" && (countdowns[m.id] ?? m.timeLeft) > 0 ? (
                      <div>
                        <strong>เวลาเหลือ:</strong> {formatTime(countdowns[m.id] ?? m.timeLeft)}
                      </div>
                    ) : (
                      <div className="actions">
                        <button
                          onClick={() => handleStart(m)}
                          disabled={m.status === "out-of-service"}
                          style={{
                            backgroundColor:
                              m.status === "out-of-service" ? "#9ca3af" : "#10b981",
                            color: "#fff",
                            padding: "8px 16px",
                            border: "none",
                            borderRadius: "6px",
                            cursor:
                              m.status === "out-of-service" ? "not-allowed" : "pointer",
                            opacity: m.status === "out-of-service" ? 0.6 : 1,
                            fontWeight: "bold",
                          }}
                          title={
                            m.status === "out-of-service"
                              ? "เครื่องนี้ไม่สามารถใช้งานได้"
                              : `Confirm & Start (${formatTime(totalTimeSec)})`
                          }
                        >
                          Confirm & Start ({formatTime(totalTimeSec)})
                        </button>
                        <button onClick={() => handleAdd10Dryer(m.id)}>
                          +10 ฿ (เพิ่ม +6 นาที)
                        </button>
                        {extra > 0 && (
                          <button
                            onClick={() => handleRemove10Dryer(m.id, base)}
                            style={{
                              backgroundColor: "#facc15",
                              color: "#111",
                              marginLeft: 8,
                            }}
                          >
                            -10 ฿ (ลบ -6 นาที)
                          </button>
                        )}
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            color: "#374151",
                          }}
                        >
                          ชำระเพิ่ม (ยังไม่หัก): {extra + base} ฿
                        </div>
                        <div style={{ fontSize: 13, color: "#4b5563" }}>
                          เวลารวมที่คาดว่าจะทำงาน: {formatTime(totalTimeSec)}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
