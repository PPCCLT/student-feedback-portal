import 'dotenv/config';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

console.log('--- ENV CHECK ---');
try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    console.log('Content of .env:');
    console.log(envContent);
} catch (e) {
    console.log('Could not read .env:', e.message);
}

const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24);
console.log('SESSION_TTL_SECONDS value:', SESSION_TTL_SECONDS);
console.log('Type:', typeof SESSION_TTL_SECONDS);

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-insecure-secret-change-me';

try {
    console.log('Attempting to sign token...');
    const token = jwt.sign({ department: 'Super Admin' }, ADMIN_JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
    console.log('Token signed successfully:', token);
} catch (e) {
    console.error('Error signing token:', e);
}
