import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const shipmentSchema = z.object({
  header: z.object({
    service: z.string().optional(),
    awbNo: z.string().optional(),
    origin: z.string(),
    destination: z.string(),
    date: z.string().optional(),
    invoiceNo: z.string().optional(),
    invoiceDate: z.string().optional(),
    boxNumber: z.preprocess((val) => String(val), z.string()), // Ensure string
    serviceDetails: z.string().optional(),
  }),
  sender: z.object({
    name: z.string(),
    address: z.string(),
    adhaar: z.string().optional(),
    contact: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }),
  receiver: z.object({
    name: z.string(),
    address: z.string(),
    contact: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
  }),
  routing: z.object({
    portOfLoading: z.string().optional(),
  }),
  items: z.array(z.any()), // JSONB
  other: z.object({
    pcs: z.number().optional(),
    weight: z.string().optional(),
    volumetricWeight: z.string().optional(),
    currency: z.string().optional(),
    totalAmount: z.number().optional(),
    amountInWords: z.string().optional(),
    billingAmount: z.number().optional(),
  }),
});

export const createShipment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const data = shipmentSchema.parse(req.body);

    // Map frontend camelCase to DB snake_case
    const dbData = {
      user_id: userId,
      tenant_id: req.user?.tenant_id,
      
      // Header
      service: data.header.service,
      awb_no: data.header.awbNo,
      origin: data.header.origin,
      destination: data.header.destination,
      invoice_number: data.header.invoiceNo,
      invoice_date: data.header.invoiceDate ? new Date(data.header.invoiceDate) : null,
      shipment_date: data.header.date ? new Date(data.header.date) : null,
      service_details: data.header.serviceDetails,
      box_count: parseInt(data.header.boxNumber) || 1,

      // Sender
      sender_name: data.sender.name,
      sender_address: data.sender.address,
      sender_adhaar: data.sender.adhaar,
      sender_contact: data.sender.contact,
      sender_email: data.sender.email,

      // Receiver
      receiver_name: data.receiver.name,
      receiver_address: data.receiver.address,
      receiver_contact: data.receiver.contact,
      receiver_email: data.receiver.email,

      // Routing
      port_of_loading: data.routing.portOfLoading,

      // Items
      packages: data.items,

      // Other
      pcs: data.other.pcs,
      weight: data.other.weight,
      volumetric_weight: data.other.volumetricWeight,
      currency: data.other.currency,
      total_amount: data.other.totalAmount,
      amount_in_words: data.other.amountInWords,
      billing_amount: data.other.billingAmount,
    };

    const { data: shipment, error } = await supabase
      .from('shipments')
      .insert(dbData)
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('shipments')
      .select('*', { count: 'exact' }) // Get total count for pagination
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply Search Filter if search term exists
    if (search) {
      const searchTerm = `%${search}%`;
      query = query.or(`awb_no.ilike.${searchTerm},sender_name.ilike.${searchTerm},receiver_name.ilike.${searchTerm},origin.ilike.${searchTerm},destination.ilike.${searchTerm}`);
    }

    // Apply Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: shipments, count, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ message: 'Failed to fetch shipments', error: error.message });
    }

    // Calculate Total Revenue (Sum of total_amount for all matching records)
    // Note: optimization - ideally use an RPC function for sum, but fetching just the column is okay for now
    let revenueQuery = supabase
      .from('shipments')
      .select('total_amount')
      .eq('user_id', userId);
    
    // Apply same search filter to revenue calculation if search exists
    if (search) {
      const searchTerm = `%${search}%`;
      revenueQuery = revenueQuery.or(`awb_no.ilike.${searchTerm},sender_name.ilike.${searchTerm},receiver_name.ilike.${searchTerm},origin.ilike.${searchTerm},destination.ilike.${searchTerm}`);
    }

    const { data: revenueData, error: revenueError } = await revenueQuery;
    
    const totalRevenue = revenueData 
      ? revenueData.reduce((sum, item) => sum + (item.total_amount || 0), 0) 
      : 0;

    res.json({
      data: shipments,
      meta: {
        total: count,
        totalRevenue, // Send total revenue
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0,
      }
    });
  } catch (error) {
    console.error('Fetch shipments error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
