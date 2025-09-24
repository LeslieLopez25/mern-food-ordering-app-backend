import { Request } from "express";

export interface AuthRequest extends Request {
  userId?: string;
  auth0Id?: string;
  email?: string;
  name?: string;
}
