import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET /students/:id → fetch student by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const student = await prisma.student.findUnique({
      where: { userId: id },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
        applications: {
          include: {
            post: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(401).json({
        error: "STUDENT_NOT_FOUND",
        message: "To access student dashboard, kindly login as student",
        redirectTo: "/sip/login",
      });
    }

    return res.status(200).json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /students/:id → update student by ID
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    rollNo,
    branch,
    cpi,
    courseType,
    year,
    linkedinUrl,
    githubUrl,
    resumeUrl,
  } = req.body;

  try {
    const updated = await prisma.student.update({
      where: { userId: id },
      data: {
        name,
        rollNo,
        branch,
        cpi,
        courseType,
        year,
        linkedinUrl,
        githubUrl,
        resumeUrl,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating student:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /students → create new student
router.post("/", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId or email" });
  }

  try {
    const existing = await prisma.student.findUnique({
      where: { userId },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const newStudent = await prisma.student.create({
      data: {
        userId,
        name: "",
        rollNo: "",
        branch: "",
        cpi: 0,
        courseType: "",
        year: 1,
        linkedinUrl: "",
        githubUrl: "",
        resumeUrl: "",
      },
    });

    return res.status(201).json(newStudent);
  } catch (err) {
    console.error("Failed to create student:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
