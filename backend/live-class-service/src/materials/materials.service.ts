import {Inject, Injectable, OnApplicationBootstrap} from '@nestjs/common';
import type {Collection, Db} from 'mongodb';
import {ObjectId} from 'mongodb';
import {MONGO_DB} from '@/config/database.module';
import type {ClassMaterial, ClassMaterialDocument} from './material.types';
import {toPublicMaterial} from './material.types';

@Injectable()
export class MaterialsService implements OnApplicationBootstrap {
  constructor(@Inject(MONGO_DB) private readonly db: Db) {}

  private materials(): Collection<ClassMaterial> {
    return this.db.collection<ClassMaterial>('class_materials');
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.materials().createIndex({ classId: 1, sessionId: 1 });
  }

  async create(classId: ObjectId, uploadedBy: string, input: { title: string; fileUrl: string; sessionId?: string | null; visibleFrom?: Date }): Promise<ClassMaterialDocument> {
    const doc: ClassMaterial = {
      classId,
      sessionId: input.sessionId ? new ObjectId(input.sessionId) : null,
      title: input.title,
      fileUrl: input.fileUrl,
      uploadedBy,
      visibleFrom: input.visibleFrom ?? null,
      createdAt: new Date(),
    };
    const result = await this.materials().insertOne(doc as any);
    return { ...doc, _id: result.insertedId };
  }

  /**
   * Enrolled students see every class-level material (sessionId: null) plus every
   * session-scoped material for a session that occurred at or before their own enrolledAt is
   * NOT the rule here — the domain spec's "late joiner can catch up" (§18) means they see
   * material from sessions that already happened BEFORE they joined too, not just after. So
   * this simply returns everything for the class with no enrolledAt filtering at all — the
   * one restriction is `visibleFrom` (an instructor-controlled gate independent of when the
   * student joined), matching "exact availability... controlled by the educator."
   */
  async listForClass(classId: ObjectId): Promise<ReturnType<typeof toPublicMaterial>[]> {
    const now = new Date();
    const docs = await this.materials()
      .find({ classId, $or: [{ visibleFrom: null }, { visibleFrom: { $lte: now } }] })
      .sort({ createdAt: 1 })
      .toArray();
    return docs.map((d) => toPublicMaterial(d as ClassMaterialDocument));
  }
}
