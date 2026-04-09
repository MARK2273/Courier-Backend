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
    console.log(`[AUTH] Login attempt: ${email} for tenant slug: ${tenantId}`);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      console.log(`[AUTH] User not found or error: ${email}`);
      if (error) {
        console.error(`[AUTH] Supabase Error Detail:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check Tenant Access
    if (tenantId) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id, tenant_id')
        .eq('tenant_id', tenantId)
        .single();

      if (tenantError || !tenant) {
        console.log(`[AUTH] Tenant slug not found: ${tenantId}`);
        return res.status(403).json({ message: `Access denied. Tenant '${tenantId}' not found.` });
      }

      console.log(`[AUTH] Comparing User Tenant ID (${user.tenant_id}) with Resolved Tenant ID (${tenant.id})`);
      if (user.tenant_id !== tenant.id) {
        console.log(`[AUTH] Tenant mismatch for user ${email}`);
        return res.status(403).json({ message: `Access denied. User does not belong to tenant '${tenantId}'.` });
      }
    }

    const isValid = await verifyPassword(user.password, password);
    if (!isValid) {
      console.log(`[AUTH] Invalid password for: ${email}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log(`[AUTH] Login successful: ${email}`);
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        tenant_id: user.tenant_id,
        can_show_tax: user.can_show_tax
      },
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' }
    );

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        tenant_id: user.tenant_id,
        can_show_tax: user.can_show_tax
      } 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const verifyOwnerPassword = async (req: Request, res: Response) => {
  try {
    const { password } = z.object({ password: z.string() }).parse(req.body);
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('owner_password')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const isValid = await verifyPassword(tenant.owner_password, password);
    if (isValid) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid owner password' });
    }
  } catch (error) {
    console.error('[AUTH] Owner verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
