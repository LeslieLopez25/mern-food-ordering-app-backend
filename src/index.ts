import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import myUserRoute from "./routes/MyUserRoute";
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import myRestaurantRoute from "./routes/MyRestaurantRoute";
import restaurantRoute from "./routes/RestaurantRoute";
import orderRoute from "./routes/OrderRoute";
import OrderController from "./controllers/OrderController";

mongoose
  .connect(process.env.MONGODB_CONNECTION_STRING as string)
  .then(() => console.log("Connection to database!"));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

app.use(cors());

app.use("/api/order/checkout/webhook", express.raw({ type: "*/*" }));

app.use(express.json());

app.get("/health", async (req: Request, res: Response) => {
  res.send({ message: "health OK!" });
});

app.use("/api/my/user", myUserRoute);
app.use("/api/my/restaurant", myRestaurantRoute);
app.use("/api/restaurant", restaurantRoute);
app.use("/api/order", orderRoute);

setInterval(async () => {
  console.log("Archiving delivered orders...");
  await OrderController.archiveDeliveredOrdersJob();
}, 5 * 60 * 1000);

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
  console.log(`server running on port ${PORT}`);
});
