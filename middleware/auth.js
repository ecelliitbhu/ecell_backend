import jwt from "jsonwebtoken";

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
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (role) => (req, res, next) => {
  const roleDataKey = role.toLowerCase();
  const hasRole =
    req.user?.roles?.includes(role) ||
    Boolean(req.user?.roleData?.[roleDataKey]);

  if (!hasRole) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  const username = req.headers["x-admin-username"];
  const password = req.headers["x-admin-password"];

  if (
    !username ||
    !password ||
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
};