import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import myUserRoute from "./routes/MyUserRoute";
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import myRestaurantRoute from "./routes/MyRestaurantRoute";
import restaurantRoute from "./routes/RestaurantRoute";
import orderRoute from "./routes/OrderRoute";

// Detect environment
const isTest = process.env.NODE_ENV === "test";

mongoose
  .connect(process.env.MONGODB_CONNECTION_STRING as string)
  .then(() => console.log("Connected to database!"))
  .catch((err) => console.error("DB connection error:", err));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

// Relaxed CORS for tests
const allowedOrigins = isTest
  ? ["http://localhost:5174", "http://127.0.0.1:5174"]
  : ["http://localhost:5174", process.env.FRONTEND_URL];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Stripe webhook must use raw body
app.use("/api/order/checkout/webhook", express.raw({ type: "*/*" }));

app.use(express.json());

// Mock Stripe logic for tests only
if (isTest) {
  console.log("⚙️ Running in TEST MODE — using mock Stripe checkout");

  app.post("/api/order/checkout", (req: Request, res: Response) => {
    // Simulate a successful payment intent
    res.json({
      url: "http://localhost:5174/order-status",
      mock: true,
      message: "Simulated Stripe checkout URL",
    });
  });
}

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.send({ message: "health OK!" });
});

// Routes
app.use("/api/my/user", myUserRoute);
app.use("/api/my/restaurant", myRestaurantRoute);
app.use("/api/restaurant", restaurantRoute);
app.use("/api/order", orderRoute);
app.use("/api/my/restaurant/order", orderRoute);

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}${isTest ? " (TEST MODE)" : ""}`);
});
