export interface CreateRoomInput {
  /** Used only to seed a human-recognizable prefix on the generated room name — never trust
   * this alone for uniqueness/unguessability, the provider appends real entropy. */
  classTitle: string;
}

export interface CreateRoomResult {
  /** Opaque to every caller except the room-reveal endpoint — this is the value that must
   * never appear in any list/detail projection or client-visible response outside that one
   * endpoint. For JitsiProvider this is the room name meet.jit.si's IFrame API joins by. */
  roomId: string;
  /** The domain the frontend's Jitsi IFrame API should target (e.g. "meet.jit.si") — safe to
   * expose freely, it's not secret; only roomId is. */
  domain: string;
}

/**
 * A conferencing-provider abstraction, mirroring PaymentProvider/EmailProvider/StorageProvider
 * exactly. JitsiProvider (wrapping the free public meet.jit.si server) is the only
 * implementation today — adding ZoomProvider/LoomProvider later is a new class implementing
 * this interface plus a registry entry, not a rewrite of any call site.
 */
export interface VideoProvider {
  readonly name: string;
  createRoom(input: CreateRoomInput): CreateRoomResult;
}
