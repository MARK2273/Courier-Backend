const argon2 = require('argon2');

const email = process.argv[2];
const password = process.argv[3];
const tenantId = process.argv[4] || 'default'; // Optional tenant ID, defaults to 'default'

if (!email || !password) {
  console.error('Usage: node generate_user.js <email> <password> [tenant_id]');
  process.exit(1);
}

argon2.hash(password).then(hash => {
  console.log('\nCopy and run this SQL in Supabase:\n');
  console.log(`INSERT INTO users (email, password, tenant_id) VALUES ('${email}', '${hash}', '${tenantId}');`);
  console.log('\n');
}).catch(err => {
  console.error(err);
});
