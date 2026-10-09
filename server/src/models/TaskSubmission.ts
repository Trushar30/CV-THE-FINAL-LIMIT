import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITaskSubmission {
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  content: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskSubmissionDocument extends ITaskSubmission, Document {
  _id: Types.ObjectId;
}

const TaskSubmissionSchema = new Schema<ITaskSubmissionDocument>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'EmployeeTask',
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50000,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'taskSubmissions',
    timestamps: true,
  }
);

// Indexes
TaskSubmissionSchema.index({ userId: 1, submittedAt: -1 });

export const TaskSubmissionModel =
  (mongoose.models.TaskSubmission as mongoose.Model<ITaskSubmissionDocument>) ||
  mongoose.model<ITaskSubmissionDocument>('TaskSubmission', TaskSubmissionSchema);
