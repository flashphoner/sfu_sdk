const isNode = typeof process !== 'undefined' && !!process.versions && !!process.versions.node
    && typeof XMLHttpRequest === 'undefined';

export const UPLOAD_ABORTED = "Attachment upload aborted";
export const UPLOAD_NETWORK_FAILURE = "Attachment upload failed before the server answered";

export type HttpUploadResult = {
    status: number;
    response?: any;
};

export type HttpUploadOptions = {
    url: string;
    body: Blob | ArrayBuffer;
    onProgress?: (uploadedBytes: number) => void;
    stallTimeoutMs?: number;
};

export type HttpUpload = {
    promise: Promise<HttpUploadResult>;
    abort: () => void;
};

export function uploadAttachmentBody(options: HttpUploadOptions): HttpUpload {
    return isNode ? uploadWithNodeHttp(options) : uploadWithXhr(options);
}

function uploadWithXhr(options: HttpUploadOptions): HttpUpload {
    const xhr = new XMLHttpRequest();
    let aborted = false;
    const promise = new Promise<HttpUploadResult>((resolve, reject) => {
        let stallTimer: ReturnType<typeof setTimeout>;
        const stallMs = options.stallTimeoutMs === undefined ? 120000 : options.stallTimeoutMs;
        const rearmStallWatchdog = () => {
            if (!stallMs) {
                return;
            }
            clearTimeout(stallTimer);
            stallTimer = setTimeout(() => {
                aborted = true;
                xhr.abort();
                reject(new Error(UPLOAD_NETWORK_FAILURE));
            }, stallMs);
        };
        xhr.open("PUT", options.url);
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.responseType = "json";
        xhr.upload.onprogress = (event) => {
            /* No progress events follow the last body byte, and a big body may take the server long to answer. */
            if (event.total && event.loaded >= event.total) {
                clearTimeout(stallTimer);
            } else {
                rearmStallWatchdog();
            }
            if (options.onProgress) {
                options.onProgress(event.loaded);
            }
        };
        xhr.onload = () => {
            clearTimeout(stallTimer);
            resolve({status: xhr.status, response: xhr.response});
        };
        xhr.onerror = () => {
            clearTimeout(stallTimer);
            reject(new Error(UPLOAD_NETWORK_FAILURE));
        };
        xhr.onabort = () => {
            clearTimeout(stallTimer);
            reject(new Error(aborted ? UPLOAD_NETWORK_FAILURE : UPLOAD_ABORTED));
        };
        rearmStallWatchdog();
        xhr.send(options.body);
    });
    return {
        promise,
        abort: () => xhr.abort()
    };
}

function uploadWithNodeHttp(options: HttpUploadOptions): HttpUpload {
    /* A static require would drag the node core modules into the browser bundle. */
    // eslint-disable-next-line no-new-func
    const nodeRequire = new Function('name', 'return require(name)');
    const http = nodeRequire('http');
    const https = nodeRequire('https');
    let request: any;
    let aborted = false;
    const promise = new Promise<HttpUploadResult>((resolve, reject) => {
        toBuffer(options.body).then((buffer) => {
            if (aborted) {
                reject(new Error(UPLOAD_ABORTED));
                return;
            }
            const link = new URL(options.url);
            const transport = link.protocol === 'https:' ? https : http;
            request = transport.request(link, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': buffer.length
                }
            }, (response: any) => {
                const parts: any[] = [];
                response.on('data', (part: any) => parts.push(part));
                response.on('end', () => {
                    let parsed;
                    try {
                        parsed = JSON.parse(Buffer.concat(parts).toString('utf8'));
                    } catch (e) {
                        parsed = undefined;
                    }
                    resolve({status: response.statusCode, response: parsed});
                });
                response.on('error', () => reject(new Error(aborted ? UPLOAD_ABORTED : UPLOAD_NETWORK_FAILURE)));
                response.on('aborted', () => reject(new Error(aborted ? UPLOAD_ABORTED : UPLOAD_NETWORK_FAILURE)));
            });
            request.on('error', () => reject(new Error(aborted ? UPLOAD_ABORTED : UPLOAD_NETWORK_FAILURE)));
            request.on('close', () => reject(new Error(aborted ? UPLOAD_ABORTED : UPLOAD_NETWORK_FAILURE)));
            request.end(buffer, () => {
                if (options.onProgress) {
                    options.onProgress(buffer.length);
                }
            });
        }).catch(reject);
    });
    return {
        promise,
        abort: () => {
            aborted = true;
            if (request) {
                request.destroy();
            }
        }
    };
}

async function toBuffer(body: Blob | ArrayBuffer): Promise<any> {
    if (body instanceof ArrayBuffer) {
        return Buffer.from(body);
    }
    return Buffer.from(await body.arrayBuffer());
}
