import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

//profile userdata
router.get("/user", async (req, res) => {
  const { email } = req.query; // Extract email from query parameters
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  try {
    const userData = await prisma.campusAmbassador.findUnique({
      where: { email: email }, // Find user by email
      select: {
        id: true,
        name: true,
        collegeName: true,
        collegeYear: true,
        phone: true,
        points: true,
        referrals: true,
        // Add any other fields you want to include in the response
      },
    });
    if (userData) {
      return res.status(200).json(userData); // Return user data if found
    } else {
      return res.status(404).json({ error: "User  not found" }); // User not found
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching user data" });
  }
});

//leaderboard top 10
router.get("/getLeaderboard", async (req, res) => {
  try {
    const topUsers = await prisma.campusAmbassador.findMany({
      orderBy: {
        points: "desc",
      },
      take: 10,
      select: {
        name: true,
        points: true,
        collegeName: true,
      },
    });
    res.status(200).json(topUsers);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching top user data" });
  }
});

router.get("/getTasks", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized: User not logged in" });
  }

  try {
    // Fetch the user based on userId
    const user = await prisma.campusAmbassador.findUnique({
      where: { id: Number(userId) },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Now, we use the user's email from the user object
    const userEmail = user.email;

    // Fetch tasks associated with the user
    const tasks = await prisma.task.findMany({
      where: {
        users: {
          some: {
            id: Number(userId), // Ensure the task is associated with the user
          },
        },
      },
      select: {
        id: true,
        title: true,
        lastDate: true,
        description: true,
        points: true,
        status: true,
        submissions: {
          // Fetch all submissions for the task
          where: {
            userEmail: userEmail, // Use the user's email here
          },
          select: {
            status: true, // Fetch submission status
            taskId: true, // Ensure we can check the task ID for submission
          },
        },
      },
    });

    const currentDate = new Date();

    const processedTasks = tasks.map((task) => {
      let status = "Pending";
      console.log(task, "qtt");
      const submission = task.submissions.find((sub) => sub.taskId === task.id); // Find submission by task ID
      if (submission) {
        if (submission.status === "pending") {
          status = "Pending";
        } else if (submission.status === "submitted") {
          status = "Submitted";
        }
      } else if (!submission && task.lastDate < currentDate) {
        status = "Missing"; // If no submission and the deadline has passed
      }

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: status,
        submitted: status === "Submitted",
        lastDate: task.lastDate,
      };
    });

    res.status(200).json(processedTasks);
    console.log(processedTasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching tasks info" });
  }
});

router.post("/submit", async (req, res) => {
  const { taskId, submission, email } = req.body;

  try {
    // Step 1: Find the user by email
    const user = await prisma.campusAmbassador.findUnique({
      where: { email: email },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Step 2: Find the task by taskId
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Step 3: Check if a submission already exists for this user and task
    let submissionRecord = await prisma.submission.findUnique({
      where: {
        userEmail_taskId: {
          userEmail: user.email,
          taskId: taskId,
        },
      },
    });

    if (submissionRecord) {
      // If a submission already exists, update it
      submissionRecord = await prisma.submission.update({
        where: {
          id: submissionRecord.id,
        },
        data: {
          submission: submission,
          status: "submitted", // Set status as submitted
        },
      });
    } else {
      // If no submission exists, create a new one
      await prisma.submission.create({
        data: {
          taskId: task.id,
          userEmail: user.email,
          submission: submission,
          status: "submitted", // Set status as submitted
        },
      });
    }

    res.status(200).json({
      message: "Task submission updated successfully.",
    });
  } catch (error) {
    console.error("Error updating task submission:", error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the task submission." });
  }
});

router.post("/update", async (req, res) => {
  const { id, name, collegeName, collegeYear, phone } = req.body;

  try {
    const updatedUser = await prisma.campusAmbassador.update({
      where: { id: id }, // finding user by id
      data: {
        name: name,
        collegeName: collegeName,
        collegeYear: collegeYear,
        phone: phone,
      },
    });

    res.json(updatedUser); // Return the updated user data
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Unable to update user" });
  }
});

router.post("/register", async (req, res) => {
  const {
    name,
    collegeName,
    collegeYear,
    program,
    phone,
    email,
    POR,
    reasonToJoin,
    roleInStudentBody,
    skills,
    experience,
    roleInEcell,
    hours,
    contribution,
    motivation,
  } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await prisma.campusAmbassador.findUnique({
      where: { email: email },
    });

    if (existingUser) {
      console.log("User found");
      return res
        .status(400)
        .json({
          error: "You have already submitted the form",
          user: existingUser,
        });
    }

    // Create a new user
    const newUser = await prisma.campusAmbassador.create({
      data: {
        name,
        collegeName,
        collegeYear,
        program,
        phone,
        email,
        POR,
        reasonToJoin,
        roleInStudentBody,
        skills,
        experience,
        roleInEcell,
        hours,
        contribution,
        motivation,
        points: 0,
        user: {
          connect: { email: email },
        },
      },
    });

    // Get all active tasks
    const activeTasks = await prisma.task.findMany();

    // Create a submission object for each task and connect the user
    const submissionsData = activeTasks.map((task) => ({
      taskId: task.id,
      userEmail: newUser.email,
      submission: "", // Initially empty, can be updated later
      status: "pending", // Default status
    }));

    // Create submissions for all tasks linked to the new user
    await prisma.submission.createMany({
      data: submissionsData,
    });

    // Connect user to tasks
    for (const task of activeTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          users: {
            connect: { id: newUser.id },
          },
        },
      });
    }

    res
      .status(201)
      .json({
        message:
          "User successfully registered and tasks assigned with submissions!",
        user: newUser,
      });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Unable to add user" });
  }
});

