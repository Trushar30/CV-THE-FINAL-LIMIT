import { IUserDocument } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
    }
  }
}
