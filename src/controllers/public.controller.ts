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
      .eq('tenant_id', tenant)
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
