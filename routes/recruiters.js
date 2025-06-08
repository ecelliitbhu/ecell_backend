import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET /recruiters/:id → Get recruiter by userId
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const recruiter = await prisma.recruiter.findUnique({
      where: { userId: id },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
        posts: {
          include: {
            applications: true,
          },
        },
      },
    });

    if (!recruiter) {
      return res.status(401).json({
        error: "RECRUITER_NOT_FOUND",
        message: "To access recruiter dashboard, kindly login as recruiter",
        redirectTo: "/sip/login",
      });
    }

    return res.status(200).json(recruiter);
  } catch (error) {
    console.error("Error fetching recruiter:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// PUT /recruiters/:id → Update recruiter profile
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { companyName, address, websiteUrl } = req.body;

  try {
    const recruiter = await prisma.recruiter.update({
      where: { userId: id },
      data: {
        companyName,
        address,
        websiteUrl,
      },
    });

    return res.status(200).json(recruiter);
  } catch (error) {
    console.error("Error updating recruiter:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// POST /recruiters → Create recruiter if not exists
router.post("/", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId or email" });
  }

  try {
    const existing = await prisma.recruiter.findUnique({
      where: { userId },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const newRecruiter = await prisma.recruiter.create({
      data: {
        userId,
        companyName: "",
        websiteUrl: "",
        address: "",
      },
    });

    return res.status(201).json(newRecruiter);
  } catch (err) {
    console.error("Failed to create recruiter:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