router.get("/ping", (req, res) => {
  res.status(200).json({ message: "Server is alive" });
});

router.post("/createTask", async (req, res) => {
  const { title, description, lastDate, points } = req.body;

  // Validate input
  if (!title || !description || !lastDate || !points) {
    return res
      .status(400)
      .json({ error: "Title, description, lastDate, and points are required" });
  }

  try {
    // Convert lastDate to Date format and ensure points are numbers
    const taskData = {
      title,
      description,
      lastDate: new Date(lastDate), // Ensure lastDate is in Date format
      points: Number(points),
      submitted: false,
    };

    // Create a task
    const task = await prisma.task.create({
      data: taskData,
    });

    // Get all users
    const users = await prisma.campusAmbassador.findMany({
      select: { id: true, email: true }, // Fetch user ID and email for creating submissions
    });

    if (users.length === 0) {
      return res.status(400).json({ error: "No users found to assign tasks." });
    }

    // Prepare submission objects for each user
    const submissions = users.map((user) => ({
      taskId: task.id,
      userEmail: user.email, // Use user email to create the submission
      submission: "", // Empty submission initially
      status: "pending", // Default status
    }));

    // Create submissions for each user
    await prisma.submission.createMany({
      data: submissions,
    });

    // Associate the created task with all users
    await prisma.task.update({
      where: { id: task.id },
      data: {
        users: {
          connect: users.map((user) => ({ id: user.id })), // Connect each user to the task
        },
      },
    });

    res
      .status(201)
      .json({
        message:
          "Task successfully created, assigned to all users, and submissions created!",
      });
  } catch (error) {
    console.error("Error creating tasks:", error);
    res.status(500).json({ error: "An error occurred while creating tasks" });
  }
});

