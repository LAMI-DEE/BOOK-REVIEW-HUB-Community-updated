import bcrypt from 'bcrypt';

const hashPassword = async () => {
  const plainPassword = 'adminpass';
  const saltRounds = 10;

  try {
    const hashed = await bcrypt.hash(plainPassword, saltRounds);
    console.log('Hashed password for adminpass:\n', hashed);
  } catch (err) {
    console.error('Error hashing password:', err);
  }
};

hashPassword();


//Hashed password for adminpass:
// $2b$10$m5vEscBZc30C5XKZ4Zt.SOkthA22iDZHbjiBsu1iIssY5Do3EoXEi