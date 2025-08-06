// src/components/TopUpForm.jsx
import React, { useState } from "react";

export default function TopUpForm({ balance, onBalanceChange }) {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  async function handleTopUp(e) {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      setMessage("กรุณาใส่จำนวนเงินที่ถูกต้อง (บาท)");
      return;
    }

    try {
      const res = await fetch("http://localhost:3001/api/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num }),
      });

      const data = await res.json();

      if (data.ok) {
        onBalanceChange(data.balance);
        setMessage(`เติมเงินสำเร็จ: ${num} ฿ (ยอดคงเหลือ: ${data.balance} ฿)`);
        setAmount("");
        setTimeout(() => setMessage(""), 5000);
      } else {
        setMessage(data.message || "เติมเงินไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      setMessage("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    }
  }

  return (
    <div>
      <h3>Top-up Coins (THB)</h3>
      <form onSubmit={handleTopUp} className="topup-form">
        <label>
          Amount (฿)
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="เช่น 50"
          />
        </label>
        <div className="actions">
          <button
            type="submit"
            style={{
              backgroundColor: "#4f46e5", // Indigo
              color: "#fff",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Confirm Payment (simulate)
          </button>
        </div>
      </form>

      <div className="balance">
        <strong>Balance:</strong> {balance} ฿
      </div>

      {message && <div className="message">{message}</div>}
    </div>
  );
}
