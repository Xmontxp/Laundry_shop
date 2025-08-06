import React, { useState, useCallback } from "react";
import MachineList from "./components/MachineList";
import TopUpForm from "./components/TopUpForm";
import LineNotify from "./components/LineNotify";
import "./styles.css";

function BlankPage() {
  return (
    <div className="blank-page">
      <h2>Blank Page / Workspace</h2>
      <p>This page is intentionally minimal so you can modify it freely.</p>
    </div>
  );
}

export default function App() {
  const [balance, setBalance] = useState(0);

  const updateBalance = useCallback((newBalance) => {
    setBalance(newBalance);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>Laundry shop</h1>
      </header>

      <main className="main-grid">
        <section className="left">
          <TopUpForm balance={balance} onBalanceChange={updateBalance} />
        </section>

        <section className="center">
          <MachineList balance={balance} onBalanceChange={updateBalance} />
        </section>

        <section className="right">
          <LineNotify
            apiBase="http://localhost:3001" // เปลี่ยนตาม URL backend ของคุณ เช่น ngrok URL
            lineGroupJoinUrl="https://line.me/ti/g/gqLKtrmgUd"
          />
        </section>
      </main>
    </div>
  );
}
