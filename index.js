const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Allow localhost (dev) + all your production domains
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://seba-songjog.web.app",
  "https://seba-songjog.vercel.app",
  "https://assgn10.pages.dev"
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Blocked by CORS"));
    }
  },
  credentials: true
}));

app.use(express.json());

// Database connection
let db;

async function connectDB() {
  try {
    const client = new MongoClient(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db("seba-songjog-server");
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

connectDB();

// Unified API endpoint
app.route("/api/events")

  // GET: Fetch public events (or include private if uid provided)
  .get(async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database not ready" });

    try {
      const { uid } = req.query;
      const query = uid
        ? { $or: [{ visibility: { $ne: "private" } }, { ownerId: uid }] }
        : { visibility: { $ne: "private" } };

      const events = await db
        .collection("events")
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.json(events);
    } catch (error) {
      console.error("GET error:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  })

  // POST: Create event, Join, or Leave
  .post(async (req, res) => {
    if (!db) return res.status(503).json({ error: "Database not ready" });

    const { type } = req.body;

    // Create Event
    if (type === "create") {
      const { uid, email, name, title, date, location, visibility = "public" } = req.body;

      if (!uid || !email || !title || !date || !location) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const eventId = "EVT" + Date.now().toString().slice(-6);
      const newEvent = {
        eventId,
        title,
        date,
        location,
        visibility,
        ownerId: uid,
        ownerEmail: email,
        ownerName: name || email.split("@")[0],
        volunteers: 0,
        volunteerList: [],
        createdAt: new Date(),
      };

      await db.collection("events").insertOne(newEvent);
      return res.json({ message: "Event created successfully", eventId });
    }

    // Join or Leave Event
    if (type === "join" || type === "leave") {
      const { eventId, uid, email, name } = req.body;
      if (!eventId || !uid) return res.status(400).json({ error: "eventId and uid required" });

      const event = await db.collection("events").findOne({ eventId });
      if (!event) return res.status(404).json({ error: "Event not found" });

      if (type === "join") {
        if (event.volunteerList?.some(v => v.uid === uid)) {
          return res.status(400).json({ error: "Already joined" });
        }

        await db.collection("events").updateOne(
          { eventId },
          {
            $inc: { volunteers: 1 },
            $push: {
              volunteerList: {
                uid,
                email,
                name: name || email.split("@")[0],
                joinedAt: new Date(),
              },
            },
          }
        );
        return res.json({ message: "Joined successfully" });
      }

      if (type === "leave") {
        await db.collection("events").updateOne(
          { eventId },
          {
            $inc: { volunteers: -1 },
            $pull: { volunteerList: { uid } },
          }
        );
        return res.json({ message: "Left successfully" });
      }
    }

    res.status(400).json({ error: "Invalid type. Use: create, join, or leave" });
  });

// Health check
app.get("/", (req, res) => {
  res.send("Seba Songjog API is running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});