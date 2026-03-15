import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || twilioNumber;

// Initialize Twilio client only if credentials exist
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Formats a raw contact number into E.164 format.
 */
const formatPhoneNumber = (contactNumber: string): string | null => {
  if (!contactNumber) return null;
  const cleaned = contactNumber.replace(/\s+/g, '');
  if (cleaned === '+91' || cleaned.length < 5) return null;
  return cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
};

/**
 * Core utility function to send an SMS using Twilio.
 * 
 * @param contactNumber The destination phone number.
 * @param messageBody The content of the SMS.
 */
export const sendSMS = async (contactNumber: string, messageBody: string): Promise<boolean> => {
  if (!client || !twilioNumber) {
    console.warn("Twilio credentials not configured in environment. Skipping SMS notification.");
    return false;
  }

  const to = formatPhoneNumber(contactNumber);
  if (!to) {
    console.warn("Invalid contact number provided for SMS notification.");
    return false;
  }

  try {
    const message = await client.messages.create({
      body: messageBody,
      from: twilioNumber,
      to,
    });

    console.log(`SMS sent successfully to ${to}. SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    return false;
  }
};

/**
 * Core utility function to send a WhatsApp message using Twilio.
 * 
 * @param contactNumber The destination phone number.
 * @param messageBody The content of the WhatsApp message.
 */
export const sendWhatsApp = async (contactNumber: string, messageBody: string): Promise<boolean> => {
  if (!client || !twilioNumber) {
    console.warn("Twilio credentials not configured in environment. Skipping WhatsApp notification.");
    return false;
  }

  const formattedNumber = formatPhoneNumber(contactNumber);
  if (!formattedNumber) {
    console.warn("Invalid contact number provided for WhatsApp notification.");
    return false;
  }

  const from = `whatsapp:${whatsappNumber}`;
  const to = `whatsapp:${formattedNumber}`;

  try {
    const message = await client.messages.create({
      body: messageBody,
      from,
      to,
    });

    console.log(`WhatsApp message sent successfully to ${to}. SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`Failed to send WhatsApp message to ${to}:`, error);
    return false;
  }
};

/**
 * Sends an SMS notification to the sender when their shipment is generated.
 */
export const sendShipmentNotificationSMS = async (
  contactNumber: string,
  awbNo: string,
  billingAmount: number,
  redirectLink: string
): Promise<boolean> => {
  const messageBody = `Shipment ${awbNo} generated. View your invoice here: ${redirectLink}`;
  return sendSMS(contactNumber, messageBody);
};

/**
 * Sends a WhatsApp notification to the sender when their shipment is generated.
 */
export const sendShipmentNotificationWhatsApp = async (
  contactNumber: string,
  awbNo: string,
  billingAmount: number,
  redirectLink: string
): Promise<boolean> => {
  const messageBody = `Shipment ${awbNo} generated. View your invoice here: https://cdteswhaqnawrpvivwmo.supabase.co/storage/v1/object/public/shipment-pdfs/a5c4df70-ca49-42d8-8e06-6e09e0ee244c/1773573623800.pdf`;
  // const messageBody = `Shipment ${awbNo} generated. View your invoice here: ${redirectLink}`;
  return sendWhatsApp(contactNumber, messageBody);
};
