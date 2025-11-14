import test from "node:test";
import assert from "node:assert/strict";
import AssetUploader from "../src/services/AssetUploader";
import { Asset, FileWithPath } from "../src/types";
import { IAssetDatabase } from "../src/iAssetDatabase";
import { MediaStorage, StorageResult, UploadParams } from "universal_media_storage";

type MediaStorageLike = Pick<MediaStorage, "uploadFile">;

class InMemoryAssetDatabase implements IAssetDatabase {
    public savedPayloads: Asset[][] = [];
    constructor(private readonly existingPaths = new Set<string>()) {}

    async saveToDatabase({ assets }: { assets: Asset[]; }): Promise<void> {
        this.savedPayloads.push(assets);
    }

    async doesAssetPathAlreadyExist(path: string): Promise<boolean> {
        return this.existingPaths.has(path);
    }

    getSavedAssets(): Asset[] {
        return this.savedPayloads.flat();
    }
}

class StubMediaStorage implements MediaStorageLike {
    public uploadCalls: UploadParams[] = [];
    constructor(private readonly resultFactory?: (params: UploadParams) => StorageResult | Promise<StorageResult>) {}

    async uploadFile(params: UploadParams): Promise<StorageResult> {
        this.uploadCalls.push(params);
        if (this.resultFactory) {
            return await this.resultFactory(params);
        }
        const key = `asset-${this.uploadCalls.length}`;
        return {
            key,
            url: `https://cdn.test/${params.file.name}`,
            downloadUrl: `https://cdn.test/${params.file.name}?dl=1`,
            integrity: "sha256-test",
        };
    }
}

function buildFile(overrides: Partial<FileWithPath> = {}): FileWithPath {
    const data = overrides.data ?? Buffer.from("example payload");
    return {
        name: overrides.name ?? "example.txt",
        data,
        mv: async () => undefined,
        encoding: "utf-8",
        truncated: false,
        size: data.length,
        tempFilePath: "",
        md5: "",
        mimetype: overrides.mimetype ?? "text/plain",
        relativePath: overrides.relativePath,
    };
}

test("uploadSingleAssetToMediaStorageAndDB saves metadata, summary and folder stats", async () => {
    const db = new InMemoryAssetDatabase();
    const mediaStorage = new StubMediaStorage(() => ({
        key: "asset-key",
        url: "https://cdn.test/assets/folder1/example.txt",
        downloadUrl: "https://cdn.test/assets/folder1/example.txt?dl=1",
        integrity: "sha256-abc",
    }));
    const uploader = new AssetUploader(db, mediaStorage as unknown as MediaStorage);
    const fileBuffer = Buffer.from("hello world");

    await uploader.uploadSingleAssetToMediaStorageAndDB({
        assetFolderName: "assets",
        relativePath: "folder1/example.txt",
        fileData: fileBuffer,
        mimetype: "text/plain",
    });

    const savedAssets = db.getSavedAssets();
    assert.equal(savedAssets.length, 1);
    const asset = savedAssets[0];
    assert.equal(asset.id, "asset-key");
    assert.equal(asset.url, "https://cdn.test/assets/folder1/example.txt");
    assert.equal(asset.downloadUrl, "https://cdn.test/assets/folder1/example.txt?dl=1");
    assert.equal(asset.expectedHash, "sha256-abc");
    assert.equal(asset.path, "folder1/example.txt");
    assert.equal(asset.totalSize, fileBuffer.length);
    assert.equal(asset.encodedPath, encodeURIComponent("assets/folder1/example.txt"));

    const folderStats = uploader.getFolderSummary().get("folder1");
    assert.deepEqual(folderStats, { count: 1, size: fileBuffer.length });
});

test("uploadSingleAssetToMediaStorageAndDB skips uploads when the asset path exists", async () => {
    const db = new InMemoryAssetDatabase(new Set(["assets/folder1/example.txt"]));
    const mediaStorage = new StubMediaStorage();
    const uploader = new AssetUploader(db, mediaStorage as unknown as MediaStorage);

    await uploader.uploadSingleAssetToMediaStorageAndDB({
        assetFolderName: "assets",
        relativePath: "folder1/example.txt",
        fileData: Buffer.from("duplicate content"),
        mimetype: "text/plain",
    });

    assert.equal(mediaStorage.uploadCalls.length, 0);
    assert.equal(db.getSavedAssets().length, 0);
});

test("uploadMultipleAssetsToMediaStorageAndDB infers mimetypes and forwards file metadata", async () => {
    const db = new InMemoryAssetDatabase();
    const mediaStorage = new StubMediaStorage();
    const uploader = new AssetUploader(db, mediaStorage as unknown as MediaStorage);

    const files: FileWithPath[] = [
        buildFile({
            name: "first.txt",
            relativePath: "folderA/nested.txt",
            data: Buffer.from("first"),
        }),
        buildFile({
            name: "report.json",
            relativePath: "folderB/report.json",
            data: Buffer.from('{"ok":true}'),
            mimetype: "",
        }),
    ];

    await uploader.uploadMultipleAssetsToMediaStorageAndDB({
        uploadedFiles: files,
        basePath: "assets",
    });

    assert.equal(mediaStorage.uploadCalls.length, 2);
    const [firstCall, secondCall] = mediaStorage.uploadCalls;
    assert.equal(firstCall.file.name, "assets/folderA/nested.txt");
    assert.equal(firstCall.uploadPath, "assets");
    assert.equal(secondCall.file.name, "assets/folderB/report.json");
    assert.equal(secondCall.file.mimetype, "application/json");
    assert.equal(secondCall.file.data.toString(), '{"ok":true}');
});

test("uploadMultipleFilesToMediaStorageOnly forwards remote parent IDs and relative URIs", async () => {
    const db = new InMemoryAssetDatabase();
    const mediaStorage = new StubMediaStorage();
    const uploader = new AssetUploader(db, mediaStorage as unknown as MediaStorage);

    await uploader.uploadMultipleFilesToMediaStorageOnly({
        files: buildFile({ name: "banner.png", relativePath: "folder/banner.png", mimetype: "image/png" }),
        basePath: "public",
        remoteParentPaths: ["parent-folder"],
    });

    assert.equal(mediaStorage.uploadCalls.length, 1);
    const call = mediaStorage.uploadCalls[0];
    assert.deepEqual(call.parentPathIds, ["parent-folder"]);
    assert.equal(call.uploadPath, "public");
    assert.equal(call.file.uri, "public/folder/banner.png");
    assert.equal(call.file.name, "public/folder/banner.png");
});
