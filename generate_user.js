const argon2 = require('argon2');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node generate_user.js <email> <password>');
  process.exit(1);
}

argon2.hash(password).then(hash => {
  console.log('\nCopy and run this SQL in Supabase:\n');
  console.log(`INSERT INTO users (email, password) VALUES ('${email}', '${hash}');`);
  console.log('\n');
}).catch(err => {
  console.error(err);
});
