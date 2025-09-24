import { Response } from "express";
import User from "../models/user";
import { AuthRequest } from "../types/types";

// Get the currently logged-in user's profile
// Finds user by auth0Id. If missing, creates with email + name from req.
const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    let user = await User.findOne({ auth0Id: req.auth0Id });

    if (!user) {
      user = new User({
        auth0Id: req.auth0Id,
        email: req.email,
        name: req.name ?? "",
      });
      await user.save();
    }

    res.json(user);
  } catch (error) {
    console.error("getCurrentUser error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Create a new user in the database
// Uses values from JWT middleware, ensures email + name are set.
const createCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const existingUser = await User.findOne({ auth0Id: req.auth0Id });

    if (existingUser) {
      return res.status(200).json(existingUser);
    }

    const newUser = new User({
      auth0Id: req.auth0Id,
      email: req.email, // required by schema
      name: req.name ?? "",
      ...req.body, // allow optional extra fields
    });

    await newUser.save();
    res.status(201).json(newUser.toObject());
  } catch (error) {
    console.error("createCurrentUser error:", error);
    res.status(500).json({ message: "Error creating user" });
  }
};

// Update the current user's profile
// Uses userId populated by middleware + ensures required fields remain intact.
const updateCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const { name, addressLine1, country, city } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Always preserve email + auth0Id, update other fields
    user.name = name ?? user.name;
    user.addressLine1 = addressLine1 ?? user.addressLine1;
    user.city = city ?? user.city;
    user.country = country ?? user.country;

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("updateCurrentUser error:", error);
    res.status(500).json({ message: "Error updating user" });
  }
};

export default {
  getCurrentUser,
  createCurrentUser,
  updateCurrentUser,
};
