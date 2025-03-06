import express from "express";
import { jwtCheck, jwtParse } from "../middleware/auth";
import OrderController from "../controllers/OrderController";
import Order from "../models/order";

const router = express.Router();

router.get("/", jwtCheck, jwtParse, OrderController.getMyOrders);

router.get("/archived", jwtCheck, jwtParse, OrderController.getArchivedOrders);

router.post(
  "/checkout/create-checkout-session",
  jwtCheck,
  jwtParse,
  OrderController.createCheckoutSession
);

router.post("/checkout/webhook", OrderController.stripeWebhookHandler);

router.put(
  "/archive-orders",
  jwtCheck,
  jwtParse,
  OrderController.archiveDeliveredOrders
);

router.patch("/:id/archive", jwtCheck, jwtParse, async (req, res) => {
  try {
    const orderId = req.params.id;

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { archived: true },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({ message: "Order archived successfully", order: updatedOrder });
  } catch (error) {
    res.status(500).json({ error: "Failed to archive order" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const orderId = req.params.id;

    await Order.findByIdAndDelete(orderId);

    res.json({ message: "Order delete successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
