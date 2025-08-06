import EventEmitter from 'events';

const event = new EventEmitter();

// Initialize machines according to spec
// Washing: W-01... capacities 10,15,20. Dryers: D-01...
const machines = [
  // Washing machines
  { id: 'W-01', kind: 'washing', capacity: 10, status: 'available', remaining: 0, notified: false },
  { id: 'W-02', kind: 'washing', capacity: 15, status: 'available', remaining: 0, notified: false },
  { id: 'W-03', kind: 'washing', capacity: 20, status: 'available', remaining: 0, notified: false },
  // Dryers
  { id: 'D-01', kind: 'dryer', capacity: 15, status: 'available', remaining: 0, notified: false },
  { id: 'D-02', kind: 'dryer', capacity: 20, status: 'available', remaining: 0, notified: false },
];

let timers = {};

function getMachines(){
  return machines;
}

function findMachine(id){
  return machines.find(m => m.id === id);
}

// Start a machine with duration (seconds). If already in use, reject.
function startMachine(id, durationSec){
  const m = findMachine(id);
  if(!m) throw new Error('Machine not found');
  if(m.status === 'in-use') throw new Error('Machine already in use');
  m.status = 'in-use';
  m.remaining = durationSec;
  m.notified = false;

  // Create interval for countdown
  if(timers[id]) clearInterval(timers[id]);
  timers[id] = setInterval(() => {
    m.remaining = Math.max(0, m.remaining - 1);
    // Emit tick event
    event.emit('tick', { id: m.id, remaining: m.remaining });

    // If less than 60s and not notified -> emit notify event
    if(m.remaining <= 60 && !m.notified && m.remaining > 0){
      m.notified = true;
      event.emit('almost-done', { id: m.id, remaining: m.remaining });
    }
    // When reaches 0, stop
    if(m.remaining === 0){
      clearInterval(timers[id]);
      delete timers[id];
      m.status = 'available';
      event.emit('finished', { id: m.id });
    }
  }, 1000);
}

// Stop/reset machine (for maintenance etc.)
function stopMachine(id){
  const m = findMachine(id);
  if(!m) throw new Error('Machine not found');
  if(timers[id]){
    clearInterval(timers[id]);
    delete timers[id];
  }
  m.status = 'available';
  m.remaining = 0;
  m.notified = false;
}

export { getMachines, startMachine, stopMachine, event };
