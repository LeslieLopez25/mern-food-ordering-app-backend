import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import myUserRoute from "./routes/MyUserRoute";
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import myRestaurantRoute from "./routes/MyRestaurantRoute";
import restaurantRoute from "./routes/RestaurantRoute";
import orderRoute from "./routes/OrderRoute";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

mongoose.connect(process.env.MONGODB_CONNECTION_STRING as string);

const app = express();

  app.use(
  cors({
    origin: ["http://localhost:5174",
  "http://127.0.0.1:5174", process.env.FRONTEND_URL as string],
    credentials: true,
  })
);

// Stripe webhook must use raw body
app.use("/api/order/checkout/webhook", express.raw({ type: "*/*" }));

app.use(express.json());

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
  console.log(`Server running on port ${PORT}`);});