import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client only if credentials exist
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

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

  // Clean number by removing any spaces
  const cleanedContactNumber = contactNumber.replace(/\s+/g, '');

  // Ensure contact number is formatted correctly (e.g., E.164 string with +91 or other country code)
  const to = cleanedContactNumber.startsWith('+') ? cleanedContactNumber : `+91${cleanedContactNumber}`;

  try {
    const message = await client.messages.create({
      body: messageBody,
      from: twilioNumber,
      to,
    });
    console.log(message)
    
    console.log(`SMS sent successfully to ${to}. SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    return false;
  }
};

/**
 * Sends an SMS notification to the sender when their shipment is generated.
 * 
 * @param contactNumber The destination phone number. Must be verified in Twilio for trial accounts.
 * @param awbNo AWB number of the shipment
 * @param billingAmount Total billing amount of the shipment
 * @param pdfLink Frontend URL pointing to the shipment details/invoice page
 */
export const sendShipmentNotificationSMS = async (
  contactNumber: string,
  awbNo: string,
  billingAmount: number,
  pdfLink: string
): Promise<boolean> => {
  const messageBody = `View your invoice here: ${pdfLink}`;
  return sendSMS(contactNumber, messageBody);
};
