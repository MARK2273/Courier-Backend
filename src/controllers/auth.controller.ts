import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { verifyPassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1), // Allow any length for now, though min 6 is good practice
});

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
