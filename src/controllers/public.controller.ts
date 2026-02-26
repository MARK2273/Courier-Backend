import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const trackShipment = async (req: Request, res: Response) => {
  try {
    const { awb } = req.params;

    if (!awb) {
      return res.status(400).json({ message: 'AWB number is required' });
    }

    const { data: shipment, error } = await supabase
      .from('shipments')
      .select('*, services(name, tracking_url_template)')
      .eq('awb_no', awb)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !shipment) {
      return res.status(404).json({ message: 'No shipment found with this tracking number' });
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
