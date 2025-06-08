import express from "express";
import cors from "cors";
import studentRoutes from "./routes/students.js";
import recruiterRoutes from "./routes/recruiters.js";
import ambassadorRoutes from "./routes/ambassador.js";
import postRoutes from "./routes/posts.js";
import applicationRoutes from "./routes/applications.js";
import userRoutes from "./routes/users.js";



const app = express();
app.use(cors());
app.use(express.json());

app.use("/students", studentRoutes);
app.use("/recruiters", recruiterRoutes);
app.use("/ambassador", ambassadorRoutes);
app.use("/posts", postRoutes);
app.use("/applications", applicationRoutes);
app.use("/users", userRoutes);


const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
