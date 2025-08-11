import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET /applications/:id → Get application by ID
router.get("/getone/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        student: true,
        post: true,
      },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    return res.status(200).json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return res.status(500).json({ message: "Error fetching application" });
  }
});

// PUT /applications/:id → Update application status
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const application = await prisma.application.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json(application);
  } catch (error) {
    console.error("Error updating application:", error);
    return res.status(500).json({ message: "Error updating application" });
  }
});

// DELETE /applications/:id → Withdraw (delete) application
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    // console.log("Status of application:", application.status);
    const status = application.status?.toLowerCase?.();
    if (status === "rejected") {
      return res
        .status(400)
        .json({ message: "Cannot withdraw a rejected application" });
    }

    await prisma.application.delete({
      where: { id },
    });

    return res
      .status(200)
      .json({ message: "Application withdrawn successfully" });
  } catch (error) {
    console.error("Error deleting application:", error);
    return res.status(500).json({ message: "Error deleting application" });
  }
});

// GET /applications → List applications (optionally filtered by studentId or postId)
router.get("/getinfo/", async (req, res) => {
  const { studentId, postId } = req.query;

  try {
    const where = {};
    if (studentId) where.studentId = studentId;
    if (postId) where.postId = postId;

    const applications = await prisma.application.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                email: true,
                createdAt: true,
              },
            },
          },
        },
        post: {
          include: {
            recruiter: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        appliedAt: "desc",
      },
    });

    return res.status(200).json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return res.status(500).json({ message: "Error fetching applications" });
  }
});

// POST /applications → Create new application
router.post("/create", async (req, res) => {
  const { studentId, postId } = req.body;

  if (!studentId || !postId) {
    return res.status(400).json({ message: "Missing studentId or postId" });
  }

  try {
    const existingApplication = await prisma.application.findFirst({
      where: {
        studentId,
        postId,
      },
    });

    if (existingApplication) {
      return res
        .status(400)
        .json({ message: "You have already applied for this position" });
    }

    const application = await prisma.application.create({
      data: {
        studentId,
        postId,
        status: "PENDING",
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        post: {
          include: {
            recruiter: true,
          },
        },
      },
    });

    return res.status(201).json(application);
  } catch (error) {
    console.error("Error creating application:", error);
    return res.status(500).json({ message: "Error creating application" });
  }
});

export default router;
