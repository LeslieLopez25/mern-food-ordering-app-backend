import mongoose, { Document, Schema, Types } from "mongoose";

// Strongly typed User interface
export interface IUser extends Document {
  _id: Types.ObjectId;
  auth0Id: string;
  email: string;
  name: string;
  addressLine1?: string;
  city?: string;
  country?: string;
}

// Define schema
const userSchema = new Schema<IUser>({
  auth0Id: {
    type: String,
    required: true,
    immutable: true,
  },
  email: {
    type: String,
    required: function (this: IUser) {
      return this.isNew;
    },
  },
  name: {
    type: String,
    required: function (this: IUser) {
      return this.isNew;
    },
  },
  addressLine1: { type: String },
  city: { type: String },
  country: { type: String },
});

// Create model
const User = mongoose.model<IUser>("User", userSchema);

export default User;
