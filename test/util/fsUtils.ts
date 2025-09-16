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

export function createFileFromPath(filePath: string, type: string, filename?: string): any {
    const resolvedPath = path.resolve(__dirname, filePath);
    if (!fs.existsSync(resolvedPath)) {
        throw new Error(`File does not exist at path: ${resolvedPath}`);
    }
    const name = filename || path.basename(filePath);
    const data = fs.readFileSync(resolvedPath);
    return {
        name,
        type: type,
        size: fs.statSync(resolvedPath).size,
        path: resolvedPath,
        stream: () => fs.createReadStream(resolvedPath),
        data,
        [Symbol.toStringTag]: 'File',
    };
}
