import express from "express";

const router = express.Router();

// GET /ping → Simple health check endpoint
router.get("", (req, res) => {
  res.status(200).json({ message: "Status alive" });
});

export default router;
