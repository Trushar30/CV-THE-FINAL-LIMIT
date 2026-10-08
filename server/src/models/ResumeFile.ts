import mongoose, { Document, Schema, Types } from 'mongoose';

export type ResumeStatus = 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED' | 'ARCHIVED';

export interface IResumeFile {
  userId: Types.ObjectId;
  gridFsFileId: Types.ObjectId;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  status: ResumeStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IResumeFileDocument extends IResumeFile, Document {
  _id: Types.ObjectId;
  gridFsId: Types.ObjectId;
}

const ResumeFileSchema = new Schema<IResumeFileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gridFsFileId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },
    sha256: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['UPLOADED', 'PROCESSING', 'ANALYZED', 'FAILED', 'ARCHIVED'],
      default: 'UPLOADED',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'resumes',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

ResumeFileSchema.virtual('gridFsId').get(function (this: IResumeFileDocument) {
  return this.gridFsFileId;
});

export const ResumeFile = mongoose.model<IResumeFileDocument>('Resume', ResumeFileSchema);
export const ResumeModel = ResumeFile;
