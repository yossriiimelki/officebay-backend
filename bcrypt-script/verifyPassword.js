const bcrypt = require('bcrypt');

const hash = '$2b$10$UE6r9MB7Uxi3mmHV8w3G0Os.dRvigxFlhbb95PL4VSqrOb4DWtdN2';
const password = 'admin123';

bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error verifying password:', err);
    return;
  }
  console.log('Password matches hash:', result); // Should be true
});