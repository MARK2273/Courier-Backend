import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { verifyPassword } from '../utils/hash';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().optional(), // Optional for backward compatibility, but enforced logic below
});

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, tenantId } = loginSchema.parse(req.body);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check Tenant Access
    if (tenantId && user.tenant_id !== tenantId) {
       return res.status(403).json({ message: `Access denied.` });
    }

    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, tenant_id: user.tenant_id },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    res.json({ token, user: { id: user.id, email: user.email, tenant_id: user.tenant_id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
