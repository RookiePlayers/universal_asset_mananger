import { Asset } from "./types";


export interface IAssetDatabase {
    saveToDatabase({ assets }: { assets: Asset[]; }): Promise<void>;
    doesAssetPathAlreadyExist(path: string): Promise<boolean>;
}
