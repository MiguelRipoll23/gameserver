import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { userSignatureKeysTable } from "../../../../db/schema.ts";

export interface SignatureKeysData {
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
}

@injectable()
export class UserSignatureKeysService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async get(): Promise<SignatureKeysData | null> {
    const rows = await this.databaseService
      .get()
      .select({
        privateKey: userSignatureKeysTable.privateKey,
        publicKey: userSignatureKeysTable.publicKey,
      })
      .from(userSignatureKeysTable)
      .limit(1);

    if (rows.length === 0) return null;

    return {
      privateKey: rows[0].privateKey as JsonWebKey,
      publicKey: rows[0].publicKey as JsonWebKey,
    };
  }

  public async save(data: SignatureKeysData): Promise<void> {
    await this.databaseService
      .get()
      .insert(userSignatureKeysTable)
      .values({
        id: 1,
        privateKey: data.privateKey,
        publicKey: data.publicKey,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userSignatureKeysTable.id,
        set: {
          privateKey: data.privateKey,
          publicKey: data.publicKey,
          updatedAt: new Date(),
        },
      });
  }
}
