import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const getServices = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ message: 'Tenant ID not found' });
    }

    const { data: services, error } = await supabase
      .from('services')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error fetching services:', error);
      return res.status(500).json({ message: 'Failed to fetch services', error: error.message });
    }

    res.json(services);
  } catch (error) {
    console.error('Fetch services error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
