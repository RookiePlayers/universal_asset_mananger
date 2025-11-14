import dotenv from "dotenv";
dotenv.config();
import { FirebaseStorageService, MediaStorage } from "universal_media_storage";
import { IAssetDatabase } from "../src";
import AssetUploader from "../src/services/AssetUploader";
import { Asset, FileWithPath } from "../src/types";

class MockDatabase implements IAssetDatabase {
    private assets: Asset[] = [];

    saveToDatabase({ assets }: { assets: Asset[]; }): Promise<void> {
        this.assets.push(...assets);
        return Promise.resolve();
    }
    doesAssetPathAlreadyExist(path: string): Promise<boolean> {
        const exists = this.assets.some(asset => asset.path === path);
        return Promise.resolve(exists);
    }

    getAssets() {
        return this.assets;
    }

}

function init() {
    const db = new MockDatabase();
    console.log(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64)
    const uploader = new AssetUploader(db, new MediaStorage(
        {
            config: {
                'firebase_service_account_key_base64': process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '',
                'firebase_storage_bucket': process.env.FIREBASE_STORAGE_BUCKET || '',
            
            },
            service: new FirebaseStorageService()
        }
    ));

    const files: FileWithPath[] = [
        {
            name: "example.txt",
            mimetype: "text/plain",
            data: Buffer.from("Hello, World!"),
            relativePath: "folder1/example.txt",
            mv: () => Promise.resolve(),
            encoding: "utf-8",
            truncated: false,
            size: 13,
            tempFilePath: "",
            md5: "",
        }

    ]
     uploader.uploadMultipleAssetsToMediaStorageAndDB({
                uploadedFiles: files,
                basePath: 'assets'
            }).then(() => {
                console.log("Upload complete");
                console.log("Database contents:", db.getAssets());
            }).catch(err => {
                console.error("Error uploading files:", err);
            });

}

init();