import express from "express";
import prisma from "../lib/prisma.js";
import crypto from "crypto";

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
        email: true,
        points: true,
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

router.get("/getAllTasks", async (req, res) => {
  try {
    // Fetch all tasks
    const tasks = await prisma.task.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        lastDate: true,
        points: true,
        status: true,
        submitted: true,
      },
      orderBy: { id: "asc" },
    });

    if (!tasks || tasks.length === 0) {
      return res.status(404).json({ message: "No tasks found." });
    }

    res.status(200).json(tasks);
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
    // Check if the ambassador already exists
    const existingAmbassador = await prisma.campusAmbassador.findUnique({
      where: { email: email },
    });

    if (existingAmbassador) {
      console.log("Ambassador found");
      return res
        .status(400)
        .json({
          error: "You have already submitted the form",
          user: existingAmbassador,
        });
    }

    // Upsert User - find existing user or create new one
    const user = await prisma.user.upsert({
      where: { email: email },
      update: {}, // No updates needed if user exists
      create: { email: email, id: crypto.randomUUID(), }, // Create new user if doesn't exist
    });

    // Create a new campus ambassador
    const newAmbassador = await prisma.campusAmbassador.create({
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
        userId: user.id, // Use the userId from the upserted user
      },
    });

    // Get all active tasks
    const activeTasks = await prisma.task.findMany();

    // Create a submission object for each task and connect the user
    const submissionsData = activeTasks.map((task) => ({
      taskId: task.id,
      userEmail: newAmbassador.email,
      submission: "", // Initially empty, can be updated later
      status: "pending", // Default status
    }));

    // Create submissions for all tasks linked to the new ambassador
    await prisma.submission.createMany({
      data: submissionsData,
    });

    // Connect ambassador to tasks
    for (const task of activeTasks) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          CampusAmbassador: {
            connect: { id: newAmbassador.id },
          },
        },
      });
    }

    res
      .status(201)
      .json({
        message:
          "Ambassador successfully registered and tasks assigned with submissions!",
        user: newAmbassador,
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
        CampusAmbassador: {
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
  const { taskId, userId, points, action } = req.body; // Extract data from the request body

  try {
    if (taskId && userId && action ) {
      // Step 1: Get the user's email using the userId
      const user = await prisma.campusAmbassador.findUnique({
        where: { id: userId },
        select: { email: true }, // Get only the email field
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Find the submission record for that user-task pair
      const submission = await prisma.submission.findUnique({
        where: {
          userEmail_taskId: {
            userEmail: user.email,
            taskId: Number(taskId),
          },
        },
      });

      if (!submission) {
        return res
          .status(404)
          .json({ error: "Submission not found for this task and user" });
      }

      // If admin clicks ✅ approve
      if (action === "approve") {
        // Update submission status to "approved" or "submitted"
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: "approved",
          },
        });

        // Increment user's total points by the task's points
        await prisma.campusAmbassador.update({
          where: { id: userId },
          data: {
            points: {
              increment: Number(points),
            },
          },
        });

        return res.status(200).json({
          message: "✅ Points successfully assigned and submission approved!",
        });
      }

      // If admin clicks ❌ reject
      else if (action === "reject") {
        // Update submission status to "rejected"
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            status: "rejected",
          },
        });

        return res.status(200).json({
          message: "❌ Submission rejected. No points awarded.",
        });
      }

      // Invalid action fallback
      else {
        return res.status(400).json({ error: "Invalid action provided" });
      }
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
              submission.status === "submitted" ||
              submission.status === "approved"
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
              submitted: userSubmission?.status == "submitted" ||
              userSubmission?.status === "approved",
              taskPoints: task?.points,
              status: userSubmission?.status || "pending",
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
      .json({ error: "An error occurred while processing the request", message: error.message });
  }
});

