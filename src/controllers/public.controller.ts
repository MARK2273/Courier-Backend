import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const trackShipment = async (req: Request, res: Response) => {
  try {
    const { awb } = req.params;
    const { tenant } = req.query; // This will be the slug like 'shalibhadra'

    if (!awb) {
      return res.status(400).json({ message: 'AWB number is required' });
    }

    if (!tenant) {
      return res.status(400).json({ message: 'Tenant identifier is required' });
    }

    // 1. Get the tenant UUID from the slug
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('tenant_id', tenant as string)
      .single();

    if (tenantError || !tenantData) {
      return res.status(404).json({ message: 'Invalid tenant identifier' });
    }

    const tenantUuid = tenantData.id;

    // 2. Query shipment within that tenant
    const { data: shipment, error } = await supabase
      .from('shipments')
      .select('*, services(name, tracking_url_template)')
      .eq('awb_no', awb)
      .eq('tenant_id', tenantUuid)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !shipment) {
      return res.status(404).json({ message: 'No shipment found with this tracking number in your organization' });
    }

    const serviceData = (shipment as any).services;
    const trackingUrlTemplate = serviceData?.tracking_url_template;

    if (!trackingUrlTemplate) {
      return res.status(400).json({
        message: 'No tracking template available for this service',
        service: serviceData?.name || 'Unknown'
      });
    }

    if (!shipment.service_details) {
      return res.status(400).json({
        message: 'No tracking information available for this shipment',
        service: serviceData?.name
      });
    }

    const trackingUrl = trackingUrlTemplate.replace('{{id}}', shipment.service_details);

    res.json({
      awb_no: shipment.awb_no,
      service: serviceData?.name,
      tracking_url: trackingUrl
    });

  } catch (error) {
    console.error('Public tracking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getHsCodes = async (req: Request, res: Response) => {
  try {
    const { data: hsCodes, error } = await supabase
      .from('hs_codes')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching HS codes:', error);
      return res.status(500).json({ message: 'Failed to fetch HS codes' });
    }

    res.json(hsCodes);
  } catch (error) {
    console.error('HS codes fetch error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const viewShipmentPdf = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const redirectToError = (type: string) => {
    return res.redirect(`${frontendUrl}/document-error?type=${type}`);
  };

  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id as string)) {
      return redirectToError('invalid');
    }

    const { data: shipment, error } = await supabase
      .from('shipments')
      .select('pdf_url')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (error || !shipment) {
      return redirectToError('not-found');
    }

    if (!shipment.pdf_url) {
      return redirectToError('pending');
    }

    // Redirect to the actual Supabase Storage URL
    res.redirect(shipment.pdf_url);
  } catch (error) {
    console.error('View shipment PDF error:', error);
    return redirectToError('error');
  }
};
