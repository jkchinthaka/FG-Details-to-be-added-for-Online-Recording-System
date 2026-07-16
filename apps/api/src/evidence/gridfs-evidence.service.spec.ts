import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { ObjectId } from "mongodb";
import { EvidenceUploadError, GridFsEvidenceService } from "./gridfs-evidence.service";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x04, 0x00]);

class FakeWriteStream extends EventEmitter {
  readonly id = new ObjectId();
  readonly chunks: Buffer[] = [];
  destroyed = false;
  write(chunk: Buffer, cb: (err?: Error) => void) {
    this.chunks.push(chunk);
    cb();
    return true;
  }
  end() {
    queueMicrotask(() => this.emit("finish"));
  }
  destroy() {
    this.destroyed = true;
  }
}

function buildService() {
  const service = new GridFsEvidenceService();
  const openUploadStream = jest.fn(() => new FakeWriteStream());
  const deleteFn = jest.fn().mockResolvedValue(undefined);
  const updateOne = jest.fn().mockResolvedValue(undefined);
  const fakeBucket = { openUploadStream, delete: deleteFn };
  const fakeDb = { collection: jest.fn(() => ({ updateOne })) };
  // Bypass real Mongo connection.
  (service as unknown as { bucket: unknown }).bucket = fakeBucket;
  (service as unknown as { db: unknown }).db = fakeDb;
  return { service, openUploadStream, deleteFn, updateOne };
}

function padTo(buffer: Buffer, size: number): Buffer {
  if (buffer.length >= size) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(size - buffer.length, 0)]);
}

describe("GridFsEvidenceService.uploadStream", () => {
  it("streams a valid JPEG and returns the detected type", async () => {
    const { service, openUploadStream } = buildService();
    const result = await service.uploadStream({
      source: Readable.from(padTo(JPEG, 2048)),
      originalFileName: "photo.jpg",
      claimedMimeType: "image/jpeg",
      uploadedById: "user-1",
    });
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.sizeBytes).toBe(2048);
    expect(result.storedFileName.endsWith(".jpg")).toBe(true);
    expect(openUploadStream).toHaveBeenCalledTimes(1);
  });

  it("streams a valid PNG and PDF", async () => {
    const { service } = buildService();
    const png = await service.uploadStream({
      source: Readable.from(padTo(PNG, 512)),
      originalFileName: "shot.png",
      claimedMimeType: "image/png",
      uploadedById: "user-1",
    });
    expect(png.mimeType).toBe("image/png");

    const pdf = await service.uploadStream({
      source: Readable.from(padTo(PDF, 512)),
      originalFileName: "scan.pdf",
      claimedMimeType: "application/pdf",
      uploadedById: "user-1",
    });
    expect(pdf.mimeType).toBe("application/pdf");
  });

  it("rejects a renamed executable (unreadable signature)", async () => {
    const { service, deleteFn } = buildService();
    await expect(
      service.uploadStream({
        source: Readable.from(padTo(EXE, 512)),
        originalFileName: "malware.png",
        claimedMimeType: "image/png",
        uploadedById: "user-1",
      }),
    ).rejects.toMatchObject({ code: "UNREADABLE_SIGNATURE" });
    // Never opened an upload stream, so nothing to delete.
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("rejects MIME spoofing (jpeg content with .png name)", async () => {
    const { service } = buildService();
    await expect(
      service.uploadStream({
        source: Readable.from(padTo(JPEG, 512)),
        originalFileName: "photo.png",
        claimedMimeType: "image/png",
        uploadedById: "user-1",
      }),
    ).rejects.toMatchObject({ code: "MIME_SPOOFED" });
  });

  it("rejects a disallowed extension before any I/O", async () => {
    const { service, openUploadStream } = buildService();
    await expect(
      service.uploadStream({
        source: Readable.from(padTo(JPEG, 512)),
        originalFileName: "notes.txt",
        claimedMimeType: "text/plain",
        uploadedById: "user-1",
      }),
    ).rejects.toMatchObject({ code: "DISALLOWED_EXTENSION" });
    expect(openUploadStream).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before opening a stream (single chunk)", async () => {
    const { service, deleteFn, openUploadStream } = buildService();
    await expect(
      service.uploadStream({
        source: Readable.from(padTo(JPEG, 9 * 1024 * 1024)),
        originalFileName: "photo.jpg",
        claimedMimeType: "image/jpeg",
        uploadedById: "user-1",
      }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    // Size tripped before the signature/stream opened — nothing to clean up.
    expect(openUploadStream).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("aborts and deletes the partial object when overflow happens mid-stream", async () => {
    const { service, deleteFn, openUploadStream } = buildService();
    async function* chunked() {
      yield padTo(JPEG, 64); // opens the stream after signature is validated
      yield Buffer.alloc(9 * 1024 * 1024, 0); // pushes past the per-file limit
    }
    await expect(
      service.uploadStream({
        source: Readable.from(chunked()),
        originalFileName: "photo.jpg",
        claimedMimeType: "image/jpeg",
        uploadedById: "user-1",
      }),
    ).rejects.toBeInstanceOf(EvidenceUploadError);
    expect(openUploadStream).toHaveBeenCalledTimes(1);
    expect(deleteFn).toHaveBeenCalledTimes(1);
  });
});
