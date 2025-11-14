// Developed by Samiul Hasan
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;


const allowedOrigins = [
  'http://localhost:5173',       
  'https://seba-songjog.web.app/', 
  'https://assgn10.pages.dev/'     
];

const corsOptions = {
  origin: function (origin, callback) {

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));

app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME);
    console.log("Successfully connected to MongoDB Atlas!");
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
}

connectDB();

async function generateEventId() {
  try {
    const lastEvent = await db.collection("events")
      .find()
      .sort({ eventId: -1 })
      .limit(1)
      .toArray();
    
    if (lastEvent.length === 0) {
      return "EVT001";
    }
    
    const lastEventId = lastEvent[0].eventId;
    const lastNumber = parseInt(lastEventId.replace('EVT', ''));
    const newNumber = lastNumber + 1;
    return `EVT${newNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error generating event ID:", error);
    return `EVT${Date.now().toString().slice(-6)}`;
  }
}

async function generateUserId() {
  try {
    const lastUser = await db.collection("users")
      .find()
      .sort({ userId: -1 })
      .limit(1)
      .toArray();
    
    if (lastUser.length === 0) {
      return "USR001";
    }
    
    const lastUserId = lastUser[0].userId;
    const lastNumber = parseInt(lastUserId.replace('USR', ''));
    const newNumber = lastNumber + 1;
    return `USR${newNumber.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error("Error generating user ID:", error);
    return `USR${Date.now().toString().slice(-6)}`;
  }
}

app.get('/', (req, res) => {
  res.send('Server is running');
});

// ========== USERS API  Samiul Hasan) ==========

app.post('/api/users', async (req, res) => {
  const { uid, email, displayName, photoURL, authProvider } = req.body;

  if (!uid || !email) {
    return res.status(400).json({ error: "User ID and email are required" });
  }

  try {
    const existingUser = await db.collection("users").findOne({ uid });
    
    if (existingUser) {
      await db.collection("users").updateOne(
        { uid },
        { 
          $set: { 
            email,
            displayName: displayName || existingUser.displayName,
            photoURL: photoURL || existingUser.photoURL,
            lastLogin: new Date(),
            updatedAt: new Date()
          } 
        }
      );
      return res.json({ message: "User updated", user: existingUser });
    } else {
      const userId = await generateUserId();
      const userData = {
        userId,
        uid,
        email,
        displayName: displayName || "",
        photoURL: photoURL || "",
        authProvider: authProvider || "email",
        myEvents: [],
        joinedEvents: [],
        totalEventsCreated: 0,
        totalEventsJoined: 0,
        totalPoints: 0,
        joinedAt: new Date(),
        lastLogin: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection("users").insertOne(userData);
      return res.status(201).json({ 
        message: "User created successfully", 
        user: { ...userData, _id: result.insertedId }
      });
    }
  } catch (error) {
    console.error("User creation error:", error);
    res.status(500).json({ error: "Failed to create/update user" });
  }
});

app.get('/api/users/uid/:uid', async (req, res) => {
  try {
    const user = await db.collection("users").findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid user ID format" });
    }
    const user = await db.collection("users").findOne({ _id: new ObjectId(req.params.id) });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

app.get('/api/users/:uid/my-events', async (req, res) => {
  try {
    const user = await db.collection("users").findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const myEventIds = user.myEvents || [];
    const events = await db.collection("events")
      .find({ eventId: { $in: myEventIds } })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(events);
  } catch (error) {
    console.error("Get user events error:", error);
    res.status(500).json({ error: "Failed to fetch user events" });
  }
});

app.get('/api/users/:uid/joined-events', async (req, res) => {
  try {
    const user = await db.collection("users").findOne({ uid: req.params.uid });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const joinedEventIds = user.joinedEvents || [];
    const events = await db.collection("events")
      .find({ eventId: { $in: joinedEventIds } })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(events);
  } catch (error) {
    console.error("Get joined events error:", error);
    res.status(500).json({ error: "Failed to fetch joined events" });
  }
});

app.post('/api/users/:uid/my-events', async (req, res) => {
  try {
    const { eventId } = req.body;
    
    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required" });
    }

    await db.collection("users").updateOne(
      { uid: req.params.uid },
      { 
        $addToSet: { myEvents: eventId },
        $inc: { totalEventsCreated: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({ message: "Event added to user profile" });
  } catch (error) {
    console.error("Add to user events error:", error);
    res.status(500).json({ error: "Failed to add event to user profile" });
  }
});

app.post('/api/users/:uid/joined-events', async (req, res) => {
  try {
    const { eventId } = req.body;
    
    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required" });
    }

    await db.collection("users").updateOne(
      { uid: req.params.uid },
      { 
        $addToSet: { joinedEvents: eventId },
        $inc: { totalEventsJoined: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({ message: "Event added to joined events" });
  } catch (error) {
    console.error("Add to joined events error:", error);
    res.status(500).json({ error: "Failed to add event to joined events" });
  }
});

app.delete('/api/users/:uid/my-events/:eventId', async (req, res) => {
  try {
    await db.collection("users").updateOne(
      { uid: req.params.uid },
      { 
        $pull: { myEvents: req.params.eventId },
        $inc: { totalEventsCreated: -1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({ message: "Event removed from user profile" });
  } catch (error) {
    console.error("Remove from user events error:", error);
    res.status(500).json({ error: "Failed to remove event from user profile" });
  }
});

app.delete('/api/users/:uid/joined-events/:eventId', async (req, res) => {
  try {
    await db.collection("users").updateOne(
      { uid: req.params.uid },
      { 
        $pull: { joinedEvents: req.params.eventId },
        $inc: { totalEventsJoined: -1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({ message: "Event removed from joined events" });
  } catch (error) {
    console.error("Remove from joined events error:", error);
    res.status(500).json({ error: "Failed to remove event from joined events" });
  }
});

app.put('/api/users/:uid', async (req, res) => {
  const { displayName, photoURL, phone, location } = req.body;

  try {
    await db.collection("users").updateOne(
      { uid: req.params.uid },
      { 
        $set: { 
          displayName,
          photoURL,
          phone: phone || "",
          location: location || "",
          updatedAt: new Date()
        } 
      }
    );
    res.json({ message: "User profile updated successfully" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

// ========== EVENTS API  Samiul Hasan) ==========

app.get('/api/events', async (req, res) => {
  try {
    const events = await db.collection("events").find().sort({ createdAt: -1 }).toArray();
    res.json(events);
  } catch (error) {
    console.error("Get events error:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

app.get('/api/events/public', async (req, res) => {
  try {
    const events = await db.collection("events")
      .find({ visibility: { $ne: "private" } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(events);
  } catch (error)
 {
    console.error("Get public events error:", error);
    res.status(500).json({ error: "Failed to fetch public events" });
  }
});

app.get('/api/events/id/:eventId', async (req, res) => {
  try {
    const event = await db.collection("events").findOne({ eventId: req.params.eventId });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("Get event error:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid event ID format" });
    }
    const event = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (error) {
    console.error("Get event error:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

app.post('/api/events', async (req, res) => {
  const {
    title,
    organization,
    organizer,
    date,
    time,
    endTime,
    location,
    coordinates,
    category,
    volunteers,
    maxVolunteers,
    description,
    fullDescription,
    requirements,
    images,
    contact,
    verified,
    rating,
    reviews,
    impact,
    liveAttendance,
    points,
    isRecurring,
    recurrence,
    ownerId,
    ownerEmail,
    ownerName,
    visibility = "public"
  } = req.body;

  if (!title || !date || !location) {
    return res.status(400).json({ error: "Title, date and location are required" });
  }

  if (!ownerId) {
    return res.status(400).json({ error: "Owner ID is required" });
  }

  try {
    const eventId = await generateEventId();
    
    const eventData = { 
      eventId,
      title,
      organization: organization || "",
      organizer: organizer || "",
      date,
      time: time || "",
      endTime: endTime || "",
      location,
      coordinates: coordinates || { lat: 0, lng: 0 },
      category: category || "general",
      volunteers: volunteers || 0,
      maxVolunteers: maxVolunteers || 0,
      description,
      fullDescription: fullDescription || "",
      requirements: requirements || [],
      images: images || [],
      contact: contact || { email: "", phone: "", website: "" },
      verified: verified || false,
      rating: rating || 0,
      reviews: reviews || 0,
      impact: impact || {
        wasteCollected: "N/A",
        areaCleaned: "N/A",
        previousParticipants: "0"
      },
      liveAttendance: liveAttendance || 0,
      points: points || 0,
      isRecurring: isRecurring || false,
      recurrence: recurrence || "",
      ownerId,
      ownerEmail: ownerEmail || "",
      ownerName: ownerName || "",
      visibility: visibility || "public",
      createdAt: new Date(),
      updatedAt: new Date(),
      volunteerList: []
    };

    const result = await db.collection("events").insertOne(eventData);
    
    await db.collection("users").updateOne(
      { uid: ownerId },
      { 
        $addToSet: { myEvents: eventId },
        $inc: { totalEventsCreated: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.status(201).json({ 
      message: "Event added successfully", 
      id: result.insertedId,
      eventId: eventId 
    });
  } catch (error) {
    console.error("Create event error:", error);
    res.status(500).json({ error: "Failed to add event" });
  }
});

app.put('/api/events/id/:eventId', async (req, res) => {
  const eventData = { ...req.body, updatedAt: new Date() };
  delete eventData._id;
  delete eventData.eventId;
  delete eventData.ownerId;
  delete eventData.ownerEmail;
  delete eventData.ownerName;
  delete eventData.createdAt;

  try {
    await db.collection("events").updateOne(
      { eventId: req.params.eventId },
      { 
        $set: eventData
      }
    );
    res.json({ message: "Event updated successfully" });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

app.put('/api/events/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid event ID format" });
  }
  
  const eventData = { ...req.body, updatedAt: new Date() };
  delete eventData._id;
  delete eventData.eventId;
  delete eventData.ownerId;
  delete eventData.ownerEmail;
  delete eventData.ownerName;
  delete eventData.createdAt;

  try {
    await db.collection("events").updateOne(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: eventData
      }
    );
    res.json({ message: "Event updated successfully" });
  } catch (error) {
    console.error("Update event error:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

app.delete('/api/events/id/:eventId', async (req, res) => {
  try {
    const event = await db.collection("events").findOne({ eventId: req.params.eventId });
    
    if (event && event.ownerId) {
      await db.collection("users").updateOne(
        { uid: event.ownerId },
        { 
          $pull: { myEvents: req.params.eventId },
          $inc: { totalEventsCreated: -1 },
          $set: { updatedAt: new Date() }
        }
      );
    }
    
    await db.collection("events").deleteOne({ eventId: req.params.eventId });
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid event ID format" });
  }
  
  try {
    const event = await db.collection("events").findOne({ _id: new ObjectId(req.params.id) });
    
    if (event && event.ownerId) {
      await db.collection("users").updateOne(
        { uid: event.ownerId },
        { 
          $pull: { myEvents: event.eventId },
          $inc: { totalEventsCreated: -1 },
          $set: { updatedAt: new Date() }
        }
      );
    }
    
    await db.collection("events").deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Delete event error:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ========== EVENT VOLUNTEERS MANAGEMENT  Samiul Hasan) ==========

app.post('/api/events/:eventId/join', async (req, res) => {
  try {
    const { userId, userEmail, userName } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const event = await db.collection("events").findOne({ eventId: req.params.eventId });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (event.volunteers >= event.maxVolunteers) {
      return res.status(400).json({ error: "Event is full" });
    }
    
    const user = await db.collection("users").findOne({ uid: userId });
    if (user.joinedEvents && user.joinedEvents.includes(req.params.eventId)) {
        return res.status(400).json({ error: "You have already joined this event" });
    }

    await db.collection("events").updateOne(
      { eventId: req.params.eventId },
      { 
        $inc: { volunteers: 1, liveAttendance: 1 },
        $addToSet: { 
          volunteerList: {
            userId,
            userEmail,
            userName,
            joinedAt: new Date()
          }
        },
        $set: { updatedAt: new Date() }
      }
    );

    await db.collection("users").updateOne(
      { uid: userId },
      { 
        $addToSet: { joinedEvents: req.params.eventId },
        $inc: { totalEventsJoined: 1, totalPoints: event.points || 10 },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({ message: "Successfully joined the event" });
  } catch (error) {
    console.error("Join event error:", error);
    res.status(500).json({ error: "Failed to join event" });
  }
});

app.post('/api/events/:eventId/leave', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const event = await db.collection("events").findOne({ eventId: req.params.eventId });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    const user = await db.collection("users").findOne({ uid: userId });
    if (!user.joinedEvents || !user.joinedEvents.includes(req.params.eventId)) {
        return res.status(400).json({ error: "You have not joined this event" });
    }

    await db.collection("events").updateOne(
      { eventId: req.params.eventId },
      { 
        $inc: { volunteers: -1, liveAttendance: -1 },
        $pull: { 
          volunteerList: { userId: userId }
        },
        $set: { updatedAt: new Date() }
      }
    );

    await db.collection("users").updateOne(
      { uid: userId },
      { 
        $pull: { joinedEvents: req.params.eventId },
        $inc: { totalEventsJoined: -1, totalPoints: -(event.points || 10) },
        $set: { updatedAt: new Date() }
      }
    );

    res.json({ message: "Successfully left the event" });
  } catch (error) {
    console.error("Leave event error:", error);
    res.status(500).json({ error: "Failed to leave event" });
  }
});

app.get('/api/events/:eventId/volunteers', async (req, res) => {
  try {
    const event = await db.collection("events").findOne({ eventId: req.params.eventId });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    res.json(event.volunteerList || []);
  } catch (error) {
    console.error("Get event volunteers error:", error);
    res.status(500).json({ error: "Failed to fetch event volunteers" });
  }
});


// --- Server Listen  Samiul Hasan) ---
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});