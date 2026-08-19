import type {ObjectId} from 'mongodb';

/** sessionId null = class-level material (always visible, §17). Set = session-scoped (§19,
 * lets a late-joining student see what they missed once that session has occurred). */
export interface ClassMaterial {
  classId: ObjectId;
  sessionId: ObjectId | null;
  title: string;
  fileUrl: string;
  uploadedBy: string;
  visibleFrom: Date | null;
  createdAt: Date;
}

export type ClassMaterialDocument = ClassMaterial & { _id: ObjectId };

export function toPublicMaterial(doc: ClassMaterialDocument) {
  const { _id, classId, sessionId, ...rest } = doc;
  return { id: _id.toHexString(), classId: classId.toHexString(), sessionId: sessionId ? sessionId.toHexString() : null, ...rest };
}
