import express from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireRole, requireAdmin, requireAdminAccess } from "../middleware/auth.js";

const router = express.Router();

// GET /recruiters/getinfo/:id → Get recruiter by userId or recruiter id
// Ownership check: you can only fetch your own profile (or admin)
router.get("/getinfo/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  // Ownership check — the token's user ID or recruiter ID must match the requested ID
  // Admins can view any recruiter's profile
  const isOwner = req.user?.id === id || req.user?.roleData?.recruiter?.id === id;
  if (!isOwner) {
    const adminUsername = req.headers["x-admin-username"];
    const adminPassword = req.headers["x-admin-password"];
    if (
      adminUsername !== process.env.ADMIN_USERNAME ||
      adminPassword !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(403).json({ message: "Forbidden: you can only view your own profile" });
    }
  }

  try {
    // Flat select — every consumer of this endpoint (dashboard, profile,
    // post-internship, post-login) only reads these fields.
    const recruiter = await prisma.recruiter.findFirst({
      where: {
        OR: [
          { userId: id },
          { id: id }
        ]
      },
      select: {
        id: true,
        userId: true,
        companyName: true,
        address: true,
        websiteUrl: true,
        phoneNumber: true,
        verified: true,
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!recruiter) {
      return res.status(404).json({
        error: "RECRUITER_NOT_FOUND",
        message: "Recruiter profile not found",
      });
    }

    return res.status(200).json(recruiter);
  } catch (error) {
    console.error("Error fetching recruiter:", error);
    return res
      .status(500)
      .json({ message: "Error fetching recruiter", error: error.message });
  }
});

// PUT /recruiters/update/:id → Update recruiter profile
// Ownership check: you can only update your own profile
router.put("/update/:id", requireAuth, requireRole("RECRUITER"), async (req, res) => {
  const { id } = req.params;

  // Ownership check — token user ID or recruiter ID must match
  const isOwner = req.user?.id === id || req.user?.roleData?.recruiter?.id === id;
  if (!isOwner) {
    return res.status(403).json({ message: "Forbidden: you can only update your own profile" });
  }

  const { companyName, address, websiteUrl, phoneNumber } = req.body;

  try {
    // Determine userId
    let targetUserId = req.user?.id;
    if (req.user?.id === id) {
      targetUserId = id;
    } else {
      const existing = await prisma.recruiter.findFirst({
        where: { OR: [{ id }, { userId: id }] },
      });
      if (existing) targetUserId = existing.userId;
    }

    const data = {
      companyName: companyName || "",
      address: address || "",
      websiteUrl: websiteUrl || "",
      phoneNumber: phoneNumber || "",
    };

    const recruiter = await prisma.recruiter.upsert({
      where: { userId: targetUserId },
      update: data,
      create: {
        userId: targetUserId,
        ...data,
      },
    });

    return res.status(200).json(recruiter);
  } catch (error) {
    console.error("Error updating recruiter:", error);
    return res
      .status(500)
      .json({ message: "Error updating recruiter", error: error.message });
  }
});

// POST /recruiters/register → Create recruiter if not exists
router.post("/register", async (req, res) => {
  const { userId, companyName, websiteUrl, address, phoneNumber } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    const data = {
      companyName: companyName || "",
      websiteUrl: websiteUrl || "",
      address: address || "",
      phoneNumber: phoneNumber || "",
    };

    const savedRecruiter = await prisma.recruiter.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });

    return res.status(200).json(savedRecruiter);
  } catch (err) {
    console.error("Failed to create recruiter:", err);
    return res.status(500).json({ message: "Failed to create recruiter" });
  }
});

// GET /recruiters/pending → Get all unverified recruiters (Admin only)
router.get("/pending", requireAdminAccess, async (req, res) => {
  try {
    const pendingRecruiters = await prisma.recruiter.findMany({
      where: { verified: false },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
      },
    });

    return res.status(200).json(pendingRecruiters);
  } catch (error) {
    console.error("Error fetching pending recruiters:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch pending recruiters", error: error.message });
  }
});

// PUT /recruiters/verify/:id → Approve a recruiter (Admin only)
router.put("/verify/:id", requireAdminAccess, async (req, res) => {
  const { id } = req.params;

  try {
    const recruiter = await prisma.recruiter.update({
      where: { id },
      data: { verified: true },
    });

    return res.status(200).json({ success: true, recruiter });
  } catch (error) {
    console.error("Error verifying recruiter:", error);
    return res.status(500).json({ success: false, message: "Verification failed", error: error.message });
  }
});

export default router;
