import React, { useEffect, useState, useRef } from "react";

export default function LineNotify({
  pollIntervalMs = 5000,
  apiBase = "https://34d5876191d5.ngrok-free.app", // เปลี่ยนตาม ngrok URL หรือ localhost:3001
  lineGroupJoinUrl = "https://line.me/ti/g/gqLKtrmgUd",
}) {
  const [machines, setMachines] = useState([]);
  const [status, setStatus] = useState("");
  const prevNearFinishRef = useRef(new Set());
  const isMountedRef = useRef(true);

  // ดึงข้อมูลเครื่อง
  async function fetchMachines() {
    try {
      const res = await fetch(`${apiBase}/api/machines`);
      if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลเครื่องได้");
      const data = await res.json();
      if (isMountedRef.current) setMachines(data);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    fetchMachines();
    const id = setInterval(fetchMachines, pollIntervalMs);
    return () => {
      isMountedRef.current = false;
      clearInterval(id);
    };
  }, [pollIntervalMs, apiBase]);

  const nearFinish = machines.filter(
    (m) =>
      m.status === "in-use" &&
      typeof m.timeLeft === "number" &&
      m.timeLeft <= 60
  );

  useEffect(() => {
    const currentIds = new Set(nearFinish.map((m) => m.id));
    prevNearFinishRef.current = currentIds;
  }, [nearFinish]);

  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        padding: 16,
        borderRadius: 8,
        maxWidth: 600,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <h3>Line-notify</h3>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>เข้าร่วมกลุ่มไลน์</strong>
        </div>
        <div>
          <a
            href={lineGroupJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              backgroundColor: "#10b981",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: "bold",
              fontSize: 16,
            }}
          >
            คลิกเพื่อเข้าร่วมกลุ่มไลน์
          </a>
        </div>
      </div>

      {nearFinish.map((m) => (
        <div
          key={m.id}
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid #f0f0f0",
            marginBottom: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div>
            <strong>
              {m.kind === "washing" ? "เครื่องซักผ้า" : "เครื่องอบผ้า"} {m.id}
            </strong>{" "}
            – เหลือเวลาอีก{" "}
            <span style={{ fontWeight: "600" }}>
              {m.timeLeft >= 60
                ? `${Math.ceil(m.timeLeft / 60)} นาที`
                : `${m.timeLeft} วินาที`}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            {m.notifiedAlmostDone
              ? "แจ้งเตือนอัตโนมัติส่งแล้ว"
              : "กำลังจะส่งแจ้งเตือน..."}
          </div>
        </div>
      ))}

      {status && (
        <div
          style={{
            marginTop: 14,
            backgroundColor: "#f3f4f6",
            padding: 10,
            borderRadius: 4,
          }}
        >
          {status}
        </div>
      )}
    </div>
  );
}
