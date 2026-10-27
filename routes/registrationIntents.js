import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /registration-intents -> record user intent to register for an event
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      userEmail,
      userName,
      eventSlug = "esummit-27",
      eventName = "E-Summit '27 Pass",
      platform = "konfhub",
      status = "clicked",
    } = req.body;

    const email = (userEmail || req.user?.email || "").trim();
    if (!email) {
      return res.status(400).json({ error: "userEmail is required" });
    }

    // Resolve valid UUID for userId if possible
    let validUserId = null;
    const candidateId = userId || req.user?.id;
    if (candidateId && typeof candidateId === "string" && UUID_REGEX.test(candidateId)) {
      validUserId = candidateId;
    } else {
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email },
          select: { id: true, student: { select: { name: true } } },
        });
        if (existingUser?.id) {
          validUserId = existingUser.id;
        }
      } catch (err) {
        // ignore lookup error
      }
    }

    const name = userName || req.user?.name || null;

    const intent = await prisma.registrationIntent.create({
      data: {
        userId: validUserId,
        userEmail: email,
        userName: name,
        eventSlug: eventSlug || "esummit-27",
        eventName: eventName || "E-Summit '27 Pass",
        platform: platform || "konfhub",
        status: status || "clicked",
      },
    });

    console.log(`[registration-intent] Tracked intent for ${email} on ${eventName} (${eventSlug})`);
    return res.status(201).json({ success: true, data: intent });
  } catch (error) {
    console.error("[registration-intent] Error creating intent:", error);
    return res.status(500).json({ error: error.message || "Failed to record intent" });
  }
});

// GET /registration-intents -> list registration intents (with optional filters)
router.get("/", async (req, res) => {
  try {
    const { eventSlug, email } = req.query;
    const where = {};
    if (eventSlug) where.eventSlug = String(eventSlug);
    if (email) where.userEmail = String(email);

    const intents = await prisma.registrationIntent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.status(200).json({ success: true, count: intents.length, data: intents });
  } catch (error) {
    console.error("[registration-intent] Error fetching intents:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch intents" });
  }
});

export default router;
