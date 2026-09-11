import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.NEXTAUTH_SECRET; // read at request time, not module-load time

    if (!secret) {
      console.error("NEXTAUTH_SECRET is not set");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const decoded = jwt.verify(token, secret);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = decoded;

    // Enrich with fresh roleData from DB — the JWT bakes roleData at login
    // time and never refreshes, so recruiter/student profiles created after
    // login are invisible to roleData-dependent routes.
    try {
      const freshUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { student: true, recruiter: true, ambassador: true },
      });
      req.user.roleData = {
        student: freshUser?.student || null,
        recruiter: freshUser?.recruiter || null,
        ambassador: freshUser?.ambassador || null,
      };
    } catch (e) {
      console.error("roleData enrichment failed:", e.message);
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user || !req.user.roles?.includes(role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

export const requireAdmin = async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });
    if (!user?.email) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const admin = await prisma.admin.findUnique({
      where: { email: user.email },
    });
    if (!admin) {
      return res.status(403).json({ message: "Forbidden: admin access required" });
    }
    next();
  } catch (error) {
    console.error("Admin check error:", error.message);
    return res.status(500).json({ message: "Server error during admin check" });
  }
};

// Combined middleware for admin routes — accepts EITHER:
//   1. Bearer token (NextAuth session) + user is in Admin table, OR
//   2. X-Admin-Username + X-Admin-Password headers matching ADMIN_USERNAME / ADMIN_PASSWORD env vars
// This lets the standalone admin panel (which doesn't use NextAuth) access admin routes.
export const requireAdminAccess = async (req, res, next) => {
  try {
    // Path 1: Bearer token auth
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const secret = process.env.NEXTAUTH_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret);
        if (decoded?.id) {
          const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { email: true },
          });
          if (user?.email) {
            const admin = await prisma.admin.findUnique({ where: { email: user.email } });
            if (admin) {
              req.user = decoded;
              return next();
            }
          }
        }
      }
    }

    // Path 2: X-Admin-Username + X-Admin-Password headers (standalone admin panel)
    const adminUsername = req.headers["x-admin-username"];
    const adminPassword = req.headers["x-admin-password"];
    if (
      adminUsername === process.env.ADMIN_USERNAME &&
      adminPassword === process.env.ADMIN_PASSWORD
    ) {
      return next();
    }

    return res.status(401).json({ message: "Unauthorized: admin access required" });
  } catch (error) {
    console.error("Admin access check error:", error.message);
    return res.status(401).json({ message: "Unauthorized" });
  }
};