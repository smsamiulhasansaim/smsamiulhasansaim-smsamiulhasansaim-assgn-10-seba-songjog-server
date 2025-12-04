require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const baseOrigins = [
  'https://assgn10.pages.dev',
  'https://seba-songjog.vercel.app',
  'https://seba-songjog.web.app',
  'http://localhost:5173',
  'http://localhost:5174'
];

const envOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

const allowedOrigins = [...new Set([...baseOrigins, ...envOrigins])];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Client
const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

// Generate Custom Event ID
async function generateEventId() {
  try {
    const result = await db.collection('counters').findOneAndUpdate(
      { _id: 'eventId' },
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );

    const seq = result.value.seq.toString().padStart(4, '0');
    const year = new Date().getFullYear();
    return `EVT-${year}-${seq}`; 
  } catch (error) {
    return `EVT-${Date.now()}`;
  }
}

const connectDB = async () => {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    console.log("Connected to MongoDB successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// --- ROUTES ---

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Seba Songjog Server is running',
    timestamp: new Date().toISOString()
  });
});

// CREATE Event
app.post('/api/events', async (req, res) => {
  try {
    const eventId = await generateEventId();
    const eventData = {
      ...req.body,
      eventId,                    
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('events').insertOne(eventData);

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: { _id: result.insertedId, ...eventData }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create event', error: error.message });
  }
});

// GET All Events
app.get('/api/events', async (req, res) => {
  try {
    const events = await db.collection('events')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, count: events.length, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch events' });
  }
});

// GET Single Event by ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format' });
    }

    const event = await db.collection('events').findOne({ _id: new ObjectId(id) });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    res.json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE Event 
app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const result = await db.collection('events').deleteOne({
      _id: new ObjectId(id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Server error during deletion' });
  }
});

// UPDATE Event 
app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    delete updateData._id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const result = await db.collection('events').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updateData, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.json({ success: true, message: 'Event updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error during update' });
  }
});

// Error Handlers
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((error, req, res, next) => {
  if (error.message.includes('Not allowed by CORS')) {
    return res.status(403).json({ success: false, message: 'CORS policy: Origin not allowed' });
  }
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start Server
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();