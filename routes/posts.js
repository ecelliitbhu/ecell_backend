import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET /posts → Get all posts
router.get("/", async (req, res) => {
  try {
    console.log("Fetching all posts...");

    const posts = await prisma.post.findMany({
      include: {
        recruiter: {
          include: {
            user: true,
          },
        },
        applications: {
          include: {
            student: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`Found ${posts.length} posts`);
    return res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// POST /posts → Create a new post
router.post("/", async (req, res) => {
  const {
    recruiterId,
    companyName,
    jobTitle,
    jobDescription,
    qualification,
    experience,
    stipend,
    requiredSkills,
    location,
    jobType,
  } = req.body;

  try {
    console.log("Creating new post:", req.body);

    // Ensure recruiter exists
    const recruiterExists = await prisma.recruiter.findUnique({
      where: { id: recruiterId },
    });

    if (!recruiterExists) {
      return res
        .status(400)
        .json({ message: "Invalid recruiterId: recruiter not found" });
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
        requiredSkills,
        location,
        jobType,
      },
      include: {
        recruiter: true,
        applications: true,
      },
    });

    // console.log("Post created successfully:", post.id);
    return res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

// GET /posts/:id → Get a single post
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        recruiter: true,
        applications: {
          include: {
            student: true,
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
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /posts/:id → Update a post
router.put("/:id", async (req, res) => {
  const { id } = req.params;
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
  } = req.body;

  try {
    const post = await prisma.post.update({
      where: { id },
      data: {
        companyName,
        jobTitle,
        jobDescription,
        qualification,
        experience,
        stipend,
        requiredSkills,
        location,
        jobType,
      },
    });

    return res.status(200).json(post);
  } catch (error) {
    console.error("Error updating post:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /posts/:id → Delete a post and its applications
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // First delete all applications
    await prisma.application.deleteMany({
      where: { postId: id },
    });

    // Then delete the post
    await prisma.post.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
