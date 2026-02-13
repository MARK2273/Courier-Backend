import argon2 from 'argon2';

export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password);
};

export const verifyPassword = async (hash: string, plain: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch (err) {
    console.error('Error verifying password:', err);
    return false;
  }
};
