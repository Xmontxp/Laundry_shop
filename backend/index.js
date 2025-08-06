import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { getMachines, startMachine, stopMachine, event } from './machines.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';

// GET /api/machines
app.get('/api/machines', (req, res) => {
  res.json(getMachines());
});

// POST /api/start
// body: { id: 'W-01', durationSec: 1500 }
// ตัวอย่างแก้ไขใน backend/index.js (เฉพาะส่วน POST /api/start)
app.post('/api/start', (req, res) => {
  const { id, durationSec = 1500, price = 0 } = req.body;
  try {
    // check machine available
    const m = getMachines().find(x => x.id === id);
    if(!m) return res.status(400).json({ ok:false, message: 'Machine not found' });
    if(m.status === 'in-use') return res.status(400).json({ ok:false, message: 'Machine already in use' });

    // check balance
    if(userBalance < Number(price)) {
      return res.status(400).json({ ok:false, message: 'Insufficient balance' });
    }

    // deduct balance and start
    userBalance = userBalance - Number(price);

    startMachine(id, Number(durationSec) || 1500);

    return res.json({ ok: true, message: 'Machine started', balance: userBalance });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});


// POST /api/stop
app.post('/api/stop', (req, res) => {
  const { id } = req.body;
  try {
    stopMachine(id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

// POST /api/topup (simple simulation)
let userBalance = 0;
app.post('/api/topup', (req, res) => {
  const { amount } = req.body;
  const num = Number(amount) || 0;
  if(num <= 0) return res.status(400).json({ ok:false, message: 'Invalid amount' });
  userBalance += num;
  return res.json({ ok:true, balance: userBalance });
});

// Listen to machine events for notifications
event.on('almost-done', async ({ id, remaining }) => {
  const payload = { machineId: id, remainingSeconds: remaining, message: 'Less than 60 seconds remaining' };
  console.log('ALMOST DONE:', payload);
  if(WEBHOOK_URL){
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('Webhook sent to', WEBHOOK_URL);
    } catch (err) {
      console.error('Failed to send webhook', err.message);
    }
  }
});

event.on('finished', ({ id }) => {
  console.log('Machine finished:', id);
});

app.listen(PORT, () => {
  console.log(`Laundry backend running on http://localhost:${PORT}`);
  console.log('Use .env to configure WEBHOOK_URL');
});
