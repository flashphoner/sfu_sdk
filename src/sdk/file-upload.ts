let FormDataImpl: any;
let isNode: boolean;

isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node;
if (isNode) {
    FormDataImpl = require('form-data');
} else {
    FormDataImpl = globalThis.FormData;
}

export async function uploadFile(options: { url: string; file: any }): Promise<string> {
    const formData = new FormDataImpl();
    let headers: Record<string, string> = {};

    if (isNode) {
        if (!options.file.stream || typeof options.file.stream !== 'function') {
            throw new Error('File object must have a valid stream function for Node.js');
        }
        const stream = options.file.stream();
        if (!stream || typeof stream.pipe !== 'function') {
            throw new Error('Invalid stream provided for file upload in Node.js');
        }
        formData.append('file', stream, {
            filename: options.file.name,
            contentType: options.file.type || 'application/octet-stream',
        });
        headers = formData.getHeaders();
    } else {
        const fileData = options.file.data ? new globalThis.File([options.file.data], options.file.name, { type: options.file.type }) : options.file;
        formData.append('file', fileData, options.file.name);
    }

    const response = await fetch(options.url, {
        method: 'POST',
        body: formData,
        headers,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
    }

    const responseJson = await response.json();
    return responseJson.url;
}
