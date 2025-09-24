import { auth } from "express-oauth2-jwt-bearer";
import { Response, NextFunction } from "express";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../models/user";
import { AuthRequest } from "../types/types";

dotenv.config();

export const jwtCheck = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: "RS256",
});

// Middleware to decode JWT, ensure user exists, and attach info to req
export const jwtParse = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Authorization header missing or malformed" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token missing" });
    }

    const decoded = jwt.decode(token) as {
      sub?: string;
      email?: string;
      name?: string;
      nickname?: string;
      [key: string]: any;
    };

    if (!decoded || !decoded.sub) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Fallback values if token doesn’t include them
    const auth0Id = decoded.sub;
    const email = decoded.email || "";
    const name = decoded.name || decoded.nickname || "Unnamed User";

    // Attach to request
    req.auth0Id = auth0Id;
    req.email = email;
    req.name = name;

    // Ensure user exists in DB
    let user = await User.findOne({ auth0Id });
    if (!user) {
      user = new User({
        auth0Id,
        email: email || "no-email@example.com", // prevent validation errors
        name: name || "Unnamed User",
      });
      await user.save();
    }

    req.userId = user._id.toString();

    next();
  } catch (err) {
    console.error("JWT parse error:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
};
