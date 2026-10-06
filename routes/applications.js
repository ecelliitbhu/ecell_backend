import express from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /applications/recruiter → all applications across the logged-in recruiter's posts
router.get("/recruiter", requireAuth, requireRole("RECRUITER"), async (req, res) => {
  let recruiterId = req.user.roleData?.recruiter?.id;

  if (!recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: req.user.id } });
    if (recruiter) recruiterId = recruiter.id;
  }

  if (!recruiterId) {
    return res.status(403).json({ message: "No recruiter profile linked to this account" });
  }

  try {
    const applications = await prisma.application.findMany({
      where: { post: { recruiterId } },
      orderBy: { appliedAt: "desc" },
      select: {
        id: true,
        postId: true,
        studentId: true,
        status: true,
        appliedAt: true,
        post: {
          select: {
            id: true,
            jobTitle: true,
            companyName: true,
          },
        },
        student: {
          select: {
            name: true,
            rollNo: true,
            branch: true,
            cpi: true,
            year: true,
            resumeUrl: true,
            linkedinUrl: true,
          },
        },
      },
    });

    return res.status(200).json(applications);
  } catch (error) {
    console.error("Error fetching recruiter applications:", error);
    return res.status(500).json({ message: "Error fetching recruiter applications" });
  }
});

// GET /applications/student → paginated list of the logged-in student's own applications
router.get("/student", requireAuth, requireRole("STUDENT"), async (req, res) => {
  const studentId = req.user.id;
  if (!req.user.roleData?.student) {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) {
      return res.status(403).json({ message: "No student profile linked to this account" });
    }
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where: { studentId },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          appliedAt: true,
          post: {
            select: {
              id: true,
              companyName: true,
              jobTitle: true,
              location: true,
              jobType: true,
              stipend: true,
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      }),
      prisma.application.count({ where: { studentId } }),
    ]);

    return res.status(200).json({
      data: applications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching student applications:", error);
    return res.status(500).json({ message: "Error fetching applications" });
  }
});

// GET /applications/post/:postId → paginated list of applicants for a specific post
// only the recruiter who owns the post can access this
router.get("/post/:postId", requireAuth, requireRole("RECRUITER"), async (req, res) => {
  const { postId } = req.params;
  let recruiterId = req.user.roleData?.recruiter?.id;

  if (!recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: req.user.id } });
    if (recruiter) recruiterId = recruiter.id;
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.recruiterId !== recruiterId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const where = { postId };
    if (req.query.status) where.status = req.query.status;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          appliedAt: true,
          post: {
            select: {
              id: true,
              jobTitle: true,
              companyName: true,
            },
          },
          student: {
            select: {
              name: true,
              rollNo: true,
              branch: true,
              cpi: true,
              year: true,
              resumeUrl: true,
              linkedinUrl: true,
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      }),
      prisma.application.count({ where }),
    ]);

    return res.status(200).json({
      data: applications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching post applications:", error);
    return res.status(500).json({ message: "Error fetching applications" });
  }
});

// GET /applications/getone/:id → single application, scoped to the requester
router.get("/getone/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        student: { select: { userId: true, name: true, rollNo: true, branch: true, cpi: true } },
        post: { select: { id: true, recruiterId: true, companyName: true, jobTitle: true } },
      },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const isOwnerStudent = req.user.roles?.includes("STUDENT") && application.student.userId === req.user.id;
    const recruiterId = req.user.roleData?.recruiter?.id;
    const isOwnerRecruiter = req.user.roles?.includes("RECRUITER") && application.post.recruiterId === recruiterId;
    const isAdmin = req.user.roles?.includes("ADMIN");

    if (!isOwnerStudent && !isOwnerRecruiter && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return res.status(500).json({ message: "Error fetching application" });
  }
});

// PUT /applications/update/:id → recruiter updates status of an application to their own post
router.put("/update/:id", requireAuth, requireRole("RECRUITER"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  let recruiterId = req.user.roleData?.recruiter?.id;

  if (!recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: req.user.id } });
    if (recruiter) recruiterId = recruiter.id;
  }

  const allowedStatuses = ["PENDING", "ACCEPTED", "REJECTED"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      include: { post: true },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.post.recruiterId !== recruiterId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating application:", error);
    return res.status(500).json({ message: "Error updating application" });
  }
});

// DELETE /applications/:id or /applications/delete/:id → Withdraw (delete) application
router.delete(["/delete/:id", "/:id"], requireAuth, async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.id;

  try {
    const application = await prisma.application.findFirst({
      where: {
        OR: [
          { id },
          { postId: id, studentId: currentUserId },
          { postId: id },
        ],
      },
      include: {
        student: true,
      },
    });

    if (!application) {
      // Idempotent: already withdrawn/deleted
      return res.status(200).json({ message: "Application already withdrawn", alreadyWithdrawn: true });
    }

    const isOwner = application.studentId === currentUserId || application.student?.userId === currentUserId || req.user?.roles?.includes("ADMIN");
    if (!isOwner && req.user?.roles?.includes("STUDENT")) {
      return res.status(403).json({ message: "Forbidden: you can only withdraw your own application" });
    }

    const status = application.status?.toLowerCase?.();
    if (status === "rejected") {
      return res.status(400).json({ message: "Cannot withdraw a rejected application" });
    }

    await prisma.application.delete({
      where: { id: application.id },
    });

    return res.status(200).json({ message: "Application withdrawn successfully", success: true });
  } catch (error) {
    console.error("Error deleting application:", error);
    return res.status(500).json({ message: "Error deleting application", error: error.message });
  }
});

// GET /applications or /applications/getinfo → List applications (optionally filtered by studentId or postId)
router.get(["/", "/getinfo", "/getinfo/"], requireAuth, async (req, res) => {
  const { studentId, postId } = req.query;

  try {
    const where = {};
    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { OR: [{ userId: studentId }, { id: studentId }] },
      });
      where.studentId = student ? student.userId : studentId;
    }
    if (postId) {
      where.postId = postId;
    }

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
    return res.status(500).json({ message: "Error fetching applications", error: error.message });
  }
});

// POST /applications or /applications/create → Create new application
router.post(["/", "/create"], requireAuth, async (req, res) => {
  const { postId } = req.body;
  let studentId = req.body.studentId || req.user?.id;

  if (!postId) {
    return res.status(400).json({ message: "Missing postId" });
  }

  if (!studentId && req.user?.id) {
    studentId = req.user.id;
  }

  try {
    let actualStudentId = studentId;
    const student = await prisma.student.findFirst({
      where: { OR: [{ userId: studentId }, { id: studentId }] },
    });
    if (student) {
      actualStudentId = student.userId;
    }

    const existingApplication = await prisma.application.findFirst({
      where: {
        studentId: actualStudentId,
        postId,
      },
      include: {
        post: true,
      },
    });

    if (existingApplication) {
      return res.status(200).json({
        message: "You have already applied for this position",
        alreadyApplied: true,
        ...existingApplication,
      });
    }

    const application = await prisma.application.create({
      data: {
        studentId: actualStudentId,
        postId,
        status: "PENDING",
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        post: { select: { id: true, companyName: true, jobTitle: true } },
      },
    });

    return res.status(201).json(application);
  } catch (error) {
    if (error.code === "P2002") {
      const existing = await prisma.application.findFirst({
        where: { postId, studentId: req.user?.id || studentId },
        include: { post: true },
      });
      return res.status(200).json({
        message: "You have already applied for this position",
        alreadyApplied: true,
        ...(existing || {}),
      });
    }
    console.error("Error creating application:", error);
    return res.status(500).json({ message: "Error creating application", error: error.message });
  }
});

export default router;