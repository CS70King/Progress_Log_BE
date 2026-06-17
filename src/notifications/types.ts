export type NotificationRecipient = {
  phoneNumber: string;
  country?: string;
  firstName?: string;
  lastName?: string;
};

export type SendSmsInput = {
  recipient: NotificationRecipient;
  body: string;
  metadata?: Record<string, string>;
};

export type NotificationProvider = {
  sendSms(input: SendSmsInput): Promise<void>;
};
