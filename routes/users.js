import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// POST /users/create → create user if doesn't exist
router.post("/create", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Missing email in request body" });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(200).json(existingUser);
    }

    const newUser = await prisma.user.create({ data: { email } });
    return res.status(201).json(newUser);
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /users/find?email=... → find user by email
router.get("/find", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: "Missing email in query" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        student: true,
        recruiter: true,
        ambassador: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error finding user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /users/:id → find user by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Missing user ID in URL parameter" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        student: true,
        recruiter: true,
        ambassador: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
