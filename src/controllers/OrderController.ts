import Stripe from "stripe";
import { Request, Response } from "express";
import Restaurant, { MenuItemType } from "../models/restaurant";
import Order from "../models/order";

const STRIPE = new Stripe(process.env.STRIPE_API_KEY as string);
const FRONTEND_URL = process.env.FRONTEND_URL as string;
const STRIPE_ENDPOINT_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;

// Get all orders for the currently logged-in user
// If an order is marked as "delivered" and more than 7 seconds have passed, it gets filtered out
const getMyOrders = async (req: Request, res: Response) => {
  try {
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
    console.log(error);
    res.status(500).json({ message: "something went wrong" });
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

// Handles Stripe webhooks (specifically when checkout session completes)
// Marks the order as "paid" and updates the total amount
const stripeWebhookHandler = async (req: Request, res: Response) => {
  let event;

  try {
    const sig = req.headers["stripe-signature"];
    event = STRIPE.webhooks.constructEvent(
      req.body,
      sig as string,
      STRIPE_ENDPOINT_SECRET
    );
  } catch (error: any) {
    console.log(error);
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

// Creates a new order in the DB and generates a Stripe Checkout session
// Returns the Stripe checkout URL so the frontend can redirect the user
const createCheckoutSession = async (req: Request, res: Response) => {
  try {
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

    // Convert cart items into Stripe line items
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
    console.log(error);
    res.status(500).json({ message: error.raw.message });
  }
};

// Converts the cart items into Stripe's expected line item format
const createLineItems = (
  checkoutSessionRequest: CheckoutSessionRequest,
  menuItems: MenuItemType[]
) => {
  const lineItems = checkoutSessionRequest.cartItems.map((cartItem) => {
    const menuItem = menuItems.find(
      (item) => item._id.toString() === cartItem.menuItemId.toString()
    );

    if (!menuItem) {
      throw new Error(`Menu item not found: ${cartItem.menuItemId}`);
    }

    const line_item: Stripe.Checkout.SessionCreateParams.LineItem = {
      price_data: {
        currency: "mxn",
        unit_amount: menuItem.price,
        product_data: {
          name: menuItem.name,
        },
      },
      quantity: parseInt(cartItem.quantity),
    };

    return line_item;
  });

  return lineItems;
};

// Helper function that creates a Stripe Checkout session using line items, delivery info, and redirects URLs
const createSession = async (
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  orderId: string,
  deliveryPrice: number,
  restaurantId: string
) => {
  const sessionData = await STRIPE.checkout.sessions.create({
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
    metadata: {
      orderId,
      restaurantId,
    },
    success_url: `${FRONTEND_URL}/order-status?success=true`,
    cancel_url: `${FRONTEND_URL}/detail/${restaurantId}?cancelled=true`,
  });

  return sessionData;
};

// Allows the restaurant to update the status of an order
// If status is set to "delivered", the order is deleted from the DB after 7 seconds
const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId, status } = req.body;

    const order = await Order.findById(orderId).populate({
      path: "restaurant",
      populate: { path: "user", model: "User" },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Make sure the user updating the order owns the restaurant
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

    // Auto-delete the order after 7 seconds if delivered
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
