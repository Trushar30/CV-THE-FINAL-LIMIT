import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISkill {
  name: string;
  domainCode: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISkillDocument extends ISkill, Document {
  _id: Types.ObjectId;
}

export const skillSchema = new Schema<ISkillDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    domainCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'skills',
  }
);

// Compound index on domainCode and name for fast lookups
skillSchema.index({ domainCode: 1, name: 1 });

export const SkillModel =
  (mongoose.models.Skill as mongoose.Model<ISkillDocument>) ||
  mongoose.model<ISkillDocument>('Skill', skillSchema);
