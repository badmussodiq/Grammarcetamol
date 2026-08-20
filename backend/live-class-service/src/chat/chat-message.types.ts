import type {ObjectId} from 'mongodb';

export interface ClassChatMessage {
  classId: ObjectId;
  senderId: string;
  senderRole: 'instructor' | 'student' | 'admin';
  body: string;
  createdAt: Date;
}

export type ClassChatMessageDocument = ClassChatMessage & { _id: ObjectId };

export function toPublicMessage(doc: ClassChatMessageDocument) {
  const { _id, classId, ...rest } = doc;
  return { id: _id.toHexString(), classId: classId.toHexString(), ...rest };
}
