import * as crypto from 'crypto';

export async function generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair(
            'rsa',
            {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem',
                },
            },
            (err, publicKey, privateKey) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ publicKey, privateKey });
                }
            }
        );
    });
}

export function privateKeyToString(privateKey: crypto.KeyObject): string {
    return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString('utf8');
}

export function encryptPrivateKey(privateKey: string, password: string): string {
    const key = crypto.createHash('sha256').update(password).digest();
    const cipher = crypto.createCipheriv('aes-256-ecb', key, null); // Использование AES-256-ECB без IV (небезопасно. используется для тестов)

    const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
    return encrypted.toString('base64');
}

export function decryptPrivateKey(encryptedKey: string, password: string): string {
    const key = crypto.createHash('sha256').update(password).digest();
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null); // Использование AES-256-ECB без IV (небезопасно. используется для тестов)

    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedKey, 'base64')), decipher.final()]);
    return decrypted.toString('utf8');
}

export function encryptWithPublicKey(publicKey: string, data: string): string {
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        Buffer.from(data, 'utf8')
    );
    return encrypted.toString('base64');
}

export function decryptWithPrivateKey(privateKey: string, encryptedData: string): string {
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        },
        Buffer.from(encryptedData, 'base64')
    );
    return decrypted.toString('utf8');
}
