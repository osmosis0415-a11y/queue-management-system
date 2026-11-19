const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const defaultCounters = [
  { id: 'counter-1', name: 'Counter 1', status: 'available', currentTicket: null },
  { id: 'counter-2', name: 'Counter 2', status: 'available', currentTicket: null },
  { id: 'counter-3', name: 'Counter 3', status: 'available', currentTicket: null }
];

const state = {
  nextNumber: 1,
  queue: [],
  counters: structuredClone(defaultCounters),
  dailySummary: {
    ticketsCreated: 0,
    ticketsServed: 0,
    averageWaitMinutes: 0
  }
};

function ticketNumberLabel(number) {
  return `Q-${String(number).padStart(3, '0')}`;
}

function createTicket({ name = 'Guest', service = 'General Assistance' }) {
  const number = state.nextNumber;
  const ticket = {
    id: `ticket-${Date.now()}-${number}`,
    number,
    label: ticketNumberLabel(number),
    name,
    service,
    status: 'waiting',
    counterId: null,
    createdAt: new Date().toISOString(),
    calledAt: null,
    servedAt: null
  };

  state.nextNumber += 1;
  state.queue.push(ticket);
  state.dailySummary.ticketsCreated += 1;

  return ticket;
}

function findTicket(ticketId) {
  return state.queue.find((ticket) => ticket.id === ticketId) || null;
}

function findCounter(counterId) {
  return state.counters.find((counter) => counter.id === counterId) || null;
}

function sendState() {
  const queueWithPosition = state.queue.map((ticket, index) => ({
    ...ticket,
    position: index + 1
  }));

  io.emit('state', {
    queue: queueWithPosition,
    counters: state.counters,
    dailySummary: state.dailySummary,
    nextNumber: state.nextNumber
  });
}

app.get('/api/state', (req, res) => {
  res.json({
    queue: state.queue.map((ticket, index) => ({ ...ticket, position: index + 1 })),
    counters: state.counters,
    dailySummary: state.dailySummary,
    nextNumber: state.nextNumber
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'queue-management-system' });
});

app.post('/api/tickets', (req, res) => {
  const { name, service } = req.body || {};
  const ticket = createTicket({
    name: name?.trim() || 'Guest',
    service: service?.trim() || 'General Assistance'
  });

  sendState();
  res.status(201).json(ticket);
});

app.post('/api/tickets/call-next', (req, res) => {
  const { counterId } = req.body || {};
  const counter = findCounter(counterId);

  if (!counter) {
    return res.status(400).json({ error: 'Counter not found.' });
  }

  const nextTicket = state.queue.find((ticket) => ticket.status === 'waiting');

  if (!nextTicket) {
    return res.status(400).json({ error: 'No waiting tickets.' });
  }

  nextTicket.status = 'called';
  nextTicket.counterId = counter.id;
  nextTicket.calledAt = new Date().toISOString();
  counter.status = 'busy';
  counter.currentTicket = nextTicket.label;

  sendState();
  res.json({ message: 'Next ticket called', ticket: nextTicket, counter });
});

app.post('/api/tickets/serve', (req, res) => {
  const { ticketId, counterId } = req.body || {};
  const counter = findCounter(counterId || 'counter-1');
  const ticket = findTicket(ticketId);

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  if (counter) {
    counter.status = 'available';
    counter.currentTicket = null;
  }

  ticket.status = 'served';
  ticket.servedAt = new Date().toISOString();
  ticket.counterId = counterId || ticket.counterId;

  state.dailySummary.ticketsServed += 1;

  const servedTickets = state.queue.filter((item) => item.status === 'served');
  if (servedTickets.length > 0) {
    const averageWaitMs = servedTickets.reduce((total, item) => {
      if (!item.calledAt || !item.createdAt) return total;
      return total + (new Date(item.calledAt) - new Date(item.createdAt));
    }, 0) / servedTickets.length;

    state.dailySummary.averageWaitMinutes = Number((averageWaitMs / 60000).toFixed(1));
  }

  sendState();
  res.json({ message: 'Ticket served', ticket, counter });
});

app.post('/api/tickets/skip', (req, res) => {
  const { ticketId } = req.body || {};
  const ticket = findTicket(ticketId);

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found.' });
  }

  ticket.status = 'skipped';
  sendState();
  res.json({ message: 'Ticket skipped', ticket });
});

app.post('/api/counters/reset', (req, res) => {
  state.counters = structuredClone(defaultCounters);
  state.queue = state.queue.map((ticket) => ({
    ...ticket,
    status: ticket.status === 'served' ? 'served' : 'waiting',
    counterId: null,
    calledAt: null,
    servedAt: null
  }));

  sendState();
  res.json({ message: 'Counters reset.', counters: state.counters });
});

io.on('connection', (socket) => {
  socket.emit('state', {
    queue: state.queue.map((ticket, index) => ({ ...ticket, position: index + 1 })),
    counters: state.counters,
    dailySummary: state.dailySummary,
    nextNumber: state.nextNumber
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Queue management system running on http://0.0.0.0:${PORT}`);
});
