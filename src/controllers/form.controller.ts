import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase';
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
    paymentType: z.enum(['Cash', 'Online']),
    selectedUpiId: z.string().uuid().optional().nullable(),
    ownerCost: z.number().optional().default(0),
  }),
});

const getFinancialYear = (date: Date = new Date()) => {
  const month = date.getMonth(); // 0 is January, 3 is April
  const year = date.getFullYear();
  const fyStart = month >= 3 ? year : year - 1;
  const fyEnd = fyStart + 1;
  // Format as YYYYyy (e.g., 202526)
  return `${fyStart}${fyEnd.toString().slice(-2)}`;
};

const generateAwbNo = async () => {
  const currentFy = getFinancialYear();
  const prefix = currentFy;
  const baseSequence = BigInt(1);

  // Get ALL AWB numbers to find the max for the CURRENT financial year
  const { data, error } = await supabase
    .from('shipments')
    .select('awb_no')
    .like('awb_no', `${prefix}%`)
    .not('awb_no', 'is', null);

  if (error) {
    console.error('Error fetching AWBs:', error);
    throw new Error('Could not generate AWB number');
  }

  if (!data || data.length === 0) {
    return `${prefix}${baseSequence.toString().padStart(6, '0')}`;
  }

  // Extract sequence numbers and find max
  let maxSeq = BigInt(0);
  for (const row of data) {
    if (row.awb_no && row.awb_no.startsWith(prefix)) {
      try {
        // Extract sequence part (everything after prefix)
        const seqStr = row.awb_no.slice(prefix.length);
        if (seqStr) {
          const seq = BigInt(seqStr);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      } catch (e) { }
    }
  }

  const nextSeq = maxSeq === BigInt(0) ? baseSequence : maxSeq + BigInt(1);

  return `${prefix}${nextSeq.toString().padStart(6, '0')}`;
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
      payment_type: data.other.paymentType,
      selected_upi_id: data.other.paymentType === 'Cash' ? null : data.other.selectedUpiId,
      owner_cost: data.other.ownerCost || 0,
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
      query = query.or(`awb_no.ilike.${searchTerm},sender_name.ilike.${searchTerm},receiver_name.ilike.${searchTerm},origin.ilike.${searchTerm},destination.ilike.${searchTerm},sender_contact.ilike.${searchTerm}`);
    }

    // Apply Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: shipments, count, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ message: 'Failed to fetch shipments', error: error.message });
    }

    // Calculate Comparative Stats (Monthly)
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    let revenueQuery = supabase
      .from('shipments')
      .select('billing_amount, owner_cost, shipment_date')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    // Apply same search filter to revenue calculation if search exists
    if (search) {
      const searchTerm = `%${search}%`;
      revenueQuery = revenueQuery.or(`awb_no.ilike.${searchTerm},sender_name.ilike.${searchTerm},receiver_name.ilike.${searchTerm},origin.ilike.${searchTerm},destination.ilike.${searchTerm},sender_contact.ilike.${searchTerm},receiver_contact.ilike.${searchTerm}`);
    }

    const { data: revenueData, error: revenueError } = await revenueQuery;

    let totalRevenue = 0;
    let totalOwnerCost = 0;
    let thisMonthRevenue = 0;
    let thisMonthCost = 0;
    let lastMonthRevenue = 0;
    let lastMonthCost = 0;

    if (revenueData) {
      revenueData.forEach(item => {
        const amount = item.billing_amount || 0;
        const cost = item.owner_cost || 0;
        const date = item.shipment_date ? new Date(item.shipment_date) : null;

        totalRevenue += amount;
        totalOwnerCost += cost;

        if (date) {
          if (date >= startOfThisMonth) {
            thisMonthRevenue += amount;
            thisMonthCost += cost;
          } else if (date >= startOfLastMonth && date <= endOfLastMonth) {
            lastMonthRevenue += amount;
            lastMonthCost += cost;
          }
        }
      });
    }

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
        totalRevenue,
        totalOwnerCost,
        thisMonthRevenue,
        thisMonthCost,
        lastMonthRevenue,
        lastMonthCost,
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
      .select('*, services(name, tracking_url_template), upi_configs(upi_id, payee_name, display_name)')
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

    const upiConfig = (shipment as any).upi_configs;

    // Map nested services.name to service property for frontend compatibility
    const responseData = {
      ...shipment,
      service: serviceData?.name || null,
      tracking_url: trackingUrl,
      upi_details: upiConfig || null
    };
    delete (responseData as any).services;
    delete (responseData as any).upi_configs;

    res.json(responseData);
  } catch (error) {
    console.error('Get shipment by ID error:', error);
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
    console.error('Delete shipment error:', error);
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
      origin: data.header.origin,
      destination: data.header.destination,
      invoice_number: data.header.invoiceNo,
      invoice_date: data.header.invoiceDate ? new Date(data.header.invoiceDate) : null,
      shipment_date: data.header.date ? new Date(data.header.date) : null,
      service_details: data.header.serviceDetails,
      service_id: data.header.serviceId,
      box_count: parseInt(data.header.boxNumber) || 1,

      sender_name: data.sender.name,
      sender_address: data.sender.address,
      sender_adhaar: data.sender.adhaar,
      sender_contact: data.sender.contact,
      sender_email: data.sender.email,

      receiver_name: data.receiver.name,
      receiver_address: data.receiver.address,
      receiver_contact: data.receiver.contact,
      receiver_email: data.receiver.email,

      port_of_loading: data.routing.portOfLoading,
      packages: data.items,

      pcs: data.other.pcs,
      weight: data.other.weight,
      volumetric_weight: data.other.volumetricWeight,
      currency: data.other.currency,
      total_amount: data.other.totalAmount,
      amount_in_words: data.other.amountInWords,
      billing_amount: data.other.billingAmount,
      payment_type: data.other.paymentType,
      selected_upi_id: data.other.paymentType === 'Cash' ? null : data.other.selectedUpiId,
      owner_cost: data.other.ownerCost || 0,
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

export const getUpiConfigs = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { data, error } = await supabase
      .from('upi_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching UPI configs:', error);
      return res.status(500).json({ message: 'Error fetching UPI configurations' });
    }

    let defaultUpiId: string | null = null;
    if (data && data.length > 0) {
      defaultUpiId = data[0].id;
    }

    return res.status(200).json({ configs: data, defaultUpiId });
  } catch (error) {
    console.error('Error in getUpiConfigs:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
export const uploadPdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const bucketName = process.env.SUPABASE_PDF_BUCKET || 'shipment-pdfs';
    const filePath = `${id}/${Date.now()}.pdf`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase Storage Error:', uploadError);
      return res.status(500).json({ message: 'Failed to upload PDF to storage', error: uploadError.message });
    }

    // Get Public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // Update Shipment in DB
    const { error: dbError } = await supabase
      .from('shipments')
      .update({ pdf_url: publicUrl })
      .eq('id', id);

    if (dbError) {
      console.error('Database Update Error:', dbError);
      return res.status(500).json({ message: 'Failed to update shipment with PDF URL', error: dbError.message });
    }

    const redirectUrl = `${req.protocol}://${req.get('host')}/api/public/shipment-pdf/${id}`;

    res.json({ 
      message: 'PDF uploaded successfully', 
      url: publicUrl,
      redirectUrl: redirectUrl
    });
  } catch (error: any) {
    console.error('Upload Controller Error:', error);
    res.status(500).json({ message: 'Internal server error during PDF upload', error: error.message });
  }
};
