import 'dotenv/config';

console.log('Raw SESSION_TTL_SECONDS:', process.env.SESSION_TTL_SECONDS);
console.log('Number convert:', Number(process.env.SESSION_TTL_SECONDS));
console.log('Default fallback:', Number(process.env.SESSION_TTL_SECONDS || 60 * 60 * 24));
console.log('ADMIN_JWT_SECRET:', process.env.ADMIN_JWT_SECRET);
