import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET /students/:id → fetch student by ID
router.get("/getinfo/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const student = await prisma.student.findFirst({
      where: {
        OR: [
          { userId: id },
          { id: id }
        ]
      },
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
      return res.status(404).json({
        error: "STUDENT_NOT_FOUND",
        message: "Student profile not found",
      });
    }

    return res.status(200).json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /students/:id → update student by ID
router.put("/update/:id", async (req, res) => {
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
    const data = {
      name,
      rollNo,
      branch,
      cpi: typeof cpi === "number" ? cpi : (Number.parseFloat(cpi) || 0),
      courseType: courseType || "B.Tech",
      year: typeof year === "number" ? year : (Number.parseInt(year) || 1),
      linkedinUrl: linkedinUrl || "",
      githubUrl: githubUrl || "",
      resumeUrl: resumeUrl || "",
    };

    const updated = await prisma.student.upsert({
      where: { userId: id },
      update: data,
      create: {
        userId: id,
        ...data,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating student:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /students → create new student
router.post("/register", async (req, res) => {
  const {
    userId,
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

  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    const data = {
      name: name || "",
      rollNo: rollNo || "",
      branch: branch || "Architecture, Planning and Design",
      cpi: typeof cpi === "number" ? cpi : (Number.parseFloat(cpi) || 0),
      courseType: courseType || "B.Tech",
      year: typeof year === "number" ? year : (Number.parseInt(year) || 1),
      linkedinUrl: linkedinUrl || "",
      githubUrl: githubUrl || "",
      resumeUrl: resumeUrl || "",
    };

    const savedStudent = await prisma.student.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });

    return res.status(200).json(savedStudent);
  } catch (err) {
    console.error("Failed to create student:", err);
    return res.status(500).json({ message: "Failed to create student" });
  }
});


export default router;
