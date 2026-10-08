import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDomain {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDomainDocument extends IDomain, Document {
  _id: Types.ObjectId;
}

export const domainSchema = new Schema<IDomainDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'domains',
  }
);

export const DomainModel =
  (mongoose.models.Domain as mongoose.Model<IDomainDocument>) ||
  mongoose.model<IDomainDocument>('Domain', domainSchema);
