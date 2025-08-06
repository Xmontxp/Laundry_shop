import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import dotenv from "dotenv";
import crypto from "crypto";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../")));

// LINE Messaging API config
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";

// Validate webhook signature
function validateSignature(req) {
  const signature = req.headers["x-line-signature"] || "";
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

// Push message helper
async function pushLineMessage(to, text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า");
    return;
  }
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/push",
      {
        to,
        messages: [
          {
            type: "text",
            text,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    console.error("LINE push error:", err.response?.data || err.message);
  }
}

// DB init
let db;
async function initDb() {
  db = await open({
    filename: "./laundry.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      kind TEXT,
      capacity TEXT,
      status TEXT,
      timeLeft INTEGER,
      notifiedAlmostDone INTEGER DEFAULT 0
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machineId TEXT,
      action TEXT,
      price INTEGER,
      timestamp INTEGER
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS balance (
      id INTEGER PRIMARY KEY CHECK (id=1),
      amount INTEGER
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      targetId TEXT UNIQUE,
      label TEXT
    );
  `);

  const row = await db.get("SELECT amount FROM balance WHERE id=1");
  if (!row) {
    await db.run("INSERT INTO balance (id, amount) VALUES (1, 0)");
  }

  const existing = await db.all("SELECT id FROM machines");
  if (existing.length === 0) {
    const machinesSeed = [
      { id: "W-11", kind: "washing", capacity: "10kg", status: "in-use", timeLeft: 150 },
      { id: "W-12", kind: "washing", capacity: "10kg", status: "available", timeLeft: null },
      { id: "W-13", kind: "washing", capacity: "10kg", status: "out-of-service", timeLeft: null },
      { id: "W-21", kind: "washing", capacity: "15kg", status: "available", timeLeft: null },
      { id: "W-22", kind: "washing", capacity: "15kg", status: "available", timeLeft: null },
      { id: "W-23", kind: "washing", capacity: "15kg", status: "out-of-service", timeLeft: null },
      { id: "W-24", kind: "washing", capacity: "15kg", status: "in-use", timeLeft: 180 },
      { id: "W-25", kind: "washing", capacity: "15kg", status: "in-use", timeLeft: 130 },
      { id: "W-31", kind: "washing", capacity: "20kg", status: "available", timeLeft: null },
      { id: "W-31", kind: "washing", capacity: "20kg", status: "available", timeLeft: null },
      { id: "W-31", kind: "washing", capacity: "20kg", status: "available", timeLeft: null },
      { id: "D-11", kind: "dryer", capacity: "15kg", status: "in-use", timeLeft: 150 },
      { id: "D-12", kind: "dryer", capacity: "15kg", status: "available", timeLeft: null },
      { id: "D-13", kind: "dryer", capacity: "15kg", status: "out-of-service", timeLeft: null },
      { id: "D-14", kind: "dryer", capacity: "15kg", status: "in-use", timeLeft: 120 },
      { id: "D-15", kind: "dryer", capacity: "15kg", status: "available", timeLeft: null },
      { id: "D-16", kind: "dryer", capacity: "15kg", status: "available", timeLeft: null },
      { id: "D-17", kind: "dryer", capacity: "15kg", status: "in-use", timeLeft: 180 },
      { id: "D-18", kind: "dryer", capacity: "15kg", status: "available", timeLeft: null },
      { id: "D-21", kind: "dryer", capacity: "20kg", status: "available", timeLeft: null },
      { id: "D-22", kind: "dryer", capacity: "20kg", status: "available", timeLeft: null },
    ];
    for (const m of machinesSeed) {
      await db.run(
        `INSERT INTO machines (id, kind, capacity, status, timeLeft, notifiedAlmostDone) VALUES (?, ?, ?, ?, ?, 0)`,
        m.id,
        m.kind,
        m.capacity,
        m.status,
        m.timeLeft
      );
    }
  }
}
await initDb();

// --- API routes ---

// LINE webhook
app.post("/api/webhook", async (req, res) => {
  if (LINE_CHANNEL_SECRET && !validateSignature(req)) {
    return res.status(401).send("Invalid signature");
  }

  const events = req.body.events || [];
  for (const event of events) {
    const source = event.source || {};
    let targetId = null;
    if (source.groupId) targetId = source.groupId;
    else if (source.roomId) targetId = source.roomId;
    else if (source.userId) targetId = source.userId;

    if (targetId) {
      try {
        await db.run(
          `INSERT OR IGNORE INTO recipients (targetId, label) VALUES (?, ?)`,
          targetId,
          `${event.source.type || "unknown"}:${targetId}`
        );
        console.log("Registered recipient:", targetId);
      } catch (e) {
        console.error("Recipient insert error:", e);
      }
    }

    if (event.type === "message" && event.replyToken) {
      try {
        await axios.post(
          "https://api.line.me/v2/bot/message/reply",
          {
            replyToken: event.replyToken,
            messages: [
              {
                type: "text",
                text: "รับทราบแล้ว จะส่งแจ้งเตือนเมื่อเครื่องใกล้หมดเวลา",
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );
      } catch (e) {
        console.error("Reply error:", e.response?.data || e.message);
      }
    }
  }

  res.sendStatus(200);
});

// Get recipients
app.get("/api/recipients", async (req, res) => {
  const rows = await db.all("SELECT * FROM recipients");
  res.json(rows);
});

// Machines list
app.get("/api/machines", async (req, res) => {
  const machines = await db.all("SELECT * FROM machines");
  res.json(
    machines.map((m) => ({
      ...m,
      notifiedAlmostDone: Boolean(m.notifiedAlmostDone),
    }))
  );
});

// Top-up
app.post("/api/topup", async (req, res) => {
  const { amount } = req.body;
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return res.json({ ok: false, message: "จำนวนเงินไม่ถูกต้อง" });
  }
  await db.run("UPDATE balance SET amount = amount + ? WHERE id=1", amount);
  const row = await db.get("SELECT amount FROM balance WHERE id=1");
  res.json({ ok: true, balance: row.amount });
});

// Start machine
app.post("/api/start", async (req, res) => {
  const { id, durationSec, price } = req.body;
  if (!id || typeof durationSec !== "number" || typeof price !== "number") {
    return res.json({ ok: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  const machine = await db.get("SELECT * FROM machines WHERE id=?", id);
  if (!machine) return res.json({ ok: false, message: "ไม่พบเครื่อง" });
  if (machine.status === "in-use") {
    return res.json({ ok: false, message: "เครื่องกำลังใช้งานอยู่" });
  }

  const balRow = await db.get("SELECT amount FROM balance WHERE id=1");
  if (balRow.amount < price) {
    return res.json({ ok: false, message: "ยอดเงินไม่พอ" });
  }

  await db.run(
    `UPDATE machines SET status='in-use', timeLeft=?, notifiedAlmostDone=0 WHERE id=?`,
    durationSec,
    id
  );
  await db.run("UPDATE balance SET amount = amount - ? WHERE id=1", price);
  await db.run(
    `INSERT INTO history (machineId, action, price, timestamp) VALUES (?, ?, ?, ?)`,
    id,
    "start",
    price,
    Date.now()
  );

  const newBalance = (await db.get("SELECT amount FROM balance WHERE id=1")).amount;
  res.json({ ok: true, balance: newBalance });
});

// Set available
app.post("/api/setAvailable", async (req, res) => {
  const { id } = req.body;
  const machine = await db.get("SELECT * FROM machines WHERE id=?", id);
  if (!machine) return res.status(404).json({ ok: false, message: "ไม่พบเครื่อง" });

  await db.run(
    `UPDATE machines SET status='available', timeLeft=NULL, notifiedAlmostDone=0 WHERE id=?`,
    id
  );
  res.json({ ok: true });
});

// History
app.get("/api/history", async (req, res) => {
  const rows = await db.all("SELECT * FROM history ORDER BY timestamp DESC");
  res.json(rows);
});

// Balance
app.get("/api/balance", async (req, res) => {
  const row = await db.get("SELECT amount FROM balance WHERE id=1");
  res.json({ balance: row.amount });
});

// Manual push (testing)
app.post("/api/notify/push-all", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ ok: false, message: "ต้องมีข้อความ" });

  const recipients = await db.all("SELECT targetId FROM recipients");
  for (const r of recipients) {
    await pushLineMessage(r.targetId, message);
  }
  res.json({ ok: true });
});

// Scheduler: atomic decrement + แจ้งเตือนแค่ครั้งเดียว
setInterval(async () => {
  const machines = await db.all("SELECT * FROM machines");
  for (const m of machines) {
    if (m.status === "in-use" && typeof m.timeLeft === "number") {
      try {
        // เริ่ม transaction
        await db.run("BEGIN IMMEDIATE");

        // ดึงค่าล่าสุดอีกครั้ง
        const fresh = await db.get("SELECT * FROM machines WHERE id=?", m.id);
        if (!(fresh.status === "in-use" && typeof fresh.timeLeft === "number")) {
          await db.run("COMMIT");
          continue;
        }

        const newTime = Math.max(0, fresh.timeLeft - 1);
        await db.run("UPDATE machines SET timeLeft=? WHERE id=?", newTime, m.id);

        let shouldNotify = false;
        if (newTime <= 60 && fresh.notifiedAlmostDone === 0) {
          await db.run("UPDATE machines SET notifiedAlmostDone=1 WHERE id=?", m.id);
          shouldNotify = true;
        }

        if (newTime === 0) {
          await db.run(
            `UPDATE machines SET status='available', timeLeft=NULL, notifiedAlmostDone=0 WHERE id=?`,
            m.id
          );
        }

        await db.run("COMMIT");

        if (shouldNotify) {
          const kindLabel = fresh.kind === "washing" ? "เครื่องซักผ้า" : "เครื่องอบผ้า";
          const displayTime =
            newTime >= 60 ? `${Math.ceil(newTime / 60)} นาที` : `${newTime} วินาที`;
          const message = `${kindLabel} ${m.id} เหลือเวลาอีก ${displayTime}`;

          const recipients = await db.all("SELECT targetId FROM recipients");
          for (const r of recipients) {
            await pushLineMessage(r.targetId, message);
          }
        }
      } catch (err) {
        console.error("Scheduler error:", err);
        try {
          await db.run("ROLLBACK");
        } catch {}
      }
    }
  }
}, 1000);

app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
