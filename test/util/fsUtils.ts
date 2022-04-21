import * as fs from 'fs';
import * as path from "path";

export const writeFile = (path: any, data: any, options: any) => {
    return fs.writeFileSync(path, data, options);
}

export const getFilePath = (...pathSegments: string[]) => {
    return path.resolve(...pathSegments);
}

export const makeDir = (path: string) => {
    if (!fs.existsSync(path)) {
        return fs.mkdirSync(path);
    }
}

export const deleteDir = async (path: string) => {
    console.log("delete dir " + path);

    return fs.rmSync(path, {recursive: true, force: true})
}