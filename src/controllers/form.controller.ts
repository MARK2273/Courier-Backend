import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const shipmentSchema = z.object({
  header: z.object({
    awbNo: z.string().optional(),
    origin: z.string(),
    destination: z.string(),
    date: z.string().optional(),
    invoiceNo: z.string().optional(),
    invoiceDate: z.string().optional(),
    boxNumber: z.preprocess((val) => String(val), z.string()), // Ensure string
    serviceDetails: z.string().optional(),
    serviceId: z.string().uuid().optional(),
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

const generateAwbNo = async () => {
  // Get all AWB numbers that are numeric to find the true maximum
  const { data, error } = await supabase
    .from('shipments')
    .select('awb_no')
    .not('awb_no', 'is', null);

  if (error) {
    console.error('Error fetching AWBs:', error);
    throw new Error('Could not generate AWB number');
  }

  const baseNumber = BigInt(102458);
  
  if (!data || data.length === 0) {
    return baseNumber.toString();
  }

  // Filter for numeric AWBs and find the maximum using BigInt
  let maxNumber = baseNumber;
  let foundNumeric = false;

  for (const row of data) {
    if (row.awb_no && /^\d+$/.test(row.awb_no)) {
      try {
        const currentNumber = BigInt(row.awb_no);
        if (!foundNumeric || currentNumber > maxNumber) {
          maxNumber = currentNumber;
          foundNumeric = true;
        }
      } catch (e) {
        // Skip invalid BigInt strings
      }
    }
  }

  // If no numeric AWBs were found (unlikely), return baseNumber
  // Otherwise, return maxNumber + 1
  return (foundNumeric ? maxNumber + BigInt(1) : baseNumber).toString();
};

export const createShipment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId || !tenantId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const data = shipmentSchema.parse(req.body);

    // Map frontend camelCase to DB snake_case
    const dbData = {
      user_id: userId,
      tenant_id: tenantId,
      
      // Header
      awb_no: await generateAwbNo(),
      origin: data.header.origin,
      destination: data.header.destination,
      invoice_number: data.header.invoiceNo,
      invoice_date: data.header.invoiceDate ? new Date(data.header.invoiceDate) : null,
      shipment_date: data.header.date ? new Date(data.header.date) : null,
      service_details: data.header.serviceDetails,
      service_id: data.header.serviceId,
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
      .select('*, services(name, tracking_url_template)', { count: 'exact' }) // Get total count for pagination
      .eq('user_id', userId)
      .eq('is_deleted', false)
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
      .select('billing_amount')
      .eq('user_id', userId)
      .eq('is_deleted', false);
    
    // Apply same search filter to revenue calculation if search exists
    if (search) {
      const searchTerm = `%${search}%`;
      revenueQuery = revenueQuery.or(`awb_no.ilike.${searchTerm},sender_name.ilike.${searchTerm},receiver_name.ilike.${searchTerm},origin.ilike.${searchTerm},destination.ilike.${searchTerm}`);
    }

    const { data: revenueData, error: revenueError } = await revenueQuery;
    
    const totalRevenue = revenueData 
      ? revenueData.reduce((sum, item) => sum + (item.billing_amount || 0), 0 ) 
      : 0;

    // Map nested services.name to service property for frontend compatibility
    const mappedShipments = shipments?.map(shipment => {
      const serviceData = (shipment as any).services;
      const trackingUrlTemplate = serviceData?.tracking_url_template;
      const trackingUrl = trackingUrlTemplate && shipment.service_details
        ? trackingUrlTemplate.replace('{{id}}', shipment.service_details)
        : null;

      const mapped = {
        ...shipment,
        service: serviceData?.name || null,
        tracking_url: trackingUrl
      };
      delete (mapped as any).services;
      return mapped;
    });

    res.json({
      data: mappedShipments,
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

export const getShipmentById = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { id } = req.params;

    const { data: shipment, error } = await supabase
      .from('shipments')
      .select('*, services(name, tracking_url_template)')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();

    if (error || !shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const serviceData = (shipment as any).services;
    const trackingUrlTemplate = serviceData?.tracking_url_template;
    const trackingUrl = trackingUrlTemplate && shipment.service_details
      ? trackingUrlTemplate.replace('{{id}}', shipment.service_details)
      : null;

    // Map nested services.name to service property for frontend compatibility
    const responseData = {
      ...shipment,
      service: serviceData?.name || null,
      tracking_url: trackingUrl
    };
    delete (responseData as any).services;

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteShipment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId || !tenantId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { id } = req.params;

    // First check if shipment exists and belongs to the user/tenant
    const { data: existing, error: fetchError } = await supabase
      .from('shipments')
      .select('tenant_id')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    // Double check tenant isolation (though eq('user_id', userId) should be enough)
    if (existing.tenant_id !== tenantId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Perform soft delete
    const { error: updateError } = await supabase
      .from('shipments')
      .update({ is_deleted: true })
      .eq('id', id);

    if (updateError) {
      console.error('Supabase error:', updateError);
      return res.status(500).json({ message: 'Failed to delete shipment', error: updateError.message });
    }

    res.json({ message: 'Shipment deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateShipment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;
    if (!userId || !tenantId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { id } = req.params;
    const data = shipmentSchema.parse(req.body);

    // Verify ownership and existence
    const { data: existing, error: fetchError } = await supabase
      .from('shipments')
      .select('tenant_id')
      .eq('id', id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    if (existing.tenant_id !== tenantId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Map frontend camelCase to DB snake_case
    const dbData = {
      // Header
      // awb_no: data.header.awbNo, // REMOVED: AWB must not be updated
      origin: data.header.origin,
      destination: data.header.destination,
      invoice_number: data.header.invoiceNo,
      invoice_date: data.header.invoiceDate ? new Date(data.header.invoiceDate) : null,
      shipment_date: data.header.date ? new Date(data.header.date) : null,
      service_details: data.header.serviceDetails,
      service_id: data.header.serviceId,
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

    const { data: updated, error: updateError } = await supabase
      .from('shipments')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase error:', updateError);
      return res.status(500).json({ message: 'Failed to update shipment', error: updateError.message });
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.issues });
    }
    console.error('Update shipment error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
