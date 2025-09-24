import Stripe from "stripe";
import { Response } from "express";
import { AuthRequest } from "../types/types";
import Restaurant, { MenuItemType } from "../models/restaurant";
import Order from "../models/order";

const STRIPE = new Stripe(process.env.STRIPE_API_KEY as string);
const FRONTEND_URL = process.env.FRONTEND_URL as string;
const STRIPE_ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

// Get all orders for the currently logged-in user
const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const orders = await Order.find({ user: req.userId })
      .populate({
        path: "restaurant",
        populate: { path: "user", model: "User" },
      })
      .populate("user");

    const now = Date.now();
    const filteredOrders = orders.filter((order) => {
      if (order.status !== "delivered") return true;
      const deliveredAt = new Date(order.updatedAt).getTime();
      return now - deliveredAt < 7000;
    });

    res.json(filteredOrders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

type CheckoutSessionRequest = {
  cartItems: {
    menuItemId: string;
    name: string;
    quantity: string;
  }[];
  deliveryDetails: {
    email: string;
    name: string;
    addressLine1: string;
    city: string;
  };
  restaurantId: string;
};

// Stripe webhook handler
const stripeWebhookHandler = async (req: AuthRequest, res: Response) => {
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    event = STRIPE.webhooks.constructEvent(
      req.body,
      sig as string,
      STRIPE_ENDPOINT_SECRET
    );
  } catch (error: any) {
    console.error(error);
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const order = await Order.findById(event.data.object.metadata?.orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.totalAmount = event.data.object.amount_total;
    order.status = "paid";

    await order.save();
  }

  res.status(200).send();
};

// Create a checkout session + order
const createCheckoutSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const checkoutSessionRequest: CheckoutSessionRequest = req.body;

    const restaurant = await Restaurant.findById(
      checkoutSessionRequest.restaurantId
    );

    if (!restaurant) {
      throw new Error("Restaurant not found");
    }

    const newOrder = new Order({
      restaurant: restaurant,
      user: req.userId,
      status: "placed",
      deliveryDetails: checkoutSessionRequest.deliveryDetails,
      cartItems: checkoutSessionRequest.cartItems,
      createdAt: new Date(),
    });

    const lineItems = createLineItems(
      checkoutSessionRequest,
      restaurant.menuItems
    );

    const session = await createSession(
      lineItems,
      newOrder._id.toString(),
      restaurant.deliveryPrice,
      restaurant._id.toString()
    );

    if (!session.url) {
      return res.status(500).json({ message: "Error creating stripe session" });
    }

    await newOrder.save();
    res.json({ url: session.url });
  } catch (error: any) {
    console.error(error);
    res
      .status(500)
      .json({ message: error.raw?.message || "Something went wrong" });
  }
};

// Converts cart items → Stripe line items
const createLineItems = (
  checkoutSessionRequest: CheckoutSessionRequest,
  menuItems: MenuItemType[]
) => {
  return checkoutSessionRequest.cartItems.map((cartItem) => {
    const menuItem = menuItems.find(
      (item) => item._id.toString() === cartItem.menuItemId.toString()
    );

    if (!menuItem) {
      throw new Error(`Menu item not found: ${cartItem.menuItemId}`);
    }

    return {
      price_data: {
        currency: "mxn",
        unit_amount: menuItem.price,
        product_data: {
          name: menuItem.name,
        },
      },
      quantity: parseInt(cartItem.quantity),
    } as Stripe.Checkout.SessionCreateParams.LineItem;
  });
};

// Create a Stripe Checkout session
const createSession = async (
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  orderId: string,
  deliveryPrice: number,
  restaurantId: string
) => {
  return await STRIPE.checkout.sessions.create({
    line_items: lineItems,
    shipping_options: [
      {
        shipping_rate_data: {
          display_name: "Delivery",
          type: "fixed_amount",
          fixed_amount: {
            amount: deliveryPrice,
            currency: "mxn",
          },
        },
      },
    ],
    mode: "payment",
    metadata: { orderId, restaurantId },
    success_url: `${FRONTEND_URL}/order-status?success=true`,
    cancel_url: `${FRONTEND_URL}/detail/${restaurantId}?cancelled=true`,
  });
};

// Update order status
const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, status } = req.body;

    const order = await Order.findById(orderId).populate({
      path: "restaurant",
      populate: { path: "user", model: "User" },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const restaurantPopulated = order.restaurant as any;
    if (
      !restaurantPopulated ||
      !restaurantPopulated.user ||
      restaurantPopulated.user.toString() !== req.userId
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    order.status = status;
    await order.save();

    res.json({ message: "Order status updated", order });

    if (status === "delivered") {
      setTimeout(async () => {
        const orderToDelete = await Order.findById(orderId);
        if (orderToDelete) {
          await Order.findByIdAndDelete(orderId);
          console.log(`Order ${orderId} permanently deleted.`);
        }
      }, 7000);
    }
  } catch (error: any) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: error.message || "Something went wrong" });
  }
};

export default {
  getMyOrders,
  createCheckoutSession,
  stripeWebhookHandler,
  updateOrderStatus,
};
