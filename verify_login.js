const argon2 = require('argon2');

const password = 'Shalibhadra@1234';
const hash = '$argon2id$v=19$m=65536,t=3,p=4$s/EhQRg9e4LHAprqRXFlnA$wSRg1KrJA/LWrNdVXwN2B4blOOeCbIf5+EZ0KNlq+fA';

console.log('Verifying...');
console.log('Password:', password);
console.log('Hash:', hash);

argon2.verify(hash, password).then(match => {
  if (match) {
    console.log('SUCCESS: Password matches hash!');
  } else {
    console.log('FAILURE: Password does NOT match hash.');
  }
}).catch(err => {
  console.error('Error:', err);
});
