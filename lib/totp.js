// Thin wrapper around otplib v13 (async, functional API)
import { generateSecret, generate, verify, generateURI } from 'otplib';

export const createSecret = () => generateSecret();

export const otpauthUri = (username, secret) =>
    generateURI({ issuer: 'Student Portal', label: username, secret });

export async function verifyCode(secret, token) {
    try {
        const result = await verify({ secret, token, epochTolerance: 30 });
        return typeof result === 'boolean' ? result : !!result?.valid;
    } catch {
        return false;
    }
}

export const generateCode = (secret) => generate({ secret });
