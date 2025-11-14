## Universal Asset Manager

A tiny orchestration layer for moving user uploads into a remote media provider (via [`universal_media_storage`](https://www.npmjs.com/package/universal_media_storage)) while persisting the final asset metadata to your own database.  
It is framework‑agnostic, works perfectly with `express-fileupload`, and only asks you to supply an `IAssetDatabase` implementation.

### Highlights

- **Storage + DB in sync** – upload files to Firebase Storage (or any other `MediaStorage` driver) and immediately save canonical asset metadata such as URLs, hashes, and sizes.
- **Duplicate protection** – `AssetUploader` checks your DB via `doesAssetPathAlreadyExist` before streaming the file, preventing wasted bandwidth.
- **Relative-path aware bulk uploads** – `uploadMultipleAssetsToMediaStorageAndDB` keeps folder structures intact (great for ZIP/unpacked directory uploads).
- **Storage-only migrations** – `uploadMultipleFilesToMediaStorageOnly` lets you seed or mirror remote storage without touching the DB layer.
- **Folder analytics** – Keep lightweight per-folder counts and sizes through `getFolderSummary` / `addFolderStats`.
- **Fully typed** – Ships `Asset`, `UploadObject`, `ResultSummary`, and `FileWithPath` helpers so TypeScript consumers stay safe.

---

## Installation

```bash
npm install universal_asset_mananger
# peerdep used internally for uploads
npm install universal_media_storage
```

The package is written in TypeScript and publishes types out of the box—no extra typings are required.

---

## Quick start

1. **Implement the persistence contract**
   ```ts
   import { Asset, IAssetDatabase } from "universal_asset_mananger";

   class AssetRepository implements IAssetDatabase {
     async saveToDatabase({ assets }: { assets: Asset[] }) {
       // batch insert into your table/collection
     }

     async doesAssetPathAlreadyExist(path: string) {
       // return true if path already present
     }
   }
   ```
2. **Configure your storage backend** – the example uses Firebase Storage through the `MediaStorage` abstraction:
   ```ts
   import { FirebaseStorageService, MediaStorage } from "universal_media_storage";

   const storage = new MediaStorage({
     config: {
       firebase_service_account_key_base64: process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? "",
       firebase_storage_bucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
     },
     service: new FirebaseStorageService(),
   });
   ```
3. **Instantiate the uploader and send files**
   ```ts
   import AssetUploader from "universal_asset_mananger/dist/services/AssetUploader";
   import { FileWithPath } from "universal_asset_mananger";

   const uploader = new AssetUploader(new AssetRepository(), storage);

   const files: FileWithPath[] = [
     {
       name: "example.txt",
       relativePath: "folder1/example.txt",
       data: Buffer.from("Hello!"),
       mimetype: "text/plain",
       mv: () => Promise.resolve(),
       encoding: "utf-8",
       truncated: false,
       size: 6,
       tempFilePath: "",
       md5: "",
     },
   ];

   await uploader.uploadMultipleAssetsToMediaStorageAndDB({
     uploadedFiles: files,
     basePath: "assets",
   });
   ```

📁 A working script lives in [`example/index.ts`](example/index.ts). Run it with:

```bash
cd example
npm install
FIREBASE_SERVICE_ACCOUNT_BASE64=... FIREBASE_STORAGE_BUCKET=... npm start
```

---

## Operations

| Method | Purpose | Notable parameters |
| --- | --- | --- |
| `uploadSingleAssetToMediaStorageAndDB(uploadObject)` | Uploads one file, writes its metadata to the DB, updates `resultSummary`, and tracks folder stats. | `assetFolderName`, `relativePath`, `mimetype`, `fileData`, optional `parentPathIds` for nested remote folders. |
| `uploadMultipleAssetsToMediaStorageAndDB({ uploadedFiles, basePath, resultSummary })` | Accepts a single file or a collection (like from `express-fileupload`), resolves MIME types via `mime-types`, and delegates each file to the single-upload flow with duplicate protection. | `basePath` becomes the top-level remote folder; `resultSummary` lets you collect URLs & sizes for downstream reporting. |
| `uploadMultipleFilesToMediaStorageOnly({ files, basePath, remoteParentPaths })` | Sends files to storage without touching your database—ideal for migrations, replays, or one-off batches. Returns a `ResultSummary` map internally. | `remoteParentPaths` forwards any provider-specific folder hierarchy identifiers. |
| `getFolderSummary()` | Returns the internal `Map<string, FolderStats>` so you can report folder counts/sizes after a job completes. | — |
| `addFolderStats(folderPath, stats)` | Manually seed or merge folder summaries when combining batches. | `stats` should match `{ count: number; size: number; }`. |

All operations lean on the shared `FileWithPath` shape (a superset of `express-fileupload`’s `UploadedFile`) so you can pipe files straight from API routes.

---

## Types and interfaces

- `Asset`: canonical record saved to your DB (id, storage URL, hash, size, encoded path, etc.).
- `UploadObject`: internal shape for single upload orchestration.
- `ResultSummary`: `{ [relativePath: string]: { url: string; size: number } }` for quick reporting.
- `FileWithPath`: extends `express-fileupload`’s `UploadedFile` with an optional `relativePath`.
- `IAssetDatabase`: the only contract you must implement—`saveToDatabase` and `doesAssetPathAlreadyExist`.

These types can be imported from the package root.

---

## Development

```bash
npm install
npm run example   # transpile and execute example/index.ts via ts-node
```

The project uses TypeScript, ESLint, and Prettier (see configs at the repo root). Contribution ideas include adding more storage providers, extending folder analytics, or providing adapters for popular ORMs.

---

## License

MIT © Olamide Ogunlade