router.get("/admin/tasks", async (req, res) => {
  try {
    const submissions = await prisma.submission.findMany({
      include: {
        Task: { select: { title: true, points: true, id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const userEmails = [...new Set(submissions.map((s) => s.userEmail))];

    const ambassadors = await prisma.campusAmbassador.findMany({
      where: { email: { in: userEmails } },
      select: {
        id: true,
        name: true,
        email: true,
        points: true,
        collegeName: true,
        collegeYear: true,
      },
    });

    // Map ambassadors by email for quick lookup
    const ambassadorMap = Object.fromEntries(
      ambassadors.map((a) => [a.email, a])
    );

    const enrichedSubmissions = submissions.map((s) => ({
      id: s.id,
      submission: s.submission,
      status: s.status,
      createdAt: s.createdAt,
      task: s.Task,
      ambassador: ambassadorMap[s.userEmail] || null, // attach ambassador info
    }));

    const order = { pending: 1, approved: 2, rejected: 3 };

    enrichedSubmissions.sort((a, b) => {
      const statusDiff = order[a.status.toLowerCase()] - order[b.status.toLowerCase()];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.status(200).json(enrichedSubmissions);
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({ error: "Unable to fetch submissions", message: (error).message });
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
// import express from "express";
// import prisma from "../lib/prisma.js";

// const router = express.Router();

// /* ----------------------------- HEALTH CHECK ----------------------------- */
// router.get("/ping", (req, res) => {
//   res.status(200).json({ message: "Server is alive 🚀" });
// });

// /**
//  * GET /ambassador/admin/tasks
//  * View all tasks with title, last date, and points
//  */
// router.get("/admin/tasks", async (req, res) => {
//   try {
//     const tasks = await prisma.task.findMany({
//       select: { id: true, title: true, lastDate: true, points: true, isActive: true },
//       orderBy: { lastDate: "desc" },
//     });
//     res.json(tasks);
//   } catch (err) {
//     console.error("Error fetching tasks:", err);
//     res.status(500).json({ error: "Error fetching tasks" });
//   }
// });

// /* ------------------------- REGISTER NEW AMBASSADOR ----------------------- */
// router.post("/register", async (req, res) => {
//   try {
//     const { email, name, college, phone } = req.body;

//     if (!email || !name || !college || !phone)
//       return res.status(400).json({ error: "All fields are required." });

//     // Check if user already exists
//     const existingUser = await prisma.user.findUnique({ where: { email } });
//     if (existingUser)
//       return res.status(400).json({ error: "User already registered." });

//     // Create new user
//     const newUser = await prisma.user.create({
//       data: { email, name, college, phone },
//     });

//     // Assign all existing tasks to the new user
//     const tasks = await prisma.task.findMany();
//     await Promise.all(
//       tasks.map((task) =>
//         prisma.submission.create({
//           data: {
//             userId: newUser.id,
//             taskId: task.id,
//             status: "Pending",
//           },
//         })
//       )
//     );

//     res.status(201).json({ message: "Registration successful!", newUser });
//   } catch (error) {
//     console.error("Error registering user:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// /* --------------------------- UPDATE USER DETAILS ------------------------ */
// router.post("/update", async (req, res) => {
//   try {
//     const { email, name, college, phone } = req.body;

//     const user = await prisma.user.update({
//       where: { email },
//       data: { name, college, phone },
//     });

//     res.status(200).json({ message: "Profile updated successfully", user });
//   } catch (error) {
//     console.error("Error updating user:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// /* ----------------------------- GET LEADERBOARD -------------------------- */
// router.get("/getLeaderboard", async (req, res) => {
//   try {
//     const leaderboard = await prisma.user.findMany({
//       orderBy: { totalPoints: "desc" },
//       take: 10,
//     });

//     res.status(200).json(leaderboard);
//   } catch (error) {
//     console.error("Error fetching leaderboard:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// /* ----------------------------- GET USER DATA ---------------------------- */
// router.get("/user", async (req, res) => {
//   try {
//     const { email } = req.query;
//     const user = await prisma.user.findUnique({ where: { email } });

//     if (!user) return res.status(404).json({ error: "User not found" });

//     res.status(200).json(user);
//   } catch (error) {
//     console.error("Error fetching user:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// /* ----------------------------- GET USER TASKS --------------------------- */
// router.get("/getTasks", async (req, res) => {
//   try {
//     const { userId } = req.query;

//     const tasks = await prisma.submission.findMany({
//       where: { userId },
//       include: { task: true },
//     });

//     res.status(200).json(tasks);
//   } catch (error) {
//     console.error("Error fetching tasks:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });
// /* ----------------------------- SUBMIT A TASK ---------------------------- */
// router.post("/submit", async (req, res) => {
//   try {
//     const { userId, taskId, submissionLink } = req.body;

//     const submission = await prisma.submission.updateMany({
//       where: { userId, taskId },
//       data: { submissionLink, status: "Submitted" },
//     });

//     res.status(200).json({ message: "Task submitted successfully", submission });
//   } catch (error) {
//     console.error("Error submitting task:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// /* ----------------------------- ADMIN ROUTES ----------------------------- */

// /* -------------------------- CHECK ADMIN EMAIL --------------------------- */
// /**
//  * GET /ambassador/admin/active-submissions
//  * Returns submissions pending verification (after task deadline)
//  */
// /* -------------------------- CHECK ADMIN EMAIL --------------------------- */
// router.post("/checkAdminEmail", async (req, res) => {
//   try {
//     const { email } = req.body;
//     const admin = await prisma.admin.findUnique({ where: { email } });

//     if (admin) return res.status(200).json({ isAdmin: true });
//     else return res.status(403).json({ isAdmin: false });
//   } catch (error) {
//     console.error("Error checking admin:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// router.get("/admin/active-submissions", async (req, res) => {
//   try {
//     const now = new Date();

//     const submissions = await prisma.submission.findMany({
//       where: {
//         status: "pending",
//         task: { lastDate: { lt: now } },
//       },
//       include: {
//         task: { select: { id: true, title: true, points: true, lastDate: true } },
//       },
//       orderBy: { createdAt: "asc" },
//     });

//     const emails = [...new Set(submissions.map((s) => s.userEmail))];

//     const ambassadors = await prisma.campusAmbassador.findMany({
//       where: { email: { in: emails } },
//       select: { id: true, name: true, email: true, points: true },
//     });

//     const userMap = Object.fromEntries(ambassadors.map((u) => [u.email, u]));

//     const data = submissions.map((s) => ({
//       submissionId: s.id,
//       taskId: s.task.id,
//       taskTitle: s.task.title,
//       taskPoints: s.task.points,
//       taskLastDate: s.task.lastDate,
//       userEmail: s.userEmail,
//       userName: userMap[s.userEmail]?.name || null,
//       userId: userMap[s.userEmail]?.id || null,
//       userTotalPoints: userMap[s.userEmail]?.points || 0,
//       submissionLink: s.submission,
//       status: s.status,
//       createdAt: s.createdAt,
//     }));

//     res.json(data);
//   } catch (err) {
//     console.error("Error fetching active submissions:", err);
//     res.status(500).json({ error: "Error fetching active submissions" });
//   }
// });

// /**
//  * PATCH /ambassador/admin/verify-submission
//  * Approve or reject a submission
//  */
// router.patch("/admin/verify-submission", async (req, res) => {
//   const { submissionId, action } = req.body;

//   if (!submissionId || !action) {
//     return res.status(400).json({ error: "submissionId and action are required" });
//   }

//   if (!["approve", "reject"].includes(action)) {
//     return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
//   }

//   try {
//     const submission = await prisma.submission.findUnique({
//       where: { id: Number(submissionId) },
//       include: { task: true },
//     });

//     if (!submission) {
//       return res.status(404).json({ error: "Submission not found" });
//     }

//     if (action === "approve") {
//       const [updatedSubmission] = await prisma.$transaction([
//         prisma.submission.update({
//           where: { id: Number(submissionId) },
//           data: {
//             status: "approved",
//             pointsAwarded: submission.task.points,
//             verifiedAt: new Date(),
//           },
//         }),
//         prisma.campusAmbassador.update({
//           where: { email: submission.userEmail },
//           data: { points: { increment: submission.task.points } },
//         }),
//       ]);

//       return res.json({ message: "Submission approved", submission: updatedSubmission });
//     } else {
//       const updatedSubmission = await prisma.submission.update({
//         where: { id: Number(submissionId) },
//         data: { status: "rejected", verifiedAt: new Date() },
//       });

//       return res.json({ message: "Submission rejected", submission: updatedSubmission });
//     }
//   } catch (err) {
//     console.error("Error verifying submission:", err);
//     res.status(500).json({ error: "Error verifying submission" });
//   }
// });

// /**
//  * POST /ambassador/createTask
//  * Create a new task and assign to all ambassadors
//  */
// router.post("/createTask", async (req, res) => {
//   try {
//     const { title, description, lastDate, points } = req.body;

//     const task = await prisma.task.create({
//       data: {
//         title,
//         description,
//         lastDate: new Date(lastDate),
//         points: Number(points),
//         isActive: true,
//       },
//     });

//     const ambassadors = await prisma.campusAmbassador.findMany({
//       select: { email: true },
//     });

//     const submissionsData = ambassadors.map((a) => ({
//       taskId: task.id,
//       userEmail: a.email,
//       submission: "",
//       status: "pending",
//     }));

//     await prisma.submission.createMany({ data: submissionsData });

//     res.json({ message: "Task created and assigned", task });
//   } catch (err) {
//     console.error("Error creating task:", err);
//     res.status(500).json({ error: "Error creating task" });
//   }
// });

// /**
//  * POST /ambassador/submit
//  * CA submits task work (Drive link)
//  */
// router.post("/submit", async (req, res) => {
//   const { taskId, userEmail, submissionLink } = req.body;

//   if (!taskId || !userEmail || !submissionLink) {
//     return res.status(400).json({ error: "Missing fields" });
//   }

//   try {
//     const sub = await prisma.submission.updateMany({
//       where: { taskId: Number(taskId), userEmail },
//       data: {
//         submission: submissionLink,
//         status: "submitted",
//       },
//     });
//     res.json({ message: "Submission successful", result: sub });
//   } catch (err) {
//     console.error("Error submitting task:", err);
//     res.status(500).json({ error: "Error submitting task" });
//   }
// });

// /**
//  * GET /ambassador/getTasks/:email
//  * Returns tasks for a specific user
//  */
// router.get("/getTasks/:email", async (req, res) => {
//   const email = req.params.email;

//   try {
//     const submissions = await prisma.submission.findMany({
//       where: { userEmail: email },
//       include: { task: true },
//     });

//     const now = new Date();

//     const result = submissions.map((s) => {
//       let status = s.status;
//       if (status === "pending" && s.task.lastDate < now) {
//         status = "missing";
//       }
//       return {
//         taskId: s.task.id,
//         title: s.task.title,
//         points: s.task.points,
//         lastDate: s.task.lastDate,
//         status,
//         submissionLink: s.submission,
//       };
//     });

//     res.json(result);
//   } catch (err) {
//     console.error("Error fetching tasks:", err);
//     res.status(500).json({ error: "Error fetching tasks" });
//   }
// });

// /**
//  * GET /ambassador/leaderboard
//  * Returns all ambassadors sorted by points
//  */
// router.get("/leaderboard", async (req, res) => {
//   try {
//     const leaderboard = await prisma.campusAmbassador.findMany({
//       orderBy: { points: "desc" },
//       select: { name: true, email: true, collegeName: true, points: true },
//     });
//     res.json(leaderboard);
//   } catch (err) {
//     console.error("Error fetching leaderboard:", err);
//     res.status(500).json({ error: "Error fetching leaderboard" });
//   }
// });

// export default router;
// import express from "express";
// import prisma from "../lib/prisma.js";

// const router = express.Router();

// /* ----------------------------- HEALTH CHECK ----------------------------- */
// router.get("/ping", (req, res) => {
//   res.status(200).json({ message: "Server is alive 🚀" });
// });

// /* ----------------------------- ADMIN CHECK ------------------------------ */
// /**
//  * POST /ambassador/checkAdminEmail
//  * Verifies if a given email belongs to an Admin.
//  */
// router.post("/checkAdminEmail", async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ error: "Email is required" });

//     const admin = await prisma.admin.findUnique({ where: { email } });

//     if (admin) return res.status(200).json({ isAdmin: true });
//     else return res.status(403).json({ isAdmin: false });
//   } catch (error) {
//     console.error("❌ Error checking admin:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// /* --------------------------- REGISTER AMBASSADOR ------------------------ */
// /**
//  * POST /ambassador/register
//  * Registers a new Campus Ambassador and assigns existing tasks.
//  */
// router.post("/register", async (req, res) => {
//   try {
//     const {
//       userId,
//       name,
//       collegeName,
//       collegeYear,
//       program,
//       phone,
//       email,
//       POR,
//       reasonToJoin,
//       roleInStudentBody,
//       skills,
//       experience,
//       roleInEcell,
//       hours,
//       contribution,
//       motivation,
//     } = req.body;

//     if (!email || !name || !collegeName || !phone)
//       return res.status(400).json({ error: "Required fields missing" });

//     // Check if already registered
//     const existing = await prisma.campusAmbassador.findUnique({ where: { email } });
//     if (existing)
//       return res.status(400).json({ error: "User already registered as ambassador" });

//     // Create new ambassador
//     const ambassador = await prisma.campusAmbassador.create({
//       data: {
//         userId,
//         name,
//         collegeName,
//         collegeYear,
//         program,
//         phone,
//         email,
//         POR,
//         reasonToJoin,
//         roleInStudentBody,
//         skills,
//         experience,
//         roleInEcell,
//         hours,
//         contribution,
//         motivation,
//       },
//     });

//     // Assign all current tasks
//     const tasks = await prisma.task.findMany();
//     await Promise.all(
//       tasks.map((task) =>
//         prisma.submission.create({
//           data: {
//             taskId: task.id,
//             userEmail: email,
//             submission: "",
//             status: "pending",
//           },
//         })
//       )
//     );

//     res.status(201).json({ message: "Registration successful!", ambassador });
//   } catch (error) {
//     console.error("❌ Error registering ambassador:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// /* ----------------------------- GET TASKS -------------------------------- */
// /**
//  * GET /ambassador/getTasks/:email
//  * Fetches all tasks assigned to an ambassador
//  */
// router.get("/getTasks/:email", async (req, res) => {
//   const email = req.params.email;

//   try {
//     const submissions = await prisma.submission.findMany({
//       where: { userEmail: email },
//       include: { task: true },
//     });

//     const now = new Date();

//     const result = submissions.map((s) => {
//       let status = s.status;
//       if (status === "pending" && s.task.lastDate < now) {
//         status = "missing";
//       }
//       return {
//         taskId: s.task.id,
//         title: s.task.title,
//         points: s.task.points,
//         lastDate: s.task.lastDate,
//         status,
//         submissionLink: s.submission,
//       };
//     });

//     res.json(result);
//   } catch (err) {
//     console.error("❌ Error fetching tasks:", err);
//     res.status(500).json({ error: "Error fetching tasks" });
//   }
// });

// /* ----------------------------- SUBMIT TASK ------------------------------ */
// /**
//  * POST /ambassador/submit
//  * Submit a task by email
//  */
// router.post("/submit", async (req, res) => {
//   const { taskId, userEmail, submissionLink } = req.body;

//   if (!taskId || !userEmail || !submissionLink)
//     return res.status(400).json({ error: "Missing fields" });

//   try {
//     const sub = await prisma.submission.updateMany({
//       where: { taskId: Number(taskId), userEmail },
//       data: {
//         submission: submissionLink,
//         status: "submitted",
//       },
//     });
//     res.json({ message: "Submission successful", result: sub });
//   } catch (err) {
//     console.error("❌ Error submitting task:", err);
//     res.status(500).json({ error: "Error submitting task" });
//   }
// });

// /* ----------------------------- LEADERBOARD ------------------------------ */
// router.get("/leaderboard", async (req, res) => {
//   try {
//     const leaderboard = await prisma.campusAmbassador.findMany({
//       orderBy: { points: "desc" },
//       select: { name: true, email: true, collegeName: true, points: true },
//     });
//     res.json(leaderboard);
//   } catch (err) {
//     console.error("❌ Error fetching leaderboard:", err);
//     res.status(500).json({ error: "Error fetching leaderboard" });
//   }
// });

// /* ----------------------- ADMIN: CREATE NEW TASK ------------------------- */
// /**
//  * POST /ambassador/createTask
//  * Admin creates a task and assigns to all ambassadors
//  */
// router.post("/createTask", async (req, res) => {
//   try {
//     const { title, description, lastDate, points } = req.body;

//     const task = await prisma.task.create({
//       data: {
//         title,
//         description,
//         lastDate: new Date(lastDate),
//         points: Number(points),
//         isActive: true,
//       },
//     });

//     const ambassadors = await prisma.campusAmbassador.findMany({
//       select: { email: true },
//     });

//     const submissionsData = ambassadors.map((a) => ({
//       taskId: task.id,
//       userEmail: a.email,
//       submission: "",
//       status: "pending",
//     }));

//     await prisma.submission.createMany({ data: submissionsData });

//     res.json({ message: "Task created and assigned", task });
//   } catch (err) {
//     console.error("❌ Error creating task:", err);
//     res.status(500).json({ error: "Error creating task" });
//   }
// });

// /* ----------------------- ADMIN: VERIFY SUBMISSION ----------------------- */
// /**
//  * PATCH /ambassador/admin/verify-submission
//  * Admin approves or rejects a submission
//  */
// router.patch("/admin/verify-submission", async (req, res) => {
//   const { submissionId, action } = req.body;

//   if (!submissionId || !action)
//     return res.status(400).json({ error: "submissionId and action are required" });

//   if (!["approve", "reject"].includes(action))
//     return res.status(400).json({ error: "Invalid action" });

//   try {
//     const submission = await prisma.submission.findUnique({
//       where: { id: Number(submissionId) },
//       include: { task: true },
//     });

//     if (!submission) return res.status(404).json({ error: "Submission not found" });

//     if (action === "approve") {
//       const [updatedSubmission] = await prisma.$transaction([
//         prisma.submission.update({
//           where: { id: Number(submissionId) },
//           data: {
//             status: "approved",
//             verifiedAt: new Date(),
//           },
//         }),
//         prisma.campusAmbassador.update({
//           where: { email: submission.userEmail },
//           data: { points: { increment: submission.task.points } },
//         }),
//       ]);

//       return res.json({ message: "Submission approved", submission: updatedSubmission });
//     } else {
//       const updatedSubmission = await prisma.submission.update({
//         where: { id: Number(submissionId) },
//         data: { status: "rejected", verifiedAt: new Date() },
//       });

//       return res.json({ message: "Submission rejected", submission: updatedSubmission });
//     }
//   } catch (err) {
//     console.error("❌ Error verifying submission:", err);
//     res.status(500).json({ error: "Error verifying submission" });
//   }
// });

// /* -------------------- ADMIN: ACTIVE SUBMISSIONS ------------------------- */
// /**
//  * GET /ambassador/admin/active-submissions
//  * Returns submissions pending verification (after deadline)
//  */
// router.get("/admin/active-submissions", async (req, res) => {
//   try {
//     const now = new Date();

//     const submissions = await prisma.submission.findMany({
//       where: {
//         status: "submitted",
//         task: { lastDate: { lt: now } },
//       },
//       include: {
//         task: { select: { id: true, title: true, points: true, lastDate: true } },
//       },
//       orderBy: { id: "asc" },
//     });

//     const emails = [...new Set(submissions.map((s) => s.userEmail))];

//     const ambassadors = await prisma.campusAmbassador.findMany({
//       where: { email: { in: emails } },
//       select: { id: true, name: true, email: true, points: true },
//     });

//     const userMap = Object.fromEntries(ambassadors.map((u) => [u.email, u]));

//     const data = submissions.map((s) => ({
//       submissionId: s.id,
//       taskId: s.task.id,
//       taskTitle: s.task.title,
//       taskPoints: s.task.points,
//       taskLastDate: s.task.lastDate,
//       userEmail: s.userEmail,
//       userName: userMap[s.userEmail]?.name || null,
//       userId: userMap[s.userEmail]?.id || null,
//       userTotalPoints: userMap[s.userEmail]?.points || 0,
//       submissionLink: s.submission,
//       status: s.status,
//     }));

//     res.json(data);
//   } catch (err) {
//     console.error("❌ Error fetching active submissions:", err);
//     res.status(500).json({ error: "Error fetching active submissions" });
//   }
// });

// export default router;
