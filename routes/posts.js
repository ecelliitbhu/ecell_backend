import express from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /posts or /posts/getinfo → Public paginated feed of internships for students
// Query params: page (default 1), limit (default 50), search, type, skills
router.get(["/", "/getinfo"], async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const { search, type, skills } = req.query;

  // Build where clause from optional filters
  const where = {};

  if (search) {
    where.OR = [
      { jobTitle: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type) {
    where.jobType = type.toUpperCase();
  }

  if (skills) {
    // skills can be comma-separated: ?skills=React,Node
    const skillsArray = skills.split(",").map((s) => s.trim());
    where.requiredSkills = { hasSome: skillsArray };
  }

  try {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where,
        select: {
          id: true,
          jobTitle: true,
          companyName: true,
          jobDescription: true,
          qualification: true,
          experience: true,
          jobType: true,
          stipend: true,
          location: true,
          requiredSkills: true,
          applicationMethod: true,
          applicationLink: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.count({ where }),
    ]);

    return res.status(200).json({
      data: posts,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res.status(500).json({ message: "Error fetching posts", error: error.message });
  }
});

// GET /posts/recruiter → Recruiter's own posts (paginated dashboard feed)
// Auth required. Only returns posts belonging to the logged-in recruiter.
router.get("/recruiter", requireAuth, requireRole("RECRUITER"), async (req, res) => {
  let recruiterId = req.user.roleData?.recruiter?.id;

  if (!recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: req.user.id } });
    if (recruiter) {
      recruiterId = recruiter.id;
    }
  }

  if (!recruiterId) {
    return res.status(403).json({ message: "No recruiter profile linked to this account" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where: { recruiterId },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          recruiterId: true,
          jobTitle: true,
          companyName: true,
          jobDescription: true,
          qualification: true,
          experience: true,
          jobType: true,
          stipend: true,
          location: true,
          requiredSkills: true,
          applicationMethod: true,
          applicationLink: true,
          createdAt: true,
          _count: { select: { applications: true } }, // applicant count
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.post.count({ where: { recruiterId } }),
    ]);

    return res.status(200).json({
      data: posts,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching recruiter posts:", error);
    return res.status(500).json({ message: "Error fetching recruiter posts", error: error.message });
  }
});

// GET /posts/getpost/:id or /posts/:id → Single post details (public)
router.get(["/getpost/:id", "/:id"], async (req, res) => {
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        jobTitle: true,
        companyName: true,
        jobDescription: true,
        qualification: true,
        experience: true,
        jobType: true,
        stipend: true,
        location: true,
        requiredSkills: true,
        applicationMethod: true,
        applicationLink: true,
        createdAt: true,
        recruiter: {
          select: {
            id: true,
            companyName: true,
            websiteUrl: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    return res.status(200).json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    return res.status(500).json({ message: "Error fetching post" });
  }
});

// POST /posts or /posts/create → Create a new post
// Auth required. recruiterId resolved securely from authenticated user
router.post(["/", "/create"], requireAuth, requireRole("RECRUITER"), async (req, res) => {
  let recruiterId = req.user.roleData?.recruiter?.id;

  if (!recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: req.user.id } });
    if (recruiter) {
      recruiterId = recruiter.id;
    }
  }

  if (!recruiterId && req.body.recruiterId) {
    const recruiter = await prisma.recruiter.findFirst({
      where: { id: req.body.recruiterId, userId: req.user.id },
    });
    if (recruiter) {
      recruiterId = recruiter.id;
    }
  }

  if (!recruiterId) {
    return res.status(403).json({ message: "No recruiter profile linked to this account" });
  }

  const {
    companyName,
    jobTitle,
    jobDescription,
    qualification,
    experience,
    stipend,
    requiredSkills,
    location,
    jobType,
    applicationMethod,
    applicationLink,
  } = req.body;

  try {
    // Verify the recruiter is verified before allowing post creation
    const recruiter = await prisma.recruiter.findUnique({ where: { id: recruiterId } });

    if (!recruiter) {
      return res.status(400).json({ message: "Recruiter profile not found" });
    }

    if (!recruiter.verified) {
      return res.status(403).json({ message: "Recruiter not verified. Cannot create post." });
    }

    const post = await prisma.post.create({
      data: {
        recruiterId,
        companyName,
        jobTitle,
        jobDescription,
        qualification,
        experience,
        stipend,
        requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
        location,
        jobType: jobType || "REMOTE",
        applicationMethod: applicationMethod || "NATIVE",
        applicationLink: applicationLink || null,
      },
      select: {
        id: true,
        jobTitle: true,
        companyName: true,
        jobType: true,
        createdAt: true,
      },
    });

    return res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return res.status(500).json({ message: "Error creating post", error: error.message });
  }
});

// PUT /posts/:id or /posts/update/:id → Update a post
// Auth required. Only the recruiter who owns the post can update it.
router.put(["/update/:id", "/:id"], requireAuth, requireRole("RECRUITER"), async (req, res) => {
  const { id } = req.params;
  let recruiterId = req.user.roleData?.recruiter?.id;

  if (!recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: req.user.id } });
    if (recruiter) recruiterId = recruiter.id;
  }

  if (!recruiterId) {
    return res.status(403).json({ message: "No recruiter profile linked to this account" });
  }

  const {
    companyName,
    jobTitle,
    jobDescription,
    qualification,
    experience,
    stipend,
    requiredSkills,
    location,
    jobType,
    applicationMethod,
    applicationLink,
  } = req.body;

  try {
    // Ownership check — must own the post before updating
    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.recruiterId !== recruiterId) {
      return res.status(403).json({ message: "Forbidden: you do not own this post" });
    }

    const updated = await prisma.post.update({
      where: { id },
      data: {
        companyName,
        jobTitle,
        jobDescription,
        qualification,
        experience,
        stipend,
        requiredSkills: Array.isArray(requiredSkills) ? requiredSkills : [],
        location,
        jobType: jobType || "REMOTE",
        applicationMethod: applicationMethod || "NATIVE",
        applicationLink: applicationLink || null,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating post:", error);
    return res.status(500).json({ message: "Error updating post" });
  }
});

// DELETE /posts/:id or /posts/delete/:id → Delete a post and its applications
// Auth required. Only the recruiter who owns the post can delete it.
router.delete(["/delete/:id", "/:id"], requireAuth, requireRole("RECRUITER"), async (req, res) => {
  const { id } = req.params;
  let recruiterId = req.user.roleData?.recruiter?.id;

  if (!recruiterId) {
    const recruiter = await prisma.recruiter.findUnique({ where: { userId: req.user.id } });
    if (recruiter) recruiterId = recruiter.id;
  }

  if (!recruiterId) {
    return res.status(403).json({ message: "No recruiter profile linked to this account" });
  }

  try {
    // Ownership check — must own the post before deleting
    const post = await prisma.post.findUnique({ where: { id } });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.recruiterId !== recruiterId) {
      return res.status(403).json({ message: "Forbidden: you do not own this post" });
    }

    // Delete all applications first (referential integrity)
    await prisma.application.deleteMany({ where: { postId: id } });

    // Then delete the post
    await prisma.post.delete({ where: { id } });

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return res.status(500).json({ message: "Error deleting post" });
  }
});

export default router;