router.post("/admin/tasks", async (req, res) => {
  const { taskId, userId, points } = req.body; // Extract data from the request body

  try {
    if (taskId && userId && points) {
      // Step 1: Get the user's email using the userId
      const user = await prisma.campusAmbassador.findUnique({
        where: { id: userId },
        select: { email: true }, // Get only the email field
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Step 2: Update the points in the submission table for the task-user relationship
      // Step 3: Update the user's total points (if needed)
      const updatedUser = await prisma.campusAmbassador.update({
        where: { id: userId },
        data: {
          points: {
            increment: points, // Increment the user's total points
          },
        },
      });

      return res.status(200).json({
        message: "Points successfully assigned to the user-task submission!",
      });
    } else {
      // If no taskId, userId, or points provided, return all users' responses
      const userResponses = await prisma.campusAmbassador.findMany({
        select: {
          id: true,
          name: true,
          collegeName: true,
          points: true,
          email: true,
          tasks: {
            select: {
              id: true,
              title: true,
              points: true,
              submissions: {
                select: {
                  userEmail: true,
                  status: true,
                  submission: true, // Only fetch the status and other necessary data
                },
              },
            },
          },
        },
      });
      // Format responses and count completed tasks
      const formattedResponses = userResponses.map((user) => {
        // Count the completed tasks (tasks where there's a submission with status "submitted")
        const completedTasksCount = user.tasks.filter((task) =>
          task.submissions.some(
            (submission) =>
              submission.status === "submitted" &&
              submission.userEmail === user.email
          )
        ).length;

        return {
          userId: user.id,
          userName: user.name,
          collegeName: user.collegeName,
          totalPoints: user.points,
          completedTasksCount, // Number of completed tasks
          tasks: user.tasks.map((task) => {
            // Get the submission for the current user (where userEmail matches)
            const userSubmission = task.submissions.find(
              (submission) => submission.userEmail === user.email
            );
            return {
              taskId: task.id,
              taskTitle: task.title,
              submission: userSubmission ? userSubmission?.submission : null,
              submitted: userSubmission?.status == "submitted",
              taskPoints: task?.points,
            };
          }),
        };
      });
      // Sort users by completed tasks count in descending order
      formattedResponses.sort(
        (a, b) => b.completedTasksCount - a.completedTasksCount
      );

      return res.status(200).json(formattedResponses);
    }
  } catch (error) {
    console.error("Error in admin tasks endpoint:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});

// Endpoint to get earlier tasks with submission count
router.get("/Tasks", async (req, res) => {
  try {
    // Fetch all tasks but ensure only unique tasks are returned
    const tasks = await prisma.task.findMany({
      distinct: ["id"], // Ensures each task is returned only once based on task ID
    });
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "An error occurred while fetching tasks" });
  }
});

router.put("/tasks/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const { title, description, lastDate } = req.body;

  try {
    const updatedTask = await prisma.task.update({
      where: { id: Number(taskId) },
      data: {
        title,
        description,
        lastDate: lastDate ? new Date(lastDate) : undefined,
      },
    });

    res.status(200).json(updatedTask);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Unable to update task" });
  }
});

router.delete("/tasks/:taskId", async (req, res) => {
  const { taskId } = req.params;

  try {
    // First, delete all submissions related to the task
    await prisma.submission.deleteMany({
      where: { taskId: Number(taskId) },
    });

    // Then, delete the task itself
    await prisma.task.delete({
      where: { id: Number(taskId) },
    });

    res
      .status(200)
      .json({
        message: "Task and associated submissions successfully deleted",
      });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Unable to delete task and submissions" });
  }
});

router.post("/checkAdminEmail", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if an admin exists with the given email
    const admin = await prisma.admin.findUnique({
      where: { email: email },
    });

    // If an admin with the given email exists, return true, otherwise false
    if (admin) {
      return res.status(200).json({ isAdmin: true });
    } else {
      return res.status(200).json({ isAdmin: false });
    }
  } catch (error) {
    console.error("Error checking admin email:", error);
    res
      .status(500)
      .json({ error: "An error occurred while checking the admin email" });
  }
});

router.delete("/submissions/clear", async (req, res) => {
  try {
    // Reset submission-related fields for all tasks
    await prisma.task.updateMany({
      data: {
        submission: "",
        submitted: false,
        status: "pending",
      },
    });

    res.status(200).json({
      message: "All task submissions have been cleared successfully.",
    });
  } catch (error) {
    console.error("Error clearing submissions:", error);
    res
      .status(500)
      .json({ error: "An error occurred while clearing submissions." });
  }
});

export default router