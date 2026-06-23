import { inject, injectable } from "@needle-di/core";
import { DatabaseService } from "../../../../core/services/database-service.ts";
import { serverSignatureKeysTable } from "../../../../db/schema.ts";
import { SignatureKeysData } from "../types/signature-keys-data-type.ts";

@injectable()
export class ServerSignatureKeysService {
  constructor(private databaseService = inject(DatabaseService)) {}

  public async get(): Promise<SignatureKeysData | null> {
    const rows = await this.databaseService
      .get()
      .select({
        privateKey: serverSignatureKeysTable.privateKey,
        publicKey: serverSignatureKeysTable.publicKey,
      })
      .from(serverSignatureKeysTable)
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
      .insert(serverSignatureKeysTable)
      .values({
        id: 1,
        privateKey: data.privateKey,
        publicKey: data.publicKey,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: serverSignatureKeysTable.id,
        set: {
          privateKey: data.privateKey,
          publicKey: data.publicKey,
          updatedAt: new Date(),
        },
      });
  }
}
