const bcrypt = require('bcrypt');

bcrypt.hash('admin123', 10, (error, newHash) => {
  if (error) {
    console.error('Error generating hash:', error);
    return;
  }
  console.log('New hash for admin123:', newHash);
});