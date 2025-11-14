import { UploadedFile as ExpressFile } from "express-fileupload";

export type Asset = {
    id: string;
    path: string;
    encodedPath?: string;
    url: string;
    downloadUrl?: string;
    expectedHash?: string;
    totalSize?: number;
}


export type FolderStats = {
  count: number;
  size: number;
};

export type UploadObject = {
    assetFolderName: string;
    relativePath: string;
    parentPathIds?: string[];
    fileData: Buffer;
    mimetype: string;
    resultSummary?: ResultSummary;
}



export type ResultSummary = {
  [key: string]: {
    url: string;
    size: number;
  };
};
export type FileWithPath = ExpressFile & {
    relativePath?: string;
};
