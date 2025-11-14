import { MediaStorage } from "universal_media_storage";
import { FileWithPath, FolderStats, ResultSummary, UploadObject } from "../types";
import { nanoid } from "nanoid";
import path from "path";
import mime from "mime-types";
import { IAssetDatabase } from "../iAssetDatabase";


export default class AssetUploader {
    private folderSummary = new Map<string, FolderStats>();

    constructor(private assetDatabase: IAssetDatabase, private mediaStorage: MediaStorage) {}

    public async uploadSingleAssetToMediaStorageAndDB(uploadObject: UploadObject): Promise<void> {
        const assetPath = `${uploadObject.assetFolderName}/${uploadObject.relativePath}`;
        if(await this.assetDatabase.doesAssetPathAlreadyExist(assetPath)) {
            console.log(`Asset at path ${assetPath} already exists. Skipping upload.`);
            return;
        }
        const { relativePath, fileData, assetFolderName, parentPathIds } = uploadObject;
        const result= await this.mediaStorage.uploadFile({
            file: {
                name: relativePath,
                mimetype: uploadObject.mimetype,
                data: fileData,
                uri: assetPath
            },
            uploadPath: assetFolderName,
            parentPathIds: parentPathIds ?? []
        })

        await this.assetDatabase.saveToDatabase({
            assets: [{
                id: result.key ?? nanoid(10),
                url: result.url,
                downloadUrl: result.downloadUrl,
                expectedHash: result.integrity,
                totalSize: fileData.length,
                encodedPath: encodeURIComponent(assetPath),
                path: relativePath,

            }]
        })

        uploadObject.resultSummary = {
            ...uploadObject.resultSummary,
            [relativePath]: {
                url: result.url,
                size: fileData.length
            }
        }

        const folderKey = path.dirname(relativePath);
        const stats = this.folderSummary.get(folderKey) || { count: 0, size: 0 };
        stats.count += 1;
        stats.size += fileData.length;
        this.folderSummary.set(folderKey, stats);

        
    }

    public async uploadMultipleAssetsToMediaStorageAndDB(
        {uploadedFiles, basePath='', resultSummary}: {uploadedFiles: FileWithPath[] | FileWithPath, basePath?: string, resultSummary?: ResultSummary}
    ){
        const filesArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];
          for (const file of filesArray) {
            const relativePath = path.posix.join(basePath.substring(
                basePath.startsWith("/") ? 1 : 0, basePath.length), file.relativePath || file.name);
            const fileData = file.data as Buffer;
            const mimetype = file.mimetype || mime.lookup(file.name) || 'application/octet-stream';
            //Log.info(`Uploading file: ${relativePath} with mimetype: ${mimetype} [${basePath}]`);
            await this.uploadSingleAssetToMediaStorageAndDB({
                assetFolderName: basePath,
                relativePath,
                fileData,
                mimetype,
                resultSummary,
             });
        }
    }

    public async uploadMultipleFilesToMediaStorageOnly({
        files, basePath = "", remoteParentPaths = []
    }:{
        files: FileWithPath[] | FileWithPath
        basePath?: string;
        remoteParentPaths?: string[];
    }): Promise<void> {
        // Implementation for uploading files to a remote storage service
        const resultSummary: ResultSummary = {};
        const filesArray = Array.isArray(files) ? files : [files];
        // Log.info(`Uploading files with base path: ${basePath} to remote parent path: ${remoteParentPath}`);
        for (const file of filesArray) {
            const relativePath = path.posix.join(basePath, file.relativePath || file.name);
            const fileData = file.data as Buffer;
            const mimetype = file.mimetype || mime.lookup(file.name) || 'application/octet-stream';
            // Log.info(`Uploading file: ${relativePath} with mimetype: ${mimetype} to remote path: ${remoteParentPath}`);

            const { url } = await this.mediaStorage.uploadFile({
            file: {
                name: (relativePath),
                data: fileData,
                uri: relativePath,
                mimetype,
            },
            uploadPath: basePath,
            parentPathIds: remoteParentPaths,
            });

            // Log.info(`File uploaded successfully: ${relativePath} to ${url}`);
            resultSummary[relativePath] = { url, size: fileData.length };
        } 
    }

    public getFolderSummary(): Map<string, FolderStats> {
        return this.folderSummary;
    }

    public addFolderStats(folderPath: string, stats: FolderStats): void {
        this.folderSummary = {
            ...this.folderSummary,
            [folderPath]: stats,
        }
    }

}

