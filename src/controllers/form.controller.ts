import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const shipmentSchema = z.object({
  sender_name: z.string(),
  sender_address: z.string(),
  receiver_name: z.string(),
  receiver_address: z.string(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  origin: z.string(),
  destination: z.string(),
  box_count: z.preprocess((val) => Number(val), z.number()), // Handle string numbers
  packages: z.array(z.any()), // JSONB
});

export const createShipment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const data = shipmentSchema.parse(req.body);

    const { data: shipment, error } = await supabase
      .from('shipments')
      .insert({ ...data, user_id: userId })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ message: 'Failed to create shipment', error: error.message });
    }

    res.status(201).json(shipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    console.error('Shipment creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getMyShipments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { data: shipments, error } = await supabase
      .from('shipments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ message: 'Failed to fetch shipments', error: error.message });
    }

    res.json(shipments);
  } catch (error) {
    console.error('Fetch shipments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
